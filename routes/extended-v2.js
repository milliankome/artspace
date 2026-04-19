/**
 * ArtSpace — Additional API Routes v2.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SAFE ADDITIONS ONLY:
 *  - All new routes mounted at /api/extended/...
 *  - Does NOT touch /api/projects, /api/auth, /api/messages
 *  - All DB operations use try-catch with graceful fallback
 *  - Never modifies existing collection schemas
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const express    = require('express');
const router     = express.Router();
const mongoose   = require('mongoose');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');

// Auth helpers (imported from existing helpers.js)
const { protect, restrictTo } = require('./helpers');

/* ── FEATURE FLAG (mirrors frontend) ─────────────────────────── */
const FEATURES = {
  services:      true,
  testimonials:  true,
  faqs:          true,
  quotes:        true,
  team:          true,
  settings:      true,
  press:         true,
  subscribers:   true,
  styleLibrary:  true,
  floorPlans:    true,
  activityLogs:  true,
  analytics:     true,
};

function featureGuard(key) {
  return (req, res, next) => {
    if (!FEATURES[key]) return res.status(503).json({ error: `Feature "${key}" is currently disabled.` });
    next();
  };
}

/* ── UPLOAD CONFIG ────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('File type not allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

/* ── ACTIVITY LOGGER (safe — never throws) ────────────────────── */
async function log(userId, action, details = {}) {
  try {
    await mongoose.connection.db.collection('activityLogs').insertOne({
      userId: userId?.toString() || 'system',
      action, details,
      createdAt: new Date()
    });
  } catch (e) {
    // Logging must never break the main operation
    console.warn('[ActivityLog] Failed to write log:', e.message);
  }
}

/* ── INPUT SANITIZATION ───────────────────────────────────────── */
function sanitizeStr(s, maxLen = 500) {
  if (s === null || s === undefined) return '';
  return String(s).slice(0, maxLen).replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
}

function safeObjId(id) {
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
}

/* ═══════════════════════════════════════════════════════
   SERVICES  /api/extended/services
   (Pass-through to existing extended.js if mounted;
    this file adds PATCH support and input validation)
═══════════════════════════════════════════════════════ */
router.get('/services', featureGuard('services'), async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category: sanitizeStr(category) } : {};
    const services = await mongoose.connection.db.collection('services').find(filter).sort({ order: 1 }).toArray();
    res.json({ status: 'success', data: services });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch services' }); }
});

router.post('/services', protect, restrictTo('admin'), featureGuard('services'), async (req, res) => {
  try {
    const { title, description, icon, pricingModel, serviceArea, category } = req.body;
    if (!sanitizeStr(title, 120) || !sanitizeStr(description, 2000)) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }
    const doc = {
      title: sanitizeStr(title, 120),
      description: sanitizeStr(description, 2000),
      icon: sanitizeStr(icon, 10) || '✨',
      pricingModel: sanitizeStr(pricingModel, 100),
      serviceArea: sanitizeStr(serviceArea, 200),
      category: ['residential','commercial','staging'].includes(category) ? category : 'residential',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('services').insertOne(doc);
    await log(req.user._id, 'create_service', { serviceId: result.insertedId, title: doc.title });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to create service' }); }
});

router.put('/services/:id', protect, restrictTo('admin'), featureGuard('services'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const allowed = ['title','description','icon','pricingModel','serviceArea','category'];
    const update = { updatedAt: new Date() };
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = sanitizeStr(req.body[k], 2000); });
    const result = await mongoose.connection.db.collection('services').findOneAndUpdate(
      { _id: oid }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Service not found' });
    await log(req.user._id, 'update_service', { serviceId: req.params.id });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to update service' }); }
});

router.delete('/services/:id', protect, restrictTo('admin'), featureGuard('services'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const result = await mongoose.connection.db.collection('services').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Service not found' });
    await log(req.user._id, 'delete_service', { serviceId: req.params.id });
    res.json({ status: 'success', message: 'Service deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete service' }); }
});

/* ═══════════════════════════════════════════════════════
   TESTIMONIALS  /api/extended/testimonials
═══════════════════════════════════════════════════════ */
router.get('/testimonials', featureGuard('testimonials'), async (req, res) => {
  try {
    const filter = req.query.approved === 'true' ? { approved: true } : {};
    const docs = await mongoose.connection.db.collection('testimonials').find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch testimonials' }); }
});

router.post('/testimonials', protect, restrictTo('admin'), featureGuard('testimonials'), async (req, res) => {
  try {
    const { clientName, clientTitle, content, rating, projectLink, image, approved } = req.body;
    if (!sanitizeStr(clientName, 100) || !sanitizeStr(content, 1000)) {
      return res.status(400).json({ error: 'Client name and content are required.' });
    }
    const doc = {
      clientName: sanitizeStr(clientName, 100),
      clientTitle: sanitizeStr(clientTitle, 150),
      content: sanitizeStr(content, 1000),
      rating: Math.min(5, Math.max(1, parseInt(rating)||5)),
      projectLink: sanitizeStr(projectLink, 300),
      image: sanitizeStr(image, 500),
      approved: approved === true || approved === 'true',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('testimonials').insertOne(doc);
    await log(req.user._id, 'create_testimonial', { testimonialId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to create testimonial' }); }
});

router.put('/testimonials/:id', protect, restrictTo('admin'), featureGuard('testimonials'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const allowed = ['clientName','clientTitle','content','rating','projectLink','image','approved'];
    const update = { updatedAt: new Date() };
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.content) update.content = sanitizeStr(update.content, 1000);
    const result = await mongoose.connection.db.collection('testimonials').findOneAndUpdate(
      { _id: oid }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Testimonial not found' });
    await log(req.user._id, 'update_testimonial', { testimonialId: req.params.id });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to update testimonial' }); }
});

router.delete('/testimonials/:id', protect, restrictTo('admin'), featureGuard('testimonials'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const result = await mongoose.connection.db.collection('testimonials').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    await log(req.user._id, 'delete_testimonial', { testimonialId: req.params.id });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

/* ═══════════════════════════════════════════════════════
   FAQs  /api/extended/faqs
═══════════════════════════════════════════════════════ */
router.get('/faqs', featureGuard('faqs'), async (req, res) => {
  try {
    const validCats = ['process','pricing','timeline','general'];
    const filter = req.query.category && validCats.includes(req.query.category)
      ? { category: req.query.category } : {};
    const docs = await mongoose.connection.db.collection('faqs').find(filter).sort({ order: 1, createdAt: 1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch FAQs' }); }
});

router.post('/faqs', protect, restrictTo('admin'), featureGuard('faqs'), async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;
    if (!sanitizeStr(question, 500) || !sanitizeStr(answer, 2000)) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }
    const validCats = ['process','pricing','timeline','general'];
    const doc = {
      question: sanitizeStr(question, 500),
      answer: sanitizeStr(answer, 2000),
      category: validCats.includes(category) ? category : 'general',
      order: parseInt(order) || 0,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('faqs').insertOne(doc);
    await log(req.user._id, 'create_faq', { faqId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to create FAQ' }); }
});

router.put('/faqs/:id', protect, restrictTo('admin'), featureGuard('faqs'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const update = { updatedAt: new Date() };
    ['question','answer','category','order'].forEach(k => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });
    const result = await mongoose.connection.db.collection('faqs').findOneAndUpdate(
      { _id: oid }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'FAQ not found' });
    await log(req.user._id, 'update_faq', { faqId: req.params.id });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to update FAQ' }); }
});

router.delete('/faqs/:id', protect, restrictTo('admin'), featureGuard('faqs'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    await mongoose.connection.db.collection('faqs').deleteOne({ _id: oid });
    await log(req.user._id, 'delete_faq', { faqId: req.params.id });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

/* ═══════════════════════════════════════════════════════
   QUOTE REQUESTS  /api/extended/quotes
═══════════════════════════════════════════════════════ */
const quoteLimiter = rateLimit({ windowMs: 60*60*1000, max: 5, message: { error: 'Too many quote requests. Try again later.' } });

router.get('/quotes', protect, restrictTo('admin','editor','lead_manager'), featureGuard('quotes'), async (req, res) => {
  try {
    const validStatuses = ['new','in-progress','closed'];
    const filter = req.query.status && validStatuses.includes(req.query.status) ? { status: req.query.status } : {};
    const docs = await mongoose.connection.db.collection('quoteRequests').find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch quotes' }); }
});

router.post('/quotes', quoteLimiter, featureGuard('quotes'), async (req, res) => {
  try {
    const { name, email, phone, projectType, budget, timeline, details } = req.body;
    if (!sanitizeStr(name, 100) || !sanitizeStr(email, 200)) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const doc = {
      name: sanitizeStr(name, 100),
      email: sanitizeStr(email, 200).toLowerCase(),
      phone: sanitizeStr(phone, 30),
      projectType: sanitizeStr(projectType, 100),
      budget: sanitizeStr(budget, 100),
      timeline: sanitizeStr(timeline, 100),
      details: sanitizeStr(details, 2000),
      status: 'new',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('quoteRequests').insertOne(doc);
    res.status(201).json({ status: 'success', message: 'Quote request received.', data: { _id: result.insertedId } });
  } catch (e) { res.status(500).json({ error: 'Failed to submit quote request' }); }
});

router.put('/quotes/:id', protect, restrictTo('admin','editor','lead_manager'), featureGuard('quotes'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const validStatuses = ['new','in-progress','closed'];
    const update = { updatedAt: new Date() };
    if (req.body.status && validStatuses.includes(req.body.status)) update.status = req.body.status;
    if (req.body.notes !== undefined) update.notes = sanitizeStr(req.body.notes, 2000);
    const result = await mongoose.connection.db.collection('quoteRequests').findOneAndUpdate(
      { _id: oid }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Quote not found' });
    await log(req.user._id, 'update_quote', { quoteId: req.params.id, status: update.status });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to update quote' }); }
});

/* ═══════════════════════════════════════════════════════
   TEAM  /api/extended/team
═══════════════════════════════════════════════════════ */
router.get('/team', featureGuard('team'), async (req, res) => {
  try {
    const filter = req.query.includeHidden === 'true' ? {} : { visible: { $ne: false } };
    const docs = await mongoose.connection.db.collection('teamMembers').find(filter).sort({ order: 1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch team' }); }
});

router.post('/team', protect, restrictTo('admin'), featureGuard('team'), async (req, res) => {
  try {
    const { name, role, bio, photo, socialLinks, order, visible } = req.body;
    if (!sanitizeStr(name, 100)) return res.status(400).json({ error: 'Name is required.' });
    const doc = {
      name: sanitizeStr(name, 100),
      role: sanitizeStr(role, 100) || 'Designer',
      bio: sanitizeStr(bio, 1000),
      photo: sanitizeStr(photo, 500),
      socialLinks: {
        linkedin:  sanitizeStr(socialLinks?.linkedin, 300),
        instagram: sanitizeStr(socialLinks?.instagram, 300),
        behance:   sanitizeStr(socialLinks?.behance, 300),
      },
      order: parseInt(order) || 0,
      visible: visible !== false && visible !== 'false',
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('teamMembers').insertOne(doc);
    await log(req.user._id, 'create_team_member', { memberId: result.insertedId, name: doc.name });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to create team member' }); }
});

router.put('/team/:id', protect, restrictTo('admin'), featureGuard('team'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const allowed = ['name','role','bio','photo','socialLinks','order','visible'];
    const update = { updatedAt: new Date() };
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.name) update.name = sanitizeStr(update.name, 100);
    if (update.bio)  update.bio  = sanitizeStr(update.bio, 1000);
    const result = await mongoose.connection.db.collection('teamMembers').findOneAndUpdate(
      { _id: oid }, { $set: update }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Team member not found' });
    await log(req.user._id, 'update_team_member', { memberId: req.params.id });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to update team member' }); }
});

router.delete('/team/:id', protect, restrictTo('admin'), featureGuard('team'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const result = await mongoose.connection.db.collection('teamMembers').deleteOne({ _id: oid });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Team member not found' });
    await log(req.user._id, 'delete_team_member', { memberId: req.params.id });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete team member' }); }
});

/* ═══════════════════════════════════════════════════════
   SITE SETTINGS  /api/extended/settings
═══════════════════════════════════════════════════════ */
router.get('/settings', protect, restrictTo('admin','editor'), featureGuard('settings'), async (req, res) => {
  try {
    const docs = await mongoose.connection.db.collection('siteSettings').find({}).toArray();
    const result = {};
    docs.forEach(s => { result[s.key] = s.data; });
    res.json({ status: 'success', data: result });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch settings' }); }
});

router.put('/settings/:key', protect, restrictTo('admin'), featureGuard('settings'), async (req, res) => {
  try {
    const allowedKeys = ['companyInfo','socialMedia','seo','heroContent','heroImages'];
    const { key } = req.params;
    if (!allowedKeys.includes(key)) return res.status(400).json({ error: 'Invalid settings key.' });
    const { data } = req.body;
    await mongoose.connection.db.collection('siteSettings').findOneAndUpdate(
      { key },
      { $set: { key, data, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    await log(req.user._id, 'update_settings', { key });
    res.json({ status: 'success', message: `Settings "${key}" updated.` });
  } catch (e) { res.status(500).json({ error: 'Failed to update settings' }); }
});

/* ═══════════════════════════════════════════════════════
   PRESS & AWARDS  /api/extended/press
═══════════════════════════════════════════════════════ */
router.get('/press', featureGuard('press'), async (req, res) => {
  try {
    const docs = await mongoose.connection.db.collection('pressAwards').find({}).sort({ year: -1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch press' }); }
});

router.post('/press', protect, restrictTo('admin'), featureGuard('press'), async (req, res) => {
  try {
    const { title, publication, year, url, image } = req.body;
    if (!sanitizeStr(title, 200)) return res.status(400).json({ error: 'Title is required.' });
    const doc = {
      title: sanitizeStr(title, 200),
      publication: sanitizeStr(publication, 200),
      year: sanitizeStr(year, 10),
      url: sanitizeStr(url, 500),
      image: sanitizeStr(image, 500),
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('pressAwards').insertOne(doc);
    await log(req.user._id, 'create_press', { pressId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to create press item' }); }
});

router.delete('/press/:id', protect, restrictTo('admin'), featureGuard('press'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    await mongoose.connection.db.collection('pressAwards').deleteOne({ _id: oid });
    await log(req.user._id, 'delete_press', { pressId: req.params.id });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

/* ═══════════════════════════════════════════════════════
   NEWSLETTER SUBSCRIBERS  /api/extended/subscribers
═══════════════════════════════════════════════════════ */
const subscribeLimiter = rateLimit({ windowMs: 60*60*1000, max: 10 });

router.get('/subscribers', protect, restrictTo('admin'), featureGuard('subscribers'), async (req, res) => {
  try {
    const docs = await mongoose.connection.db.collection('subscribers').find({}).sort({ subscribedAt: -1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch subscribers' }); }
});

router.post('/subscribe', subscribeLimiter, featureGuard('subscribers'), async (req, res) => {
  try {
    const email = sanitizeStr(req.body.email, 200).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required.' });
    }
    await mongoose.connection.db.collection('subscribers').insertOne({ email, subscribedAt: new Date() });
    res.status(201).json({ status: 'success', message: 'Subscribed successfully.' });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Already subscribed.' });
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.delete('/subscribe/:email', protect, restrictTo('admin'), featureGuard('subscribers'), async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    await mongoose.connection.db.collection('subscribers').deleteOne({ email });
    res.json({ status: 'success', message: 'Unsubscribed' });
  } catch (e) { res.status(500).json({ error: 'Failed to unsubscribe' }); }
});

/* ═══════════════════════════════════════════════════════
   STYLE LIBRARY  /api/extended/style-library
═══════════════════════════════════════════════════════ */
router.get('/style-library', featureGuard('styleLibrary'), async (req, res) => {
  try {
    const filter = req.query.type ? { type: sanitizeStr(req.query.type, 50) } : {};
    const docs = await mongoose.connection.db.collection('styleLibrary').find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch style library' }); }
});

router.post('/style-library', protect, restrictTo('admin'), featureGuard('styleLibrary'), async (req, res) => {
  try {
    const { name, type, brand, color, image, notes } = req.body;
    if (!sanitizeStr(name, 200)) return res.status(400).json({ error: 'Name is required.' });
    const validTypes = ['material','fabric','furniture','paint'];
    const doc = {
      name: sanitizeStr(name, 200),
      type: validTypes.includes(type) ? type : 'material',
      brand: sanitizeStr(brand, 200),
      color: sanitizeStr(color, 20),
      image: sanitizeStr(image, 500),
      notes: sanitizeStr(notes, 500),
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('styleLibrary').insertOne(doc);
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to add style item' }); }
});

router.delete('/style-library/:id', protect, restrictTo('admin'), featureGuard('styleLibrary'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    await mongoose.connection.db.collection('styleLibrary').deleteOne({ _id: oid });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

/* ═══════════════════════════════════════════════════════
   FLOOR PLANS  /api/extended/floor-plans
═══════════════════════════════════════════════════════ */
router.get('/floor-plans', featureGuard('floorPlans'), async (req, res) => {
  try {
    const filter = req.query.projectId ? { projectId: req.query.projectId } : {};
    const docs = await mongoose.connection.db.collection('floorPlans').find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch floor plans' }); }
});

router.post('/floor-plans', protect, restrictTo('admin'), featureGuard('floorPlans'), async (req, res) => {
  try {
    const { projectId, title, description, file, downloadPermission } = req.body;
    if (!sanitizeStr(title, 200)) return res.status(400).json({ error: 'Title is required.' });
    const doc = {
      projectId: sanitizeStr(projectId, 100) || null,
      title: sanitizeStr(title, 200),
      description: sanitizeStr(description, 500),
      file: sanitizeStr(file, 500),
      downloadPermission: downloadPermission === 'all' ? 'all' : 'admin',
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('floorPlans').insertOne(doc);
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...doc } });
  } catch (e) { res.status(500).json({ error: 'Failed to save floor plan' }); }
});

router.delete('/floor-plans/:id', protect, restrictTo('admin'), featureGuard('floorPlans'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    await mongoose.connection.db.collection('floorPlans').deleteOne({ _id: oid });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

/* ═══════════════════════════════════════════════════════
   ACTIVITY LOGS  /api/extended/activity-logs
═══════════════════════════════════════════════════════ */
router.get('/activity-logs', protect, restrictTo('admin'), featureGuard('activityLogs'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit)||50, 100);
    const page  = Math.max(parseInt(req.query.page)||1, 1);
    const [docs, total] = await Promise.all([
      mongoose.connection.db.collection('activityLogs').find({}).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray(),
      mongoose.connection.db.collection('activityLogs').countDocuments()
    ]);
    res.json({ status: 'success', data: docs, total, page, pages: Math.ceil(total/limit) });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch activity logs' }); }
});

/* ═══════════════════════════════════════════════════════
   ANALYTICS  /api/extended/analytics
═══════════════════════════════════════════════════════ */
router.get('/analytics', protect, restrictTo('admin','editor','lead_manager'), featureGuard('analytics'), async (req, res) => {
  try {
    const [totalProjects, totalMessages, totalQuotes, unreadMessages, newQuotes, recentActivity] = await Promise.all([
      mongoose.connection.db.collection('projects').countDocuments().catch(()=>0),
      mongoose.connection.db.collection('messages').countDocuments().catch(()=>0),
      mongoose.connection.db.collection('quoteRequests').countDocuments().catch(()=>0),
      mongoose.connection.db.collection('messages').countDocuments({ read: false }).catch(()=>0),
      mongoose.connection.db.collection('quoteRequests').countDocuments({ status: 'new' }).catch(()=>0),
      mongoose.connection.db.collection('activityLogs').find({}).sort({ createdAt: -1 }).limit(10).toArray().catch(()=>[])
    ]);
    res.json({ status: 'success', data: { totalProjects, totalMessages, totalQuotes, unreadMessages, newQuotes, recentActivity } });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch analytics' }); }
});

/* ═══════════════════════════════════════════════════════
   PROJECT CATEGORIES  /api/extended/project-categories
═══════════════════════════════════════════════════════ */
router.get('/project-categories', async (req, res) => {
  try {
    const docs = await mongoose.connection.db.collection('projectCategories').find({}).toArray();
    res.json({ status: 'success', data: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch categories' }); }
});

router.post('/project-categories', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!sanitizeStr(name, 100)) return res.status(400).json({ error: 'Name is required.' });
    const result = await mongoose.connection.db.collection('projectCategories').insertOne({
      name: sanitizeStr(name, 100),
      description: sanitizeStr(description, 500),
      createdAt: new Date()
    });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, name, description } });
  } catch (e) { res.status(500).json({ error: 'Failed to create category' }); }
});

router.delete('/project-categories/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const oid = safeObjId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    await mongoose.connection.db.collection('projectCategories').deleteOne({ _id: oid });
    res.json({ status: 'success', message: 'Category deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

module.exports = router;
