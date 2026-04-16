/**
 * ArtSpace Interior Design — Express Backend
 * Production-ready REST API with security best practices (OWASP Top 10)
 */

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss           = require('xss-clean');
const hpp           = require('hpp');
const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const multer        = require('multer');
const path          = require('path');
const fs            = require('fs');
const mongoose      = require('mongoose');
const csrf          = require('csurf');
const cookieParser  = require('cookie-parser');
require('dotenv').config();

const app = express();

/* ══════════════════════════════════════════════
   SECURITY MIDDLEWARE (OWASP Top 10)
══════════════════════════════════════════════ */

// 1. Secure HTTP Headers (prevents XSS, clickjacking, MIME sniffing etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      imgSrc:         ["'self'", "data:", "https://images.unsplash.com", "https://res.cloudinary.com"],
      scriptSrc:      ["'self'"],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// 2. CORS — whitelist allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// 3. Body parsing with size limits (prevents DoS via large payloads)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// 4. NoSQL Injection prevention (sanitises $ and . from req.body/params/query)
app.use(mongoSanitize());

// 5. XSS — clean user-supplied HTML
app.use(xss());

// 6. HTTP Parameter Pollution prevention
app.use(hpp({ whitelist: ['category', 'year'] }));

// 7. Rate limiting — global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// 8. Auth rate limiter — stricter for login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

/* ══════════════════════════════════════════════
   DATABASE CONNECTION
══════════════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/artspace', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

/* ══════════════════════════════════════════════
   MONGOOSE MODELS
══════════════════════════════════════════════ */

// User Schema
const userSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true, maxlength: 50 },
  lastName:   { type: String, required: true, trim: true, maxlength: 50 },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 8, select: false },
  role:       { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt:  { type: Date, default: Date.now },
  loginAttempts: { type: Number, default: 0 },
  lockUntil:  { type: Date },
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

// Project Schema
const projectSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  category:    { type: String, required: true, enum: ['Living Room','Kitchen','Bedroom','Office','Outdoor'] },
  description: { type: String, required: true, maxlength: 2000 },
  location:    { type: String, required: true, maxlength: 100 },
  area:        { type: String, maxlength: 30 },
  year:        { type: String, maxlength: 4 },
  images:      [{ url: String, publicId: String }],
  beforeImage: { url: String, publicId: String },
  featured:    { type: Boolean, default: false },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

const Project = mongoose.model('Project', projectSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName:  { type: String, trim: true, maxlength: 50 },
  email:     { type: String, required: true, trim: true },
  budget:    { type: String },
  message:   { type: String, required: true, maxlength: 1000 },
  read:      { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

/* ══════════════════════════════════════════════
   CSRF PROTECTION
══════════════════════════════════════════════ */
const csrfProtection = csrf({ cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' } });
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/* ══════════════════════════════════════════════
   JWT HELPERS
══════════════════════════════════════════════ */
const JWT_SECRET  = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function sendTokenResponse(user, statusCode, res) {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };
  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({ status: 'success', token, data: { user } });
}

/* ══════════════════════════════════════════════
   AUTH MIDDLEWARE
══════════════════════════════════════════════ */
async function protect(req, res, next) {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }
    if (!token) return res.status(401).json({ error: 'You are not logged in. Please sign in.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists.' });

    req.user = user;
    next();
  } catch (err) {
    // Don't leak sensitive info
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/* ══════════════════════════════════════════════
   INPUT VALIDATION MIDDLEWARE
══════════════════════════════════════════════ */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateBody(rules) {
  return (req, res, next) => {
    for (const [field, { required, minLen, maxLen, type }] of Object.entries(rules)) {
      const val = req.body[field];
      if (required && (val === undefined || val === null || val === '')) {
        return res.status(400).json({ error: `${field} is required.` });
      }
      if (val && type === 'email' && !validateEmail(val)) {
        return res.status(400).json({ error: `${field} must be a valid email address.` });
      }
      if (val && minLen && val.length < minLen) {
        return res.status(400).json({ error: `${field} must be at least ${minLen} characters.` });
      }
      if (val && maxLen && val.length > maxLen) {
        return res.status(400).json({ error: `${field} must be no more than ${maxLen} characters.` });
      }
    }
    next();
  };
}

/* ══════════════════════════════════════════════
   FILE UPLOAD (Multer)
   In production: use Cloudinary or AWS S3
══════════════════════════════════════════════ */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, WEBP, and GIF images are allowed.'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter,
});

// Serve uploads (with cache headers)
app.use('/uploads', express.static(uploadDir, {
  maxAge: '30d',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

/* ══════════════════════════════════════════════
   AUTH ROUTES  /api/auth
══════════════════════════════════════════════ */
const authRouter = express.Router();

// POST /api/auth/register
authRouter.post('/register', authLimiter,
  validateBody({
    firstName: { required: true, minLen: 2, maxLen: 50 },
    email:     { required: true, type: 'email' },
    password:  { required: true, minLen: 8, maxLen: 72 },
  }),
  async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

      const user = await User.create({ firstName, lastName: lastName || '', email, password });
      sendTokenResponse(user, 201, res);
    } catch (err) {
      console.error('Register error:', err.message);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

// POST /api/auth/login
authRouter.post('/login', authLimiter,
  validateBody({
    email:    { required: true, type: 'email' },
    password: { required: true, minLen: 1 },
  }),
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        // Generic message prevents email enumeration
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (user.lockUntil && user.lockUntil > Date.now()) {
        return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
      }
      const ok = await user.comparePassword(password);
      if (!ok) {
        user.loginAttempts++;
        if (user.loginAttempts >= 5) user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save({ validateBeforeSave: false });
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      // Reset on success
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save({ validateBeforeSave: false });
      sendTokenResponse(user, 200, res);
    } catch (err) {
      console.error('Login error:', err.message);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
);

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  res.cookie('jwt', 'logged_out', { expires: new Date(Date.now() + 1000), httpOnly: true });
  res.status(200).json({ status: 'success' });
});

// GET /api/auth/me
authRouter.get('/me', protect, (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
});

app.use('/api/auth', authRouter);

/* ══════════════════════════════════════════════
   PROJECTS ROUTES  /api/projects
══════════════════════════════════════════════ */
const projectsRouter = express.Router();

// GET all projects (public)
projectsRouter.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;

    const projects = await Project.find(filter)
      .sort({ createdAt: -1 })
      .select('-__v')
      .limit(50);
    res.json({ status: 'success', results: projects.length, data: projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// GET single project (public)
projectsRouter.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ status: 'success', data: project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

// POST create project (admin only)
projectsRouter.post('/', protect, restrictTo('admin'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'beforeImage', maxCount: 1 }]),
  validateBody({
    title:       { required: true, minLen: 3, maxLen: 120 },
    category:    { required: true },
    description: { required: true, minLen: 20, maxLen: 2000 },
    location:    { required: true },
  }),
  async (req, res) => {
    try {
      const { title, category, description, location, area, year, featured } = req.body;

      const validCats = ['Living Room','Kitchen','Bedroom','Office','Outdoor'];
      if (!validCats.includes(category)) return res.status(400).json({ error: 'Invalid category.' });

      const images = (req.files?.images || []).map(f => ({
        url: `/uploads/${f.filename}`,
        publicId: f.filename,
      }));

      const beforeImage = req.files?.beforeImage?.[0]
        ? { url: `/uploads/${req.files.beforeImage[0].filename}`, publicId: req.files.beforeImage[0].filename }
        : null;

      const project = await Project.create({
        title, category, description, location, area, year,
        featured: featured === 'true',
        images, beforeImage,
        createdBy: req.user._id,
      });
      res.status(201).json({ status: 'success', data: project });
    } catch (err) {
      console.error('Create project error:', err.message);
      res.status(500).json({ error: 'Failed to create project.' });
    }
  }
);

// PATCH update project (admin only)
projectsRouter.patch('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const allowed = ['title','category','description','location','area','year','featured'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updatedAt = new Date();

    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ status: 'success', data: project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// DELETE project (admin only)
projectsRouter.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    // Clean up uploaded files
    project.images.forEach(img => {
      const fp = path.join(uploadDir, img.publicId);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    res.json({ status: 'success', message: 'Project deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

app.use('/api/projects', projectsRouter);

/* ══════════════════════════════════════════════
   MESSAGES ROUTES  /api/messages
══════════════════════════════════════════════ */
const messagesRouter = express.Router();

// POST — public contact form submission
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many messages. Try again later.' } });

messagesRouter.post('/', contactLimiter,
  validateBody({
    firstName: { required: true, minLen: 2, maxLen: 50 },
    email:     { required: true, type: 'email' },
    message:   { required: true, minLen: 10, maxLen: 1000 },
  }),
  async (req, res) => {
    try {
      const { firstName, lastName, email, budget, message } = req.body;
      await Message.create({ firstName, lastName, email, budget, message });
      res.status(201).json({ status: 'success', message: 'Message received. We will be in touch within 24 hours.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send message.' });
    }
  }
);

// GET all messages (admin only)
messagesRouter.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json({ status: 'success', data: messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// PATCH mark message as read (admin only)
messagesRouter.patch('/:id/read', protect, restrictTo('admin'), async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    res.json({ status: 'success', data: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

app.use('/api/messages', messagesRouter);

/* ══════════════════════════════════════════════
   STATIC FILES — Serve frontend
══════════════════════════════════════════════ */
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ══════════════════════════════════════════════
   GLOBAL ERROR HANDLER
   Never leak stack traces or sensitive info in production
══════════════════════════════════════════════ */
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB per image.' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files. Max 10 images.' });

  // JWT errors
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid session token.' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please sign in again.' });

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map(e => e.message).join('. ');
    return res.status(400).json({ error: msg });
  }

  // CSRF errors
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'Invalid form submission. Please refresh and try again.' });

  // Default — don't leak details in production
  console.error('Unhandled error:', err);
  res.status(err.statusCode || 500).json({
    error: isProd ? 'Something went wrong. Please try again.' : err.message,
  });
});

/* ══════════════════════════════════════════════
   START SERVER
══════════════════════════════════════════════ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ArtSpace server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
