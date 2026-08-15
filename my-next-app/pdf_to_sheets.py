# pdf_to_sheets.py
# Run manually each semester: python pdf_to_sheets.py "path/to/new_timetable.pdf"
# Dry run (no Google credentials needed, writes per-day CSVs you can eyeball):
#   python pdf_to_sheets.py "timetable.pdf" --preview preview_csvs
#
# Requires: pip install pdfplumber pymupdf google-api-python-client google-auth
#
# How extraction works (and why it is NOT simple per-cell text clipping):
#
# This PDF is a rendered HTML table. Each cell's text is drawn as ONE text
# object, but long entries visually overflow their ruled cell and the PDF
# clips the overflow out of sight (e.g. "...Syed Farooq Ahmed" is visible,
# "Zaidi, 38 st" is hidden under the next row). Worse, when a row is split
# by a page break, the whole row is re-drawn INVISIBLY at the top of the
# next page, interleaved line-by-line with the first real row's text.
# Naive geometric clipping (the old approach) therefore truncated entries,
# prepended fragments of the row above, and duplicated page-break rows --
# about a third of all cells came out wrong.
#
# The fix relies on two facts about the content stream:
#   1. PyMuPDF's get_texttrace() returns each drawn text object as one
#      complete span in draw order -- so every timetable entry arrives
#      whole (including its visually clipped tail), with its position.
#   2. Rows are drawn venue-cell first, then their slot entries. The
#      hidden page-break duplicates are drawn BEFORE the first venue of
#      the page, so segmenting the span stream by venue-column spans
#      assigns every entry to the right row and drops the ghosts.
# pdfplumber is still used, but only to detect the ruled grid (row bands
# and column x-ranges, including merged lab cells spanning 3 slots).

import argparse
import csv
import os
import re
import sys

import pdfplumber
import fitz  # PyMuPDF

CREDENTIALS_PATH = "google-credentials.json"   # same service account file already in my-next-app
SHEET_ID = "1MP4MPKE-oNkbmo_GWBHtXIa0mLDW_dxlmhM4oXi55eQ"     # <-- your own sheet, not the university's

DAY_NAMES = {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Same gids your Node service already reads from (timetable.service.js SHEETS array)
DAY_GIDS = {
    "MONDAY": "0",
    "TUESDAY": "1998734114",
    "WEDNESDAY": "1268991958",
    "THURSDAY": "1486082022",
    "FRIDAY": "188030115",
}

# Every real timetable entry starts with a course code like "CS3014,BCS-5K,"
COURSE_RE = re.compile(r"^[A-Z]{2}\d{4},")


# ---------------------------------------------------------------- extraction

def span_records(fitz_page):
    """One record per drawn text object, in content-stream order.

    texttrace concatenates a cell's wrapped lines without spaces
    ("Applied HumanComputer..."), so a space is re-inserted whenever the
    per-char baseline jumps to a new line.
    """
    records = []
    for sp in fitz_page.get_texttrace():
        chars = sp["chars"]
        if not chars:
            continue
        parts = []
        prev_y = None
        for uni, _glyph, origin, _bbox in chars:
            if prev_y is not None and abs(origin[1] - prev_y) > 1.0:
                parts.append("\n")
            parts.append(chr(uni))
            prev_y = origin[1]
        records.append({
            "seq": sp["seqno"],
            "text": "".join(parts),
            "x0": min(c[3][0] for c in chars),
            "y0": min(c[3][1] for c in chars),
            "x1": max(c[3][2] for c in chars),
            "y1": max(c[3][3] for c in chars),
        })
    records.sort(key=lambda r: r["seq"])
    return records


def flatten_entry(text):
    return re.sub(r"\s*\n\s*", " ", text).strip()


def flatten_venue(text):
    # venue names are single-line in the grid; join without inserting spaces
    # so output matches what the sheet has always contained (e.g. "AB1RoomE 1")
    return text.replace("\n", "").strip()


def extract_page(plumber_page, fitz_page, page_label, warnings):
    """Parse one timetable page.

    Returns (header_cells, {row_index: venue}, {(row_index, col): [entries]})
    or None when the page has no table.
    """
    tables = plumber_page.find_tables()
    if not tables:
        return None
    table = max(tables, key=lambda t: (t.bbox[2] - t.bbox[0]) * (t.bbox[3] - t.bbox[1]))
    rows = table.rows
    ncols = len(rows[0].cells)
    table_top, table_bottom = table.bbox[1], table.bbox[3]

    # vertical band of each row (merged cells share the row's band)
    bands = []
    for r in rows:
        bb = next((c for c in r.cells if c), None)
        bands.append((bb[1], bb[3]) if bb else None)
    heights = sorted(b[1] - b[0] for b in bands if b)
    median_h = heights[len(heights) // 2]

    venue_x0, venue_x1 = rows[0].cells[0][0], rows[0].cells[0][2]

    def row_of(y):
        for i, b in enumerate(bands):
            if b and b[0] - 0.5 <= y < b[1] - 0.5:
                return i
        return None

    header_cells = [""] * ncols
    venues = {}          # row_index -> venue text
    grid = {}            # (row_index, col) -> [entry texts]
    current_row = None   # set by the most recent venue span
    ghosts = 0

    for sp in span_records(fitz_page):
        xc = (sp["x0"] + sp["x1"]) / 2
        ri = row_of(sp["y0"] + 1.0)

        # text outside the table area entirely (day title, footers)
        if ri is None and (sp["y1"] < table_top or sp["y0"] > table_bottom + 20):
            continue

        if ri == 0:  # repeated header row
            for ci, cell in enumerate(rows[0].cells):
                if cell and cell[0] <= xc <= cell[2]:
                    header_cells[ci] = (header_cells[ci] + " " + flatten_venue(sp["text"])).strip()
                    break
            continue

        if venue_x0 <= xc <= venue_x1 and ri is not None:
            band = bands[ri]
            if band and (band[1] - band[0]) < median_h * 0.3:
                # venue drawn inside a page-break stub row: hidden duplicate
                warnings.append("%s: dropped ghost venue %r in stub row" % (page_label, sp["text"]))
                current_row = None
                continue
            current_row = ri
            venues.setdefault(ri, flatten_venue(sp["text"]))
            continue

        if current_row is None:
            # drawn before the page's first venue: hidden page-break duplicate
            ghosts += 1
            continue

        target = None
        for ci, cell in enumerate(rows[current_row].cells):
            if ci > 0 and cell and cell[0] <= xc <= cell[2]:
                target = ci
                break
        if target is None:
            warnings.append("%s: no column for entry %r (x=%.0f)" % (page_label, sp["text"][:40], xc))
            continue

        band = bands[current_row]
        if band and not (band[0] - 3 <= sp["y0"] <= band[1] + 3):
            warnings.append("%s row %d: entry starts outside its row band: %r"
                            % (page_label, current_row, sp["text"][:40]))

        entry = flatten_entry(sp["text"])
        if not COURSE_RE.match(entry):
            warnings.append("%s: unusual entry (no course code): %r" % (page_label, entry[:60]))
        grid.setdefault((current_row, target), []).append(entry)

    if ghosts:
        print("  %s: dropped %d hidden page-break duplicate entr%s"
              % (page_label, ghosts, "y" if ghosts == 1 else "ies"))

    return header_cells, venues, grid, ncols


def extract_timetable(pdf_path):
    """Returns ({DAY: (header, [row, ...])}, warnings)."""
    tables = {}
    warnings = []
    fitz_doc = fitz.open(pdf_path)
    with pdfplumber.open(pdf_path) as plumber_pdf:
        current_day = None
        for idx in range(len(fitz_doc)):
            fitz_page = fitz_doc[idx]
            text = (fitz_page.get_text() or "").strip()
            first_line = text.split("\n")[0].strip().upper() if text else ""

            if first_line in DAY_NAMES:
                current_day = first_line
                tables.setdefault(current_day, (None, []))
            elif not (first_line.startswith("VENUE") and current_day):
                current_day = None  # e.g. "Statistics Dashboard"
                continue

            result = extract_page(plumber_pdf.pages[idx], fitz_page,
                                  "page %d (%s)" % (idx + 1, current_day.title()), warnings)
            if result is None:
                warnings.append("page %d: no table found, skipped" % (idx + 1))
                continue

            header_cells, venues, grid, ncols = result
            day_header, day_rows = tables[current_day]
            if day_header is None:
                tables[current_day] = (header_cells, day_rows)
            for ri in sorted(venues):
                row = [venues[ri]] + [""] * (ncols - 1)
                for (r, c), entries in grid.items():
                    if r == ri:
                        row[c] = "\n".join(entries)
                day_rows.append(row)
    fitz_doc.close()
    return {d: (h, r) for d, (h, r) in tables.items() if h is not None}, warnings


# ------------------------------------------------------------------- output

def write_csvs(tables, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for day, (header, rows) in tables.items():
        path = os.path.join(out_dir, day + ".csv")
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(header)
            writer.writerows(rows)
        print("  wrote %d venue rows to %s" % (len(rows), path))


def upload_to_sheets(tables):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)

    meta = service.spreadsheets().get(spreadsheetId=SHEET_ID).execute()
    gid_to_title = {str(s["properties"]["sheetId"]): s["properties"]["title"]
                    for s in meta["sheets"]}

    clear_ranges, data = [], []
    for day, gid in DAY_GIDS.items():
        if day not in tables:
            print("  ⚠️ %s not found in PDF, its tab is left untouched" % day)
            continue
        title = gid_to_title.get(gid)
        if title is None:
            raise ValueError("No sheet tab found for gid %s (%s)" % (gid, day))
        header, rows = tables[day]
        clear_ranges.append("'%s'" % title)
        data.append({"range": "'%s'!A1" % title, "values": [header] + rows})

    # clear first so a shorter semester doesn't leave stale rows at the bottom
    service.spreadsheets().values().batchClear(
        spreadsheetId=SHEET_ID, body={"ranges": clear_ranges}).execute()
    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SHEET_ID,
        body={"valueInputOption": "RAW", "data": data},
    ).execute()

    for item in data:
        print("  wrote %d venue rows to %s" % (len(item["values"]) - 1, item["range"].split("!")[0]))


def main():
    parser = argparse.ArgumentParser(description="FAST-NUCES timetable PDF -> Google Sheets")
    parser.add_argument("pdf", help="path to the timetable PDF")
    parser.add_argument("--preview", metavar="DIR",
                        help="write per-day CSVs to DIR instead of uploading (no Google credentials needed)")
    args = parser.parse_args()

    print("Opening %s ..." % args.pdf)
    tables, warnings = extract_timetable(args.pdf)

    if not tables:
        print("No timetable pages found -- is this the right PDF?")
        sys.exit(1)

    for day, (_header, rows) in tables.items():
        filled = sum(1 for r in rows for c in r[1:] if c)
        print("%s: %d venue rows, %d classes" % (day, len(rows), filled))

    if warnings:
        print("\n⚠️ %d warning(s) -- eyeball these cells against the PDF:" % len(warnings))
        for w in warnings:
            print("  -", w)

    print()
    if args.preview:
        write_csvs(tables, args.preview)
        print("Preview only -- nothing uploaded.")
    else:
        upload_to_sheets(tables)
        print("Done. Now hit your existing POST /sync route as usual.")


if __name__ == "__main__":
    main()
