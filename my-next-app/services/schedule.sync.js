const ClassSession = require("../models/ClassSession");
const { fetchAllDays } = require("./timetable.service");

const DAY_MAP = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7
};

function getStartTimeInt(timeStr) {
  if (!timeStr) return 9999;
  const startPart = timeStr.split("-")[0].trim();
  const [h, m] = startPart.split(":").map(Number);
  if (isNaN(h)) return 9999;
  
  let hours = h;
  if (hours >= 1 && hours <= 6) hours += 12; // PM adjustment
  
  return hours * 100 + (m || 0);
}

const syncSection = async () => {
  console.log("🚀 SYNC STARTED: Using Timetable Service...");

  try {
    const rawData = await fetchAllDays();

    if (!rawData || rawData.length === 0) {
        console.log("⚠️ No data found in Google Sheets.");
        return [];
    }

    // 1. FORMAT DATA
    const dbData = rawData.map(item => {
        // -------------------------------------------------------
        // 🛠️ CRITICAL FIX: Map Google Sheet Columns to DB Fields
        // -------------------------------------------------------
        
        // 1. Map 'details' (Sheet) -> 'subject' (DB)
        // We use "Class" as a backup so it is NEVER undefined
        const subject = item.details || item.subject || "Class";

        // 2. Map 'venue' (Sheet) -> 'room' (DB)
        const room = item.venue || item.room || "TBA";

        // 3. Handle Time
        const timeStr = item.time || "00:00 - 00:00";
        const parts = timeStr.split("-");

        // 4. Handle Type (Enum Fix) - Default to "Lecture"
        const type = (item.type && item.type.trim() !== "") ? item.type : "Lecture";

        return {
            section: item.section || "Unknown",
            day: item.day || "MONDAY",
            dayOrder: DAY_MAP[(item.day || "").toUpperCase()] || 8,
            subject: subject, // <--- This will now have data
            room: room,
            instructor: item.instructor || "TBA",
            startTime: parts[0] ? parts[0].trim() : "00:00",
            endTime: parts[1] ? parts[1].trim() : "00:00",
            startTimeInt: getStartTimeInt(timeStr),
            type: type
        };
    })
    // 🛡️ Final Filter: Remove rows where subject is missing or "No Subject"
    .filter(item => item.subject && item.subject !== "No Subject");

    // 2. SAVE TO DATABASE
    if (dbData.length > 0) {
        await ClassSession.deleteMany({});
        console.log("🗑️ Cleared old schedule.");
        
        await ClassSession.insertMany(dbData);
        console.log(`✅ SUCCESS: Saved ${dbData.length} classes!`);
        return dbData;
    } else {
        console.log("⚠️ No valid classes to save.");
        return [];
    }

  } catch (error) {
    console.error("❌ Sync Service Error:", error);
    throw error;
  }
};

module.exports = { syncSection };