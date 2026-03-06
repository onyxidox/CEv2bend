const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, unique: true, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  
  // ✅ CLEANED: Ties a push notification user to a specific section
  section: { 
    type: String, 
    required: true,
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);