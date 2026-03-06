const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: { type: String, required: true }, 
  date: { type: String, required: true }, 
  time: { type: String, required: true }, 
  endTime: { type: String, required: true },   
  section: { type: String, required: true } 
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);