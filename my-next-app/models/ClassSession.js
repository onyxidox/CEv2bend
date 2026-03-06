const mongoose = require("mongoose");

const classSessionSchema = new mongoose.Schema({
  section: { 
    type: String, 
    required: true, 
    index: true
  },

  subject: { type: String, required: true },
  room: { type: String, default: "TBA" },
  day: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  type: { type: String, enum: ["Lecture", "Lab"], default: "Lecture" },
  
  instructor: { type: String, default: "TBA" }, 
  dayOrder: { type: Number, required: true }, 
  startTimeInt: { type: Number, required: true }, 
  
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: "classsessions" 
});

// Index for faster queries
classSessionSchema.index({ section: 1, dayOrder: 1, startTimeInt: 1 });

module.exports = mongoose.model("ClassSession", classSessionSchema, "classsessions");