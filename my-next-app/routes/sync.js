const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const { fetchAllDays } = require("../services/timetable.service");
const DAY_MAP = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7
};

function getStartTimeInt(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 9999;
  const time = timeStr.split("-")[0].trim();
  const match = time.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return 9999;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours >= 1 && hours <= 6) hours += 12;

  return hours * 100 + minutes;
}

router.post("/sync", async (req, res) => {
  console.log("🔄 SYNC REQUEST RECEIVED");

  try {
    // 1. Fetch data
    const schedule = await fetchAllDays();
    
    if (!schedule || schedule.length === 0) {
      return res.status(404).json({ error: "No classes found. Check sheet ID or class name." });
    }

    const enrichedSchedule = schedule.map(item => ({
      ...item, 
      dayOrder: DAY_MAP[item.day?.toUpperCase()] || 99,
      startTimeInt: getStartTimeInt(item.time),
      updatedAt: new Date()
    }));

    // 3. Sort
    enrichedSchedule.sort((a, b) => {
      if (a.dayOrder !== b.dayOrder) return a.dayOrder - b.dayOrder;
      return a.startTimeInt - b.startTimeInt;
    });

    // 4. Save to MongoDB
    const db = mongoose.connection.db;
    const collection = db.collection("classsessions"); 

    await collection.deleteMany({}); // Clear old data
    const result = await collection.insertMany(enrichedSchedule); // Insert new

    console.log(`✅ SUCCESS: Saved ${result.insertedCount} classes to DB.`);
    
    res.json({ 
      success: true, 
      count: result.insertedCount, 
      message: "Sync complete" 
    });

  } catch (err) {
    console.error("❌ SYNC FAILED:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

module.exports = router;