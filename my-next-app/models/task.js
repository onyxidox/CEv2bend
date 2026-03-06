const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  details: { type: String }, 
  deadline: { type: Date }, 
  section: { type: String, required: true }, 
  
  priority: { 
    type: String, 
    enum: ["high", "medium", "low"], 
    default: "medium" 
  },
  type: { 
    type: String, 
    enum: ["quiz", "assignment", "task"], 
    default: "task" 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Task", TaskSchema);