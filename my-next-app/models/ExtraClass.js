const mongoose = require("mongoose");

const extraClassSchema = new mongoose.Schema({
  section: {
    type: String,
    required: true,
    index: true
  },

  subject: { type: String, required: true },
  room: { type: String, default: "TBA" },

  // Extra classes are one-off, so we store an actual calendar date
  // instead of a recurring "day" like ClassSession does.
  date: { type: Date, required: true },

  startTime: { type: String, required: true }, // e.g. "14:00"
  endTime: { type: String, required: true },

  instructor: { type: String, default: "TBA" },
  reason: { type: String, default: "" }, // optional note from CR, e.g. "Makeup for missed lecture"

  // Who posted it (CR's email/name), useful for accountability + debugging
  postedBy: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
}, {
  collection: "extraclasses"
});

// Fast lookups by section + date, and auto-cleanup of old entries (30 days after class date)
extraClassSchema.index({ section: 1, date: 1 });
extraClassSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model("ExtraClass", extraClassSchema, "extraclasses");
