// Script to demote a user to regular user
// Run: node scripts/demote-user.js <email>

const mongoose = require('mongoose');
require('dotenv').config();

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/demote-user.js <email>');
  console.log('Example: node scripts/demote-user.js user@artspace.com');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/artspace')
  .then(async () => {
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: email.toLowerCase() },
      { $set: { role: 'user' } }
    );
    
    if (result.matchedCount === 0) {
      console.log('User not found:', email);
      process.exit(1);
    }
    
    console.log('✅ User demoted to regular user:', email);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });