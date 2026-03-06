const express = require("express");
const router = express.Router();
const Announcement = require("../models/announcement"); 

router.post("/", async (req, res) => {
  try {
    const newAnnouncement = new Announcement(req.body); 
    await newAnnouncement.save();
    res.status(201).json(newAnnouncement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const { section } = req.query; 

    console.log("Announcement query for section:", section);

    if (!section) {
      return res.json([]);
    }

    
    const announcements = await Announcement.find({ section: section }).sort({ createdAt: -1 });

    console.log(`Successfully found ${announcements.length} announcements for ${section}`);
    
    res.json(announcements);
  } catch (err) {
    console.error("Announcement Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;