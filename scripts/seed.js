/**
 * Database Seed Script — ArtSpace
 * Run: node scripts/seed.js
 * Seeds demo admin user, sample user, and 6 portfolio projects.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/artspace';

// Inline schema definitions (mirrors server.js)
const userSchema = new mongoose.Schema({
  firstName:  String, lastName: String,
  email:      { type: String, unique: true, lowercase: true },
  password:   String,
  role:       { type: String, enum: ['user','admin'], default: 'user' },
});
const User = mongoose.model('User', userSchema);

const projectSchema = new mongoose.Schema({
  title: String, category: String, description: String,
  location: String, area: String, year: String,
  images: [{ url: String, publicId: String }],
  beforeImage: { url: String, publicId: String },
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Project = mongoose.model('Project', projectSchema);

const sampleProjects = [
  {
    title: 'The Westlands Penthouse',
    category: 'Living Room',
    description: 'A sweeping 4-bedroom penthouse transformed into an oasis of warmth and light, blending Italian marble with bespoke African joinery.',
    location: 'Westlands, Nairobi',
    area: '420 m²', year: '2024', featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', publicId: 'demo_1' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', publicId: 'demo_before_1' },
  },
  {
    title: 'Lavington Kitchen Retreat',
    category: 'Kitchen',
    description: 'A complete kitchen transformation featuring custom cabinetry in a warm walnut finish and Calacatta marble surfaces.',
    location: 'Lavington, Nairobi',
    area: '85 m²', year: '2024', featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', publicId: 'demo_2' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800', publicId: 'demo_before_2' },
  },
  {
    title: 'Karen Sanctuary Bedroom',
    category: 'Bedroom',
    description: 'A master bedroom designed as a true retreat — layered textures of linen, cashmere, and hand-embroidered cushions.',
    location: 'Karen, Nairobi',
    area: '65 m²', year: '2023', featured: true,
    images: [{ url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800', publicId: 'demo_3' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=800', publicId: 'demo_before_3' },
  },
  {
    title: 'Kilimani Creative Office',
    category: 'Office',
    description: 'A modern creative agency space balancing productivity with inspiration. Open collaboration zones meet private focus pods.',
    location: 'Kilimani, Nairobi',
    area: '320 m²', year: '2023', featured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800', publicId: 'demo_4' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800', publicId: 'demo_before_4' },
  },
  {
    title: 'Runda Dining Experience',
    category: 'Living Room',
    description: 'An expansive open-plan living and dining area designed for effortless entertaining. Statement lighting and bespoke dining table for 14.',
    location: 'Runda, Nairobi',
    area: '180 m²', year: '2022', featured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1617104678098-de229db51175?w=800', publicId: 'demo_5' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=800', publicId: 'demo_before_5' },
  },
  {
    title: 'Muthaiga Spa Bathroom',
    category: 'Bedroom',
    description: 'A hotel-grade bathroom sanctuary with freestanding stone tub, rain shower, and floor-to-ceiling book-matched marble panels.',
    location: 'Muthaiga, Nairobi',
    area: '28 m²', year: '2022', featured: false,
    images: [{ url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800', publicId: 'demo_6' }],
    beforeImage: { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800', publicId: 'demo_before_6' },
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing
  await User.deleteMany({});
  await Project.deleteMany({});
  console.log('🗑  Cleared existing data');

  // Create users
  const adminPass = await bcrypt.hash('admin123', 12);
  const userPass  = await bcrypt.hash('user123', 12);

  await User.insertMany([
    { firstName: 'Sophia', lastName: 'Mwangi', email: 'admin@artspace.com', password: adminPass, role: 'admin' },
    { firstName: 'John',   lastName: 'Doe',    email: 'user@artspace.com',  password: userPass,  role: 'user' },
  ]);
  console.log('👤 Users seeded (admin@artspace.com / admin123 | user@artspace.com / user123)');

  // Create projects
  await Project.insertMany(sampleProjects);
  console.log(`🖼  ${sampleProjects.length} projects seeded`);

  await mongoose.disconnect();
  console.log('✅ Seed complete!');
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
