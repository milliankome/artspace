/**
 * ArtSpace - Extended API Routes
 * New routes for enhanced admin features
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware imports from main server
const { protect, restrictTo } = require('./helpers');

// File upload configuration
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: Log activity
async function logActivity(userId, action, details) {
  try {
    await mongoose.connection.db.collection('activityLogs').insertOne({
      userId,
      action,
      details,
      createdAt: new Date()
    });
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
}

// ============================================
// SERVICES MANAGEMENT
// ============================================

// GET all services
router.get('/services', async (req, res) => {
  try {
    const services = await mongoose.connection.db.collection('services').find({}).toArray();
    res.json({ status: 'success', data: services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create service (admin only)
router.post('/services', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { title, description, icon, pricingModel, serviceArea, category } = req.body;
    const service = {
      title,
      description,
      icon: icon || '✨',
      pricingModel: pricingModel || '',
      serviceArea: serviceArea || '',
      category: category || 'residential', // residential, commercial, staging
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('services').insertOne(service);
    await logActivity(req.user._id, 'create_service', { serviceId: result.insertedId, title });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...service } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update service
router.put('/services/:id', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    const result = await mongoose.connection.db.collection('services').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Service not found' });
    await logActivity(req.user._id, 'update_service', { serviceId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE service
router.delete('/services/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mongoose.connection.db.collection('services').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Service not found' });
    await logActivity(req.user._id, 'delete_service', { serviceId: id });
    res.json({ status: 'success', message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TESTIMONIALS MANAGEMENT
// ============================================

// GET all testimonials
router.get('/testimonials', async (req, res) => {
  try {
    const testimonials = await mongoose.connection.db.collection('testimonials').find({}).toArray();
    res.json({ status: 'success', data: testimonials });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create testimonial
router.post('/testimonials', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { clientName, clientTitle, content, rating, projectLink, image, approved } = req.body;
    const testimonial = {
      clientName,
      clientTitle: clientTitle || '',
      content,
      rating: rating || 5,
      projectLink: projectLink || '',
      image: image || '',
      approved: approved || false,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('testimonials').insertOne(testimonial);
    await logActivity(req.user._id, 'create_testimonial', { testimonialId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...testimonial } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update testimonial
router.put('/testimonials/:id', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    const result = await mongoose.connection.db.collection('testimonials').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Testimonial not found' });
    await logActivity(req.user._id, 'update_testimonial', { testimonialId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE testimonial
router.delete('/testimonials/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mongoose.connection.db.collection('testimonials').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Testimonial not found' });
    await logActivity(req.user._id, 'delete_testimonial', { testimonialId: id });
    res.json({ status: 'success', message: 'Testimonial deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FAQs MANAGEMENT
// ============================================

// GET all FAQs
router.get('/faqs', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const faqs = await mongoose.connection.db.collection('faqs').find(filter).toArray();
    res.json({ status: 'success', data: faqs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create FAQ
router.post('/faqs', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;
    const faq = {
      question,
      answer,
      category: category || 'general', // process, pricing, timeline, general
      order: order || 0,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('faqs').insertOne(faq);
    await logActivity(req.user._id, 'create_faq', { faqId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...faq } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update FAQ
router.put('/faqs/:id', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    const result = await mongoose.connection.db.collection('faqs').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'FAQ not found' });
    await logActivity(req.user._id, 'update_faq', { faqId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE FAQ
router.delete('/faqs/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mongoose.connection.db.collection('faqs').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'FAQ not found' });
    await logActivity(req.user._id, 'delete_faq', { faqId: id });
    res.json({ status: 'success', message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// QUOTE REQUESTS MANAGEMENT
// ============================================

// GET all quote requests
router.get('/quotes', protect, restrictTo('super_admin', 'editor', 'lead_manager', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const quotes = await mongoose.connection.db.collection('quoteRequests').find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ status: 'success', data: quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create quote request (public)
router.post('/quotes', async (req, res) => {
  try {
    const { name, email, phone, projectType, budget, timeline, details } = req.body;
    const quote = {
      name,
      email,
      phone: phone || '',
      projectType: projectType || '',
      budget: budget || '',
      timeline: timeline || '',
      details: details || '',
      status: 'new', // new, in-progress, closed
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('quoteRequests').insertOne(quote);
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...quote } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update quote request
router.put('/quotes/:id', protect, restrictTo('super_admin', 'editor', 'lead_manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const update = { updatedAt: new Date() };
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    
    const result = await mongoose.connection.db.collection('quoteRequests').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Quote not found' });
    await logActivity(req.user._id, 'update_quote', { quoteId: id, status });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TEAM MEMBERS MANAGEMENT
// ============================================

// GET all team members
router.get('/team', async (req, res) => {
  try {
    const { includeHidden } = req.query;
    const filter = includeHidden === 'true' ? {} : { visible: { $ne: false } };
    const team = await mongoose.connection.db.collection('teamMembers').find(filter).sort({ order: 1 }).toArray();
    res.json({ status: 'success', data: team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create team member
router.post('/team', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { name, role, bio, photo, socialLinks, order, visible } = req.body;
    const member = {
      name,
      role: role || 'Designer',
      bio: bio || '',
      photo: photo || '',
      socialLinks: socialLinks || { linkedin: '', instagram: '', behance: '' },
      order: order || 0,
      visible: visible !== false,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await mongoose.connection.db.collection('teamMembers').insertOne(member);
    await logActivity(req.user._id, 'create_team_member', { memberId: result.insertedId, name });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...member } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update team member
router.put('/team/:id', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };
    delete update._id;
    const result = await mongoose.connection.db.collection('teamMembers').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Team member not found' });
    await logActivity(req.user._id, 'update_team_member', { memberId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE team member
router.delete('/team/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await mongoose.connection.db.collection('teamMembers').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Team member not found' });
    await logActivity(req.user._id, 'delete_team_member', { memberId: id });
    res.json({ status: 'success', message: 'Team member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SITE SETTINGS
// ============================================

// GET all settings
router.get('/settings', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const settings = await mongoose.connection.db.collection('siteSettings').find({}).toArray();
    const result = {};
    settings.forEach(s => { result[s.key] = s.data; });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update settings
router.put('/settings/:key', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { data } = req.body;
    const result = await mongoose.connection.db.collection('siteSettings').findOneAndUpdate(
      { key },
      { $set: { data, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    await logActivity(req.user._id, 'update_settings', { key });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// NEWSLETTER SUBSCRIBERS
// ============================================

// GET subscribers
router.get('/subscribers', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const subscribers = await mongoose.connection.db.collection('subscribers').find({}).toArray();
    res.json({ status: 'success', data: subscribers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await mongoose.connection.db.collection('subscribers').insertOne({
      email: email.toLowerCase(),
      subscribedAt: new Date()
    });
    res.status(201).json({ status: 'success', message: 'Subscribed successfully' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Already subscribed' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE unsubscribe
router.delete('/subscribe/:email', async (req, res) => {
  try {
    const { email } = req.params;
    await mongoose.connection.db.collection('subscribers').deleteOne({ email: decodeURIComponent(email) });
    res.json({ status: 'success', message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PRESS & AWARDS
// ============================================

// GET press & awards
router.get('/press', async (req, res) => {
  try {
    const press = await mongoose.connection.db.collection('pressAwards').find({}).toArray();
    res.json({ status: 'success', data: press });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST press/award
router.post('/press', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { title, publication, year, url, image } = req.body;
    const item = {
      title,
      publication: publication || '',
      year: year || '',
      url: url || '',
      image: image || '',
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('pressAwards').insertOne(item);
    await logActivity(req.user._id, 'create_press', { pressId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...item } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE press/award
router.delete('/press/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await mongoose.connection.db.collection('pressAwards').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    await logActivity(req.user._id, 'delete_press', { pressId: id });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STYLE LIBRARY / MOOD BOARDS
// ============================================

// GET style items
router.get('/style-library', async (req, res) => {
  try {
    const items = await mongoose.connection.db.collection('styleLibrary').find({}).toArray();
    res.json({ status: 'success', data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST style item
router.post('/style-library', protect, restrictTo('super_admin', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const { name, type, brand, color, notes } = req.body;
    const item = {
      name,
      type: type || 'material', // material, fabric, furniture, paint
      brand: brand || '',
      color: color || '',
      notes: notes || '',
      image: req.file ? '/uploads/' + req.file.filename : '',
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('styleLibrary').insertOne(item);
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...item } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE style item
router.delete('/style-library/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await mongoose.connection.db.collection('styleLibrary').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// FLOOR PLANS
// ============================================

// GET floor plans
router.get('/floor-plans', async (req, res) => {
  try {
    const { projectId } = req.query;
    const filter = projectId ? { projectId } : {};
    const plans = await mongoose.connection.db.collection('floorPlans').find(filter).toArray();
    res.json({ status: 'success', data: plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST floor plan
router.post('/floor-plans', protect, restrictTo('super_admin', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const { projectId, title, description, downloadPermission } = req.body;
    const plan = {
      projectId: projectId || null,
      title,
      description: description || '',
      file: req.file ? '/uploads/' + req.file.filename : '',
      downloadPermission: downloadPermission || 'admin', // admin, all
      createdBy: req.user._id,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('floorPlans').insertOne(plan);
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...plan } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE floor plan
router.delete('/floor-plans/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await mongoose.connection.db.collection('floorPlans').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    res.json({ status: 'success', message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ACTIVITY LOGS
// ============================================

// GET activity logs
router.get('/activity-logs', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const logs = await mongoose.connection.db.collection('activityLogs')
      .find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    const total = await mongoose.connection.db.collection('activityLogs').countDocuments();
    res.json({ status: 'success', data: logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS
// ============================================

// GET basic analytics
router.get('/analytics', protect, restrictTo('admin', 'editor', 'lead_manager'), async (req, res) => {
  try {
    const [
      totalProjects,
      totalMessages,
      totalQuotes,
      unreadMessages,
      newQuotes,
      recentActivity
    ] = await Promise.all([
      mongoose.connection.db.collection('projects').countDocuments(),
      mongoose.connection.db.collection('messages').countDocuments(),
      mongoose.connection.db.collection('quoteRequests').countDocuments(),
      mongoose.connection.db.collection('messages').countDocuments({ read: false }),
      mongoose.connection.db.collection('quoteRequests').countDocuments({ status: 'new' }),
      mongoose.connection.db.collection('activityLogs').find({}).sort({ createdAt: -1 }).limit(10).toArray()
    ]);
    
    res.json({
      status: 'success',
      data: {
        totalProjects,
        totalMessages,
        totalQuotes,
        unreadMessages,
        newQuotes,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PROJECT ENHANCEMENTS (Categories, Status)
// ============================================

// GET project categories
router.get('/project-categories', async (req, res) => {
  try {
    const categories = await mongoose.connection.db.collection('projectCategories').find({}).toArray();
    res.json({ status: 'success', data: categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST project category
router.post('/project-categories', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await mongoose.connection.db.collection('projectCategories').insertOne({
      name,
      description: description || '',
      createdAt: new Date()
    });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, name, description } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project category
router.delete('/project-categories/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    await mongoose.connection.db.collection('projectCategories').deleteOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    res.json({ status: 'success', message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PROJECT STATUS & IMAGE ORDERING
// ============================================

// PATCH update project status
router.patch('/projects/:id/status', protect, restrictTo('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['completed', 'in-progress', 'concept'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await mongoose.connection.db.collection('projects').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Project not found' });
    await logActivity(req.user._id, 'update_project_status', { projectId: id, status });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT reorder project images
router.put('/projects/:id/images/order', protect, restrictTo('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { imageOrder } = req.body; // Array of indices in new order
    const project = await mongoose.connection.db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Reorder images based on provided order
    const reorderedImages = imageOrder.map(idx => project.images[idx]).filter(Boolean);
    const result = await mongoose.connection.db.collection('projects').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { images: reorderedImages, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    await logActivity(req.user._id, 'reorder_project_images', { projectId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH set cover image
router.patch('/projects/:id/cover', protect, restrictTo('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { coverImage } = req.body;
    const result = await mongoose.connection.db.collection('projects').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { coverImage, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Project not found' });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SEO SETTINGS
// ============================================

// GET SEO settings
router.get('/seo', async (req, res) => {
  try {
    const seoSettings = await mongoose.connection.db.collection('seoSettings').find({}).toArray();
    const result = {};
    seoSettings.forEach(s => { result[s.page] = s; });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update SEO settings for a page
router.put('/seo/:page', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { page } = req.params;
    const { title, description, keywords, ogImage } = req.body;
    const result = await mongoose.connection.db.collection('seoSettings').findOneAndUpdate(
      { page },
      { $set: { title, description, keywords, ogImage, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    await logActivity(req.user._id, 'update_seo', { page });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// HOMEPAGE HERO / SLIDER
// ============================================

// GET hero slides
router.get('/hero-slides', async (req, res) => {
  try {
    const slides = await mongoose.connection.db.collection('heroSlides').find({}).sort({ order: 1 }).toArray();
    res.json({ status: 'success', data: slides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create hero slide
router.post('/hero-slides', protect, restrictTo('super_admin', 'editor', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const { headline, subheadline, ctaText, ctaLink, order, active } = req.body;
    const slide = {
      headline: headline || '',
      subheadline: subheadline || '',
      ctaText: ctaText || 'Learn More',
      ctaLink: ctaLink || '#',
      image: req.file ? '/uploads/' + req.file.filename : '',
      order: order || 0,
      active: active !== false,
      createdAt: new Date()
    };
    const result = await mongoose.connection.db.collection('heroSlides').insertOne(slide);
    await logActivity(req.user._id, 'create_hero_slide', { slideId: result.insertedId });
    res.status(201).json({ status: 'success', data: { _id: result.insertedId, ...slide } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update hero slide
router.put('/hero-slides/:id', protect, restrictTo('super_admin', 'editor', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    delete update._id;
    if (req.file) update.image = '/uploads/' + req.file.filename;
    update.updatedAt = new Date();
    
    const result = await mongoose.connection.db.collection('heroSlides').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Slide not found' });
    await logActivity(req.user._id, 'update_hero_slide', { slideId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE hero slide
router.delete('/hero-slides/:id', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await mongoose.connection.db.collection('heroSlides').deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    await logActivity(req.user._id, 'delete_hero_slide', { slideId: id });
    res.json({ status: 'success', message: 'Slide deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT reorder hero slides
router.put('/hero-slides/reorder', protect, restrictTo('super_admin', 'editor', 'admin'), async (req, res) => {
  try {
    const { slides } = req.body; // Array of { id, order }
    const bulkOps = slides.map(s => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(s.id) },
        update: { $set: { order: s.order } }
      }
    }));
    await mongoose.connection.db.collection('heroSlides').bulkWrite(bulkOps);
    await logActivity(req.user._id, 'reorder_hero_slides', {});
    res.json({ status: 'success', message: 'Slides reordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ENHANCED MESSAGES (Internal Notes, Reply, Filter)
// ============================================

// GET messages with filters
router.get('/messages', protect, restrictTo('admin', 'editor', 'lead_manager'), async (req, res) => {
  try {
    const { read, resolved, source, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (read !== undefined) filter.read = read === 'true';
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    if (source) filter.source = source;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await mongoose.connection.db.collection('messages')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    const total = await mongoose.connection.db.collection('messages').countDocuments(filter);
    
    res.json({ 
      status: 'success', 
      data: messages, 
      total, 
      page: parseInt(page), 
      pages: Math.ceil(total / parseInt(limit)) 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update message (mark read, resolved, add notes)
router.patch('/messages/:id', protect, restrictTo('admin', 'editor', 'lead_manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { read, resolved, internalNotes, source } = req.body;
    const update = { updatedAt: new Date() };
    if (read !== undefined) update.read = read;
    if (resolved !== undefined) {
      update.resolved = resolved;
      if (resolved) update.resolvedAt = new Date();
    }
    if (internalNotes !== undefined) update.internalNotes = internalNotes;
    if (source) update.source = source;
    
    const result = await mongoose.connection.db.collection('messages').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Message not found' });
    await logActivity(req.user._id, 'update_message', { messageId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST reply to message (store reply internally)
router.post('/messages/:id/reply', protect, restrictTo('admin', 'editor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Reply content required' });
    
    const result = await mongoose.connection.db.collection('messages').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          repliedBy: req.user._id,
          repliedAt: new Date(),
          reply: reply,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Message not found' });
    await logActivity(req.user._id, 'reply_message', { messageId: id });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS - PROJECT VIEWS & INQUIRY SOURCES
// ============================================

// GET project view analytics
router.get('/analytics/project-views', protect, restrictTo('admin', 'editor', 'lead_manager'), async (req, res) => {
  try {
    const projects = await mongoose.connection.db.collection('projects')
      .find({})
      .sort({ views: -1 })
      .limit(10)
      .project({ title: 1, views: 1, category: 1 })
      .toArray();
    res.json({ status: 'success', data: projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET inquiry source analytics
router.get('/analytics/inquiry-sources', protect, restrictTo('admin', 'editor', 'lead_manager'), async (req, res) => {
  try {
    const sources = await mongoose.connection.db.collection('messages').aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const quoteSources = await mongoose.connection.db.collection('quoteRequests').aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    res.json({ 
      status: 'success', 
      data: { 
        messages: sources,
        quotes: quoteSources
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST track project view (public endpoint)
router.post('/projects/:id/view', async (req, res) => {
  try {
    await mongoose.connection.db.collection('projects').updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $inc: { views: 1 } }
    );
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// USER MANAGEMENT (Admin Roles)
// ============================================

// GET all users (admin only)
router.get('/users', protect, restrictTo('super_admin'), async (req, res) => {
  try {
    const users = await mongoose.connection.db.collection('users')
      .find({})
      .select('firstName lastName email role createdAt')
      .toArray();
    res.json({ status: 'success', data: users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update user role
router.patch('/users/:id/role', protect, restrictTo('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['user', 'viewer', 'editor', 'lead_manager', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await mongoose.connection.db.collection('users').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'User not found' });
    await logActivity(req.user._id, 'update_user_role', { targetUserId: id, role });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// EXPORT DATA (Subscribers, etc.)
// ============================================

// Export subscribers as CSV
router.get('/export/subscribers', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const subscribers = await mongoose.connection.db.collection('subscribers').find({}).toArray();
    const csv = 'Email,Subscribed At\n' + 
      subscribers.map(s => `${s.email},${s.subscribedAt}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export messages as CSV
router.get('/export/messages', protect, restrictTo('super_admin', 'admin'), async (req, res) => {
  try {
    const messages = await mongoose.connection.db.collection('messages').find({}).toArray();
    const csv = 'First Name,Last Name,Email,Message,Source,Read,Resolved,Created At\n' + 
      messages.map(m => `${m.firstName},${m.lastName},${m.email},"${m.message.replace(/"/g, '""')}",${m.source || ''},${m.read},${m.resolved},${m.createdAt}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=messages.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;