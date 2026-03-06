const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); 
const { findUserByEmail, createUser, updateUser } = require("../models/user");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password, name, section } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email/Password required" });
    }

    if (!email.endsWith("@nu.edu.pk")) {
      return res.status(403).json({ success: false, message: "Only @nu.edu.pk allowed." });
    }

    let user = await findUserByEmail(email);

    if (!user) {
      console.log(`🆕 Creating Account: ${email}`);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = await createUser({
        email,
        password: hashedPassword,
        name: name || email.split("@")[0],
        role: "student",
        section: section 
      });

    } 
    else {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });
      
     
      const updates = {};
      let needsUpdate = false;

      if (section && ["BSCE-2A", "BSCE-2B"].includes(section) && user.section !== section) {
        updates.section = section;
        needsUpdate = true;
        console.log(`🔄 Updating section for ${user.email}: ${user.section} -> ${section}`);
      }

      if (name && user.name !== name) {
        updates.name = name;
        needsUpdate = true;
      }

      if (needsUpdate) {
        user = await updateUser(email, updates); 
      }
    }

    
    const token = jwt.sign(
      { id: user._id, section: user.section }, 
      process.env.JWT_SECRET || "secret", 
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token, 
      user: {
        id: user._id,
        name: user.name, 
        email: user.email,
        role: user.role,
        section: user.section 
      }
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;