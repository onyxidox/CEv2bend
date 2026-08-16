const axios = require('axios');

// 🔧 All Computer Engineering sections, 1st through 3rd semester
const TARGET_SECTIONS = [
    "BCE-1A", "BCE-1B",
    "BCE-2A", "BCE-2B",
    "BCE-3A", "BCE-3B"
];

const SHEET_ID = "1MP4MPKE-oNkbmo_GWBHtXIa0mLDW_dxlmhM4oXi55eQ";

const SHEETS = [
  { day: "MONDAY", gid: "0" },
  { day: "TUESDAY", gid: "1998734114" },
  { day: "WEDNESDAY", gid: "1268991958" },
  { day: "THURSDAY", gid: "1486082022" },
  { day: "FRIDAY", gid: "188030115" },
];

// Normalizes a section string for comparison: trims spaces, uppercases
function normalizeSection(s) {
    return (s || "").trim().toUpperCase();
}

async function fetchAllDays() {
    const allSchedule = [];
    console.log("--- STARTING FETCH (COMMA-FORMAT PARSER) ---");

    const targetSet = new Set(TARGET_SECTIONS.map(normalizeSection));

    for (const sheet of SHEETS) {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${sheet.gid}`;
        const day = sheet.day;

        try {
            const res = await axios.get(url);
            let data = res.data;
            data = data.substring(data.indexOf('(') + 1, data.lastIndexOf(')'));
            const parsed = JSON.parse(data);
            const rows = parsed.table.rows;

            console.log(`📄 [${day}] Fetched ${rows.length} rows (gid=${sheet.gid})`);

            // Row 0 is the header row: col 0 = "Venue", cols 1..N = time slots like "8:00-8:50"
            const headerRow = rows[0];
            const timeSlots = headerRow.c.map(c => {
                let v = c?.v || "";
                if (typeof v === "string") v = v.replace(/[–—−]/g, "-").trim();
                return v;
            });

            let lastVenue = "Unknown Venue";
            let dayMatches = 0;

            // Data starts at row index 1 (sheet row 2)
            for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                if (!row || !row.c) continue;

                // Column A (venue) may be blank on merged/continuation rows — carry forward
                const venueCell = row.c[0];
                if (venueCell && venueCell.v && String(venueCell.v).trim() !== "") {
                    lastVenue = String(venueCell.v).trim();
                }
                const venue = lastVenue;

                for (let colIndex = 1; colIndex < row.c.length; colIndex++) {
                    const cell = row.c[colIndex];
                    if (!cell || !cell.v) continue;

                    const cellText = String(cell.v).trim();
                    if (!cellText) continue;

                    // Expected format: "CODE,SECTION, Title, Instructor, NN st"
                    const parts = cellText.split(",").map(p => p.trim()).filter(p => p !== "");
                    if (parts.length < 2) continue; // malformed cell, skip

                    const courseCode = parts[0];
                    const sectionRaw = parts[1];
                    const normalizedSection = normalizeSection(sectionRaw);

                    if (!targetSet.has(normalizedSection)) continue; // not one of our target sections

                    // Everything between section and the last two fields (instructor, seats) is the title
                    // Seats field usually ends in "st" (e.g. "44 st") — strip it if present
                    let instructor = "TBA";
                    let title = courseCode;

                    if (parts.length >= 5) {
                        instructor = parts[parts.length - 2];
                        title = parts.slice(2, parts.length - 2).join(", ");
                    } else if (parts.length === 4) {
                        instructor = parts[3];
                        title = parts[2];
                    } else if (parts.length === 3) {
                        title = parts[2];
                    }

                    const time = timeSlots[colIndex] || "Unknown";

                    allSchedule.push({
                        section: sectionRaw,
                        day,
                        venue,
                        time,
                        instructor,
                        details: `${courseCode} - ${title}`,
                        updatedAt: new Date()
                    });
                    dayMatches++;
                }
            }

            console.log(`✅ [${day}] Matched ${dayMatches} entries for target sections`);

        } catch (err) {
            console.error(`❌ Failed to fetch ${day}:`, err.response ? err.response.status : err.message);
        }
    }

    console.log(`--- FETCH COMPLETE. Found ${allSchedule.length} total entries ---`);
    return allSchedule;
}

module.exports = { fetchAllDays };