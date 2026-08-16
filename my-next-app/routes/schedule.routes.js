const express = require("express");
const router = express.Router();
const ClassSession = require("../models/ClassSession");
const { syncSection } = require("../services/schedule.sync");


router.get("/", async (req, res) => {
  try {
    const section = req.query.section || (req.user && req.user.section) || "BCE-3A";

    // Fetch data
    const classes = await ClassSession.find({ section: { $regex: section, $options: "i" } })
        .sort({ dayOrder: 1, startTimeInt: 1 })
        .lean(); 

    if (classes.length === 0) {
        return res.json({ message: `No classes found`, data: [] });
    }

    const frontendData = classes.map(cls => {
       
        const cleanDay = cls.day.charAt(0).toUpperCase() + cls.day.slice(1).toLowerCase();

        return {
            _id: cls._id,
            
            
            type: "Class", 
            
            details: cls.subject,   
            title: cls.subject,
            venue: cls.room,      
            room: cls.room,
            
            time: `${cls.startTime} - ${cls.endTime}`,

            instructor: cls.instructor,
            day: cleanDay, 
            section: cls.section
        };
    });

    console.log(`✅ API: Sending ${frontendData.length} classes (Masquerading as type='Class')`);

    res.json({
        section: section,
        data: frontendData
    });

  } catch (err) {
    console.error("❌ API ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});


router.post("/sync", async (req, res) => {
    try {
        console.log("🚀 API: Starting Manual Sync...");
        const data = await syncSection(); 
        res.json({ message: "Sync Complete", count: data ? data.length : 0 });
    } catch (err) {
        console.error("❌ Sync Failed:", err);
        res.status(500).json({ error: "Sync failed", details: err.message });
    }
});

module.exports = router;