// ═══════════════════════════════════════════════════════════
//  SPACE BACKGROUND ENGINE
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;

  // ── Static stars (3 layers depth) ─────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 320 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.8+0.15,
      tw: Math.random()*Math.PI*2,
      sp: Math.random()*0.022+0.004,
      hue: Math.random()<0.15 ? 200+Math.random()*60 : Math.random()<0.1 ? 30+Math.random()*20 : 0,
    }));
  }

  // ── Meteors (diagonal fast streaks) ───────────────────
  let meteors = [];
  function spawnMeteor() {
    const size = Math.random()*3.5+1.5;
    meteors.push({
      x: Math.random()*W*1.3 - W*0.15,
      y: -80,
      vx: (Math.random()-0.5)*3,
      vy: Math.random()*14+8,
      len: Math.random()*220+80,
      alpha: 1,
      size,
      hue: Math.random()<0.3 ? 200+Math.random()*40 : Math.random()<0.15 ? 30+Math.random()*20 : 0,
    });
  }
  setInterval(spawnMeteor, 600);

  // ── Asteroids (slow drifting rocks) ───────────────────
  let asteroids = [];
  function initAsteroids() {
    asteroids = Array.from({ length: 6 }, () => makeAsteroid(true));
  }
  function makeAsteroid(init) {
    const r = Math.random()*28+10;
    return {
      x: init ? Math.random()*W : (Math.random()<0.5 ? -r : W+r),
      y: init ? Math.random()*H : Math.random()*H,
      r,
      vx: (Math.random()-0.5)*0.6,
      vy: Math.random()*0.5+0.1,
      rot: Math.random()*Math.PI*2,
      drot: (Math.random()-0.5)*0.012,
      pts: Array.from({length:9},(_,i)=>{
        const a=i/9*Math.PI*2, noise=0.7+Math.random()*0.6;
        return { a, r:noise };
      }),
      hue: 200+Math.random()*30,
    };
  }

  // ── Draw asteroid rock ─────────────────────────────────
  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(a.rot);
    // Glow
    const glow = ctx.createRadialGradient(0,0,0,0,0,a.r*2.2);
    glow.addColorStop(0,`hsla(${a.hue},60%,50%,0.18)`); glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,a.r*2.2,0,Math.PI*2); ctx.fill();
    // Rock shape
    ctx.beginPath();
    a.pts.forEach((p,i) => {
      const x = Math.cos(p.a)*a.r*p.r, y = Math.sin(p.a)*a.r*p.r;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    const rg = ctx.createRadialGradient(-a.r*0.3,-a.r*0.3,0,0,0,a.r*1.1);
    rg.addColorStop(0,`hsl(${a.hue},25%,48%)`);
    rg.addColorStop(0.5,`hsl(${a.hue},20%,28%)`);
    rg.addColorStop(1,`hsl(${a.hue},15%,14%)`);
    ctx.fillStyle=rg; ctx.fill();
    ctx.strokeStyle=`hsla(${a.hue},30%,55%,0.5)`; ctx.lineWidth=1; ctx.stroke();
    // Craters
    [[a.r*0.28,a.r*0.18,a.r*0.14],[-a.r*0.2,a.r*0.3,a.r*0.1],[-a.r*0.3,-a.r*0.25,a.r*0.09]].forEach(([cx,cy,cr])=>{
      ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2);
      ctx.strokeStyle=`hsla(${a.hue},20%,18%,0.6)`; ctx.lineWidth=1; ctx.stroke();
    });
    ctx.restore();
  }

  // ── Draw meteor with glowing trail ────────────────────
  function drawMeteor(m) {
    const angle = Math.atan2(m.vy, m.vx);
    const tx = m.x - Math.cos(angle)*m.len, ty = m.y - Math.sin(angle)*m.len;

    // Wide glow trail
    const wg = ctx.createLinearGradient(tx,ty,m.x,m.y);
    const hue = m.hue === 0 ? 210 : m.hue;
    wg.addColorStop(0,`hsla(${hue},80%,70%,0)`);
    wg.addColorStop(0.7,`hsla(${hue},90%,80%,${m.alpha*0.25})`);
    wg.addColorStop(1,`hsla(${hue},100%,95%,${m.alpha*0.6})`);
    ctx.beginPath();
    ctx.moveTo(tx,ty); ctx.lineTo(m.x,m.y);
    ctx.strokeStyle=wg; ctx.lineWidth=m.size*3.5; ctx.lineCap='round'; ctx.stroke();

    // Core bright trail
    const cg = ctx.createLinearGradient(tx,ty,m.x,m.y);
    cg.addColorStop(0,`hsla(${hue},100%,100%,0)`);
    cg.addColorStop(1,`hsla(${hue},100%,100%,${m.alpha})`);
    ctx.beginPath();
    ctx.moveTo(tx,ty); ctx.lineTo(m.x,m.y);
    ctx.strokeStyle=cg; ctx.lineWidth=m.size*0.9; ctx.stroke();

    // Head glow
    ctx.shadowColor=`hsl(${hue},100%,85%)`; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.size*1.8,0,Math.PI*2);
    ctx.fillStyle=`hsla(${hue},100%,95%,${m.alpha})`; ctx.fill();
    ctx.shadowBlur=0;

    // Debris sparks
    if (Math.random()<0.35) {
      for (let i=0;i<2;i++) {
        const bx=m.x+(Math.random()-0.5)*12, by=m.y+(Math.random()-0.5)*12;
        ctx.beginPath(); ctx.arc(bx,by,Math.random()*1.5+0.3,0,Math.PI*2);
        ctx.fillStyle=`hsla(${hue},90%,85%,${m.alpha*0.7})`; ctx.fill();
      }
    }
  }

  // ── Main loop ──────────────────────────────────────────
  function frame(ts) {
    t = ts*0.001;
    ctx.fillStyle='#02030d'; ctx.fillRect(0,0,W,H);

    // Deep space nebula layers
    [
      [0.15,0.25,0.5, 240,0.055],[0.85,0.70,0.45,260,0.045],
      [0.50,0.10,0.38,210,0.04], [0.30,0.80,0.32,280,0.035],
      [0.70,0.30,0.28,190,0.03],
    ].forEach(([fx,fy,fr,fh,fa])=>{
      const g=ctx.createRadialGradient(fx*W,fy*H,0,fx*W,fy*H,fr*Math.min(W,H));
      g.addColorStop(0,`hsla(${fh},70%,35%,${fa})`); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    });

    // Milky way band
    const mw = ctx.createLinearGradient(0, H*0.2, W, H*0.8);
    mw.addColorStop(0,'transparent');
    mw.addColorStop(0.3,`rgba(130,160,255,0.04)`);
    mw.addColorStop(0.5,`rgba(150,180,255,0.07)`);
    mw.addColorStop(0.7,`rgba(130,160,255,0.04)`);
    mw.addColorStop(1,'transparent');
    ctx.fillStyle=mw; ctx.fillRect(0,0,W,H);

    // Stars
    stars.forEach(s => {
      s.tw += s.sp;
      const a = 0.22+Math.sin(s.tw)*0.55;
      const hue = s.hue || 0;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = hue
        ? `hsla(${hue},80%,80%,${a})`
        : `rgba(210,220,255,${a})`;
      ctx.fill();
      // Cross flare on bigger stars
      if (s.r > 1.3 && a > 0.5) {
        ctx.strokeStyle=`rgba(200,215,255,${a*0.35})`;
        ctx.lineWidth=0.6;
        ctx.beginPath(); ctx.moveTo(s.x-s.r*3,s.y); ctx.lineTo(s.x+s.r*3,s.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x,s.y-s.r*3); ctx.lineTo(s.x,s.y+s.r*3); ctx.stroke();
      }
    });

    // Asteroids
    asteroids.forEach(a => {
      a.x += a.vx; a.y += a.vy; a.rot += a.drot;
      if (a.y > H+a.r*2 || a.x < -a.r*3 || a.x > W+a.r*3) Object.assign(a, makeAsteroid(false));
      drawAsteroid(a);
    });

    // Meteors
    meteors = meteors.filter(m => m.y < H+100 && m.alpha > 0.02);
    meteors.forEach(m => {
      m.x += m.vx; m.y += m.vy;
      m.alpha -= 0.004;
      drawMeteor(m);
    });

    // Vignette
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*0.95);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(2,3,13,0.72)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(frame);
  }

  function resize() {
    W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight;
    initStars(); initAsteroids();
  }
  window.addEventListener('resize',resize);
  resize(); requestAnimationFrame(frame);
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
