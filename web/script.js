// ═══════════════════════════════════════════════════════════
//  EPIC BACKGROUND ENGINE
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, t = 0;

  // ── Stars ──────────────────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.04 + 0.01,
    }));
  }

  // ── Shooting stars ─────────────────────────────────────
  let shoots = [];
  function spawnShoot() {
    shoots.push({
      x: Math.random() * W * 1.4 - W * 0.2,
      y: Math.random() * H * 0.5,
      len: Math.random() * 180 + 80,
      speed: Math.random() * 14 + 8,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      alpha: 1,
      hue: Math.random() < 0.5 ? 260 : 200,
    });
  }
  setInterval(spawnShoot, 2200);

  // ── Plasma blobs ───────────────────────────────────────
  const blobs = [
    { x: 0.18, y: 0.25, r: 0.38, hue: 270, speed: 0.0004 },
    { x: 0.78, y: 0.70, r: 0.32, hue: 210, speed: 0.0006 },
    { x: 0.55, y: 0.15, r: 0.28, hue: 320, speed: 0.0005 },
    { x: 0.20, y: 0.80, r: 0.25, hue: 190, speed: 0.0007 },
  ];

  // ── Aurora wave ────────────────────────────────────────
  function drawAurora() {
    for (let layer = 0; layer < 5; layer++) {
      const freq   = 0.0018 + layer * 0.0006;
      const amp    = H * (0.06 + layer * 0.025);
      const yBase  = H * (0.3 + layer * 0.12);
      const hue    = (200 + layer * 28 + t * 8) % 360;
      const thick  = H * 0.13;

      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) {
        const y = yBase
          + Math.sin(x * freq + t * (0.4 + layer * 0.15)) * amp
          + Math.sin(x * freq * 1.7 + t * 0.3) * amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yBase - thick, 0, yBase + thick * 1.5);
      grad.addColorStop(0,   `hsla(${hue}, 90%, 65%, 0)`);
      grad.addColorStop(0.3, `hsla(${hue}, 85%, 60%, 0.10)`);
      grad.addColorStop(0.6, `hsla(${hue}, 80%, 55%, 0.07)`);
      grad.addColorStop(1,   `hsla(${hue}, 70%, 50%, 0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // ── Plasma blobs ───────────────────────────────────────
  function drawBlobs() {
    blobs.forEach((b, i) => {
      const cx = (b.x + Math.sin(t * b.speed * 1000 + i) * 0.12) * W;
      const cy = (b.y + Math.cos(t * b.speed * 800  + i) * 0.10) * H;
      const r  = b.r * Math.min(W, H);

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   `hsla(${(b.hue + t * 15) % 360}, 85%, 65%, 0.22)`);
      g.addColorStop(0.5, `hsla(${(b.hue + t * 15 + 30) % 360}, 75%, 55%, 0.08)`);
      g.addColorStop(1,   `hsla(${b.hue}, 60%, 40%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── Grid ───────────────────────────────────────────────
  function drawGrid() {
    const size = 60;
    ctx.strokeStyle = 'rgba(120, 80, 255, 0.04)';
    ctx.lineWidth   = 0.8;
    for (let x = 0; x < W; x += size) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += size) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // ── Vignette ───────────────────────────────────────────
  function drawVignette() {
    const g = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4,2,14,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Main loop ──────────────────────────────────────────
  function frame(ts) {
    t = ts * 0.001;

    // Base
    ctx.fillStyle = '#04020e';
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawBlobs();
    drawAurora();

    // Stars
    stars.forEach(s => {
      s.twinkle += s.speed;
      const a = 0.35 + Math.sin(s.twinkle) * 0.55;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 200, 255, ${a})`;
      ctx.fill();
    });

    // Shooting stars
    shoots = shoots.filter(s => s.alpha > 0.02);
    shoots.forEach(s => {
      const dx = Math.cos(s.angle) * s.speed;
      const dy = Math.sin(s.angle) * s.speed;

      const tail = ctx.createLinearGradient(
        s.x - Math.cos(s.angle) * s.len, s.y - Math.sin(s.angle) * s.len,
        s.x, s.y
      );
      tail.addColorStop(0, `hsla(${s.hue}, 90%, 85%, 0)`);
      tail.addColorStop(1, `hsla(${s.hue}, 90%, 95%, ${s.alpha})`);

      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * s.len, s.y - Math.sin(s.angle) * s.len);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = tail;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Glow head
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
      glow.addColorStop(0, `hsla(${s.hue}, 90%, 95%, ${s.alpha})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();

      s.x += dx; s.y += dy;
      s.alpha -= 0.012;
    });

    drawVignette();
    requestAnimationFrame(frame);
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initStars();
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();

// ═══════════════════════════════════════════════════════════
//  AUTH LOGIC
// ═══════════════════════════════════════════════════════════
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
    setTimeout(() => { window.location.href = './dashboard.html'; }, 900);
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
  setTimeout(() => { window.location.href = './dashboard.html'; }, 1000);
});
