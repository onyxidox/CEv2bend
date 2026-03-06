const cron = require("node-cron");
const webpush = require("web-push");
const Task = require("../models/task");
const Subscription = require("../models/Subscription");

const initScheduler = () => {
  console.log("⏰ Task Reminder Scheduler Initialized...");

  // Runs every day at 8:00 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("running daily deadline check...");
    
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const startOfTomorrow = new Date(tomorrow.setHours(0,0,0,0));
      const endOfTomorrow = new Date(tomorrow.setHours(23,59,59,999));

      const upcomingTasks = await Task.find({
        deadline: {
          $gte: startOfTomorrow,
          $lte: endOfTomorrow
        }
      });

      if (upcomingTasks.length === 0) return;

      // 3. Get all users
      const subscriptions = await Subscription.find();

      // 4. Send reminders
      for (const task of upcomingTasks) {
        const payload = JSON.stringify({
          title: `⏰ Reminder: Due Tomorrow!`,
          body: `Don't forget: ${task.title} is due tomorrow.`,
          url: "/tasks"
        });

        subscriptions.forEach(sub => {
           webpush.sendNotification(sub, payload).catch(e => console.error(e));
        });
      }
      
      console.log(`✅ Sent reminders for ${upcomingTasks.length} tasks.`);

    } catch (error) {
      console.error("❌ Scheduler Error:", error);
    }
  });
};

module.exports = initScheduler;