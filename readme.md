# 🎨 ArtSpace — Where Art Meets Elegance

> Premium interior design website with full-stack architecture, role-based authentication, and admin dashboard.

---

## 📁 Project Structure

```
artspace/
├── index.html              ← Frontend (single-page, all pages)
├── server.js               ← Node.js + Express REST API
├── package.json
├── .env.example            ← Copy to .env and fill in values
├── scripts/
│   └── seed.js             ← Seeds demo data to MongoDB
├── public/                 ← (create this folder, put index.html inside)
│   └── index.html
└── uploads/                ← Auto-created on first run (local image storage)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone & Install
```bash
git clone https://github.com/yourname/artspace.git
cd artspace
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
# Edit .env with your values (especially JWT_SECRET and MONGO_URI)
```

### 3. Seed the Database
```bash
npm run seed
```
This creates:
- `admin@artspace.com` / `admin123` (Admin role)
- `user@artspace.com` / `user123` (User role)
- 6 sample portfolio projects

### 4. Place Frontend
```bash
mkdir public
cp index.html public/index.html
```

### 5. Run the Server
```bash
# Development
npm run dev

# Production
npm start
```

Visit: `http://localhost:5000`

---

## 🔐 Authentication

| Role  | Capabilities |
|-------|-------------|
| Guest | View all public content |
| User  | View content + save favourites |
| Admin | Full CRUD on projects, view messages, manage content |

### Demo Credentials
| Email | Password | Role |
|-------|----------|------|
| admin@artspace.com | admin123 | Admin |
| user@artspace.com | user123 | User |

---

## 📡 API Reference

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login (returns JWT) |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/auth/me` | Auth | Get current user |
| GET | `/api/csrf-token` | Public | Get CSRF token |

### Projects
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/projects` | Public | List all projects |
| GET | `/api/projects?category=Kitchen` | Public | Filter by category |
| GET | `/api/projects?featured=true` | Public | Get featured only |
| GET | `/api/projects/:id` | Public | Get single project |
| POST | `/api/projects` | Admin | Create project + upload images |
| PATCH | `/api/projects/:id` | Admin | Update project |
| DELETE | `/api/projects/:id` | Admin | Delete project |

### Messages
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/messages` | Public | Submit contact form |
| GET | `/api/messages` | Admin | View all messages |
| PATCH | `/api/messages/:id/read` | Admin | Mark as read |

---

## 🔒 Security Features (OWASP Top 10)

| Threat | Mitigation |
|--------|-----------|
| **XSS** | `xss-clean` middleware + DOM `textContent`/`sanitize()` in frontend |
| **SQL/NoSQL Injection** | `express-mongo-sanitize`, Mongoose schemas with strict typing |
| **Broken Auth** | bcrypt (cost 12) hashing, JWT with short expiry, account lockout after 5 failed attempts |
| **Broken Access Control** | `protect` + `restrictTo('admin')` middleware on every protected route |
| **CSRF** | `csurf` token middleware for state-changing requests |
| **Security Misconfiguration** | `helmet` (CSP, HSTS, X-Frame-Options, nosniff, etc.) |
| **Sensitive Data Exposure** | Generic error messages in production, password field excluded from queries |
| **Insecure Upload** | MIME type validation, file size limits (10MB), filename sanitization |
| **Rate Limiting** | Express-rate-limit: 10 auth attempts / 15min, 5 contact submissions / hour |
| **HTTPS** | HSTS header set; configure TLS termination at proxy (nginx/Cloudflare) |

---

## ☁️ Production Deployment

### With Nginx (recommended)
```nginx
server {
    listen 443 ssl;
    server_name artspace.co.ke;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment for Production
```env
NODE_ENV=production
JWT_SECRET=<64-char random hex>
MONGO_URI=mongodb+srv://...
```

### Cloud Images (Cloudinary)
Replace the `multer` disk storage in `server.js` with:
```js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const storage = new CloudinaryStorage({ cloudinary, params: { folder: 'artspace' } });
```

---

## 🎨 Customisation

### Colour Palette
Edit CSS variables in `index.html`:
```css
:root {
  --brown-deep: #3E2723;   /* Primary brand colour */
  --gold:       #B8996A;   /* Accent */
  --cream:      #F5EFE6;   /* Light backgrounds */
}
```

### Adding Services
Edit `SERVICES_DATA` array in the `<script>` section of `index.html`.

### Adding Portfolio Items via Admin
1. Login as admin → Dashboard → Upload
2. Fill in details and upload images
3. Project appears immediately in portfolio

---

## 📱 Pages Overview

| Page | Route (SPA hash) | Description |
|------|-----------------|-------------|
| Home | `#home` | Hero, featured projects, stats, process, testimonial |
| Portfolio | `#portfolio` | Filterable grid with Before/After slider in modal |
| Services | `#services` | 6 service cards with pricing |
| About | `#about` | Brand story, team profiles |
| Contact | `#contact` | Form + WhatsApp integration |
| Admin | `#admin` | Dashboard, project management, upload, messages |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework dependency) |
| Typography | Cormorant Garamond (serif) + Jost (sans) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Security | helmet, xss-clean, csurf, hpp, mongo-sanitize, rate-limit |
| Images | Multer (local) / Cloudinary (production) |

---

*ArtSpace Interior Design © 2025 — Nairobi, Kenya*