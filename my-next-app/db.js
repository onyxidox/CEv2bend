const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  throw new Error("❌ MONGO_URI not found in .env file");
}


let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: "test",
      bufferCommands: false, 
      
      
      maxPoolSize: 10, 
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log(`✅ New MongoDB Connection Established`);
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; 
    console.error("❌ Error connecting to MongoDB:", e.message);
    throw e;
  }

  return cached.conn;
}

module.exports = { connectDB };