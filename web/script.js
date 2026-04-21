// ═══════════════════════════════════════════════════════════
//  GOLDEN DRAGON ENGINE
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;

  // ── Stars + nebula ─────────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 250 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.6+0.2, tw: Math.random()*Math.PI*2,
      sp: Math.random()*0.03+0.006,
    }));
  }
  let shoots = [];
  setInterval(() => {
    if (Math.random()>0.55) return;
    shoots.push({ x:Math.random()*W, y:Math.random()*H*0.4,
      len:Math.random()*180+80, speed:Math.random()*14+7,
      angle:Math.PI/4+(Math.random()-0.5)*0.5, alpha:1 });
  }, 2200);

  // ── Dragon ─────────────────────────────────────────────
  const SEG = 120, GAP = 22;
  let segs = [];
  function initDragon() {
    segs = Array.from({ length: SEG }, () => ({ x: W/2, y: H/2, a: 0 }));
  }

  // Grand sweeping path — lemniscate stretched across full screen
  function headPos(t) {
    const th = t * 0.25;
    const d  = 1 + Math.sin(th)*Math.sin(th);
    return {
      x: W/2 + W*0.40 * Math.cos(th) / d,
      y: H/2 + H*0.32 * Math.sin(th)*Math.cos(th) / d,
    };
  }

  function updateDragon(t) {
    const hp = headPos(t);
    segs[0].x = hp.x; segs[0].y = hp.y;
    for (let i=1; i<SEG; i++) {
      const dx = segs[i-1].x - segs[i].x, dy = segs[i-1].y - segs[i].y;
      const d  = Math.hypot(dx, dy);
      if (d > GAP) { const f=(d-GAP)/d; segs[i].x+=dx*f; segs[i].y+=dy*f; }
      segs[i].a = Math.atan2(dy, dx);
    }
    segs[0].a = segs.length>1 ? Math.atan2(segs[0].y-segs[1].y, segs[0].x-segs[1].x) : 0;
  }

  // ── Dragon pearl (chasing ball) ────────────────────────
  let pearl = { x:0, y:0 };
  function updatePearl(t) {
    const th = t*0.25 + 1.2;
    const d  = 1 + Math.sin(th)*Math.sin(th);
    pearl.x = W/2 + W*0.40*Math.cos(th)/d;
    pearl.y = H/2 + H*0.32*Math.sin(th)*Math.cos(th)/d;
  }
  function drawPearl() {
    const g = ctx.createRadialGradient(pearl.x, pearl.y, 0, pearl.x, pearl.y, 28);
    g.addColorStop(0,   'rgba(255,255,230,0.95)');
    g.addColorStop(0.3, 'rgba(255,220,80,0.8)');
    g.addColorStop(0.7, 'rgba(255,160,20,0.35)');
    g.addColorStop(1,   'transparent');
    ctx.shadowColor='#ffe060'; ctx.shadowBlur=40;
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pearl.x, pearl.y, 28, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(pearl.x-8, pearl.y-8, 7, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }

  // ── Gold fire particles ────────────────────────────────
  let fire = [];
  function spawnFire() {
    const a = segs[0].a;
    const tx = segs[0].x + Math.cos(a)*55, ty = segs[0].y + Math.sin(a)*55;
    for (let i=0; i<8; i++) {
      const sp = (Math.random()-0.5)*1.0;
      fire.push({
        x:tx, y:ty,
        vx: Math.cos(a+sp)*(14+Math.random()*10),
        vy: Math.sin(a+sp)*(14+Math.random()*10),
        life:1, size: Math.random()*20+10,
        hue: 25+Math.random()*30,
      });
    }
  }
  function drawFire() {
    fire = fire.filter(p=>p.life>0.02);
    fire.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.vx*=0.955; p.vy*=0.955;
      p.life-=0.028; p.size*=0.965;
      const g = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y,p.size);
      g.addColorStop(0,   `hsla(${p.hue+50},100%,95%,${p.life})`);
      g.addColorStop(0.3, `hsla(${p.hue+20},100%,70%,${p.life*0.85})`);
      g.addColorStop(0.7, `hsla(${p.hue},   90%, 45%,${p.life*0.5})`);
      g.addColorStop(1,   'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    });
  }

  // ── Gold sparks along body ─────────────────────────────
  let sparks = [];
  setInterval(() => {
    const idx = Math.floor(Math.random()*SEG*0.7);
    if (!segs[idx]) return;
    for (let i=0; i<4; i++)
      sparks.push({ x:segs[idx].x, y:segs[idx].y,
        vx:(Math.random()-0.5)*7, vy:(Math.random()-0.5)*7, life:1,
        hue: 40+Math.random()*20 });
  }, 90);
  function drawSparks() {
    sparks = sparks.filter(p=>p.life>0.02);
    sparks.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.life-=0.055;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
      ctx.fillStyle=`hsla(${p.hue},100%,80%,${p.life})`; ctx.fill();
    });
  }

  // ── Claw at given segment ──────────────────────────────
  function drawClaw(x, y, angle, size, side) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle + (side>0 ? 0.5 : -0.5));
    ctx.shadowColor='#ffd700'; ctx.shadowBlur=12;
    // Leg
    ctx.beginPath();
    ctx.moveTo(0,0);
    const lx=side*size*1.4, ly=size*1.2;
    ctx.quadraticCurveTo(side*size*0.8, size*0.7, lx, ly);
    ctx.strokeStyle='#b8860b'; ctx.lineWidth=size*0.35; ctx.stroke();
    // 3 claws
    for (let c=-1; c<=1; c++) {
      const ca = c*0.45;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx+Math.cos(Math.PI/2+ca+side*0.3)*size*1.1,
                 ly+Math.sin(Math.PI/2+ca+side*0.3)*size*1.1);
      ctx.strokeStyle='#ffd700'; ctx.lineWidth=size*0.18; ctx.stroke();
    }
    ctx.shadowBlur=0; ctx.restore();
  }

  // ── Draw entire body ───────────────────────────────────
  function drawBody(t) {
    // Outer glow aura
    for (let i=SEG-1; i>=1; i--) {
      const s=segs[i], prog=i/SEG;
      const sz = 30*(1-prog*0.72)+5;
      const bright = 0.18 + Math.sin(t*0.6+i*0.08)*0.06;
      const g = ctx.createRadialGradient(s.x,s.y,0, s.x,s.y,sz*2.8);
      g.addColorStop(0, `rgba(255,200,20,${bright})`);
      g.addColorStop(0.5, `rgba(180,100,0,${bright*0.4})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x,s.y,sz*2.8,0,Math.PI*2); ctx.fill();
    }

    // Scales — gold gradient
    for (let i=SEG-1; i>=1; i--) {
      const s=segs[i], prog=i/SEG;
      const sz = 28*(1-prog*0.72)+5;
      const shimmer = Math.sin(t*1.5+i*0.25)*0.12;
      const light = Math.floor(28 + (1-prog)*18 + shimmer*10);

      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.shadowColor='rgba(255,180,0,0.6)'; ctx.shadowBlur=10;

      // Main scale body
      const sg = ctx.createLinearGradient(-sz,-sz*0.5, sz, sz*0.5);
      sg.addColorStop(0,   `hsl(42,100%,${light+12}%)`);
      sg.addColorStop(0.4, `hsl(38,100%,${light}%)`);
      sg.addColorStop(1,   `hsl(30,90%,${light-10}%)`);
      ctx.beginPath(); ctx.ellipse(0,0, sz, sz*0.58, 0, 0, Math.PI*2);
      ctx.fillStyle=sg; ctx.fill();
      ctx.strokeStyle=`rgba(255,220,60,0.4)`; ctx.lineWidth=0.8; ctx.stroke();

      // Scale ridge highlight
      ctx.beginPath(); ctx.ellipse(sz*0.1,-sz*0.12, sz*0.38, sz*0.22, -0.4, 0, Math.PI*2);
      ctx.fillStyle=`rgba(255,255,180,${0.22+shimmer*0.15})`; ctx.fill();

      // Belly lighter
      ctx.beginPath(); ctx.ellipse(0, sz*0.25, sz*0.5, sz*0.2, 0, 0, Math.PI*2);
      ctx.fillStyle=`rgba(255,240,180,0.35)`; ctx.fill();

      // Dorsal spines every 3 segs
      if (i%3===0 && prog<0.68) {
        const sh=sz*(1.1-prog*0.65);
        ctx.beginPath();
        ctx.moveTo(-sz*0.1,-sz*0.52); ctx.lineTo(0,-sz*0.52-sh); ctx.lineTo(sz*0.1,-sz*0.52);
        const spg=ctx.createLinearGradient(0,-sz*0.52,0,-sz*0.52-sh);
        spg.addColorStop(0,'#ffcc00'); spg.addColorStop(1,'#ff8800');
        ctx.fillStyle=spg; ctx.fill();
      }

      ctx.shadowBlur=0; ctx.restore();
    }

    // Claws at leg positions (every 12 segs in front half)
    for (let i=8; i<SEG*0.5; i+=12) {
      if (!segs[i]) continue;
      const s=segs[i], prog=i/SEG;
      const sz=18*(1-prog*0.5)+6;
      drawClaw(s.x, s.y, s.a, sz, +1);
      drawClaw(s.x, s.y, s.a, sz, -1);
    }
  }

  // ── Dragon head ────────────────────────────────────────
  function drawHead(t) {
    const h=segs[0], a=h.a, S=48;
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(a);

    // Big golden halo
    const halo=ctx.createRadialGradient(S*0.5,0,0, S*0.5,0,S*6);
    halo.addColorStop(0,'rgba(255,200,30,0.30)');
    halo.addColorStop(0.4,'rgba(180,100,0,0.10)');
    halo.addColorStop(1,'transparent');
    ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(S*0.5,0,S*6,0,Math.PI*2); ctx.fill();

    // Neck base
    const nbg=ctx.createRadialGradient(0,0,0,0,0,S);
    nbg.addColorStop(0,'hsl(38,90%,30%)');
    nbg.addColorStop(1,'hsl(32,85%,20%)');
    ctx.beginPath(); ctx.fillStyle=nbg;
    ctx.ellipse(0,0,S,S*0.75,0,0,Math.PI*2); ctx.fill();

    // Snout / jaw
    const jaw=ctx.createLinearGradient(0,-S*0.5,S*1.3,S*0.5);
    jaw.addColorStop(0,'hsl(40,95%,42%)');
    jaw.addColorStop(1,'hsl(35,90%,28%)');
    ctx.beginPath(); ctx.fillStyle=jaw;
    ctx.ellipse(S*0.55,0, S*0.78, S*0.52, 0, 0, Math.PI*2); ctx.fill();

    // Upper ridge/brow
    ctx.beginPath(); ctx.fillStyle='hsl(42,100%,48%)';
    ctx.ellipse(S*0.45,-S*0.2, S*0.65,S*0.26, 0, 0, Math.PI*2); ctx.fill();

    // Scale lines on head
    ctx.strokeStyle='rgba(255,200,30,0.25)'; ctx.lineWidth=1;
    for (let i=0;i<5;i++) {
      ctx.beginPath();
      ctx.arc(S*0.1, -S*0.05+i*S*0.07, S*(0.22+i*0.16), Math.PI*0.6, Math.PI*1.6);
      ctx.stroke();
    }

    // Lower jaw (open)
    ctx.beginPath(); ctx.fillStyle='hsl(36,90%,32%)';
    ctx.ellipse(S*0.5, S*0.28, S*0.72, S*0.3, 0.15, 0, Math.PI*2); ctx.fill();

    // Mouth cavity glow
    const mg=ctx.createRadialGradient(S*0.7,S*0.18,0, S*0.7,S*0.18,S*0.55);
    mg.addColorStop(0,'rgba(255,120,0,0.95)');
    mg.addColorStop(0.5,'rgba(200,40,0,0.5)');
    mg.addColorStop(1,'transparent');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(S*0.7,S*0.18,S*0.55,0,Math.PI*2); ctx.fill();

    // Upper teeth
    for (let i=0;i<6;i++) {
      const tx=S*(0.18+i*0.2);
      ctx.beginPath(); ctx.moveTo(tx,-S*0.05); ctx.lineTo(tx+S*0.07,S*0.22); ctx.lineTo(tx+S*0.13,-S*0.05);
      ctx.fillStyle='rgba(255,240,210,0.92)'; ctx.fill();
    }
    // Lower teeth
    for (let i=0;i<5;i++) {
      const tx=S*(0.25+i*0.2);
      ctx.beginPath(); ctx.moveTo(tx,S*0.38); ctx.lineTo(tx+S*0.07,S*0.14); ctx.lineTo(tx+S*0.13,S*0.38);
      ctx.fillStyle='rgba(255,235,200,0.85)'; ctx.fill();
    }

    // Eye — fierce amber
    const ex=S*0.28, ey=-S*0.3;
    ctx.shadowColor='#ffaa00'; ctx.shadowBlur=30;
    const eg=ctx.createRadialGradient(ex,ey,0, ex,ey,S*0.48);
    eg.addColorStop(0,`hsla(${50+Math.sin(t*1.5)*8},100%,92%,1)`);
    eg.addColorStop(0.35,'hsla(35,100%,60%,0.95)');
    eg.addColorStop(0.7,'hsla(20,90%,35%,0.6)');
    eg.addColorStop(1,'transparent');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(ex,ey,S*0.48,0,Math.PI*2); ctx.fill();
    // Slit pupil
    ctx.fillStyle='#1a0800';
    ctx.beginPath(); ctx.ellipse(ex,ey,S*0.08,S*0.2,0.1,0,Math.PI*2); ctx.fill();
    // Eye shine
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(ex-S*0.06,ey-S*0.1,S*0.06,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(ex+S*0.05,ey+S*0.06,S*0.03,0,Math.PI*2); ctx.fill();

    // Main horn — tall & glowing gold
    ctx.shadowColor='#ffcc00'; ctx.shadowBlur=25;
    const hg1=ctx.createLinearGradient(0,-S*0.6, S*0.15,-S*1.6);
    hg1.addColorStop(0,'#ff9900'); hg1.addColorStop(1,'#ffee44');
    ctx.beginPath();
    ctx.moveTo(-S*0.08,-S*0.58); ctx.lineTo(S*0.15,-S*1.65); ctx.lineTo(S*0.38,-S*0.55);
    ctx.fillStyle=hg1; ctx.fill();
    // Back horn
    const hg2=ctx.createLinearGradient(0,-S*0.5, -S*0.08,-S*1.15);
    hg2.addColorStop(0,'#cc7700'); hg2.addColorStop(1,'#ffcc33');
    ctx.beginPath();
    ctx.moveTo(-S*0.28,-S*0.5); ctx.lineTo(-S*0.1,-S*1.18); ctx.lineTo(S*0.04,-S*0.48);
    ctx.fillStyle=hg2; ctx.fill();
    // Small brow spike
    ctx.beginPath();
    ctx.moveTo(S*0.06,-S*0.44); ctx.lineTo(S*0.22,-S*0.82); ctx.lineTo(S*0.35,-S*0.42);
    ctx.fillStyle='#ddaa00'; ctx.fill();
    ctx.shadowBlur=0;

    // Long whiskers / beard
    ctx.shadowColor='rgba(255,220,80,0.6)'; ctx.shadowBlur=8;
    [
      [S*0.9,-S*0.22, S*1.6,-S*0.6, S*2.1,-S*0.9,  'rgba(255,230,100,0.8)', 2.2],
      [S*0.9,-S*0.18, S*1.7,-S*0.1, S*2.3,S*0.1,   'rgba(255,210,80,0.65)',1.6],
      [S*0.9, S*0.15, S*1.6, S*0.55, S*2.0, S*0.85, 'rgba(255,200,70,0.7)', 2.0],
      [S*0.9, S*0.2,  S*1.5, S*0.8,  S*1.9, S*1.1,  'rgba(255,185,60,0.5)', 1.3],
    ].forEach(([x1,y1,cx,cy,x2,y2,col,lw]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1);
      ctx.quadraticCurveTo(cx,cy,x2,y2);
      ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke();
    });
    ctx.shadowBlur=0;

    ctx.restore();
  }

  // ── Background nebula ──────────────────────────────────
  function drawNebula() {
    [[0.2,0.3,0.35,38,0.07],[0.8,0.65,0.28,28,0.06],[0.5,0.1,0.22,45,0.05],[0.1,0.75,0.20,25,0.04]].forEach(([fx,fy,fr,fh,fa])=>{
      const g=ctx.createRadialGradient(fx*W,fy*H,0,fx*W,fy*H,fr*Math.min(W,H));
      g.addColorStop(0,`hsla(${fh},70%,30%,${fa})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    });
  }

  // ── Main loop ──────────────────────────────────────────
  let lastFire=0;
  function frame(ts) {
    t = ts * 0.001;
    ctx.fillStyle='#08050a';
    ctx.fillRect(0,0,W,H);

    drawNebula();

    // Stars
    stars.forEach(s => {
      s.tw+=s.sp;
      const a=0.25+Math.sin(s.tw)*0.5;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,240,200,${a})`; ctx.fill();
    });

    // Shooting stars (golden tinge)
    shoots=shoots.filter(s=>s.alpha>0.02);
    shoots.forEach(s=>{
      const tl=ctx.createLinearGradient(s.x-Math.cos(s.angle)*s.len,s.y-Math.sin(s.angle)*s.len,s.x,s.y);
      tl.addColorStop(0,'hsla(45,100%,80%,0)');
      tl.addColorStop(1,`hsla(45,100%,90%,${s.alpha})`);
      ctx.beginPath();
      ctx.moveTo(s.x-Math.cos(s.angle)*s.len,s.y-Math.sin(s.angle)*s.len);
      ctx.lineTo(s.x,s.y);
      ctx.strokeStyle=tl; ctx.lineWidth=1.8; ctx.stroke();
      s.x+=Math.cos(s.angle)*s.speed; s.y+=Math.sin(s.angle)*s.speed; s.alpha-=0.014;
    });

    updateDragon(t);
    updatePearl(t);
    drawPearl();
    drawBody(t);
    drawSparks();
    drawFire();
    drawHead(t);

    if (ts-lastFire>60) { spawnFire(); lastFire=ts; }

    // Vignette
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.06,W/2,H/2,H*0.95);
    vig.addColorStop(0,'rgba(0,0,0,0)');
    vig.addColorStop(1,'rgba(8,5,10,0.82)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(frame);
  }

  function resize() {
    W=canvas.width=window.innerWidth;
    H=canvas.height=window.innerHeight;
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
