require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { router: notificationRoutes } = require("./routes/notification.routes");
const initScheduler = require("./services/scheduler");
const announcementRoutes = require("./routes/announcement.routes");
const taskRoutes = require("./routes/task.routes");
const dbImport = require('./db');
const connectDB = dbImport.connectDB || dbImport; 
const syncRoutes = require('./routes/sync');
const extraClassRoutes = require("./routes/extraclass.routes");

const app = express();


app.use(cors());


app.use(express.json());

app.use(async (req, res, next) => {
  if (typeof connectDB === 'function') {
    try {
      await connectDB();
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      return res.status(500).json({ message: "Database connection failed" });
    }
  } else {
    console.error("❌ ERROR: connectDB is still not a function.");
    console.error("   It is currently type:", typeof connectDB);
  }
  next();
});


app.use("/api/exams", require("./routes/exam.routes"));
app.use('/api/timetable', syncRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcements", announcementRoutes); 
app.use("/api/tasks", taskRoutes);
app.use("/api/extraclass", extraClassRoutes);



try {
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/admin', require('./routes/admin.routes'));
  
  app.use('/api/schedule', require('./routes/schedule.routes')); 
} catch (error) {
  console.error("⚠️ Route Loading Error:", error.message);
}


const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`   - Schedule Routes: /api/schedule`);
  });
}

module.exports = app;
