const express = require("express");
const router = express.Router();
const Task = require("../models/task"); 

router.get("/", async (req, res) => {
  try {
    const { section } = req.query;

    
    console.log("Filtering tasks for section:", section);

    if (!section) {
      return res.json([]);
    }

    const tasks = await Task.find({ section: section }).sort({ deadline: 1 });

    res.json(tasks);
  } catch (err) {
    console.error("Task Error:", err);
    res.status(500).json([]);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const newTask = new Task(req.body);
    await newTask.save();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;