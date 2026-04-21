// ═══════════════════════════════════════════════════════════
//  GOLDEN DRAGON ENGINE
// ═══════════════════════════════════════════════════════════
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;

  // ── Stars ──────────────────────────────────────────────
  let stars = [];
  function initStars() {
    stars = Array.from({ length: 200 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.5+0.2, tw: Math.random()*Math.PI*2, sp: Math.random()*0.025+0.005,
    }));
  }
  let shoots = [];
  setInterval(() => {
    if (Math.random() > 0.5) return;
    shoots.push({ x:Math.random()*W, y:Math.random()*H*0.4,
      len:Math.random()*180+80, speed:Math.random()*14+7,
      angle:Math.PI/4+(Math.random()-0.5)*0.5, alpha:1 });
  }, 2500);

  // ── Dragon skeleton ────────────────────────────────────
  const SEG = 80, GAP = 26;
  let segs = [];
  function initDragon() {
    segs = Array.from({ length: SEG }, () => ({ x:W/2, y:H/2, a:0 }));
  }
  function headPos(t) {
    const th = t * 0.22;
    const d  = 1 + Math.sin(th)*Math.sin(th);
    return { x: W/2 + W*0.42*Math.cos(th)/d, y: H/2 + H*0.34*Math.sin(th)*Math.cos(th)/d };
  }
  function updateDragon(t) {
    const hp = headPos(t);
    segs[0].x = hp.x; segs[0].y = hp.y;
    for (let i = 1; i < SEG; i++) {
      const dx = segs[i-1].x-segs[i].x, dy = segs[i-1].y-segs[i].y;
      const d = Math.hypot(dx, dy);
      if (d > GAP) { const f=(d-GAP)/d; segs[i].x+=dx*f; segs[i].y+=dy*f; }
      segs[i].a = Math.atan2(dy, dx);
    }
    segs[0].a = Math.atan2(segs[0].y-segs[1].y, segs[0].x-segs[1].x);
  }

  // ── Body width profile ─────────────────────────────────
  function bw(prog) {
    if (prog < 0.06) return 35 + prog*300;
    if (prog < 0.18) return 53 - prog*60;
    return Math.max(5, 46*(1-prog*0.88));
  }

  // ── Draw filled body shape ─────────────────────────────
  function drawBody(t) {
    const upper = [], lower = [];
    for (let i = 0; i < SEG; i++) {
      const w = bw(i/SEG), a = segs[i].a;
      const nx = Math.cos(a-Math.PI/2), ny = Math.sin(a-Math.PI/2);
      upper.push({ x:segs[i].x+nx*w, y:segs[i].y+ny*w });
      lower.push({ x:segs[i].x-nx*w, y:segs[i].y-ny*w });
    }

    // Outer glow
    for (let i = 0; i < SEG; i += 4) {
      const w = bw(i/SEG)*3, g = ctx.createRadialGradient(segs[i].x,segs[i].y,0,segs[i].x,segs[i].y,w);
      g.addColorStop(0,`rgba(255,180,0,${0.13-i/SEG*0.09})`); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(segs[i].x,segs[i].y,w,0,Math.PI*2); ctx.fill();
    }

    // Body fill
    ctx.beginPath();
    ctx.moveTo(upper[0].x, upper[0].y);
    for (let i=1;i<SEG;i++) ctx.lineTo(upper[i].x, upper[i].y);
    for (let i=SEG-1;i>=0;i--) ctx.lineTo(lower[i].x, lower[i].y);
    ctx.closePath();
    const bg = ctx.createLinearGradient(segs[0].x,segs[0].y,segs[SEG-1].x,segs[SEG-1].y);
    bg.addColorStop(0,'#ffd700'); bg.addColorStop(0.4,'#ffaa00'); bg.addColorStop(1,'#bb6600');
    ctx.fillStyle=bg; ctx.fill();
    ctx.strokeStyle='rgba(100,45,0,0.7)'; ctx.lineWidth=2.5; ctx.stroke();

    // Belly stripe
    ctx.beginPath();
    for (let i=0;i<SEG;i++) {
      const w=bw(i/SEG)*0.42, a=segs[i].a;
      const nx=Math.cos(a-Math.PI/2)*w, ny=Math.sin(a-Math.PI/2)*w;
      i===0 ? ctx.moveTo(segs[i].x-nx*0.3,segs[i].y-ny*0.3) : ctx.lineTo(segs[i].x-nx*0.3,segs[i].y-ny*0.3);
    }
    ctx.strokeStyle='rgba(255,245,160,0.32)'; ctx.lineWidth=bw(0.35)*0.7; ctx.lineCap='round'; ctx.stroke();

    // Scales as overlapping arcs
    for (let i=SEG-1;i>=2;i--) {
      if (i%2!==0) continue;
      const prog=i/SEG, w=bw(prog), s=segs[i];
      ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.a);
      // Scale arc
      ctx.beginPath(); ctx.arc(0,-w*0.45,w*0.65,Math.PI,0);
      ctx.strokeStyle=`rgba(160,80,0,${0.55-prog*0.2})`; ctx.lineWidth=1.8; ctx.stroke();
      ctx.fillStyle=`rgba(255,190,30,${0.18-prog*0.07})`; ctx.fill();
      // Dorsal spine every 3
      if (i%3===0 && prog<0.68) {
        const sh=w*(1.15-prog*0.7);
        ctx.beginPath();
        ctx.moveTo(-w*0.12,-w*0.55); ctx.lineTo(0,-w*0.55-sh); ctx.lineTo(w*0.12,-w*0.55);
        const sg=ctx.createLinearGradient(0,-w*0.55,0,-w*0.55-sh);
        sg.addColorStop(0,'#ff8800'); sg.addColorStop(1,'#ffee44');
        ctx.fillStyle=sg; ctx.fill(); ctx.strokeStyle='rgba(120,40,0,0.4)'; ctx.lineWidth=0.8; ctx.stroke();
      }
      ctx.restore();
    }

    // Legs at 4 positions
    [10,18,33,41].forEach(li => {
      if (!segs[li]) return;
      const s=segs[li], prog=li/SEG, w=bw(prog);
      drawLeg(s.x,s.y,s.a,w,t+li*0.12,+1);
      drawLeg(s.x,s.y,s.a,w,t+li*0.12,-1);
    });
  }

  // ── Leg with 3 claws ───────────────────────────────────
  function drawLeg(x,y,angle,bw,t,side) {
    const L=bw*1.7, ph=Math.sin(t*2.5)*0.38*side;
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    const lx=side*bw*0.95, ly=bw*0.2;
    const kx=lx+Math.cos(Math.PI/2+ph+side*0.35)*L*0.52;
    const ky=ly+Math.sin(Math.PI/2+ph+side*0.35)*L*0.52;
    const fx=kx+Math.cos(Math.PI/2+ph*0.4)*L*0.52;
    const fy=ky+Math.sin(Math.PI/2+ph*0.4)*L*0.52;
    // Upper leg
    ctx.beginPath(); ctx.moveTo(lx*0.6,ly); ctx.lineTo(kx,ky);
    ctx.strokeStyle='#cc8800'; ctx.lineWidth=bw*0.42; ctx.lineCap='round'; ctx.stroke();
    ctx.strokeStyle='#ffcc22'; ctx.lineWidth=bw*0.22; ctx.stroke();
    // Lower leg
    ctx.beginPath(); ctx.moveTo(kx,ky); ctx.lineTo(fx,fy);
    ctx.strokeStyle='#bb7700'; ctx.lineWidth=bw*0.32; ctx.stroke();
    ctx.strokeStyle='#ffdd44'; ctx.lineWidth=bw*0.16; ctx.stroke();
    // 3 claws
    ctx.shadowColor='rgba(255,200,0,0.7)'; ctx.shadowBlur=8;
    for (let c=-1;c<=1;c++) {
      const ca=Math.PI/2+c*0.44+ph*0.25;
      ctx.beginPath(); ctx.moveTo(fx,fy);
      ctx.quadraticCurveTo(
        fx+Math.cos(ca)*L*0.2, fy+Math.sin(ca)*L*0.2,
        fx+Math.cos(ca)*L*0.38, fy+Math.sin(ca)*L*0.38
      );
      ctx.strokeStyle='#ffe066'; ctx.lineWidth=bw*0.16; ctx.stroke();
      ctx.fillStyle='#fff8cc';
      ctx.beginPath(); ctx.arc(fx+Math.cos(ca)*L*0.38,fy+Math.sin(ca)*L*0.38,bw*0.11,0,Math.PI*2); ctx.fill();
    }
    ctx.shadowBlur=0; ctx.restore();
  }

  // ── Dragon head (bezier-shaped) ────────────────────────
  function drawHead(t) {
    const h=segs[0], a=h.a, S=56;
    ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(a);

    // Halo
    const halo=ctx.createRadialGradient(S*0.5,0,0,S*0.5,0,S*5.5);
    halo.addColorStop(0,'rgba(255,200,20,0.38)');
    halo.addColorStop(0.45,'rgba(180,90,0,0.12)');
    halo.addColorStop(1,'transparent');
    ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(S*0.5,0,S*5.5,0,Math.PI*2); ctx.fill();

    ctx.shadowColor='rgba(80,30,0,0.9)'; ctx.shadowBlur=14; ctx.shadowOffsetX=3; ctx.shadowOffsetY=3;

    // Skull
    ctx.beginPath();
    ctx.moveTo(-S*0.18,-S*0.72);
    ctx.bezierCurveTo(-S*0.52,-S*0.82,-S*0.52,S*0.82,-S*0.18,S*0.72);
    ctx.bezierCurveTo(S*0.18,S*0.92,S*0.5,S*0.72,S*0.62,S*0.42);
    ctx.bezierCurveTo(S*0.82,S*0.22,S*0.82,-S*0.22,S*0.62,-S*0.42);
    ctx.bezierCurveTo(S*0.5,-S*0.72,S*0.18,-S*0.92,-S*0.18,-S*0.72);
    ctx.closePath();
    const hf=ctx.createLinearGradient(-S*0.5,-S*0.8,S*0.6,S*0.8);
    hf.addColorStop(0,'#ffe033'); hf.addColorStop(0.35,'#ffaa00'); hf.addColorStop(0.7,'#cc7700'); hf.addColorStop(1,'#994400');
    ctx.fillStyle=hf; ctx.fill();
    ctx.strokeStyle='rgba(80,30,0,0.65)'; ctx.lineWidth=2.2; ctx.stroke();

    // Upper snout
    ctx.beginPath();
    ctx.moveTo(S*0.28,-S*0.36);
    ctx.bezierCurveTo(S*0.7,-S*0.42,S*1.28,-S*0.28,S*1.52,-S*0.1);
    ctx.bezierCurveTo(S*1.62,S*0.02,S*1.52,S*0.1,S*1.35,S*0.06);
    ctx.bezierCurveTo(S*1.1,S*0.01,S*0.68,-S*0.07,S*0.28,-S*0.04);
    ctx.closePath();
    const sf=ctx.createLinearGradient(S*0.28,-S*0.42,S*1.52,S*0.1);
    sf.addColorStop(0,'#ffcc22'); sf.addColorStop(1,'#dd8800');
    ctx.fillStyle=sf; ctx.fill(); ctx.strokeStyle='rgba(90,35,0,0.55)'; ctx.lineWidth=1.8; ctx.stroke();

    ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;

    // Scale lines on head
    ctx.strokeStyle='rgba(255,180,20,0.22)'; ctx.lineWidth=1;
    for (let i=0;i<5;i++) {
      ctx.beginPath(); ctx.arc(S*0.1,-S*0.04+i*S*0.06,S*(0.2+i*0.15),Math.PI*0.58,Math.PI*1.6); ctx.stroke();
    }

    // Nostrils
    [S*1.26,S*1.44].forEach(nx => {
      ctx.beginPath(); ctx.ellipse(nx,-S*0.15,S*0.075,S*0.055,-0.3,0,Math.PI*2);
      ctx.fillStyle='rgba(255,40,0,0.95)'; ctx.fill();
      const ng=ctx.createRadialGradient(nx,-S*0.22,0,nx,-S*0.22,S*0.2);
      ng.addColorStop(0,'rgba(255,80,0,0.45)'); ng.addColorStop(1,'transparent');
      ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(nx,-S*0.22,S*0.2,0,Math.PI*2); ctx.fill();
    });

    // Lower jaw
    ctx.beginPath();
    ctx.moveTo(S*0.28,S*0.14);
    ctx.bezierCurveTo(S*0.72,S*0.24,S*1.12,S*0.3,S*1.42,S*0.2);
    ctx.bezierCurveTo(S*1.58,S*0.14,S*1.52,S*0.38,S*1.32,S*0.42);
    ctx.bezierCurveTo(S*1.0,S*0.46,S*0.58,S*0.4,S*0.28,S*0.34);
    ctx.closePath();
    const jf=ctx.createLinearGradient(S*0.28,S*0.1,S*1.52,S*0.46);
    jf.addColorStop(0,'#ee9900'); jf.addColorStop(1,'#aa5500');
    ctx.fillStyle=jf; ctx.fill(); ctx.strokeStyle='rgba(80,30,0,0.5)'; ctx.lineWidth=1.8; ctx.stroke();

    // Mouth glow
    const mg=ctx.createRadialGradient(S*0.9,S*0.22,0,S*0.9,S*0.22,S*0.52);
    mg.addColorStop(0,'rgba(255,110,0,0.95)'); mg.addColorStop(0.5,'rgba(180,30,0,0.6)'); mg.addColorStop(1,'transparent');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(S*0.9,S*0.22,S*0.52,0,Math.PI*2); ctx.fill();

    // Upper teeth
    for (let i=0;i<6;i++) {
      const tx=S*(0.34+i*0.21);
      ctx.beginPath(); ctx.moveTo(tx,S*0.02); ctx.lineTo(tx+S*0.08,S*0.24); ctx.lineTo(tx+S*0.14,S*0.02);
      ctx.fillStyle='rgba(255,245,218,0.94)'; ctx.fill();
      ctx.strokeStyle='rgba(180,110,0,0.3)'; ctx.lineWidth=0.7; ctx.stroke();
    }
    // Lower teeth
    for (let i=0;i<5;i++) {
      const tx=S*(0.42+i*0.21);
      ctx.beginPath(); ctx.moveTo(tx,S*0.38); ctx.lineTo(tx+S*0.08,S*0.16); ctx.lineTo(tx+S*0.14,S*0.38);
      ctx.fillStyle='rgba(255,238,205,0.88)'; ctx.fill();
    }

    // Eye socket
    ctx.beginPath(); ctx.ellipse(S*0.3,-S*0.36,S*0.3,S*0.24,0.12,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fill();
    // Eye glow
    ctx.shadowColor='#ffaa00'; ctx.shadowBlur=28;
    const eg=ctx.createRadialGradient(S*0.3,-S*0.36,0,S*0.3,-S*0.36,S*0.26);
    eg.addColorStop(0,`hsla(${52+Math.sin(t*1.8)*8},100%,94%,1)`);
    eg.addColorStop(0.32,'hsla(38,100%,62%,0.96)');
    eg.addColorStop(0.7,'hsla(22,90%,36%,0.55)');
    eg.addColorStop(1,'transparent');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.ellipse(S*0.3,-S*0.36,S*0.25,S*0.2,0.12,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    // Slit pupil
    ctx.fillStyle='#0a0300';
    ctx.beginPath(); ctx.ellipse(S*0.3,-S*0.36,S*0.065,S*0.17,0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(S*0.22,-S*0.44,S*0.065,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(S*0.36,-S*0.3,S*0.035,0,Math.PI*2); ctx.fill();

    // Brow ridge
    ctx.beginPath();
    ctx.moveTo(S*0.06,-S*0.56); ctx.bezierCurveTo(S*0.24,-S*0.66,S*0.48,-S*0.64,S*0.56,-S*0.52);
    ctx.strokeStyle='#cc7700'; ctx.lineWidth=S*0.13; ctx.lineCap='round'; ctx.stroke();
    ctx.strokeStyle='#ffcc22'; ctx.lineWidth=S*0.065; ctx.stroke();

    // Main horn (curved, tall)
    ctx.shadowColor='#ffdd00'; ctx.shadowBlur=32;
    ctx.beginPath();
    ctx.moveTo(-S*0.06,-S*0.6);
    ctx.bezierCurveTo(-S*0.06,-S*0.95,S*0.08,-S*1.35,S*0.18,-S*1.8);
    ctx.bezierCurveTo(S*0.24,-S*1.95,S*0.32,-S*1.92,S*0.36,-S*1.82);
    ctx.bezierCurveTo(S*0.4,-S*1.62,S*0.28,-S*1.15,S*0.44,-S*0.6);
    const hg=ctx.createLinearGradient(0,-S*0.6,S*0.28,-S*1.82);
    hg.addColorStop(0,'#ff8800'); hg.addColorStop(0.5,'#ffcc22'); hg.addColorStop(1,'#fffaaa');
    ctx.fillStyle=hg; ctx.fill(); ctx.strokeStyle='rgba(120,50,0,0.45)'; ctx.lineWidth=1.5; ctx.stroke();
    // Back horn
    ctx.beginPath();
    ctx.moveTo(-S*0.3,-S*0.54);
    ctx.bezierCurveTo(-S*0.34,-S*0.82,-S*0.24,-S*1.12,-S*0.14,-S*1.35);
    ctx.bezierCurveTo(-S*0.06,-S*1.45,S*0.02,-S*1.35,S*0.04,-S*0.56);
    const hg2=ctx.createLinearGradient(-S*0.3,-S*0.54,0,-S*1.35);
    hg2.addColorStop(0,'#cc6600'); hg2.addColorStop(1,'#ffbb22');
    ctx.fillStyle=hg2; ctx.fill();
    // Small side horn
    ctx.beginPath();
    ctx.moveTo(S*0.08,-S*0.44); ctx.bezierCurveTo(S*0.1,-S*0.65,S*0.22,-S*0.82,S*0.28,-S*0.86);
    ctx.bezierCurveTo(S*0.34,-S*0.88,S*0.38,-S*0.78,S*0.38,-S*0.44);
    ctx.fillStyle='#ddaa00'; ctx.fill();
    ctx.shadowBlur=0;

    // Mane wisps
    [
      [-S*0.05,-S*0.68,-S*0.32,-S*0.82,-S*0.58,-S*1.0,'#ff9900',4],
      [-S*0.12,-S*0.62,-S*0.5,-S*0.72,-S*0.72,-S*0.88,'#ffaa22',3],
      [S*0.5,S*0.46,S*0.82,S*0.74,S*1.05,S*0.96,'#dd7700',3.5],
      [S*0.38,S*0.5,S*0.65,S*0.88,S*0.72,S*1.18,'#cc6600',2.8],
      [S*0.28,S*0.55,S*0.5,S*0.95,S*0.56,S*1.24,'#bb5500',2.2],
    ].forEach(([x1,y1,cx,cy,x2,y2,col,lw]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2);
      ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke();
      ctx.strokeStyle='rgba(255,210,60,0.35)'; ctx.lineWidth=lw*0.5; ctx.stroke();
    });

    // Whiskers (long flowing)
    ctx.shadowColor='rgba(255,200,40,0.55)'; ctx.shadowBlur=10;
    [
      [S*1.38,-S*0.06,S*1.82,-S*0.52,S*2.45,-S*0.82,2.6,'rgba(255,232,100,0.88)'],
      [S*1.38,-S*0.02,S*1.92,-S*0.02,S*2.58,S*0.16,1.9,'rgba(255,215,80,0.68)'],
      [S*1.38,S*0.22,S*1.74,S*0.68,S*2.28,S*0.95,2.3,'rgba(255,202,72,0.78)'],
      [S*1.38,S*0.28,S*1.82,S*0.95,S*2.38,S*1.22,1.6,'rgba(220,168,48,0.52)'],
    ].forEach(([x1,y1,cx,cy,x2,y2,lw,col]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2);
      ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke();
    });
    ctx.shadowBlur=0;

    ctx.restore();
  }

  // ── Fire breath ────────────────────────────────────────
  let fire = [];
  function spawnFire() {
    const a=segs[0].a, tx=segs[0].x+Math.cos(a)*68, ty=segs[0].y+Math.sin(a)*68;
    for (let i=0;i<10;i++) {
      const sp=(Math.random()-0.5)*0.95;
      fire.push({ x:tx, y:ty,
        vx:Math.cos(a+sp)*(16+Math.random()*12), vy:Math.sin(a+sp)*(16+Math.random()*12),
        life:1, size:Math.random()*26+12, hue:18+Math.random()*38 });
    }
  }
  function drawFire() {
    fire=fire.filter(p=>p.life>0.02);
    fire.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vx*=0.952; p.vy*=0.952;
      p.life-=0.024; p.size*=0.963;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
      g.addColorStop(0,`hsla(${p.hue+55},100%,96%,${p.life})`);
      g.addColorStop(0.28,`hsla(${p.hue+22},100%,72%,${p.life*0.85})`);
      g.addColorStop(0.65,`hsla(${p.hue},90%,46%,${p.life*0.5})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    });
  }

  // ── Gold sparks ────────────────────────────────────────
  let sparks = [];
  setInterval(() => {
    const idx=Math.floor(Math.random()*SEG*0.7);
    if (!segs[idx]) return;
    for (let i=0;i<5;i++)
      sparks.push({ x:segs[idx].x, y:segs[idx].y,
        vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, life:1, hue:35+Math.random()*18 });
  }, 80);
  function drawSparks() {
    sparks=sparks.filter(p=>p.life>0.02);
    sparks.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.life-=0.052;
      ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2);
      ctx.fillStyle=`hsla(${p.hue},100%,78%,${p.life})`; ctx.fill();
    });
  }

  // ── Dragon pearl ───────────────────────────────────────
  let pearl={x:0,y:0};
  function updatePearl(t) {
    const th=t*0.22+1.35, d=1+Math.sin(th)*Math.sin(th);
    pearl.x=W/2+W*0.42*Math.cos(th)/d;
    pearl.y=H/2+H*0.34*Math.sin(th)*Math.cos(th)/d;
  }
  function drawPearl() {
    ctx.shadowColor='#ffe060'; ctx.shadowBlur=55;
    const g=ctx.createRadialGradient(pearl.x-11,pearl.y-11,2,pearl.x,pearl.y,34);
    g.addColorStop(0,'rgba(255,255,235,0.98)'); g.addColorStop(0.3,'rgba(255,228,90,0.9)');
    g.addColorStop(0.7,'rgba(255,155,15,0.45)'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(pearl.x,pearl.y,34,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(pearl.x-10,pearl.y-10,9,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }

  // ── Main loop ──────────────────────────────────────────
  let lastFire=0;
  function frame(ts) {
    t=ts*0.001;
    ctx.fillStyle='#07040c'; ctx.fillRect(0,0,W,H);

    // Nebula
    [[0.2,0.3,0.3,35,0.07],[0.8,0.65,0.25,28,0.06],[0.5,0.1,0.22,42,0.05]].forEach(([fx,fy,fr,fh,fa])=>{
      const g=ctx.createRadialGradient(fx*W,fy*H,0,fx*W,fy*H,fr*Math.min(W,H));
      g.addColorStop(0,`hsla(${fh},65%,28%,${fa})`); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    });

    // Stars
    stars.forEach(s=>{
      s.tw+=s.sp; const a=0.2+Math.sin(s.tw)*0.5;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,242,195,${a})`; ctx.fill();
    });

    // Shooting stars
    shoots=shoots.filter(s=>s.alpha>0.02);
    shoots.forEach(s=>{
      const tl=ctx.createLinearGradient(s.x-Math.cos(s.angle)*s.len,s.y-Math.sin(s.angle)*s.len,s.x,s.y);
      tl.addColorStop(0,'hsla(45,100%,80%,0)'); tl.addColorStop(1,`hsla(45,100%,90%,${s.alpha})`);
      ctx.beginPath();
      ctx.moveTo(s.x-Math.cos(s.angle)*s.len,s.y-Math.sin(s.angle)*s.len);
      ctx.lineTo(s.x,s.y);
      ctx.strokeStyle=tl; ctx.lineWidth=1.8; ctx.stroke();
      s.x+=Math.cos(s.angle)*s.speed; s.y+=Math.sin(s.angle)*s.speed; s.alpha-=0.013;
    });

    updateDragon(t); updatePearl(t);
    drawPearl();
    drawBody(t);
    drawSparks();
    drawFire();
    drawHead(t);
    if (ts-lastFire>55) { spawnFire(); lastFire=ts; }

    // Vignette
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.06,W/2,H/2,H*0.95);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(7,4,12,0.82)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

    requestAnimationFrame(frame);
  }

  function resize() {
    W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight;
    initStars(); initDragon();
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
