const express = require("express");
const router = express.Router();
const Announcement = require("../models/announcement");
const Task = require("../models/task");
const { findUserByEmail } = require("../models/user"); 

const checkAdmin = async (req, res, next) => {
  const userEmail = req.headers["user-email"]; 
  if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

  const user = await findUserByEmail(userEmail);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

//             ANNOUNCEMENTS

router.get("/announcements", async (req, res) => {
  const { section } = req.query; 
  
  if (!section) {
     return res.json([]); 
  }

  const list = await Announcement.find({ section: section }).sort({ createdAt: -1 });
  res.json(list);
});

router.post("/announcements", checkAdmin, async (req, res) => {
  try {
    if (!req.body.section) {
        return res.status(400).json({ error: "Section is required" });
    }

    const newItem = await announcement.create(req.body);
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/announcements/:id", checkAdmin, async (req, res) => {
  try {
    await announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//                  TASKS

router.get("/tasks", async (req, res) => {
  const { section } = req.query; 

  if (!section) {
     return res.json([]); 
  }
  const list = await Task.find({ section: section }).sort({ createdAt: -1 });
  res.json(list);
});

router.post("/tasks", checkAdmin, async (req, res) => {
  try {
    if (!req.body.section) {
        return res.status(400).json({ error: "Section is required" });
    }

    const newItem = await task.create(req.body);
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/tasks/:id", checkAdmin, async (req, res) => {
  try {
    await task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;