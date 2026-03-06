const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  section: { type: String, required: true }, 

  priority: { 
    type: String, 
    enum: ["high", "medium", "low"], 
    default: "medium" 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Announcement", AnnouncementSchema);