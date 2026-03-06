const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam'); 

router.get('/', async (req, res) => {
  try {
    const { section } = req.query; 
    if (!section) return res.status(400).json({ error: "Section is required" });
    
    const exams = await Exam.find({ section }).sort({ date: 1 });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch exams" });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, date, time, endTime, section } = req.body;
    const newExam = new Exam({ title, date, time, endTime, section });
    await newExam.save();
    res.status(201).json(newExam);
  } catch (error) {
    res.status(500).json({ error: "Failed to add exam" });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete exam" });
  }
});

module.exports = router;