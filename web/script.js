// ═══════════════════════════════════════════════════════════
//  DRAGON BACKGROUND ENGINE
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;

  // ── Stars ──────────────────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.2,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.035 + 0.008,
    }));
  }

  // ── Shooting stars ─────────────────────────────────────
  let shoots = [];
  setInterval(() => {
    if (Math.random() > 0.5) return;
    shoots.push({
      x: Math.random() * W, y: Math.random() * H * 0.5,
      len: Math.random() * 160 + 60, speed: Math.random() * 13 + 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4, alpha: 1,
    });
  }, 2400);

  // ── Dragon segments ────────────────────────────────────
  const SEG = 110, GAP = 19;
  let segs = [];
  function initDragon() {
    segs = Array.from({ length: SEG }, () => ({ x: W / 2, y: H / 2, a: 0 }));
  }

  // Head traces a grand lemniscate (figure-8)
  function headPos(t) {
    const θ = t * 0.27;
    const d = 1 + Math.sin(θ) * Math.sin(θ);
    return {
      x: W / 2 + W * 0.37 * Math.cos(θ) / d,
      y: H / 2 + H * 0.29 * Math.sin(θ) * Math.cos(θ) / d,
    };
  }

  function updateDragon(t) {
    const hp = headPos(t);
    segs[0].x = hp.x; segs[0].y = hp.y;
    for (let i = 1; i < SEG; i++) {
      const dx = segs[i-1].x - segs[i].x, dy = segs[i-1].y - segs[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist > GAP) { const f = (dist - GAP) / dist; segs[i].x += dx * f; segs[i].y += dy * f; }
      segs[i].a = Math.atan2(dy, dx);
    }
    if (segs.length > 1) segs[0].a = Math.atan2(segs[0].y - segs[1].y, segs[0].x - segs[1].x);
  }

  // ── Fire particles ─────────────────────────────────────
  let fire = [];
  function spawnFire() {
    const a = segs[0].a;
    const tx = segs[0].x + Math.cos(a) * 50, ty = segs[0].y + Math.sin(a) * 50;
    for (let i = 0; i < 6; i++) {
      const sp = (Math.random() - 0.5) * 0.8;
      fire.push({
        x: tx, y: ty,
        vx: Math.cos(a + sp) * (11 + Math.random() * 9),
        vy: Math.sin(a + sp) * (11 + Math.random() * 9),
        life: 1, size: Math.random() * 16 + 7,
        hue: 15 + Math.random() * 45,
      });
    }
  }
  function drawFire() {
    fire = fire.filter(p => p.life > 0.02);
    fire.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.032; p.size *= 0.968;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0,    `hsla(${p.hue+40}, 100%, 92%, ${p.life})`);
      g.addColorStop(0.35, `hsla(${p.hue},    100%, 60%, ${p.life * 0.8})`);
      g.addColorStop(1,    `hsla(${p.hue-15}, 80%,  28%, 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
  }

  // ── Energy sparks along body ───────────────────────────
  let sparks = [];
  setInterval(() => {
    const idx = Math.floor(Math.random() * SEG * 0.6);
    const s = segs[idx];
    for (let i = 0; i < 3; i++) {
      sparks.push({ x: s.x, y: s.y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:1 });
    }
  }, 100);
  function drawSparks() {
    sparks = sparks.filter(p => p.life > 0.02);
    sparks.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.06;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2);
      ctx.fillStyle = `rgba(160,255,200,${p.life})`; ctx.fill();
    });
  }

  // ── Dragon body ────────────────────────────────────────
  function drawBody(t) {
    // Glow aura along full body
    for (let i = SEG - 1; i >= 1; i--) {
      const s = segs[i], prog = i / SEG;
      const sz = 24 * (1 - prog * 0.74) + 4;
      const hue = (138 + Math.sin(t * 0.4 + i * 0.09) * 32) % 360;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, sz * 2.4);
      g.addColorStop(0, `hsla(${hue}, 90%, 50%, 0.20)`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, sz*2.4, 0, Math.PI*2); ctx.fill();
    }

    // Scales
    for (let i = SEG - 1; i >= 1; i--) {
      const s = segs[i], prog = i / SEG;
      const sz = 22 * (1 - prog * 0.73) + 4;
      const hue = (128 + Math.sin(t * 0.32 + i * 0.13) * 28) % 360;

      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.shadowColor = `hsl(${hue+20},100%,55%)`; ctx.shadowBlur = 9;

      // Scale body
      ctx.beginPath(); ctx.ellipse(0, 0, sz, sz*0.62, 0, 0, Math.PI*2);
      ctx.fillStyle = `hsl(${hue},72%,${17+(1-prog)*15}%)`; ctx.fill();

      // Highlight shimmer
      ctx.beginPath(); ctx.ellipse(sz*0.12,-sz*0.14, sz*0.42, sz*0.26, -0.45, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${hue+35},90%,70%,0.28)`; ctx.fill();

      // Dorsal spines every 4 segs
      if (i % 4 === 0 && prog < 0.65) {
        const sh = sz * (0.9 - prog * 0.55);
        ctx.beginPath();
        ctx.moveTo(-sz*0.12, -sz*0.55);
        ctx.lineTo(sz*0.02,  -sz*0.55 - sh);
        ctx.lineTo(sz*0.18,  -sz*0.55);
        ctx.fillStyle = `hsl(${hue+45},100%,68%)`; ctx.fill();
      }

      // Belly scale lighter stripe
      ctx.beginPath(); ctx.ellipse(0, sz*0.28, sz*0.45, sz*0.22, 0, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${hue+10},60%,38%,0.5)`; ctx.fill();

      ctx.shadowBlur = 0; ctx.restore();
    }
  }

  // ── Dragon head ────────────────────────────────────────
  function drawHead(t) {
    const h = segs[0], a = h.a, S = 38;
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(a);

    // Ambient halo
    const halo = ctx.createRadialGradient(S*0.4, 0, 0, S*0.4, 0, S*5.5);
    halo.addColorStop(0, 'rgba(60,255,110,0.28)');
    halo.addColorStop(0.45, 'rgba(20,160,70,0.09)');
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(S*0.4, 0, S*5.5, 0, Math.PI*2); ctx.fill();

    // Neck base
    ctx.beginPath(); ctx.fillStyle='#0b3309';
    ctx.ellipse(0, 0, S*0.95, S*0.72, 0, 0, Math.PI*2); ctx.fill();

    // Snout
    ctx.beginPath(); ctx.fillStyle='#104710';
    ctx.ellipse(S*0.55, 0, S*0.7, S*0.48, 0, 0, Math.PI*2); ctx.fill();

    // Upper jaw ridge
    ctx.beginPath(); ctx.fillStyle='#1a6318';
    ctx.ellipse(S*0.48, -S*0.18, S*0.58, S*0.24, 0, 0, Math.PI*2); ctx.fill();

    // Scale pattern on head
    ctx.strokeStyle='rgba(50,255,80,0.18)'; ctx.lineWidth=0.9;
    for (let i=0;i<4;i++) {
      ctx.beginPath(); ctx.arc(S*0.15, S*0.08*i-S*0.12, S*(0.28+i*0.18), Math.PI*0.65, Math.PI*1.55); ctx.stroke();
    }

    // Nostrils (glowing red)
    [S*0.88, S*1.05].forEach(nx => {
      const ng = ctx.createRadialGradient(nx,-S*0.13,0, nx,-S*0.13,S*0.2);
      ng.addColorStop(0,'rgba(255,70,0,0.95)'); ng.addColorStop(1,'transparent');
      ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(nx,-S*0.13,S*0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#150000'; ctx.beginPath(); ctx.arc(nx,-S*0.13,S*0.075,0,Math.PI*2); ctx.fill();
    });

    // Open mouth / teeth
    ctx.beginPath();
    ctx.moveTo(S*0.18, S*0.14); ctx.quadraticCurveTo(S*0.7, S*0.42, S*1.15, S*0.1);
    ctx.strokeStyle='rgba(255,90,0,0.75)'; ctx.lineWidth=2.2; ctx.stroke();
    for (let i=0;i<5;i++) {
      const tx = S*(0.25+i*0.19);
      ctx.beginPath(); ctx.moveTo(tx,S*0.17); ctx.lineTo(tx+S*0.07,S*0.38); ctx.lineTo(tx+S*0.13,S*0.17);
      ctx.fillStyle='rgba(255,235,205,0.88)'; ctx.fill();
    }

    // Eye glow
    const ex=S*0.24, ey=-S*0.29;
    const eg = ctx.createRadialGradient(ex,ey,0, ex,ey,S*0.44);
    eg.addColorStop(0, `hsla(${52+Math.sin(t)*12},100%,88%,1)`);
    eg.addColorStop(0.38, 'hsla(22,100%,58%,0.92)');
    eg.addColorStop(1, 'transparent');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(ex,ey,S*0.44,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(ex,ey,S*0.09,S*0.16,0.18,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(ex-S*0.04,ey-S*0.09,S*0.04,0,Math.PI*2); ctx.fill();

    // Main horn (large, glowing)
    ctx.shadowColor='#44ff66'; ctx.shadowBlur=20;
    ctx.beginPath();
    ctx.moveTo(-S*0.06, -S*0.56); ctx.lineTo(S*0.13, -S*1.42); ctx.lineTo(S*0.33, -S*0.52);
    ctx.fillStyle='#3dff60'; ctx.fill();
    // Back horn
    ctx.beginPath();
    ctx.moveTo(-S*0.22,-S*0.5); ctx.lineTo(-S*0.1,-S*1.0); ctx.lineTo(S*0.01,-S*0.48);
    ctx.fillStyle='#28cc45'; ctx.fill();
    // Small side horn
    ctx.beginPath();
    ctx.moveTo(S*0.08,-S*0.42); ctx.lineTo(S*0.22,-S*0.78); ctx.lineTo(S*0.34,-S*0.4);
    ctx.fillStyle='#20aa38'; ctx.fill();
    ctx.shadowBlur=0;

    // Whiskers (2 pairs)
    [[-S*0.32, -0.55, 1.9], [-S*0.1, 0.6, 1.75]].forEach(([sy, cf, len]) => {
      ctx.beginPath();
      ctx.moveTo(S*0.88, sy*0.28);
      ctx.quadraticCurveTo(S*1.45, sy*0.28+S*cf*0.38, S*len, sy*0.28+S*cf*0.85);
      ctx.strokeStyle='rgba(170,255,195,0.72)'; ctx.lineWidth=1.6; ctx.stroke();
    });
    [[-S*0.28,-0.45,1.85],[-S*0.05,0.5,1.7]].forEach(([sy,cf,len])=>{
      ctx.beginPath();
      ctx.moveTo(S*0.88, sy*0.28);
      ctx.quadraticCurveTo(S*1.5, sy*0.28+S*cf*0.3, S*len, sy*0.28+S*cf*0.7);
      ctx.strokeStyle='rgba(140,240,170,0.45)'; ctx.lineWidth=1; ctx.stroke();
    });

    ctx.restore();
  }

  // ── Nebula background ──────────────────────────────────
  function drawNebula() {
    [[0.22,0.3,0.32,140,0.08],[0.78,0.68,0.30,200,0.07],[0.52,0.15,0.24,290,0.06],[0.08,0.72,0.22,165,0.05]].forEach(([fx,fy,fr,fh,fa])=>{
      const g = ctx.createRadialGradient(fx*W, fy*H, 0, fx*W, fy*H, fr*Math.min(W,H));
      g.addColorStop(0, `hsla(${fh},80%,38%,${fa})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    });
  }

  // ── Main loop ──────────────────────────────────────────
  let lastFire = 0;
  function frame(ts) {
    t = ts * 0.001;

    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, W, H);

    drawNebula();

    // Stars
    stars.forEach(s => {
      s.tw += s.sp;
      const a = 0.28 + Math.sin(s.tw) * 0.48;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(205,220,255,${a})`; ctx.fill();
    });

    // Shooting stars
    shoots = shoots.filter(s => s.alpha > 0.02);
    shoots.forEach(s => {
      const tail = ctx.createLinearGradient(
        s.x-Math.cos(s.angle)*s.len, s.y-Math.sin(s.angle)*s.len, s.x, s.y);
      tail.addColorStop(0,'hsla(150,90%,80%,0)');
      tail.addColorStop(1,`hsla(150,90%,92%,${s.alpha})`);
      ctx.beginPath();
      ctx.moveTo(s.x-Math.cos(s.angle)*s.len, s.y-Math.sin(s.angle)*s.len);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle=tail; ctx.lineWidth=1.6; ctx.stroke();
      s.x+=Math.cos(s.angle)*s.speed; s.y+=Math.sin(s.angle)*s.speed; s.alpha-=0.013;
    });

    updateDragon(t);
    drawBody(t);
    drawSparks();
    drawFire();
    drawHead(t);

    if (ts - lastFire > 65) { spawnFire(); lastFire = ts; }

    // Vignette
    const vig = ctx.createRadialGradient(W/2,H/2,H*0.08, W/2,H/2,H*0.92);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(2,4,8,0.78)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(frame);
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars(); initDragon();
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();

// ═══════════════════════════════════════════════════════════
//  AUTH LOGIC
// ═══════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'nguyenngoctri2910@gmail.com';
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

document.getElementById('reg-password').addEventListener('input', function () {
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

// Pre-seed admin account if not exists
(function seedAdmin() {
  const adminEmail = ADMIN_EMAIL;
  const accounts = getAccounts();
  if (!accounts.find(a => a.email === adminEmail)) {
    accounts.push({ name: 'Admin', email: adminEmail, password: 'shsajaks' });
    localStorage.setItem('cc_accounts', JSON.stringify(accounts));
  }
})();

document.getElementById('login-form').addEventListener('submit', function (e) {
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

document.getElementById('register-form').addEventListener('submit', function (e) {
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
