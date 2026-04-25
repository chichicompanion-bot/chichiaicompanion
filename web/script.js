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

  // ── Golden Dragon ──────────────────────────────────────────
  function drawDragon(t) {
    const cx = W / 2, cy = H / 2;
    const orbitR  = Math.min(W, H) * 0.36;
    const bRatio  = 0.52;
    const oa      = t * 0.20;                         // orbit angle (clockwise)

    const dx      = cx + orbitR * Math.cos(oa);
    const dy      = cy + orbitR * bRatio * Math.sin(oa);

    // Tangent velocity for facing direction
    const tvx     = -orbitR * 0.20 * Math.sin(oa);
    const tvy     =  orbitR * bRatio * 0.20 * Math.cos(oa);
    const facing  = Math.atan2(tvy, tvx);

    const S = Math.min(1.45, Math.max(0.52, Math.min(W, H) / 940));

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(facing);

    // Build spine with undulation
    const N  = 20;
    const BL = 215 * S;
    const spine = [];
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      spine.push({
        x: -BL / 2 + p * BL,
        y: Math.sin(t * 2.7 - p * Math.PI * 2.25) * 23 * S * Math.sin(p * Math.PI),
      });
    }

    // ── Wings (behind body) ──
    const wi     = Math.floor(N * 0.62);
    const wp     = spine[wi];
    const wSpan  = 88 * S;
    const wBeat  = Math.sin(t * 5.4) * 0.28;
    const wAngle = Math.atan2(spine[wi+1].y - spine[wi-1].y, spine[wi+1].x - spine[wi-1].x);

    function wing(sign) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(wAngle + sign * wBeat);
      ctx.beginPath();
      ctx.moveTo(0, sign * 9 * S);
      ctx.bezierCurveTo(-18*S, sign*wSpan*0.44, 24*S, sign*wSpan, 56*S, sign*wSpan*0.82);
      ctx.bezierCurveTo(70*S,  sign*wSpan*0.48, 60*S, sign*12*S,  34*S, sign*9*S);
      ctx.closePath();
      ctx.fillStyle   = 'rgba(255,150,16,0.40)';
      ctx.strokeStyle = 'rgba(255,205,55,0.60)';
      ctx.lineWidth = 1.3; ctx.fill(); ctx.stroke();
      // vein
      ctx.beginPath();
      ctx.moveTo(0, sign*9*S);
      ctx.quadraticCurveTo(20*S, sign*wSpan*0.56, 56*S, sign*wSpan*0.82);
      ctx.strokeStyle = 'rgba(255,222,78,0.35)'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.restore();
    }
    wing(-1); wing(1);

    // ── Body ──
    ctx.shadowColor = 'rgba(255,175,18,0.62)';
    ctx.shadowBlur  = 18 * S;
    for (let i = 0; i < N; i++) {
      const p     = i / N;
      const thick = (0.14 + Math.pow(p, 0.68) * 0.86) * 19 * S;
      ctx.beginPath();
      ctx.moveTo(spine[i].x,   spine[i].y);
      ctx.lineTo(spine[i+1].x, spine[i+1].y);
      ctx.lineWidth   = thick;
      ctx.lineCap     = 'round';
      ctx.strokeStyle = `rgba(255,${Math.round(142+p*65)},${Math.round(14+p*16)},${0.80+p*0.17})`;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Scale diamonds
    for (let i = 2; i < N - 1; i += 2) {
      const p  = i / N;
      const sp = spine[i];
      const tk = (0.14 + Math.pow(p, 0.68) * 0.86) * 17 * S;
      if (tk < 4) continue;
      const sa = Math.atan2(spine[i+1].y - spine[i-1].y, spine[i+1].x - spine[i-1].x);
      ctx.save();
      ctx.translate(sp.x, sp.y); ctx.rotate(sa);
      ctx.beginPath();
      ctx.moveTo(0, -tk*0.72); ctx.lineTo(tk*0.36, 0);
      ctx.lineTo(0,  tk*0.72); ctx.lineTo(-tk*0.36, 0);
      ctx.closePath();
      ctx.fillStyle   = `rgba(255,${192+i*3},48,0.20)`;
      ctx.strokeStyle = `rgba(255,212,58,0.30)`;
      ctx.lineWidth = 0.6; ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // ── Head ──
    const hs = spine[N];
    const ha = Math.atan2(spine[N].y - spine[N-1].y, spine[N].x - spine[N-1].x);
    ctx.save();
    ctx.translate(hs.x, hs.y); ctx.rotate(ha);

    // Lower jaw
    ctx.beginPath();
    ctx.moveTo(0, 5*S);
    ctx.quadraticCurveTo(20*S, 9*S,  41*S, 5*S);
    ctx.quadraticCurveTo(45*S, 2*S,  41*S, -1*S);
    ctx.quadraticCurveTo(20*S, 2*S,  0,    2*S);
    ctx.fillStyle = 'rgba(212,140,16,0.92)'; ctx.fill();

    // Upper skull
    ctx.beginPath();
    ctx.moveTo(-5*S, -5*S);
    ctx.bezierCurveTo(6*S, -16*S, 27*S, -14*S, 43*S, -8*S);
    ctx.bezierCurveTo(47*S, -4*S,  45*S,  4*S,  41*S,  5*S);
    ctx.bezierCurveTo(27*S,  3*S,   6*S,  7*S,  -5*S,  4*S);
    ctx.closePath();
    ctx.fillStyle   = 'rgba(255,186,26,0.96)';
    ctx.strokeStyle = 'rgba(255,222,72,0.52)';
    ctx.lineWidth = 1; ctx.fill(); ctx.stroke();

    // Eye
    ctx.beginPath(); ctx.arc(24*S, -7*S, 4.5*S, 0, Math.PI*2);
    ctx.fillStyle = '#cc3300'; ctx.fill();
    ctx.beginPath(); ctx.arc(24*S, -7*S, 2.2*S, 0, Math.PI*2);
    ctx.fillStyle = '#ffdd00'; ctx.fill();
    ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(24*S, -7*S, 1*S, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.shadowBlur = 0;

    // Main horn
    ctx.beginPath();
    ctx.moveTo(10*S, -13*S); ctx.lineTo(8*S, -33*S); ctx.lineTo(18*S, -12*S);
    ctx.fillStyle = 'rgba(255,218,52,0.92)'; ctx.fill();
    // Back horn
    ctx.beginPath();
    ctx.moveTo(-1*S, -10*S); ctx.lineTo(-5*S, -23*S); ctx.lineTo(5*S, -10*S);
    ctx.fillStyle = 'rgba(255,200,42,0.72)'; ctx.fill();

    // Nostril
    ctx.beginPath(); ctx.arc(38*S, -2*S, 2.2*S, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(155,65,0,0.62)'; ctx.fill();

    // Subtle fire breath flicker
    if (Math.sin(t * 3.8) > 0.6) {
      const fg = ctx.createRadialGradient(48*S, 0, 0, 48*S, 0, 28*S);
      fg.addColorStop(0,   'rgba(255,210,50,0.45)');
      fg.addColorStop(0.4, 'rgba(255,110,0,0.20)');
      fg.addColorStop(1,   'transparent');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(52*S, 0, 24*S, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore(); // head

    // ── Tail tip ──
    const tail  = spine[0];
    const tailA = Math.atan2(spine[1].y - spine[0].y, spine[1].x - spine[0].x) + Math.PI;
    ctx.save();
    ctx.translate(tail.x, tail.y); ctx.rotate(tailA);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(16*S, -22*S, 32*S, -12*S, 30*S, 9*S);
    ctx.strokeStyle = 'rgba(255,168,18,0.68)';
    ctx.lineWidth = 3*S; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore(); // tail

    ctx.restore(); // main dragon
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
    drawDragon(t);

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
