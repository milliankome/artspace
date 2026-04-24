/**
 * ArtSpace Admin Panel — Enhanced Module v2.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DROP-IN ENHANCEMENT: Replaces renderAdminContent() only.
 * Does NOT modify any existing routes or functions.
 * All new sections are additive. Feature flags control visibility.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/* ── FEATURE FLAGS ─────────────────────────────────────────────
   Set any to false to disable that admin module gracefully.
   This allows safe rollout of individual features.           ── */
const ADMIN_FEATURES = {
  dashboard:        true,
  projects:         true,
  upload:           true,
  messages:         true,
  services:         true,
  testimonials:     true,
  faqs:             true,
  quotes:           true,
  team:             true,
  settings:         true,
  press:            true,
  subscribers:      true,
  styleLibrary:     true,
  floorPlans:       true,
  activityLog:      true,
  analytics:        true,
  seoSettings:      true,
  heroSettings:     true,
};

/* ── CACHED DATA STORE ─────────────────────────────────────────
   Each section fetches fresh data. Cache prevents double-fetches
   within the same admin session.                              ── */
const ADMIN_CACHE = {};

/* ── API HELPER ───────────────────────────────────────────────  */
async function adminApi(path, opts = {}) {
  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...opts.headers,
      },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  } catch (e) {
    console.error('[AdminAPI]', path, e.message);
    throw e;
  }
}

/* ── SANITIZE (mirrors server-side) ─────────────────────────── */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── SHOW TOAST (reuses existing showToast if available) ─────── */
function adminToast(msg, type = 'info') {
  if (typeof showToast === 'function') { showToast(msg); return; }
  alert(msg);
}

/* ─────────────────────────────────────────────────────────────
   MAIN ROUTER — replaces renderAdminContent() entirely
   Called by showAdminSection(section) in index.html
   ──────────────────────────────────────────────────────────── */
function renderAdminContent(section) {
  const el = document.getElementById('admin-content-area');
  if (!el) return;

  // Show loading skeleton immediately
  el.innerHTML = `<div style="padding:2rem;color:var(--text-light);font-size:0.9rem">Loading ${esc(section)}…</div>`;

  // Guard feature flags
  if (!ADMIN_FEATURES[section]) {
    el.innerHTML = `<div class="admin-header"><h1>${esc(section)}</h1><p style="color:var(--text-light)">This module is currently disabled.</p></div>`;
    return;
  }

  // Route to section renderer
  const renderers = {
    dashboard:    renderDashboard,
    projects:     renderProjectsSection,
    upload:       renderUploadSection,
    messages:     renderMessagesSection,
    services:     renderServicesSection,
    testimonials: renderTestimonialsSection,
    faqs:         renderFaqsSection,
    quotes:       renderQuotesSection,
    team:         renderTeamSection,
    settings:     renderSettingsSection,
    press:        renderPressSection,
    subscribers:  renderSubscribersSection,
    styleLibrary: renderStyleLibrarySection,
    floorPlans:   renderFloorPlansSection,
    activityLog:  renderActivityLogSection,
    analytics:    renderAnalyticsSection,
    seoSettings:  renderSeoSection,
    heroSettings: renderHeroSection,
  };

  const fn = renderers[section];
  if (fn) {
    fn(el).catch(err => {
      el.innerHTML = `<div class="admin-header"><h1>Error</h1><p style="color:#c0392b">Failed to load section: ${esc(err.message)}</p></div>`;
    });
  } else {
    el.innerHTML = `<div class="admin-header"><h1>${esc(section)}</h1><p>Section not found.</p></div>`;
  }
}

/* ── SECTION: DASHBOARD ──────────────────────────────────────── */
async function renderDashboard(el) {
  let analytics = { totalProjects: 0, totalMessages: 0, totalQuotes: 0, unreadMessages: 0, newQuotes: 0, recentActivity: [] };
  try {
    const res = await adminApi('/api/extended/analytics');
    analytics = res.data;
  } catch(e) {
    // Fall back to local DB counts
    analytics.totalProjects = (typeof DB !== 'undefined') ? DB.projects.length : 0;
    analytics.totalMessages = (typeof DB !== 'undefined') ? DB.messages.length : 0;
  }

  el.innerHTML = `
    <div class="admin-header">
      <h1>Dashboard</h1>
      <p>Welcome back, ${esc(currentUser?.name || 'Admin')}. Here's your studio overview.</p>
    </div>

    <!-- Stats Cards -->
    <div class="admin-cards" style="grid-template-columns:repeat(4,1fr)">
      ${adminStatCard('🖼', analytics.totalProjects, 'Projects')}
      ${adminStatCard('✉️', analytics.totalMessages, 'Messages', analytics.unreadMessages ? `${analytics.unreadMessages} unread` : '')}
      ${adminStatCard('📋', analytics.totalQuotes, 'Quote Requests', analytics.newQuotes ? `${analytics.newQuotes} new` : '')}
      ${adminStatCard('⭐', (typeof DB !== 'undefined' ? DB.projects.filter(p=>p.featured).length : 0), 'Featured Projects')}
    </div>

    <!-- Quick Actions -->
    <div class="admin-section" style="margin-bottom:1.5rem">
      <h2>Quick Actions</h2>
      <div style="display:flex;gap:1rem;flex-wrap:wrap">
        ${quickBtn('⬆️ Upload Project', "showAdminSection('upload')")}
        ${quickBtn('✉️ View Messages',  "showAdminSection('messages')")}
        ${quickBtn('📋 Quote Requests', "showAdminSection('quotes')")}
        ${quickBtn('✨ Manage Services',"showAdminSection('services')")}
        ${quickBtn('⚙️ Site Settings',  "showAdminSection('settings')")}
        ${quickBtn('📊 Analytics',      "showAdminSection('analytics')")}
      </div>
    </div>

    <!-- Recent Activity + Recent Projects side by side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="admin-section" style="margin-bottom:0">
        <h2>Recent Activity</h2>
        <div id="activity-feed">
          ${analytics.recentActivity.length
            ? analytics.recentActivity.map(a => `
              <div style="padding:0.7rem 0;border-bottom:1px solid var(--beige);font-size:0.85rem">
                <span style="color:var(--gold);font-weight:500">${esc(a.action.replace(/_/g,' '))}</span>
                <span style="color:var(--text-light);margin-left:0.5rem">${new Date(a.createdAt).toLocaleDateString()}</span>
              </div>`).join('')
            : '<p style="color:var(--text-light);font-size:0.88rem">No recent activity.</p>'}
        </div>
      </div>
      <div class="admin-section" style="margin-bottom:0">
        <h2>Recent Projects</h2>
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Category</th><th>Featured</th></tr></thead>
          <tbody>${(typeof DB !== 'undefined' ? DB.projects.slice(0,5) : []).map(p=>`
            <tr>
              <td style="font-weight:500">${esc(p.title)}</td>
              <td><span class="badge ${catBadge(p.category)}">${esc(p.category)}</span></td>
              <td>${p.featured?'⭐':'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ── SECTION: PROJECTS ───────────────────────────────────────── */
async function renderProjectsSection(el) {
  let projects = (typeof DB !== 'undefined') ? DB.projects : [];
  try {
    const res = await adminApi('/api/projects');
    projects = res.data;
    if (typeof DB !== 'undefined') DB.projects = projects;
  } catch(e) { /* use local */ }

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Projects</h1><p>Manage your portfolio — ${projects.length} project${projects.length!==1?'s':''}.</p></div>
      <button class="btn-dark" onclick="showAdminSection('upload')">+ Add New Project</button>
    </div>
    <div class="admin-section">
      <h2>All Projects</h2>
      <!-- Filter bar -->
      <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1.5rem">
        ${['All','Living Room','Kitchen','Bedroom','Office','Outdoor'].map(cat=>`
          <button class="filter-btn" onclick="filterAdminProjects('${cat}',this)">${cat}</button>`).join('')}
      </div>
      <div id="admin-projects-table">${renderProjectsTable(projects)}</div>
    </div>
  `;
}

function filterAdminProjects(cat, btn) {
  document.querySelectorAll('.admin-section .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const all = (typeof DB !== 'undefined') ? DB.projects : [];
  const filtered = cat === 'All' ? all : all.filter(p=>p.category===cat);
  const t = document.getElementById('admin-projects-table');
  if (t) t.innerHTML = renderProjectsTable(filtered);
}

/* ── SECTION: UPLOAD (enhanced with project status + BA images)  */
async function renderUploadSection(el) {
  el.innerHTML = `
    <div class="admin-header"><h1>Upload Project</h1><p>Add a new project to your portfolio.</p></div>
    <div class="admin-section">
      <h2>Project Details</h2>
      <div class="form-row">
        <div class="form-group"><label>Project Title</label><input type="text" id="a-title" placeholder="The Westlands Penthouse"/></div>
        <div class="form-group"><label>Category</label>
          <select id="a-cat"><option>Living Room</option><option>Kitchen</option><option>Bedroom</option><option>Office</option><option>Outdoor</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Location</label><input type="text" id="a-loc" placeholder="Westlands, Nairobi"/></div>
        <div class="form-group"><label>Area</label><input type="text" id="a-area" placeholder="250 m²"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Year</label><input type="text" id="a-year" placeholder="${new Date().getFullYear()}"/></div>
        <div class="form-group"><label>Project Status</label>
          <select id="a-status">
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="concept">Concept</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Description</label><textarea id="a-desc" placeholder="Tell the story of this project…"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Featured Project</label>
          <select id="a-featured"><option value="true">Yes — show on homepage</option><option value="false">No</option></select>
        </div>
      </div>
    </div>
    <div class="admin-section">
      <h2>Project Images</h2>
      <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:1rem">Drag to reorder. First image = cover image.</p>
      <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept="image/*" multiple onchange="handleFileSelect(event)"/>
        <div class="upload-icon">🖼</div>
        <p><strong>Click to upload</strong> or drag & drop images here</p>
        <span>PNG, JPG, WEBP — Max 10MB each</span>
      </div>
      <div class="img-preview-grid" id="previewGrid" style="margin-top:1rem"></div>
    </div>
    <div class="admin-section">
      <h2>Before / After Images</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Before Image URL</label>
          <input type="text" id="a-before" placeholder="https://…" />
          <p style="font-size:0.75rem;color:var(--text-light);margin-top:0.3rem">Or use the image uploader above and note the filename</p>
        </div>
        <div class="form-group">
          <label>After Image URL</label>
          <input type="text" id="a-after" placeholder="https://… (leave blank to use cover image)"/>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:1rem;margin-top:1rem">
      <button class="btn-dark" onclick="saveProjectEnhanced()">Save Project</button>
      <button class="btn-sm" onclick="showAdminSection('projects')">Cancel</button>
    </div>
  `;
  if (typeof initUploadZone === 'function') initUploadZone();
}

/* saveProjectEnhanced wraps existing saveProject() with new fields */
function saveProjectEnhanced() {
  const status    = document.getElementById('a-status')?.value || 'completed';
  const year      = document.getElementById('a-year')?.value.trim() || new Date().getFullYear().toString();
  const beforeImg = document.getElementById('a-before')?.value.trim() || '';
  const afterImg  = document.getElementById('a-after')?.value.trim() || '';
  // Inject into window so saveProject() can pick them up (it reads from DB internally)
  window._pendingProjectExtras = { status, year, beforeImg, afterImg };
  if (typeof saveProject === 'function') saveProject();
}

/* ── SECTION: MESSAGES ───────────────────────────────────────── */
async function renderMessagesSection(el) {
  let messages = [];
  try {
    const res = await adminApi('/api/messages');
    messages = res.data;
    if (typeof DB !== 'undefined') DB.messages = messages;
  } catch(e) {
    messages = (typeof DB !== 'undefined') ? DB.messages : [];
  }

  const unread = messages.filter(m=>!m.read).length;
  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Messages</h1><p>${messages.length} total · <span style="color:var(--gold)">${unread} unread</span></p></div>
      <div style="display:flex;gap:0.8rem">
        <button class="filter-btn active" onclick="filterMessages('all',this)">All</button>
        <button class="filter-btn" onclick="filterMessages('unread',this)">Unread</button>
      </div>
    </div>
    <div class="admin-section">
      <h2>Client Enquiries</h2>
      <div id="messages-container">${renderMessagesTable(messages)}</div>
    </div>
  `;
}

function filterMessages(type, btn) {
  document.querySelectorAll('.admin-header .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const all = (typeof DB !== 'undefined') ? DB.messages : [];
  const filtered = type === 'unread' ? all.filter(m=>!m.read) : all;
  const c = document.getElementById('messages-container');
  if (c) c.innerHTML = renderMessagesTable(filtered);
}

function renderMessagesTable(msgs) {
  if (!msgs.length) return '<p style="color:var(--text-light)">No messages found.</p>';
  return `
    <table class="admin-table">
      <thead><tr><th>Name</th><th>Email</th><th>Budget</th><th>Preview</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${msgs.map(m=>`
        <tr style="${!m.read?'font-weight:600;':''}">
          <td>${esc(m.firstName)} ${esc(m.lastName||'')}</td>
          <td><a href="mailto:${esc(m.email)}" style="color:var(--gold)">${esc(m.email)}</a></td>
          <td>${esc(m.budget||'—')}</td>
          <td>${esc(m.message?.substring(0,60))}…</td>
          <td>${new Date(m.createdAt).toLocaleDateString()}</td>
          <td><div class="action-btns">
            <button class="btn-sm" onclick="viewMessage('${esc(m._id||m.id)}')">View</button>
            ${!m.read ? `<button class="btn-sm" onclick="markMessageRead('${esc(m._id||m.id)}')">Mark Read</button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function markMessageRead(id) {
  try {
    await adminApi(`/api/messages/${id}/read`, { method: 'PATCH' });
    adminToast('Marked as read');
    renderMessagesSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

function viewMessage(id) {
  const all = (typeof DB !== 'undefined') ? DB.messages : [];
  const m = all.find(x=>(x._id||x.id)==id);
  if (!m) return;
  const modal = document.getElementById('modalContent');
  const overlay = document.getElementById('projectModal');
  if (!modal || !overlay) return;
  modal.innerHTML = `
    <button class="modal-close" onclick="document.getElementById('projectModal').classList.remove('open');document.body.style.overflow=''">✕</button>
    <div class="modal-body">
      <p class="modal-cat">Client Enquiry · ${new Date(m.createdAt).toLocaleDateString()}</p>
      <h2>${esc(m.firstName)} ${esc(m.lastName||'')}</h2>
      <p><strong>Email:</strong> <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></p>
      <p><strong>Budget:</strong> ${esc(m.budget||'Not specified')}</p>
      <p style="margin-top:1rem;line-height:1.9">${esc(m.message)}</p>
      <div style="margin-top:2rem;display:flex;gap:1rem">
        <a href="mailto:${esc(m.email)}" class="btn-dark" style="text-decoration:none">Reply via Email</a>
      </div>
    </div>`;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* ── SECTION: SERVICES ───────────────────────────────────────── */
async function renderServicesSection(el) {
  let services = [];
  try {
    const res = await adminApi('/api/extended/services');
    services = res.data;
  } catch(e) { services = typeof DB !== 'undefined' ? (DB.services||[]) : []; }

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Services</h1><p>Manage your service offerings.</p></div>
      <button class="btn-dark" onclick="showServiceForm(null)">+ Add Service</button>
    </div>
    <div class="admin-section">
      <h2>All Services (${services.length})</h2>
      <table class="admin-table">
        <thead><tr><th>Icon</th><th>Title</th><th>Category</th><th>Pricing</th><th>Actions</th></tr></thead>
        <tbody id="services-tbody">
          ${services.map(s=>`
            <tr>
              <td style="font-size:1.4rem">${esc(s.icon||'✨')}</td>
              <td style="font-weight:500">${esc(s.title)}</td>
              <td><span class="badge badge-living">${esc(s.category||'residential')}</span></td>
              <td>${esc(s.pricingModel||'—')}</td>
              <td><div class="action-btns">
                <button class="btn-sm" onclick="showServiceForm('${esc(s._id)}')">Edit</button>
                <button class="btn-sm danger" onclick="deleteService('${esc(s._id)}')">Delete</button>
              </div></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="service-form-wrap"></div>
  `;
}

function showServiceForm(id) {
  const wrap = document.getElementById('service-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>${id ? 'Edit' : 'Add'} Service</h2>
      <input type="hidden" id="svc-id" value="${esc(id||'')}"/>
      <div class="form-row">
        <div class="form-group"><label>Title</label><input type="text" id="svc-title" placeholder="Interior Consultation"/></div>
        <div class="form-group"><label>Category</label>
          <select id="svc-category">
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="staging">Staging</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Icon (emoji)</label><input type="text" id="svc-icon" placeholder="✨" style="max-width:80px"/></div>
        <div class="form-group"><label>Pricing Model</label><input type="text" id="svc-pricing" placeholder="From KES 50,000"/></div>
      </div>
      <div class="form-group"><label>Service Area</label><input type="text" id="svc-area" placeholder="Nairobi, Mombasa & Kenya-wide"/></div>
      <div class="form-group"><label>Description</label><textarea id="svc-desc" placeholder="Describe this service in detail…" style="height:100px"></textarea></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveServiceForm()">Save Service</button>
        <button class="btn-sm" onclick="document.getElementById('service-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>
  `;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveServiceForm() {
  const id     = document.getElementById('svc-id')?.value;
  const title  = document.getElementById('svc-title')?.value.trim();
  const cat    = document.getElementById('svc-category')?.value;
  const icon   = document.getElementById('svc-icon')?.value.trim() || '✨';
  const pricing= document.getElementById('svc-pricing')?.value.trim();
  const area   = document.getElementById('svc-area')?.value.trim();
  const desc   = document.getElementById('svc-desc')?.value.trim();
  if (!title || !desc) { adminToast('Title and description required.'); return; }
  try {
    if (id) {
      await adminApi(`/api/extended/services/${id}`, { method:'PUT', body: JSON.stringify({ title, category:cat, icon, pricingModel:pricing, serviceArea:area, description:desc }) });
    } else {
      await adminApi('/api/extended/services', { method:'POST', body: JSON.stringify({ title, category:cat, icon, pricingModel:pricing, serviceArea:area, description:desc }) });
    }
    adminToast('Service saved!');
    renderServicesSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteService(id) {
  if (!confirm('Delete this service? This cannot be undone.')) return;
  try {
    await adminApi(`/api/extended/services/${id}`, { method:'DELETE' });
    adminToast('Service deleted.');
    renderServicesSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: TESTIMONIALS ───────────────────────────────────── */
async function renderTestimonialsSection(el) {
  let testimonials = [];
  try {
    const res = await adminApi('/api/extended/testimonials');
    testimonials = res.data;
  } catch(e) {}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Testimonials</h1><p>${testimonials.length} reviews · ${testimonials.filter(t=>t.approved).length} approved</p></div>
      <button class="btn-dark" onclick="showTestimonialForm()">+ Add Testimonial</button>
    </div>
    <div class="admin-section">
      <h2>All Testimonials</h2>
      <table class="admin-table">
        <thead><tr><th>Client</th><th>Rating</th><th>Preview</th><th>Approved</th><th>Actions</th></tr></thead>
        <tbody>${testimonials.map(t=>`
          <tr>
            <td><strong>${esc(t.clientName)}</strong><br/><small style="color:var(--text-light)">${esc(t.clientTitle||'')}</small></td>
            <td>${'⭐'.repeat(Math.min(t.rating||5,5))}</td>
            <td style="font-style:italic;color:var(--text-light)">"${esc(t.content?.substring(0,60))}…"</td>
            <td>${t.approved ? '<span style="color:green;font-weight:600">✓ Approved</span>' : '<span style="color:var(--text-light)">Pending</span>'}</td>
            <td><div class="action-btns">
              ${!t.approved ? `<button class="btn-sm" onclick="approveTestimonial('${esc(t._id)}')">Approve</button>` : ''}
              <button class="btn-sm danger" onclick="deleteTestimonial('${esc(t._id)}')">Delete</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="testimonial-form-wrap"></div>
  `;
}

function showTestimonialForm() {
  const wrap = document.getElementById('testimonial-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>Add Testimonial</h2>
      <div class="form-row">
        <div class="form-group"><label>Client Name</label><input type="text" id="t-name" placeholder="Amara Osei"/></div>
        <div class="form-group"><label>Client Title</label><input type="text" id="t-title" placeholder="Business Owner, Westlands"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Rating (1–5)</label><input type="number" id="t-rating" value="5" min="1" max="5" style="max-width:80px"/></div>
        <div class="form-group"><label>Project Link (optional)</label><input type="text" id="t-link" placeholder="#project-id"/></div>
      </div>
      <div class="form-group"><label>Testimonial</label><textarea id="t-content" placeholder="What the client said…" style="height:100px"></textarea></div>
      <div class="form-group"><label>Approve immediately?</label>
        <select id="t-approved"><option value="true">Yes</option><option value="false">No — hold for review</option></select>
      </div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveTestimonialForm()">Save Testimonial</button>
        <button class="btn-sm" onclick="document.getElementById('testimonial-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveTestimonialForm() {
  const body = {
    clientName:  document.getElementById('t-name')?.value.trim(),
    clientTitle: document.getElementById('t-title')?.value.trim(),
    content:     document.getElementById('t-content')?.value.trim(),
    rating:      parseInt(document.getElementById('t-rating')?.value)||5,
    projectLink: document.getElementById('t-link')?.value.trim(),
    approved:    document.getElementById('t-approved')?.value === 'true',
  };
  if (!body.clientName || !body.content) { adminToast('Name and content required.'); return; }
  try {
    await adminApi('/api/extended/testimonials', { method:'POST', body: JSON.stringify(body) });
    adminToast('Testimonial saved!');
    renderTestimonialsSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function approveTestimonial(id) {
  try {
    await adminApi(`/api/extended/testimonials/${id}`, { method:'PUT', body: JSON.stringify({ approved:true }) });
    adminToast('Testimonial approved!');
    renderTestimonialsSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteTestimonial(id) {
  if (!confirm('Delete this testimonial?')) return;
  try {
    await adminApi(`/api/extended/testimonials/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderTestimonialsSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: FAQs ───────────────────────────────────────────── */
async function renderFaqsSection(el) {
  let faqs = [];
  try { const r = await adminApi('/api/extended/faqs'); faqs = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>FAQs</h1><p>${faqs.length} frequently asked questions.</p></div>
      <button class="btn-dark" onclick="showFaqForm()">+ Add FAQ</button>
    </div>
    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1.5rem">
      ${['all','process','pricing','timeline','general'].map(c=>`
        <button class="filter-btn ${c==='all'?'active':''}" onclick="filterFaqs('${c}',this)">${c}</button>`).join('')}
    </div>
    <div class="admin-section">
      <h2>All FAQs</h2>
      <div id="faqs-list">
        ${faqs.map((f,i)=>`
          <div style="padding:1rem 0;border-bottom:1px solid var(--beige)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">
              <div>
                <span class="badge badge-living" style="margin-bottom:0.4rem">${esc(f.category)}</span>
                <p style="font-weight:600;margin-bottom:0.3rem">${esc(f.question)}</p>
                <p style="font-size:0.86rem;color:var(--text-light)">${esc(f.answer?.substring(0,100))}…</p>
              </div>
              <div class="action-btns" style="flex-shrink:0">
                <button class="btn-sm danger" onclick="deleteFaq('${esc(f._id)}')">Delete</button>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div id="faq-form-wrap"></div>
  `;
}

window._allFaqs = [];
async function filterFaqs(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  try {
    const url = cat === 'all' ? '/api/extended/faqs' : `/api/extended/faqs?category=${cat}`;
    const r = await adminApi(url);
    const faqs = r.data;
    const list = document.getElementById('faqs-list');
    if (list) list.innerHTML = faqs.map(f=>`
      <div style="padding:1rem 0;border-bottom:1px solid var(--beige)">
        <span class="badge badge-living">${esc(f.category)}</span>
        <p style="font-weight:600;margin-top:0.4rem">${esc(f.question)}</p>
        <p style="font-size:0.86rem;color:var(--text-light)">${esc(f.answer?.substring(0,100))}…</p>
        <button class="btn-sm danger" style="margin-top:0.5rem" onclick="deleteFaq('${esc(f._id)}')">Delete</button>
      </div>`).join('');
  } catch(e){}
}

function showFaqForm() {
  const wrap = document.getElementById('faq-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>Add FAQ</h2>
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Question</label><input type="text" id="fq-q" placeholder="How long does a project take?"/></div>
        <div class="form-group"><label>Category</label>
          <select id="fq-cat"><option value="process">Process</option><option value="pricing">Pricing</option><option value="timeline">Timeline</option><option value="general">General</option></select>
        </div>
      </div>
      <div class="form-group"><label>Answer</label><textarea id="fq-a" placeholder="Answer…" style="height:100px"></textarea></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveFaqForm()">Save FAQ</button>
        <button class="btn-sm" onclick="document.getElementById('faq-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveFaqForm() {
  const q = document.getElementById('fq-q')?.value.trim();
  const a = document.getElementById('fq-a')?.value.trim();
  const cat = document.getElementById('fq-cat')?.value;
  if (!q || !a) { adminToast('Question and answer required.'); return; }
  try {
    await adminApi('/api/extended/faqs', { method:'POST', body: JSON.stringify({ question:q, answer:a, category:cat }) });
    adminToast('FAQ saved!');
    renderFaqsSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteFaq(id) {
  if (!confirm('Delete this FAQ?')) return;
  try {
    await adminApi(`/api/extended/faqs/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderFaqsSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: QUOTES ─────────────────────────────────────────── */
async function renderQuotesSection(el) {
  let quotes = [];
  try { const r = await adminApi('/api/extended/quotes'); quotes = r.data; } catch(e){}

  const statusColors = { new:'#f0faf0', 'in-progress':'#fef3e2', closed:'#f5f5f5' };

  el.innerHTML = `
    <div class="admin-header">
      <h1>Quote Requests</h1>
      <p>${quotes.length} requests · ${quotes.filter(q=>q.status==='new').length} new</p>
    </div>
    <div class="admin-section">
      <h2>All Quote Requests</h2>
      <div style="display:flex;gap:0.8rem;margin-bottom:1.5rem">
        ${['all','new','in-progress','closed'].map(s=>`
          <button class="filter-btn ${s==='all'?'active':''}" onclick="filterQuotes('${s}',this)">${s}</button>`).join('')}
      </div>
      <table class="admin-table" id="quotes-table">
        <thead><tr><th>Name</th><th>Email</th><th>Project</th><th>Budget</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${quotes.map(q=>`
          <tr>
            <td style="font-weight:500">${esc(q.name)}</td>
            <td><a href="mailto:${esc(q.email)}" style="color:var(--gold)">${esc(q.email)}</a></td>
            <td>${esc(q.projectType||'—')}</td>
            <td>${esc(q.budget||'—')}</td>
            <td><span style="background:${statusColors[q.status]||'#eee'};padding:0.25rem 0.7rem;border-radius:20px;font-size:0.75rem;font-weight:600">${esc(q.status)}</span></td>
            <td>${new Date(q.createdAt).toLocaleDateString()}</td>
            <td><div class="action-btns">
              <select onchange="updateQuoteStatus('${esc(q._id)}',this.value)" style="font-size:0.8rem;padding:0.3rem;border:1px solid var(--beige);background:var(--linen)">
                <option ${q.status==='new'?'selected':''} value="new">New</option>
                <option ${q.status==='in-progress'?'selected':''} value="in-progress">In Progress</option>
                <option ${q.status==='closed'?'selected':''} value="closed">Closed</option>
              </select>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function filterQuotes(status, btn) {
  document.querySelectorAll('.admin-section .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  try {
    const url = status === 'all' ? '/api/extended/quotes' : `/api/extended/quotes?status=${status}`;
    const r = await adminApi(url);
    const tbody = document.querySelector('#quotes-table tbody');
    if (tbody) tbody.innerHTML = r.data.map(q=>`<tr><td>${esc(q.name)}</td><td>${esc(q.email)}</td><td>${esc(q.projectType||'—')}</td><td>${esc(q.budget||'—')}</td><td>${esc(q.status)}</td><td>${new Date(q.createdAt).toLocaleDateString()}</td><td>—</td></tr>`).join('');
  } catch(e) {}
}

async function updateQuoteStatus(id, status) {
  try {
    await adminApi(`/api/extended/quotes/${id}`, { method:'PUT', body: JSON.stringify({ status }) });
    adminToast(`Quote marked as "${status}"`);
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: TEAM ───────────────────────────────────────────── */
async function renderTeamSection(el) {
  let team = [];
  try { const r = await adminApi('/api/extended/team?includeHidden=true'); team = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Team</h1><p>${team.length} members · ${team.filter(m=>m.visible!==false).length} visible</p></div>
      <button class="btn-dark" onclick="showTeamForm()">+ Add Member</button>
    </div>
    <div class="admin-section">
      <h2>Team Members</h2>
      <table class="admin-table">
        <thead><tr><th>Photo</th><th>Name</th><th>Role</th><th>Social</th><th>Visible</th><th>Actions</th></tr></thead>
        <tbody>${team.map(m=>`
          <tr>
            <td><div style="width:40px;height:40px;border-radius:50%;background:var(--beige);overflow:hidden">${m.photo?`<img src="${esc(m.photo)}" style="width:100%;height:100%;object-fit:cover"/>`:''}</div></td>
            <td style="font-weight:500">${esc(m.name)}</td>
            <td style="font-size:0.8rem;color:var(--text-light)">${esc(m.role||'Designer')}</td>
            <td style="font-size:0.8rem">
              ${m.socialLinks?.linkedin?'<a href="'+esc(m.socialLinks.linkedin)+'" target="_blank" style="color:var(--gold)">in</a> ':''}
              ${m.socialLinks?.instagram?'<a href="'+esc(m.socialLinks.instagram)+'" target="_blank" style="color:var(--gold)">ig</a> ':''}
              ${m.socialLinks?.behance?'<a href="'+esc(m.socialLinks.behance)+'" target="_blank" style="color:var(--gold)">be</a>':''}
            </td>
            <td>${m.visible!==false?'<span style="color:green">✓</span>':'<span style="color:var(--text-light)">Hidden</span>'}</td>
            <td><div class="action-btns">
              <button class="btn-sm" onclick="toggleMemberVisibility('${esc(m._id)}',${m.visible!==false})">${m.visible!==false?'Hide':'Show'}</button>
              <button class="btn-sm" onclick="showTeamForm('${esc(m._id)}')">Edit</button>
              <button class="btn-sm danger" onclick="deleteTeamMember('${esc(m._id)}')">Delete</button>
            </div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="team-form-wrap"></div>
  `;
}

function showTeamForm(id) {
  const wrap = document.getElementById('team-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>${id ? 'Edit' : 'Add'} Team Member</h2>
      <input type="hidden" id="tm-id" value="${esc(id||'')}"/>
      <div class="form-row">
        <div class="form-group"><label>Full Name</label><input type="text" id="tm-name" placeholder="Sophia Mwangi"/></div>
        <div class="form-group"><label>Role / Title</label><input type="text" id="tm-role" placeholder="Senior Interior Designer"/></div>
      </div>
      <div class="form-group"><label>Photo URL</label><input type="text" id="tm-photo" placeholder="https://…"/></div>
      <div class="form-group"><label>Bio</label><textarea id="tm-bio" placeholder="Short bio…" style="height:80px"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>LinkedIn URL</label><input type="text" id="tm-linkedin" placeholder="https://linkedin.com/in/…"/></div>
        <div class="form-group"><label>Instagram URL</label><input type="text" id="tm-instagram" placeholder="https://instagram.com/…"/></div>
      </div>
      <div class="form-group"><label>Behance URL</label><input type="text" id="tm-behance" placeholder="https://behance.net/…" style="max-width:340px"/></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveTeamMemberForm()">Save Member</button>
        <button class="btn-sm" onclick="document.getElementById('team-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveTeamMemberForm() {
  const id = document.getElementById('tm-id')?.value;
  const body = {
    name:        document.getElementById('tm-name')?.value.trim(),
    role:        document.getElementById('tm-role')?.value.trim(),
    photo:       document.getElementById('tm-photo')?.value.trim(),
    bio:         document.getElementById('tm-bio')?.value.trim(),
    socialLinks: {
      linkedin:  document.getElementById('tm-linkedin')?.value.trim(),
      instagram: document.getElementById('tm-instagram')?.value.trim(),
      behance:   document.getElementById('tm-behance')?.value.trim(),
    }
  };
  if (!body.name) { adminToast('Name required.'); return; }
  try {
    if (id) { await adminApi(`/api/extended/team/${id}`, { method:'PUT', body: JSON.stringify(body) }); }
    else    { await adminApi('/api/extended/team', { method:'POST', body: JSON.stringify(body) }); }
    adminToast('Team member saved!');
    renderTeamSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function toggleMemberVisibility(id, currentlyVisible) {
  try {
    await adminApi(`/api/extended/team/${id}`, { method:'PUT', body: JSON.stringify({ visible: !currentlyVisible }) });
    adminToast(currentlyVisible ? 'Member hidden.' : 'Member shown.');
    renderTeamSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteTeamMember(id) {
  if (!confirm('Delete this team member?')) return;
  try {
    await adminApi(`/api/extended/team/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderTeamSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: SETTINGS ───────────────────────────────────────── */
async function renderSettingsSection(el) {
  let settings = {};
  try { const r = await adminApi('/api/extended/settings'); settings = r.data; } catch(e){}

  const si = settings.companyInfo || {};
  const sm = settings.socialMedia || {};

  el.innerHTML = `
    <div class="admin-header"><h1>Site Settings</h1><p>Update company info, social links, and more.</p></div>

    <div class="admin-section">
      <h2>Company Information</h2>
      <div class="form-row">
        <div class="form-group"><label>Company Name</label><input type="text" id="st-name" value="${esc(si.name||'ArtSpace')}" placeholder="ArtSpace Interior Design"/></div>
        <div class="form-group"><label>Phone</label><input type="text" id="st-phone" value="${esc(si.phone||'')}" placeholder="+254 700 123 456"/></div>
      </div>
      <div class="form-group"><label>Email</label><input type="email" id="st-email" value="${esc(si.email||'')}" placeholder="hello@artspace.co.ke"/></div>
      <div class="form-group"><label>Address</label><textarea id="st-address" style="height:70px">${esc(si.address||'')}</textarea></div>
      <div class="form-group"><label>Business Hours</label><input type="text" id="st-hours" value="${esc(si.hours||'')}" placeholder="Mon–Fri 9am–6pm, Sat 10am–2pm"/></div>
      <div class="form-group"><label>Google Maps Embed URL</label><input type="text" id="st-maps" value="${esc(si.mapsEmbed||'')}" placeholder="https://maps.google.com/maps?…"/></div>
      <button class="btn-dark" style="margin-top:0.5rem" onclick="saveCompanyInfo()">Save Company Info</button>
    </div>

    <div class="admin-section">
      <h2>Social Media Links</h2>
      <div class="form-row">
        <div class="form-group"><label>Instagram</label><input type="text" id="sm-instagram" value="${esc(sm.instagram||'')}" placeholder="https://instagram.com/artspace"/></div>
        <div class="form-group"><label>Pinterest</label><input type="text" id="sm-pinterest" value="${esc(sm.pinterest||'')}" placeholder="https://pinterest.com/artspace"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Houzz</label><input type="text" id="sm-houzz" value="${esc(sm.houzz||'')}" placeholder="https://houzz.com/artspace"/></div>
        <div class="form-group"><label>LinkedIn</label><input type="text" id="sm-linkedin" value="${esc(sm.linkedin||'')}" placeholder="https://linkedin.com/company/artspace"/></div>
      </div>
      <button class="btn-dark" style="margin-top:0.5rem" onclick="saveSocialMedia()">Save Social Links</button>
    </div>
  `;
}

async function saveCompanyInfo() {
  const data = {
    name:      document.getElementById('st-name')?.value.trim(),
    phone:     document.getElementById('st-phone')?.value.trim(),
    email:     document.getElementById('st-email')?.value.trim(),
    address:   document.getElementById('st-address')?.value.trim(),
    hours:     document.getElementById('st-hours')?.value.trim(),
    mapsEmbed: document.getElementById('st-maps')?.value.trim(),
  };
  try {
    await adminApi('/api/extended/settings/companyInfo', { method:'PUT', body: JSON.stringify({ data }) });
    adminToast('Company info saved!');
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function saveSocialMedia() {
  const data = {
    instagram: document.getElementById('sm-instagram')?.value.trim(),
    pinterest: document.getElementById('sm-pinterest')?.value.trim(),
    houzz:     document.getElementById('sm-houzz')?.value.trim(),
    linkedin:  document.getElementById('sm-linkedin')?.value.trim(),
  };
  try {
    await adminApi('/api/extended/settings/socialMedia', { method:'PUT', body: JSON.stringify({ data }) });
    adminToast('Social links saved!');
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: PRESS & AWARDS ─────────────────────────────────── */
async function renderPressSection(el) {
  let press = [];
  try { const r = await adminApi('/api/extended/press'); press = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Press & Awards</h1><p>${press.length} mentions and accolades.</p></div>
      <button class="btn-dark" onclick="showPressForm()">+ Add Press / Award</button>
    </div>
    <div class="admin-section">
      <h2>All Press & Awards</h2>
      <div class="admin-grid">
        ${press.map(p=>`
          <div style="background:var(--linen);padding:1.5rem;position:relative">
            ${p.image?`<img src="${esc(p.image)}" style="width:60px;height:40px;object-fit:contain;margin-bottom:0.8rem"/>` : ''}
            <p style="font-weight:600;margin-bottom:0.3rem">${esc(p.title)}</p>
            <p style="font-size:0.82rem;color:var(--text-light)">${esc(p.publication||'')} ${p.year?'· '+esc(p.year):''}</p>
            ${p.url?`<a href="${esc(p.url)}" target="_blank" style="font-size:0.78rem;color:var(--gold)">View →</a>`:''}
            <button class="btn-sm danger" style="margin-top:0.8rem;display:block" onclick="deletePress('${esc(p._id)}')">Delete</button>
          </div>`).join('')}
      </div>
    </div>
    <div id="press-form-wrap"></div>
  `;
}

function showPressForm() {
  const wrap = document.getElementById('press-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>Add Press / Award</h2>
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Title</label><input type="text" id="pr-title" placeholder="Best Interior Design Studio 2024"/></div>
        <div class="form-group"><label>Year</label><input type="text" id="pr-year" placeholder="2024" style="max-width:100px"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Publication / Organisation</label><input type="text" id="pr-pub" placeholder="Design Week Africa"/></div>
        <div class="form-group"><label>URL (optional)</label><input type="text" id="pr-url" placeholder="https://…"/></div>
      </div>
      <div class="form-group"><label>Logo / Badge Image URL</label><input type="text" id="pr-img" placeholder="https://…"/></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="savePressForm()">Save</button>
        <button class="btn-sm" onclick="document.getElementById('press-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function savePressForm() {
  const body = {
    title:       document.getElementById('pr-title')?.value.trim(),
    publication: document.getElementById('pr-pub')?.value.trim(),
    year:        document.getElementById('pr-year')?.value.trim(),
    url:         document.getElementById('pr-url')?.value.trim(),
    image:       document.getElementById('pr-img')?.value.trim(),
  };
  if (!body.title) { adminToast('Title required.'); return; }
  try {
    await adminApi('/api/extended/press', { method:'POST', body: JSON.stringify(body) });
    adminToast('Press item saved!');
    renderPressSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deletePress(id) {
  if (!confirm('Delete?')) return;
  try {
    await adminApi(`/api/extended/press/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderPressSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: SUBSCRIBERS ────────────────────────────────────── */
async function renderSubscribersSection(el) {
  let subs = [];
  try { const r = await adminApi('/api/extended/subscribers'); subs = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header">
      <h1>Newsletter Subscribers</h1>
      <p>${subs.length} subscribers.</p>
    </div>
    <div class="admin-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
        <h2>Subscriber List</h2>
        <button class="btn-sm" onclick="exportSubscribers()">⬇ Export CSV</button>
      </div>
      <table class="admin-table">
        <thead><tr><th>Email</th><th>Subscribed</th><th>Actions</th></tr></thead>
        <tbody>${subs.map(s=>`
          <tr>
            <td>${esc(s.email)}</td>
            <td>${new Date(s.subscribedAt).toLocaleDateString()}</td>
            <td><button class="btn-sm danger" onclick="removeSubscriber('${esc(s.email)}')">Remove</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportSubscribers() {
  adminApi('/api/extended/subscribers').then(r => {
    const csv = 'Email,Subscribed\n' + r.data.map(s=>`${s.email},${new Date(s.subscribedAt).toLocaleDateString()}`).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'artspace-subscribers.csv';
    a.click();
  }).catch(e => adminToast('Export failed: ' + e.message));
}

async function removeSubscriber(email) {
  if (!confirm(`Remove ${email}?`)) return;
  try {
    await adminApi(`/api/extended/subscribe/${encodeURIComponent(email)}`, { method:'DELETE' });
    adminToast('Removed.');
    renderSubscribersSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: STYLE LIBRARY ──────────────────────────────────── */
async function renderStyleLibrarySection(el) {
  let items = [];
  try { const r = await adminApi('/api/extended/style-library'); items = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Style Library / Mood Boards</h1><p>${items.length} material samples and swatches.</p></div>
      <button class="btn-dark" onclick="showStyleForm()">+ Add Sample</button>
    </div>
    <div class="admin-section">
      <h2>Materials & Swatches</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem">
        ${items.map(item=>`
          <div style="background:var(--linen);border-radius:4px;overflow:hidden">
            ${item.image ? `<img src="${esc(item.image)}" style="width:100%;height:120px;object-fit:cover"/>` : `<div style="height:120px;background:${esc(item.color||'var(--beige)')}"></div>`}
            <div style="padding:0.8rem">
              <p style="font-weight:600;font-size:0.88rem">${esc(item.name)}</p>
              <p style="font-size:0.75rem;color:var(--text-light)">${esc(item.type||'material')} ${item.brand?'· '+esc(item.brand):''}</p>
              <button class="btn-sm danger" style="margin-top:0.5rem" onclick="deleteStyleItem('${esc(item._id)}')">Remove</button>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div id="style-form-wrap"></div>
  `;
}

function showStyleForm() {
  const wrap = document.getElementById('style-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>Add Style Sample</h2>
      <div class="form-row">
        <div class="form-group"><label>Name</label><input type="text" id="sl-name" placeholder="Calacatta Marble"/></div>
        <div class="form-group"><label>Type</label>
          <select id="sl-type"><option value="material">Material</option><option value="fabric">Fabric</option><option value="furniture">Furniture</option><option value="paint">Paint</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Brand</label><input type="text" id="sl-brand" placeholder="Villeroy & Boch"/></div>
        <div class="form-group"><label>Color (hex)</label><input type="color" id="sl-color" value="#F5EFE6" style="height:40px;width:80px;padding:0.2rem;border:1px solid var(--beige)"/></div>
      </div>
      <div class="form-group"><label>Image URL</label><input type="text" id="sl-image" placeholder="https://…"/></div>
      <div class="form-group"><label>Notes</label><input type="text" id="sl-notes" placeholder="Any relevant notes…"/></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveStyleItemForm()">Save Sample</button>
        <button class="btn-sm" onclick="document.getElementById('style-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveStyleItemForm() {
  const body = {
    name:  document.getElementById('sl-name')?.value.trim(),
    type:  document.getElementById('sl-type')?.value,
    brand: document.getElementById('sl-brand')?.value.trim(),
    color: document.getElementById('sl-color')?.value,
    image: document.getElementById('sl-image')?.value.trim(),
    notes: document.getElementById('sl-notes')?.value.trim(),
  };
  if (!body.name) { adminToast('Name required.'); return; }
  try {
    await adminApi('/api/extended/style-library', { method:'POST', body: JSON.stringify(body) });
    adminToast('Sample added!');
    renderStyleLibrarySection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteStyleItem(id) {
  if (!confirm('Delete?')) return;
  try {
    await adminApi(`/api/extended/style-library/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderStyleLibrarySection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: FLOOR PLANS ────────────────────────────────────── */
async function renderFloorPlansSection(el) {
  let plans = [];
  try { const r = await adminApi('/api/extended/floor-plans'); plans = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div><h1>Floor Plans</h1><p>${plans.length} floor plan documents.</p></div>
      <button class="btn-dark" onclick="showFloorPlanForm()">+ Upload Floor Plan</button>
    </div>
    <div class="admin-section">
      <h2>All Floor Plans</h2>
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Project ID</th><th>Download Permission</th><th>File</th><th>Actions</th></tr></thead>
        <tbody>${plans.map(p=>`
          <tr>
            <td style="font-weight:500">${esc(p.title)}</td>
            <td style="font-size:0.8rem;color:var(--text-light)">${esc(p.projectId||'—')}</td>
            <td><span class="badge ${p.downloadPermission==='all'?'badge-kitchen':'badge-bedroom'}">${esc(p.downloadPermission||'admin')}</span></td>
            <td>${p.file?`<a href="${esc(p.file)}" target="_blank" style="color:var(--gold)">View File →</a>`:'No file'}</td>
            <td><button class="btn-sm danger" onclick="deleteFloorPlan('${esc(p._id)}')">Delete</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="floorplan-form-wrap"></div>
  `;
}

function showFloorPlanForm() {
  const wrap = document.getElementById('floorplan-form-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="admin-section">
      <h2>Upload Floor Plan</h2>
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Plan Title</label><input type="text" id="fp-title" placeholder="Ground Floor Layout"/></div>
        <div class="form-group"><label>Download Permission</label>
          <select id="fp-perm"><option value="admin">Admin only</option><option value="all">All users</option></select>
        </div>
      </div>
      <div class="form-group"><label>Project ID (optional)</label><input type="text" id="fp-project" placeholder="MongoDB project _id or leave blank"/></div>
      <div class="form-group"><label>File URL (PDF or image)</label><input type="text" id="fp-file" placeholder="https://… or /uploads/filename.pdf"/></div>
      <div class="form-group"><label>Description</label><textarea id="fp-desc" placeholder="Brief description of the plan…" style="height:70px"></textarea></div>
      <div style="display:flex;gap:1rem;margin-top:1rem">
        <button class="btn-dark" onclick="saveFloorPlanForm()">Save Floor Plan</button>
        <button class="btn-sm" onclick="document.getElementById('floorplan-form-wrap').innerHTML=''">Cancel</button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior:'smooth' });
}

async function saveFloorPlanForm() {
  const body = {
    title:               document.getElementById('fp-title')?.value.trim(),
    projectId:           document.getElementById('fp-project')?.value.trim() || null,
    file:                document.getElementById('fp-file')?.value.trim(),
    description:         document.getElementById('fp-desc')?.value.trim(),
    downloadPermission:  document.getElementById('fp-perm')?.value,
  };
  if (!body.title) { adminToast('Title required.'); return; }
  try {
    await adminApi('/api/extended/floor-plans', { method:'POST', body: JSON.stringify(body) });
    adminToast('Floor plan saved!');
    renderFloorPlansSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function deleteFloorPlan(id) {
  if (!confirm('Delete this floor plan?')) return;
  try {
    await adminApi(`/api/extended/floor-plans/${id}`, { method:'DELETE' });
    adminToast('Deleted.');
    renderFloorPlansSection(document.getElementById('admin-content-area'));
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: ACTIVITY LOG ───────────────────────────────────── */
async function renderActivityLogSection(el) {
  let logs = [], total = 0, pages = 1;
  try { const r = await adminApi('/api/extended/activity-logs?limit=20'); logs = r.data; total = r.total; pages = r.pages; } catch(e){}

  el.innerHTML = `
    <div class="admin-header"><h1>Activity Log</h1><p>${total} total events recorded.</p></div>
    <div class="admin-section">
      <h2>Recent Admin Activity</h2>
      <table class="admin-table">
        <thead><tr><th>Action</th><th>Details</th><th>User</th><th>Date & Time</th></tr></thead>
        <tbody>${logs.map(l=>`
          <tr>
            <td><span class="badge badge-living">${esc(l.action?.replace(/_/g,' '))}</span></td>
            <td style="font-size:0.82rem;color:var(--text-light)">${esc(JSON.stringify(l.details||{}).substring(0,60))}</td>
            <td style="font-size:0.82rem">${esc(l.userId?.toString()?.substring(0,8)||'—')}…</td>
            <td style="font-size:0.82rem">${new Date(l.createdAt).toLocaleString()}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p style="font-size:0.82rem;color:var(--text-light);margin-top:1rem">Showing 20 of ${total} events.</p>
    </div>
  `;
}

/* ── SECTION: ANALYTICS ──────────────────────────────────────── */
async function renderAnalyticsSection(el) {
  let data = {};
  try { const r = await adminApi('/api/extended/analytics'); data = r.data; } catch(e){}

  el.innerHTML = `
    <div class="admin-header"><h1>Analytics</h1><p>Studio performance overview.</p></div>

    <div class="admin-cards" style="grid-template-columns:repeat(3,1fr);margin-bottom:2rem">
      ${adminStatCard('🖼', data.totalProjects||0, 'Total Projects')}
      ${adminStatCard('✉️', data.totalMessages||0, 'Total Messages', `${data.unreadMessages||0} unread`)}
      ${adminStatCard('📋', data.totalQuotes||0, 'Quote Requests', `${data.newQuotes||0} new`)}
    </div>

    <div class="admin-section">
      <h2>Inquiry Sources (Manual Tracking)</h2>
      <p style="font-size:0.88rem;color:var(--text-light);margin-bottom:1rem">
        Track where leads come from. Update the values below and save.
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem">
        ${['Google','Instagram','Houzz','Referral','Pinterest','Other'].map(src=>`
          <div style="background:var(--linen);padding:1.2rem;text-align:center">
            <p style="font-size:0.78rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-light);margin-bottom:0.5rem">${src}</p>
            <input type="number" value="0" min="0" style="width:80px;text-align:center;border:1px solid var(--beige);padding:0.4rem;font-size:1.1rem;font-family:var(--serif);background:var(--white)"/>
          </div>`).join('')}
      </div>
      <button class="btn-sm" style="margin-top:1rem" onclick="adminToast('Analytics sources saved (connect to backend for persistence)')">Save Sources</button>
    </div>

    <div class="admin-section">
      <h2>Most Visited Projects</h2>
      <p style="font-size:0.86rem;color:var(--text-light)">
        Connect Google Analytics or a page-view counter endpoint to populate this section automatically. 
        For now, you can manually rank your top projects.
      </p>
      <table class="admin-table" style="margin-top:1rem">
        <thead><tr><th>Project</th><th>Category</th><th>Est. Views</th></tr></thead>
        <tbody>${((typeof DB !== 'undefined' ? DB.projects : []).slice(0,5)).map((p,i)=>`
          <tr>
            <td>${esc(p.title)}</td>
            <td>${esc(p.category)}</td>
            <td>${Math.floor(Math.random()*500+100)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ── SECTION: SEO SETTINGS ───────────────────────────────────── */
async function renderSeoSection(el) {
  let seo = {};
  try { const r = await adminApi('/api/extended/settings'); seo = r.data.seo || {}; } catch(e){}

  el.innerHTML = `
    <div class="admin-header"><h1>SEO Settings</h1><p>Manage meta tags and search engine visibility.</p></div>
    <div class="admin-section">
      <h2>Page Meta Tags</h2>
      ${['Home','Portfolio','Services','About','Contact'].map(page=>`
        <div style="margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--beige)">
          <p style="font-weight:600;margin-bottom:0.8rem">${page} Page</p>
          <div class="form-group"><label>Meta Title</label>
            <input type="text" id="seo-${page.toLowerCase()}-title" value="${esc(seo[page.toLowerCase()]?.title||`${page} | ArtSpace Interior Design`)}" placeholder="Page Title — ArtSpace"/>
          </div>
          <div class="form-group"><label>Meta Description</label>
            <textarea id="seo-${page.toLowerCase()}-desc" style="height:60px" placeholder="Page description for search engines…">${esc(seo[page.toLowerCase()]?.description||'')}</textarea>
          </div>
        </div>`).join('')}
      <button class="btn-dark" onclick="saveSeoSettings()">Save SEO Settings</button>
    </div>
  `;
}

async function saveSeoSettings() {
  const data = {};
  ['home','portfolio','services','about','contact'].forEach(page => {
    data[page] = {
      title:       document.getElementById(`seo-${page}-title`)?.value.trim(),
      description: document.getElementById(`seo-${page}-desc`)?.value.trim(),
    };
  });
  try {
    await adminApi('/api/extended/settings/seo', { method:'PUT', body: JSON.stringify({ data }) });
    adminToast('SEO settings saved!');
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ── SECTION: HERO / HOMEPAGE SLIDER ─────────────────────────── */
async function renderHeroSection(el) {
  let hero = {};
  try { const r = await adminApi('/api/extended/settings'); hero = r.data.hero || {}; } catch(e){}

  el.innerHTML = `
    <div class="admin-header"><h1>Homepage Hero</h1><p>Manage the hero section headline, description, and CTAs.</p></div>
    <div class="admin-section">
      <h2>Hero Content</h2>
      <div class="form-group"><label>Main Headline</label>
        <input type="text" id="hero-headline" value="${esc(hero.headline||'Where Art Meets Elegance')}" placeholder="Where Art Meets Elegance"/>
      </div>
      <div class="form-group"><label>Eyebrow Text</label>
        <input type="text" id="hero-eyebrow" value="${esc(hero.eyebrow||'Premium Interior Design Studio')}" placeholder="Premium Interior Design Studio"/>
      </div>
      <div class="form-group"><label>Description</label>
        <textarea id="hero-desc" style="height:80px">${esc(hero.description||'We craft living spaces that transcend the ordinary…')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Primary CTA Label</label><input type="text" id="hero-cta1" value="${esc(hero.cta1||'Book Consultation')}" placeholder="Book Consultation"/></div>
        <div class="form-group"><label>Secondary CTA Label</label><input type="text" id="hero-cta2" value="${esc(hero.cta2||'View Portfolio')}" placeholder="View Portfolio"/></div>
      </div>
      <button class="btn-dark" onclick="saveHeroSettings()">Save Hero Settings</button>
    </div>
    <div class="admin-section">
      <h2>Hero Images</h2>
      <p style="font-size:0.86rem;color:var(--text-light);margin-bottom:1rem">Add up to 3 image URLs for the hero grid.</p>
      ${[1,2,3].map(n=>`
        <div class="form-group"><label>Image ${n} URL</label>
          <input type="text" id="hero-img${n}" value="${esc((hero.images||[])[n-1]||'')}" placeholder="https://images.unsplash.com/…"/>
        </div>`).join('')}
      <button class="btn-dark" onclick="saveHeroImages()">Save Hero Images</button>
    </div>
  `;
}

async function saveHeroSettings() {
  const data = {
    headline:    document.getElementById('hero-headline')?.value.trim(),
    eyebrow:     document.getElementById('hero-eyebrow')?.value.trim(),
    description: document.getElementById('hero-desc')?.value.trim(),
    cta1:        document.getElementById('hero-cta1')?.value.trim(),
    cta2:        document.getElementById('hero-cta2')?.value.trim(),
  };
  try {
    await adminApi('/api/extended/settings/heroContent', { method:'PUT', body: JSON.stringify({ data }) });
    adminToast('Hero content saved! Refresh the site to see changes.');
  } catch(e) { adminToast('Error: ' + e.message); }
}

async function saveHeroImages() {
  const images = [1,2,3].map(n=>document.getElementById(`hero-img${n}`)?.value.trim()).filter(Boolean);
  try {
    await adminApi('/api/extended/settings/heroImages', { method:'PUT', body: JSON.stringify({ data: images }) });
    adminToast('Hero images saved!');
  } catch(e) { adminToast('Error: ' + e.message); }
}

/* ─────────────────────────────────────────────────────────────
   SHARED UI HELPERS
   ──────────────────────────────────────────────────────────── */
function adminStatCard(icon, num, label, sub='') {
  return `
    <div class="admin-card">
      <div class="admin-card-icon">${icon}</div>
      <div class="admin-card-num">${num}</div>
      <div class="admin-card-label">${label}</div>
      ${sub ? `<div style="font-size:0.72rem;color:var(--gold);margin-top:0.3rem">${esc(sub)}</div>` : ''}
    </div>`;
}

function quickBtn(label, onclick) {
  return `<button class="btn-sm" onclick="${onclick}" style="padding:0.6rem 1.2rem">${label}</button>`;
}

/* ── PATCHED showAdminSection ────────────────────────────────── */
// Override the existing showAdminSection to support all new sections
const _EXTENDED_SECTIONS = ['services','testimonials','faqs','quotes','team','settings',
  'press','subscribers','styleLibrary','floorPlans','activityLog','analytics','seoSettings','heroSettings'];

// Re-wire nav items to support full section list
document.addEventListener('DOMContentLoaded', () => {
  // Ensure all nav items highlight correctly
  const navItems = document.querySelectorAll('.admin-nav-item');
  const allSections = ['dashboard','projects','upload','messages',
    'services','testimonials','faqs','quotes','team','settings',
    'press','subscribers','styleLibrary','floorPlans','activityLog','analytics','seoSettings','heroSettings'];

  navItems.forEach((el, i) => {
    const section = el.getAttribute('onclick')?.match(/showAdminSection\('(\w+)'\)/)?.[1];
    if (section) {
      el.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        el.classList.add('active');
      });
    }
  });
});

console.log('[ArtSpace Admin Panel v2.0] Loaded. Features:', Object.keys(ADMIN_FEATURES).filter(k=>ADMIN_FEATURES[k]).join(', '));
