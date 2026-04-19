// Script to promote a user to admin
// Run: node scripts/promote-admin.js <email>

const mongoose = require('mongoose');
require('dotenv').config();

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/promote-admin.js <email>');
  console.log('Example: node scripts/promote-admin.js user@artspace.com');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/artspace')
  .then(async () => {
    // Define user schema inline (same as server.js)
    const userSchema = new mongoose.Schema({
      firstName:   { type: String, required: true, minLen: 2, maxLen: 50 },
      lastName:    { type: String, maxLen: 50 },
      email:       { type: String, required: true, unique: true, lowercase: true },
      password:    { type: String, required: true, minLen: 8, maxLen: 72 },
      role:        { type: String, enum: ['user', 'admin'], default: 'user' },
      loginAttempts: { type: Number, default: 0 },
      lockUntil:   { type: Date },
    }, { timestamps: true });
    
    const User = mongoose.model('User', userSchema);
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('User not found:', email);
      process.exit(1);
    }
    
    user.role = 'admin';
    await user.save();
    console.log('✅ User promoted to admin:', email);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });