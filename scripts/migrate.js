/**
 * ArtSpace - Database Migration Script
 * Adds new schemas for enhanced admin features
 * Run: node scripts/migrate.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/artspace';

async function migrate() {
  console.log('🔄 Starting migration...');
  
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  
  // 1. Services Collection
  console.log('📦 Creating services collection...');
  try {
    await db.createCollection('services');
    console.log('✅ services collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  services already exists');
    else console.log('❌ services:', e.message);
  }
  
  // 2. Testimonials Collection
  console.log('📦 Creating testimonials collection...');
  try {
    await db.createCollection('testimonials');
    console.log('✅ testimonials collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  testimonials already exists');
    else console.log('❌ testimonials:', e.message);
  }
  
  // 3. FAQs Collection
  console.log('📦 Creating faqs collection...');
  try {
    await db.createCollection('faqs');
    console.log('✅ faqs collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  faqs already exists');
    else console.log('❌ faqs:', e.message);
  }
  
  // 4. Quote Requests Collection
  console.log('📦 Creating quoteRequests collection...');
  try {
    await db.createCollection('quoteRequests');
    console.log('✅ quoteRequests collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  quoteRequests already exists');
    else console.log('❌ quoteRequests:', e.message);
  }
  
  // 5. Team Members Collection
  console.log('📦 Creating teamMembers collection...');
  try {
    await db.createCollection('teamMembers');
    console.log('✅ teamMembers collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  teamMembers already exists');
    else console.log('❌ teamMembers:', e.message);
  }
  
  // 6. Site Settings Collection
  console.log('📦 Creating siteSettings collection...');
  try {
    await db.createCollection('siteSettings');
    console.log('✅ siteSettings collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  siteSettings already exists');
    else console.log('❌ siteSettings:', e.message);
  }
  
  // 7. Activity Logs Collection
  console.log('📦 Creating activityLogs collection...');
  try {
    await db.createCollection('activityLogs');
    console.log('✅ activityLogs collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  activityLogs already exists');
    else console.log('❌ activityLogs:', e.message);
  }
  
  // 8. Subscribers Collection (Newsletter)
  console.log('📦 Creating subscribers collection...');
  try {
    await db.createCollection('subscribers');
    console.log('✅ subscribers collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  subscribers already exists');
    else console.log('❌ subscribers:', e.message);
  }
  
  // 9. Press & Awards Collection
  console.log('📦 Creating pressAwards collection...');
  try {
    await db.createCollection('pressAwards');
    console.log('✅ pressAwards collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  pressAwards already exists');
    else console.log('❌ pressAwards:', e.message);
  }
  
  // 10. Style Library / Mood Boards Collection
  console.log('📦 Creating styleLibrary collection...');
  try {
    await db.createCollection('styleLibrary');
    console.log('✅ styleLibrary collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  styleLibrary already exists');
    else console.log('❌ styleLibrary:', e.message);
  }
  
  // 11. Floor Plans Collection
  console.log('📦 Creating floorPlans collection...');
  try {
    await db.createCollection('floorPlans');
    console.log('✅ floorPlans collection ready');
  } catch (e) {
    if (e.codeName === 'NamespaceExists') console.log('ℹ️  floorPlans already exists');
    else console.log('❌ floorPlans:', e.message);
  }
  
  // Add indexes for better performance
  console.log('🔧 Creating indexes...');
  
  try {
    await db.collection('services').createIndex({ category: 1 });
    await db.collection('testimonials').createIndex({ approved: 1 });
    await db.collection('faqs').createIndex({ category: 1 });
    await db.collection('quoteRequests').createIndex({ status: 1 });
    await db.collection('activityLogs').createIndex({ createdAt: -1 });
    await db.collection('subscribers').createIndex({ email: 1 }, { unique: true });
    console.log('✅ Indexes created');
  } catch (e) {
    console.log('ℹ️  Some indexes may already exist:', e.message);
  }
  
  // Seed default site settings if not exists
  console.log('🌱 Seeding default site settings...');
  const settingsExist = await db.collection('siteSettings').findOne({ key: 'company' });
  if (!settingsExist) {
    await db.collection('siteSettings').insertOne({
      key: 'company',
      data: {
        name: 'ArtSpace',
        tagline: 'Where Art Meets Elegance',
        address: '',
        phone: '',
        email: '',
        businessHours: '',
        socialLinks: {
          instagram: '',
          pinterest: '',
          houzz: '',
          linkedin: '',
          facebook: ''
        },
        seo: {
          homeTitle: 'ArtSpace — Where Art Meets Elegance',
          homeDescription: 'Premium Interior Design Studio',
          portfolioTitle: 'Portfolio | ArtSpace',
          servicesTitle: 'Services | ArtSpace',
          contactTitle: 'Contact | ArtSpace'
        },
        hero: {
          headline: 'Where Art Meets Elegance',
          subtitle: 'We craft living spaces that transcend the ordinary',
          ctaText: 'Book Consultation',
          ctaLink: 'contact'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Default settings seeded');
  } else {
    console.log('ℹ️  Settings already exist');
  }
  
  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});