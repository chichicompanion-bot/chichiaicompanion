// ═══════════════════════════════════════════════════════════
//  MOBILE SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════
(function () {
  if (window.innerWidth > 768) return;

  const NAV_ITEMS = [
    { href: './dashboard.html',   label: '🏠 Dashboard' },
    { href: './rut-tien.html',    label: '💸 Rút tiền' },
    { href: './nap-the.html',     label: '💳 Nạp tiền' },
    { href: './mua-the.html',     label: '🎴 Mua thẻ' },
    { href: './chuyen-diem.html', label: '↔️ Chuyển tiền' },
    { href: './dich-vu.html',     label: '⚡ Dịch vụ' },
    { href: './orders.html',      label: '📋 Đơn hàng', id: 'mob-orders' },
    { href: './admin.html',       label: '⚙️ Điều hành', id: 'mob-admin', cls: 'admin-link', hidden: true },
  ];

  const currentPage = location.pathname.split('/').pop() || 'index.html';

  function buildSidebar() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Hamburger button
    const ham = document.createElement('button');
    ham.className = 'mob-ham';
    ham.setAttribute('aria-label', 'Menu');
    ham.innerHTML = '<span></span>';
    topbar.insertBefore(ham, topbar.firstChild);

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'mob-overlay';
    document.body.appendChild(overlay);

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'mob-sidebar';
    sidebar.innerHTML = `
      <div class="mob-sidebar-logo">
        <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
          <defs><linearGradient id="mg1" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#2196F3"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient></defs>
          <circle cx="50" cy="44" r="35" stroke="url(#mg1)" stroke-width="7" fill="none"/>
          <path d="M22 66 L8 92 L38 77" fill="url(#mg1)"/>
          <circle cx="50" cy="11" r="5.5" fill="url(#mg1)"/>
          <path d="M42 22 Q50 17 58 22" stroke="url(#mg1)" stroke-width="5" stroke-linecap="round"/>
          <circle cx="19" cy="23" r="3.5" fill="url(#mg1)"/>
          <circle cx="13" cy="47" r="7" fill="url(#mg1)"/>
          <path d="M3 62 Q13 55 23 62" stroke="url(#mg1)" stroke-width="5" stroke-linecap="round"/>
          <circle cx="87" cy="47" r="7" fill="url(#mg1)"/>
          <path d="M77 62 Q87 55 97 62" stroke="url(#mg1)" stroke-width="5" stroke-linecap="round"/>
          <circle cx="50" cy="57" r="11" fill="url(#mg1)"/>
          <path d="M27 76 Q50 65 73 76" stroke="url(#mg1)" stroke-width="6" stroke-linecap="round"/>
        </svg>
        Trungtammxh
      </div>
      <nav class="mob-sidebar-nav" id="mob-sidebar-nav"></nav>
      <div class="mob-sidebar-bottom">
        <div class="mob-balance">💰 <span id="mob-balance-val">0</span> đ</div>
        <button class="mob-logout" onclick="logout ? logout() : (sessionStorage.clear(), location.href='./index.html')">Đăng xuất</button>
      </div>`;
    document.body.appendChild(sidebar);

    // Build nav links
    const nav = document.getElementById('mob-sidebar-nav');
    const _mobSession = JSON.parse(sessionStorage.getItem('cc_session') || 'null');
    const _mobIsAdmin = _mobSession && _mobSession.email && _mobSession.email.toLowerCase() === 'nguyenngoctri2910@gmail.com';
    NAV_ITEMS.forEach(item => {
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (item.cls) a.classList.add(item.cls);
      if (item.id) a.id = item.id;
      if (item.hidden && !(item.id === 'mob-admin' && _mobIsAdmin)) a.style.display = 'none';
      if (item.href.includes(currentPage)) a.classList.add('active');
      nav.appendChild(a);
    });

    // Toggle sidebar
    const open  = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
    const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
    ham.addEventListener('click', open);
    overlay.addEventListener('click', close);
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

    // Sync balance
    function syncBalance() {
      const el = document.getElementById('mob-balance-val');
      const navBal = document.getElementById('nav-balance');
      if (el && navBal) el.textContent = navBal.textContent;
    }
    setTimeout(syncBalance, 800);

    // Expose function to show admin link from other scripts
    window.mobSidebarShowAdmin = function () {
      const a = document.getElementById('mob-admin');
      if (a) a.style.display = 'flex';
    };
    window.mobSidebarShowOrders = function () {
      const a = document.getElementById('mob-orders');
      if (a) a.style.display = 'flex';
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSidebar);
  } else {
    buildSidebar();
  }
})();

// ═══════════════════════════════════════════════════════════
//  SUPABASE SYNC
// ═══════════════════════════════════════════════════════════
const SB_URL = 'https://kcotqibvffpiikqawfyw.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjb3RxaWJ2ZmZwaWlrcWF3Znl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxOTI0MTEsImV4cCI6MjA5Mjc2ODQxMX0.zdpJvg2JpXrozYwrSX5C0EhE9OB5fUVU18TXlWfvuOU';

const _sbH = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

async function _sbGet(path) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: _sbH });
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

async function _sbUpsert(table, body) {
  try {
    await fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ..._sbH, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(body)
    });
  } catch(e) {}
}

async function _sbPatch(table, filter, body) {
  try {
    await fetch(SB_URL + '/rest/v1/' + table + '?' + filter, {
      method: 'PATCH',
      headers: _sbH,
      body: JSON.stringify(body)
    });
  } catch(e) {}
}

async function _sbInsertTx(userEmail, type, amount, data) {
  try {
    await fetch(SB_URL + '/rest/v1/transactions', {
      method: 'POST',
      headers: _sbH,
      body: JSON.stringify({ user_email: userEmail, type, amount, data })
    });
  } catch(e) {}
}

async function syncFromSupabase() {
  const sbUsers = await _sbGet('users?select=email,name,password,balance');
  const sbEmails = new Set((sbUsers || []).map(u => u.email));

  // Push local accounts not yet in Supabase (first-time seed)
  const localAccounts = JSON.parse(localStorage.getItem('cc_accounts') || '[]');
  const localBalances = JSON.parse(localStorage.getItem('cc_balances') || '{}');
  for (const acc of localAccounts) {
    if (!sbEmails.has(acc.email)) {
      await _sbUpsert('users', { email: acc.email, name: acc.name, password: acc.password, balance: localBalances[acc.email] || 0 });
    }
  }

  // Pull fresh authoritative data from Supabase
  const users = await _sbGet('users?select=email,name,password,balance');
  if (!users || !users.length) return;
  const accounts = users.map(u => ({ name: u.name, email: u.email, password: u.password }));
  localStorage.setItem('cc_accounts', JSON.stringify(accounts));
  const balances = {};
  users.forEach(u => { balances[u.email] = Number(u.balance) || 0; });
  localStorage.setItem('cc_balances', JSON.stringify(balances));
  const session = JSON.parse(sessionStorage.getItem('cc_session') || 'null');
  if (session) {
    const bal = balances[session.email] || 0;
    const fmt = Number(bal).toLocaleString('vi-VN');
    const navEl  = document.getElementById('nav-balance');  if (navEl)  navEl.textContent  = fmt;
    const statEl = document.getElementById('stat-balance'); if (statEl) statEl.textContent = fmt + ' đ';
    const mobEl  = document.getElementById('mob-balance-val'); if (mobEl) mobEl.textContent = fmt;
    if (typeof refreshBalance === 'function') refreshBalance();
    if (typeof _navBalance   === 'function') _navBalance();
  }
}

window.sbPushBalance = function(email, balance) {
  _sbPatch('users', 'email=eq.' + encodeURIComponent(email), { balance });
};

window.sbRegisterUser = function(name, email, password) {
  _sbUpsert('users', { name, email, password, balance: 0 });
};

window.sbInsertTx = _sbInsertTx;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncFromSupabase);
} else {
  syncFromSupabase();
}
// Re-sync when user returns to tab
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) syncFromSupabase();
});

// ═══════════════════════════════════════════════════════════
//  TELEGRAM FLOATING BUTTON
// ═══════════════════════════════════════════════════════════
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .tg-float {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #2AABEE, #229ED9);
      box-shadow: 0 4px 20px rgba(42,171,238,0.5);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; text-decoration: none;
      transition: transform .2s, box-shadow .2s;
      animation: tg-pulse 2.5s infinite;
    }
    .tg-float:hover {
      transform: scale(1.12);
      box-shadow: 0 6px 28px rgba(42,171,238,0.7);
    }
    .tg-float svg { width: 30px; height: 30px; fill: #fff; }
    .tg-tooltip {
      position: fixed; bottom: 90px; right: 24px; z-index: 9998;
      background: rgba(14,11,31,0.95); border: 1px solid rgba(42,171,238,0.3);
      color: #fff; font-size: 13px; font-weight: 500; font-family: Inter, sans-serif;
      padding: 8px 14px; border-radius: 10px; white-space: nowrap;
      opacity: 0; transform: translateY(6px);
      transition: opacity .2s, transform .2s; pointer-events: none;
    }
    .tg-float:hover + .tg-tooltip,
    .tg-tooltip.show { opacity: 1; transform: translateY(0); }
    @keyframes tg-pulse {
      0%,100% { box-shadow: 0 4px 20px rgba(42,171,238,0.5); }
      50%      { box-shadow: 0 4px 30px rgba(42,171,238,0.85); }
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.className = 'tg-float';
  btn.href = 'https://t.me/ngtr_AI_bot';
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.title = 'Chat với ChiChi AI';
  btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.327 13.99l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.821.569z"/>
  </svg>`;

  const tip = document.createElement('div');
  tip.className = 'tg-tooltip';
  tip.textContent = '💬 Chat hỗ trợ Telegram';

  document.body.appendChild(btn);
  document.body.appendChild(tip);

  btn.addEventListener('mouseenter', () => tip.classList.add('show'));
  btn.addEventListener('mouseleave', () => tip.classList.remove('show'));
})();

// ── Facebook float bubble ──────────────────────────────────────
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .fb-float {
      position: fixed; bottom: 92px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #1877F2;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(24,119,242,0.55);
      animation: fb-pulse 2.4s ease-in-out infinite;
      cursor: pointer; text-decoration: none;
      transition: transform .2s;
    }
    .fb-float:hover { transform: scale(1.1); }
    .fb-float svg { width: 28px; height: 28px; fill: #fff; }
    .fb-tooltip {
      position: fixed; bottom: 160px; right: 82px; z-index: 9998;
      background: rgba(24,119,242,0.92); color: #fff;
      padding: 6px 12px; border-radius: 20px;
      font-size: 13px; font-weight: 600; white-space: nowrap;
      box-shadow: 0 2px 12px rgba(24,119,242,0.4);
      opacity: 0; transform: translateY(6px);
      transition: opacity .2s, transform .2s; pointer-events: none;
    }
    .fb-tooltip.show { opacity: 1; transform: translateY(0); }
    @keyframes fb-pulse {
      0%,100% { box-shadow: 0 4px 20px rgba(24,119,242,0.55); }
      50%      { box-shadow: 0 4px 30px rgba(24,119,242,0.9); }
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.className = 'fb-float';
  btn.href = 'https://www.facebook.com/profile.php?id=61560631922122';
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.title = 'Trang Facebook của Admin';
  btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>`;

  const tip = document.createElement('div');
  tip.className = 'fb-tooltip';
  tip.textContent = '👤 Trang Facebook của Admin';

  document.body.appendChild(btn);
  document.body.appendChild(tip);

  btn.addEventListener('mouseenter', () => tip.classList.add('show'));
  btn.addEventListener('mouseleave', () => tip.classList.remove('show'));
})();

// ═══════════════════════════════════════════════════════════
//  SPACE BACKGROUND ENGINE  —  COSMIC UNIVERSE + DRAGON
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  // ── Stars (drift + twinkle) ────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 420 }, () => ({
      x  : Math.random() * W,
      y  : Math.random() * H,
      r  : Math.random() * 1.7 + 0.15,
      tw : Math.random() * Math.PI * 2,
      ts : Math.random() * 0.016 + 0.003,
      vx : (Math.random() - 0.5) * 0.055,
      vy : (Math.random() - 0.5) * 0.055,
      hue: Math.random() < 0.12 ? 200 + Math.random() * 60
         : Math.random() < 0.08 ? 35  + Math.random() * 20 : -1,
    }));
  }

  // ── Galaxy (pre-rendered offscreen) ───────────────────────
  const GS = 720;
  let galaxyOff;
  function buildGalaxy() {
    galaxyOff = document.createElement('canvas');
    galaxyOff.width = galaxyOff.height = GS;
    const gc = galaxyOff.getContext('2d');
    const cx = GS / 2, cy = GS / 2;

    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 320; i++) {
        const prog  = i / 320;
        const r     = 26 + prog * 295;
        const angle = (arm / 3) * Math.PI * 2 + prog * Math.PI * 4.3;
        const sx    = (Math.random() - 0.5) * 32 * prog;
        const sy    = (Math.random() - 0.5) * 13 * prog;
        const px    = cx + (r + sx) * Math.cos(angle);
        const py    = cy + (r * 0.38 + sy) * Math.sin(angle);
        const alpha = (1 - prog * 0.65) * (0.35 + Math.random() * 0.65);
        const sz    = Math.random() * 2.4 * (1 - prog * 0.45) + 0.2;
        gc.beginPath();
        gc.arc(px, py, sz, 0, Math.PI * 2);
        gc.fillStyle = `hsla(${210 + Math.random()*75},65%,82%,${alpha})`;
        gc.fill();
      }
    }
    for (let i = 0; i < 160; i++) {
      const r = Math.random() * 50, a = Math.random() * Math.PI * 2;
      gc.beginPath();
      gc.arc(cx + r * Math.cos(a), cy + r * 0.4 * Math.sin(a),
             Math.random() * 1.7 + 0.2, 0, Math.PI * 2);
      gc.fillStyle = `rgba(255,242,205,${0.4 + Math.random() * 0.6})`;
      gc.fill();
    }
  }

  function drawGalaxy(t) {
    const cx = W / 2, cy = H / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.016);
    ctx.drawImage(galaxyOff, -GS / 2, -GS / 2, GS, GS);
    ctx.restore();

    // Bright core glow (static — always circular)
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 215);
    cg.addColorStop(0,    'rgba(255,255,248,0.96)');
    cg.addColorStop(0.06, 'rgba(255,238,155,0.70)');
    cg.addColorStop(0.18, 'rgba(200,162,255,0.28)');
    cg.addColorStop(0.40, 'rgba(88,70,190,0.09)');
    cg.addColorStop(1,    'transparent');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);

    // Outer halo
    const hg = ctx.createRadialGradient(cx, cy, 85, cx, cy, 380);
    hg.addColorStop(0,   'rgba(158,128,255,0.07)');
    hg.addColorStop(0.5, 'rgba(88,68,200,0.03)');
    hg.addColorStop(1,   'transparent');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  }


  // ── Main render loop ───────────────────────────────────────
  let lastTs = 0, t = 0;
  function frame(ts) {
    const dt = Math.min((ts - lastTs) * 0.001, 0.05);
    lastTs = ts; t += dt;

    ctx.fillStyle = '#02030d'; ctx.fillRect(0, 0, W, H);

    // Nebula layers
    [
      [0.18,0.22,0.48, 242,0.058],[0.82,0.72,0.42, 262,0.046],
      [0.50,0.08,0.36, 212,0.040],[0.28,0.82,0.30, 282,0.033],
      [0.72,0.28,0.26, 192,0.028],
    ].forEach(([fx,fy,fr,fh,fa]) => {
      const g = ctx.createRadialGradient(fx*W,fy*H,0, fx*W,fy*H, fr*Math.min(W,H));
      g.addColorStop(0, `hsla(${fh},68%,32%,${fa})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });

    // Stars
    stars.forEach(s => {
      s.tw += s.ts; s.x += s.vx; s.y += s.vy;
      if (s.x < -2) s.x = W+2; else if (s.x > W+2) s.x = -2;
      if (s.y < -2) s.y = H+2; else if (s.y > H+2) s.y = -2;
      const a = 0.18 + Math.sin(s.tw) * 0.52;
      if (a <= 0.03) return;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = s.hue >= 0
        ? `hsla(${s.hue},75%,78%,${a})`
        : `rgba(205,215,255,${a})`;
      ctx.fill();
      if (s.r > 1.25 && a > 0.5) {
        ctx.strokeStyle = `rgba(200,215,255,${a*0.28})`;
        ctx.lineWidth   = 0.5;
        ctx.beginPath(); ctx.moveTo(s.x-s.r*3,s.y); ctx.lineTo(s.x+s.r*3,s.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x,s.y-s.r*3); ctx.lineTo(s.x,s.y+s.r*3); ctx.stroke();
      }
    });

    drawGalaxy(t);

    // Vignette
    const vig = ctx.createRadialGradient(W/2,H/2, H*0.08, W/2,H/2, H*0.93);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,3,13,0.76)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(frame);
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars(); buildGalaxy();
  }
  window.addEventListener('resize', resize);
  resize(); requestAnimationFrame(frame);
})();

// ═══════════════════════════════════════════════════════════
//  AUTH LOGIC
// ═══════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'nguyenngoctri2910@gmail.com';
function isAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}
function isAdminSession(session) {
  return !!(session && isAdminEmail(session.email));
}
function getRedirectUrl(email) {
  return './dashboard.html';
}
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.style.opacity = isText ? '1' : '0.5';
}

function setError(id, msg) { document.getElementById(id).textContent = msg; }
function clearErrors(...ids) { ids.forEach(id => document.getElementById(id).textContent = ''); }
function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `status-msg show ${type}`;
}

const _regPwd = document.getElementById('reg-password');
if (_regPwd) _regPwd.addEventListener('input', function () {
  const v = this.value, fill = document.getElementById('strength-fill');
  let score = 0;
  if (v.length >= 6)          score++;
  if (v.length >= 10)         score++;
  if (/[A-Z]/.test(v))        score++;
  if (/[0-9]/.test(v))        score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  fill.style.width      = (score / 5 * 100) + '%';
  fill.style.background = score <= 1 ? '#f87171' : score <= 3 ? '#facc15' : '#22c55e';
});

function getAccounts() { return JSON.parse(localStorage.getItem('cc_accounts') || '[]'); }
function saveAccount(name, email, password) {
  const list = getAccounts();
  list.push({ name, email, password });
  localStorage.setItem('cc_accounts', JSON.stringify(list));
  if (window.sbRegisterUser) window.sbRegisterUser(name, email, password);
}

const LOCAL_PENDING_ORDERS_KEY = 'cc_pending_admin_orders';
const DISMISSED_PENDING_ORDERS_KEY = 'cc_pending_admin_dismissed';
function getPendingAdminOrders() {
  return JSON.parse(localStorage.getItem(LOCAL_PENDING_ORDERS_KEY) || '[]');
}
function savePendingAdminOrders(list) {
  localStorage.setItem(LOCAL_PENDING_ORDERS_KEY, JSON.stringify(list));
}
function getDismissedPendingOrders() {
  return JSON.parse(localStorage.getItem(DISMISSED_PENDING_ORDERS_KEY) || '[]');
}
function saveDismissedPendingOrders(list) {
  localStorage.setItem(DISMISSED_PENDING_ORDERS_KEY, JSON.stringify(list));
}
function normalizeOrderIdPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function buildPendingOrderId(data) {
  if (data.id) return String(data.id);
  return [
    data.type || 'order',
    data.email,
    data.amount,
    data.bank,
    data.stk,
    data.time,
    data.note,
  ].map(normalizeOrderIdPart).filter(Boolean).join('_');
}
function parseViDateTime(text) {
  const match = String(text || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 0;
  return new Date(
    Number(match[6]),
    Number(match[5]) - 1,
    Number(match[4]),
    Number(match[1]),
    Number(match[2]),
    Number(match[3] || 0)
  ).getTime();
}
function createPendingOrder(data) {
  return {
    id: buildPendingOrderId(data),
    type: data.type,
    email: data.email,
    amount: Number(data.amount || 0),
    bank: data.bank || null,
    stk: data.stk || null,
    note: data.note || null,
    ts: Number(data.ts) || parseViDateTime(data.time) || Date.now(),
    time: data.time || new Date().toLocaleString('vi-VN'),
  };
}
function queuePendingOrder(order) {
  const next = createPendingOrder(order);
  const list = getPendingAdminOrders().filter(function(item) { return item.id !== next.id; });
  list.unshift(next);
  savePendingAdminOrders(list);
  return next;
}
function removePendingOrder(id) {
  savePendingAdminOrders(getPendingAdminOrders().filter(function(item) { return item.id !== id; }));
}
function dismissPendingOrder(id) {
  removePendingOrder(id);
  const list = getDismissedPendingOrders().filter(function(item) { return item !== id; });
  list.push(id);
  saveDismissedPendingOrders(list);
}
function getBackfilledPendingOrders() {
  const orders = [];
  getAccounts().forEach(function(account) {
    const withdrawals = JSON.parse(localStorage.getItem('cc_withdrawals_' + account.email) || '[]');
    withdrawals.forEach(function(tx) {
      if (!tx || tx.status !== 'pending') return;
      orders.push(createPendingOrder({
        id: tx.orderId,
        type: 'withdrawal',
        email: account.email,
        amount: tx.amount,
        bank: tx.bank,
        stk: tx.stk,
        time: tx.time,
      }));
    });
  });
  return orders;
}
function mergePendingOrders(remoteOrders) {
  const byId = new Map();
  const dismissed = new Set(getDismissedPendingOrders());
  []
    .concat(Array.isArray(remoteOrders) ? remoteOrders : [])
    .concat(getPendingAdminOrders())
    .concat(getBackfilledPendingOrders())
    .forEach(function(order) {
      if (!order || !order.id) return;
      if (dismissed.has(order.id)) return;
      byId.set(order.id, order);
    });
  return Array.from(byId.values()).sort(function(a, b) { return Number(b.ts || 0) - Number(a.ts || 0); });
}

function createAdminNavLink(nav, id, href, label) {
  const link = document.createElement('a');
  const template = nav.querySelector('.nav-link');
  link.id = id;
  link.href = href;
  link.textContent = label;
  if (template) {
    link.className = template.className;
  } else {
    link.style.cssText = 'padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;color:#9490b0;text-decoration:none;display:inline-block;';
  }
  return link;
}

function applyAdminNavigation(session) {
  if (!isAdminSession(session)) return;
  const nav = document.querySelector('.topbar-nav, header.topbar nav, header nav');
  if (!nav) return;

  const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
  let adminLink = document.getElementById('nav-admin') || nav.querySelector('a[href="./admin.html"]');
  if (!adminLink) {
    adminLink = createAdminNavLink(nav, 'nav-admin', './admin.html', '⚙️ Điều hành');
    nav.appendChild(adminLink);
  }
  if (!adminLink.id) adminLink.id = 'nav-admin';

  let ordersLink = document.getElementById('nav-orders') || nav.querySelector('a[href="./orders.html"]');
  if (!ordersLink) {
    ordersLink = createAdminNavLink(nav, 'nav-orders', './orders.html', '📋 Đơn hàng');
    if (adminLink.nextSibling) nav.insertBefore(ordersLink, adminLink.nextSibling);
    else nav.appendChild(ordersLink);
  }
  if (!ordersLink.id) ordersLink.id = 'nav-orders';

  adminLink.style.display = 'inline-block';
  ordersLink.style.display = 'inline-block';
  if (window.mobSidebarShowAdmin) window.mobSidebarShowAdmin();
  if (window.mobSidebarShowOrders) window.mobSidebarShowOrders();

  if (adminLink.classList.contains('nav-link')) {
    adminLink.classList.toggle('active', currentPage === 'admin.html');
  }
  if (ordersLink.classList.contains('nav-link')) {
    ordersLink.classList.toggle('active', currentPage === 'orders.html');
  }
}

// Pre-seed admin account if not exists
(function seedAdmin() {
  const adminEmail = ADMIN_EMAIL;
  const accounts = getAccounts();
  if (!accounts.find(a => a.email === adminEmail)) {
    accounts.push({ name: 'Admin', email: adminEmail, password: 'shsajaks' });
    localStorage.setItem('cc_accounts', JSON.stringify(accounts));
  }
})();

(function initAdminNavigation() {
  const session = JSON.parse(sessionStorage.getItem('cc_session') || 'null');
  applyAdminNavigation(session);
})();

const _loginForm = document.getElementById('login-form');
if (_loginForm) _loginForm.addEventListener('submit', function (e) {
  e.preventDefault();
  clearErrors('login-email-err', 'login-pass-err');
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  let ok = true;
  if (!email)    { setError('login-email-err', 'Vui lòng nhập email.'); ok = false; }
  if (!password) { setError('login-pass-err',  'Vui lòng nhập mật khẩu.'); ok = false; }
  if (!ok) return;
  const found = getAccounts().find(a => a.email === email && a.password === password);
  if (found) {
    sessionStorage.setItem('cc_session', JSON.stringify({ name: found.name, email: found.email }));
    showStatus('login-status', `Đăng nhập thành công! Đang chuyển trang...`, 'success');
    setTimeout(() => { window.location.href = getRedirectUrl(found.email); }, 900);
  } else {
    showStatus('login-status', 'Email hoặc mật khẩu không đúng.', 'error');
  }
});

const _regForm = document.getElementById('register-form');
if (_regForm) _regForm.addEventListener('submit', function (e) {
  e.preventDefault();
  clearErrors('reg-name-err', 'reg-email-err', 'reg-pass-err', 'reg-confirm-err', 'reg-terms-err');
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const terms    = document.getElementById('terms').checked;
  let ok = true;
  if (!name)                             { setError('reg-name-err',    'Vui lòng nhập họ tên.'); ok = false; }
  if (!email)                            { setError('reg-email-err',   'Vui lòng nhập email.'); ok = false; }
  else if (!/\S+@\S+\.\S+/.test(email)) { setError('reg-email-err',   'Email không hợp lệ.'); ok = false; }
  if (password.length < 6)              { setError('reg-pass-err',    'Mật khẩu tối thiểu 6 ký tự.'); ok = false; }
  if (password !== confirm)             { setError('reg-confirm-err', 'Mật khẩu xác nhận không khớp.'); ok = false; }
  if (!terms)                           { setError('reg-terms-err',   'Bạn cần đồng ý điều khoản.'); ok = false; }
  if (!ok) return;
  if (getAccounts().find(a => a.email === email)) { setError('reg-email-err', 'Email này đã được đăng ký.'); return; }
  saveAccount(name, email, password);
  sessionStorage.setItem('cc_session', JSON.stringify({ name, email }));
  showStatus('register-status', 'Tạo tài khoản thành công! Đang chuyển trang...', 'success');
  setTimeout(() => { window.location.href = getRedirectUrl(email); }, 1000);
});
