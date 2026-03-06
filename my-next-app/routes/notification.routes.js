const express = require("express");
const webpush = require("web-push");
const Subscription = require("../models/Subscription");
const router = express.Router();

webpush.setVapidDetails(
  "mailto:habibahmed1928@gmail.com", 
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.post("/subscribe", async (req, res) => {
  const subscription = req.body;
  
  try {
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      subscription,
      { upsert: true, new: true }
    );
    res.status(201).json({ message: "Subscription saved!" });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

module.exports = { router, webpush, Subscription };