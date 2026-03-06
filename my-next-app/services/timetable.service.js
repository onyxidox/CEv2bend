const axios = require('axios');

const TARGET_SECTIONS = [
    "BSCE-2A", 
    "BSCE-2B"
];

const SHEET_ID = "1sivXTIf9JvaqP2k6B7-468SyZXTcOAvKyyVW4HJRxeQ";

const SHEETS = [
  { day: "MONDAY", gid: "212334121" },
  { day: "TUESDAY", gid: "194541049" },
  { day: "WEDNESDAY", gid: "1763686045" },
  { day: "THURSDAY", gid: "1603164899" },
  { day: "FRIDAY", gid: "1836512926" },
];

async function fetchAllDays() {
    const allSchedule = [];
    console.log("--- STARTING FETCH (TARGET SECTIONS ONLY) ---");

    for (const sheet of SHEETS) {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${sheet.gid}`;
        const day = sheet.day;

        try {
            const res = await axios.get(url);
            let data = res.data;
            data = data.substring(data.indexOf('(') + 1, data.lastIndexOf(')'));
            const parsed = JSON.parse(data);
            const rows = parsed.table.rows;

            let timeRowIndex = -1;
            rows.forEach((row, index) => {
                if (index > 8) return; 
                const rowStr = JSON.stringify(row);
                if (/[0-9]{1,2}:[0-9]{2}/.test(rowStr)) { 
                    timeRowIndex = index;
                }
            });

            if (timeRowIndex === -1) timeRowIndex = 2; 

            const rawTimes = rows[timeRowIndex].c.map(c => {
                let val = c?.v || "";
                if (typeof val === "string") {
                    val = val.replace(/[–—−]/g, "-");
                }
                return val;
            });
            
            const slotTimes = rawTimes.map(t => {
                if (typeof t === "string" && /[0-9]{1,2}:[0-9]{2}/.test(t)) return t;
                return null; 
            });
            rows.forEach((row, rowIndex) => {
                if (rowIndex <= timeRowIndex + 1) return; 

                const venue = row.c[0]?.v || "Unknown Venue";

                for (let colIndex = 0; colIndex < row.c.length; colIndex++) {
                    const cell = row.c[colIndex];
                    if (!cell || !cell.v || colIndex === 0) continue;

                    const cellText = cell.v;

                    
                    const match = cellText.match(/BSCE-(\d[A-Z])/i);
                    if (!match) continue;

                    const classCode = match[1].toUpperCase();
                    const normalizedSection = `BSCE-${classCode}`;

                    if (!TARGET_SECTIONS.includes(normalizedSection)) {
                        continue; 
                    }


                    const isLab = cellText.toLowerCase().includes("lab");
                    
                    let spans = 1;
                    if (isLab) {
                        let nextIdx = colIndex + 1;
                        while (nextIdx < row.c.length) {
                            if (spans >= 3) break; 
                            const nextCell = row.c[nextIdx];
                            const isEmpty = !nextCell || !nextCell.v || (typeof nextCell.v === 'string' && nextCell.v.trim() === "");
                            if (isEmpty) { spans++; nextIdx++; } else break; 
                        }
                    }

                    const startSlotStr = slotTimes[colIndex];
                    const endSlotIdx = colIndex + spans - 1;
                    const safeEndIdx = Math.min(endSlotIdx, slotTimes.length - 1);
                    const endSlotStr = slotTimes[safeEndIdx];

                    let finalTime = startSlotStr || "Unknown";
                    if (startSlotStr && endSlotStr && startSlotStr.includes("-") && endSlotStr.includes("-")) {
                        const startTime = startSlotStr.split("-")[0].trim();
                        const endTime = endSlotStr.split("-")[1].trim();
                        if (startTime && endTime) finalTime = `${startTime} - ${endTime}`;
                    } else if (startSlotStr && !endSlotStr) {
                         finalTime = startSlotStr;
                    }

            
                    let cleanText = cellText.replace(/^\b[A-Z]{2}\d{4}\s*[-–]?\s*/, "").trim();

                    let instructor = "";

                    if (cleanText.includes("\n")) {
                        const parts = cleanText.split("\n");
                        instructor = parts[parts.length - 1];
                    } 
                    else if (cleanText.includes("+")) {
                        instructor = cleanText.split("+").pop();
                    }
                    else {
                        const splitBySection = cleanText.split(new RegExp(normalizedSection, 'i'));
                        if (splitBySection.length > 1) {
                            instructor = splitBySection[1];
                        } else {
                            instructor = cleanText; // Failed to separate
                        }
                    }

                    instructor = instructor
                        .replace(/\b(Lab|Lecture)\b/gi, "") 
                        .replace(/^[\s,.\-+]+/, "") 
                        .trim();

                    const flatDetails = cleanText.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim();


                    allSchedule.push({
                        section: normalizedSection,
                        day,
                        venue,
                        time: finalTime, 
                        instructor: instructor, 
                        details: flatDetails,  
                        updatedAt: new Date()
                    });
                }
            });

        } catch (err) {
            console.error(`Failed to fetch ${day}`, err.message);
        }
    }
    console.log(`--- FETCH COMPLETE. Found ${allSchedule.length} entries ---`);
    return allSchedule;
}

module.exports = { fetchAllDays };