const express = require("express");
const router = express.Router();
const ExtraClass = require("../models/ExtraClass");

// GET /api/extraclass?section=BSCE-2A
// Returns extra classes for a section that are today or in the future,
// so past extra classes don't keep popping up.
router.get("/", async (req, res) => {
  try {
    const section = req.query.section || (req.user && req.user.section) || "BSCE-2A";

    // Start of today, so a class scheduled for "today" still shows even if
    // some of today's hours have already passed.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const extraClasses = await ExtraClass.find({
      section: { $regex: section, $options: "i" },
      date: { $gte: startOfToday }
    })
      .sort({ date: 1, startTime: 1 })
      .lean();

    const frontendData = extraClasses.map(cls => ({
      _id: cls._id,
      type: "ExtraClass",

      details: cls.subject,
      title: cls.subject,
      venue: cls.room,
      room: cls.room,

      time: `${cls.startTime} - ${cls.endTime}`,
      startTime: cls.startTime,
      endTime: cls.endTime,

      instructor: cls.instructor,
      reason: cls.reason,
      date: cls.date,
      section: cls.section,
      postedBy: cls.postedBy,
      createdAt: cls.createdAt
    }));

    res.json({
      section: section,
      data: frontendData
    });

  } catch (err) {
    console.error("❌ Extra Class GET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/extraclass
// CR adds a new extra class for their section.
router.post("/", async (req, res) => {
  try {
    const { subject, room, date, startTime, endTime, instructor, reason, section } = req.body;

    if (!subject || !date || !startTime || !endTime || !section) {
      return res.status(400).json({ message: "subject, date, startTime, endTime and section are required" });
    }

    const newExtraClass = await ExtraClass.create({
      subject,
      room: room || "TBA",
      date: new Date(date),
      startTime,
      endTime,
      instructor: instructor || "TBA",
      reason: reason || "",
      section,
      postedBy: req.headers["user-email"] || ""
    });

    res.status(201).json(newExtraClass);

  } catch (err) {
    console.error("❌ Extra Class POST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/extraclass/:id
// CR removes an extra class they (or another CR in their section) posted.
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ExtraClass.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Extra class not found" });
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("❌ Extra Class DELETE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
