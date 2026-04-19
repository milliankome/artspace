/**
 * ArtSpace — Database Migration v2.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SAFE: Only creates NEW collections + indexes.
 *       Never drops, alters, or touches existing data.
 *       Idempotent — safe to run multiple times.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Run: node scripts/migrate.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/artspace';

/* ── New collections to ensure exist ─────────────────────────── */
const NEW_COLLECTIONS = [
  'services',
  'testimonials',
  'faqs',
  'quoteRequests',
  'teamMembers',
  'siteSettings',
  'subscribers',
  'pressAwards',
  'styleLibrary',
  'floorPlans',
  'activityLogs',
  'projectCategories',
];

/* ── Indexes to ensure (non-destructive) ─────────────────────── */
const INDEXES = [
  { collection: 'subscribers',     index: { email: 1 },       options: { unique: true } },
  { collection: 'activityLogs',    index: { createdAt: -1 },  options: {} },
  { collection: 'activityLogs',    index: { userId: 1 },      options: {} },
  { collection: 'quoteRequests',   index: { status: 1 },      options: {} },
  { collection: 'quoteRequests',   index: { createdAt: -1 },  options: {} },
  { collection: 'testimonials',    index: { approved: 1 },    options: {} },
  { collection: 'faqs',            index: { category: 1 },    options: {} },
  { collection: 'services',        index: { category: 1 },    options: {} },
  { collection: 'teamMembers',     index: { order: 1 },       options: {} },
  { collection: 'styleLibrary',    index: { type: 1 },        options: {} },
  { collection: 'siteSettings',    index: { key: 1 },         options: { unique: true } },
  { collection: 'pressAwards',     index: { year: -1 },       options: {} },
  { collection: 'floorPlans',      index: { projectId: 1 },   options: {} },
];

/* ── Seed data for new collections (only if empty) ────────────── */
const SEED_DATA = {
  services: [
    { title: 'Initial Consultation', description: 'A 90-minute deep-dive session…', icon: '💬', pricingModel: 'From KES 15,000', serviceArea: 'Nairobi & Kenya-wide', category: 'residential', createdAt: new Date(), updatedAt: new Date() },
    { title: 'Full Interior Design', description: 'Comprehensive service from concept to delivery.', icon: '🎨', pricingModel: 'From KES 150,000', serviceArea: 'Nairobi & Kenya-wide', category: 'residential', createdAt: new Date(), updatedAt: new Date() },
    { title: '3D Visualization',     description: 'Photorealistic renders of your future space.', icon: '🖥', pricingModel: 'From KES 60,000', serviceArea: 'Nationwide (remote)', category: 'commercial', createdAt: new Date(), updatedAt: new Date() },
  ],
  faqs: [
    { question: 'How long does a typical project take?', answer: 'Residential projects typically take 8–16 weeks from concept to completion, depending on scope.', category: 'timeline', order: 1, createdAt: new Date(), updatedAt: new Date() },
    { question: 'What is your pricing structure?', answer: 'We offer fixed-fee packages and hourly rates depending on the project type. Consultations start at KES 15,000.', category: 'pricing', order: 1, createdAt: new Date(), updatedAt: new Date() },
    { question: 'Do you work outside Nairobi?', answer: 'Yes! We work across Kenya and can accommodate international projects for select clients.', category: 'process', order: 1, createdAt: new Date(), updatedAt: new Date() },
  ],
  siteSettings: [
    { key: 'companyInfo', data: { name: 'ArtSpace', phone: '+254 700 123 456', email: 'hello@artspace.co.ke', address: 'Westlands Square, 4th Floor, Nairobi, Kenya', hours: 'Mon–Fri 9am–6pm, Sat 10am–2pm' }, updatedAt: new Date() },
    { key: 'socialMedia', data: { instagram: 'https://instagram.com/artspaceafrica', pinterest: '', houzz: '', linkedin: '' }, updatedAt: new Date() },
    { key: 'heroContent', data: { headline: 'Where Art Meets Elegance', eyebrow: 'Premium Interior Design Studio', description: 'We craft living spaces that transcend the ordinary.', cta1: 'Book Consultation', cta2: 'View Portfolio' }, updatedAt: new Date() },
  ],
  projectCategories: [
    { name: 'Living Room', description: 'Living and entertaining spaces', createdAt: new Date() },
    { name: 'Kitchen',     description: 'Kitchen design and renovation', createdAt: new Date() },
    { name: 'Bedroom',     description: 'Master and guest bedrooms', createdAt: new Date() },
    { name: 'Office',      description: 'Home and commercial offices', createdAt: new Date() },
    { name: 'Outdoor',     description: 'Gardens and outdoor living', createdAt: new Date() },
  ],
};

async function migrate() {
  console.log('\n🔧 ArtSpace Database Migration v2.0');
  console.log('━'.repeat(45));
  console.log(`📡 Connecting to: ${MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

  // Step 1: Create new collections (safe — skips if already exists)
  console.log('📁 Creating new collections (skipping existing)…');
  for (const coll of NEW_COLLECTIONS) {
    if (existingCollections.includes(coll)) {
      console.log(`   ↷ Skipped (exists): ${coll}`);
    } else {
      await db.createCollection(coll);
      console.log(`   ✓ Created: ${coll}`);
    }
  }

  // Step 2: Create indexes (idempotent)
  console.log('\n📑 Ensuring indexes…');
  for (const { collection, index, options } of INDEXES) {
    try {
      await db.collection(collection).createIndex(index, options);
      console.log(`   ✓ Index on ${collection}: ${JSON.stringify(index)}`);
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        console.log(`   ↷ Index already exists: ${collection} ${JSON.stringify(index)}`);
      } else {
        console.warn(`   ⚠ Index error on ${collection}:`, e.message);
      }
    }
  }

  // Step 3: Seed data (only if collection is empty)
  console.log('\n🌱 Seeding default data (only if collections are empty)…');
  for (const [collName, docs] of Object.entries(SEED_DATA)) {
    const count = await db.collection(collName).countDocuments();
    if (count === 0) {
      await db.collection(collName).insertMany(docs);
      console.log(`   ✓ Seeded ${docs.length} record(s) into ${collName}`);
    } else {
      console.log(`   ↷ Skipped ${collName} (${count} existing records)`);
    }
  }

  // Step 4: Report existing collections we did NOT touch
  const protectedCollections = ['users','projects','messages'];
  console.log('\n🔒 Protected collections (NOT modified):');
  for (const c of protectedCollections) {
    const count = await db.collection(c).countDocuments().catch(()=>0);
    console.log(`   ✓ ${c}: ${count} document(s) — untouched`);
  }

  console.log('\n✅ Migration complete!\n');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
