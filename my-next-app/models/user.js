const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
  
  section: { 
    type: String, 
    required: true 
  }
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const findUserByEmail = (email) => User.findOne({ email });
const createUser = (userData) => User.create(userData);
const updateUser = (email, updates) => User.findOneAndUpdate({ email }, updates, { new: true });

module.exports = { findUserByEmail, createUser, updateUser, User };