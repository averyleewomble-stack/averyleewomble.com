// Pixel-art tree scene for averyleewomble.com
// Everything is drawn procedurally into a low-resolution buffer and scaled up.
(() => {
  const cv = document.getElementById('scene');
  const stage = document.getElementById('stage');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, S = 1, img, buf, mask, bx = 0, by = 0;
  let maskOn = false;
  let T = 0; // scene time, seconds

  // ---------- colour + pixel helpers ----------
  const C = h => {
    const n = parseInt(h.slice(1), 16);
    return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0;
  };
  const WHITE = C('#ffffff');
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrap = d => Math.atan2(Math.sin(d), Math.cos(d));

  function P(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    buf[i] = c;
    if (maskOn) mask[i] = 1;
  }
  function rect(x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c);
  }
  function disc(cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r), r2 = r * r;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        if (dx * dx + dy * dy <= r2) P(cx + dx, cy + dy, c);
  }
  function ring(cx, cy, r0, r1, c, clip) {
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r1), a = r0 * r0, b = r1 * r1;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = dx * dx + dy * dy;
        if (d >= a && d <= b && (!clip || clip(dx, dy))) P(cx + dx, cy + dy, c);
      }
  }
  function thick(x0, y0, x1, y1, w, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    const o = (w - 1) >> 1;
    for (;;) {
      if (w === 1) P(x0, y0, c); else rect(x0 - o, y0 - o, w, w, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  const line = (x0, y0, x1, y1, c) => thick(x0, y0, x1, y1, 1, c);

  function hash(x, y, s) {
    let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- palettes ----------
  const LEAF = ['#1d4747', '#2c6a50', '#4c9950', '#84c25c', '#c6e27c'].map(C);
  const LEAF_BACK = ['#173640', '#173640', '#1f4d4a', '#28624c', '#28624c'].map(C);
  const BARK = ['#33252b', '#553a36', '#7a5744', '#a17c5a'].map(C);
  const ROPE = C('#8a745a');
  const GOLD = C('#f0b429');
  const WIND = ['#c9d3de', '#dbe2ea', '#ebeff4'].map(C);
  const SMOKE = ['#b4b4bd', '#cfcfd6', '#e6e6ea'].map(C);
  const GROUND = ['#e0edcf', '#c7e0aa', '#abd288', '#8fc06e', '#74a964', '#5c9258'].map(C);

  // ---------- tree skeleton (relative to trunk base, y up is negative) ----------
  const TRUNK_H = 165;
  const quad = (b, t) => {
    const u = 1 - t;
    return [u * u * b[0] + 2 * u * t * b[2] + t * t * b[4], u * u * b[1] + 2 * u * t * b[3] + t * t * b[5]];
  };
  // [x0,y0, cx,cy, x1,y1, w0, w1] -- an old tree: heavy limbs that taper slowly
  const LIMBS = [
    [-18, -135, -95, -170, -170, -215, 30, 8],
    [18, -142, 98, -176, 175, -230, 31, 8],
    [-12, -160, -52, -248, -110, -320, 26, 7],
    [12, -160, 46, -258, 95, -335, 26, 7],
    [0, -160, 8, -258, -10, -370, 24, 6],
  ];
  // a branch off a parent: starts at most of the parent's girth so nothing turns into a stick
  const sub = (parent, t, ex, ey, bend, w0, w1) => {
    const p = quad(parent, t);
    const pw = parent[6] + (parent[7] - parent[6]) * t;
    return [p[0], p[1], (p[0] + ex) / 2, (p[1] + ey) / 2 - bend, ex, ey, w0 || pw * 0.66, w1 || 3];
  };
  const SUBS = [
    sub(LIMBS[0], 0.45, -120, -265, 6),   // 0: mandolin strap hangs here
    sub(LIMBS[0], 0.7, -198, -185, -6),
    sub(LIMBS[0], 0.3, -58, -225, 4),
    sub(LIMBS[1], 0.4, 108, -272, 6),
    sub(LIMBS[1], 0.7, 208, -192, -6),
    sub(LIMBS[1], 0.88, 192, -288, 6),
    sub(LIMBS[2], 0.5, -155, -292, 6),
    sub(LIMBS[2], 0.6, -62, -365, 6),
    sub(LIMBS[3], 0.5, 145, -312, 6),
    sub(LIMBS[3], 0.6, 52, -385, 6),
    sub(LIMBS[4], 0.5, -45, -330, 6),     // 10: briefcase hangs here
    sub(LIMBS[4], 0.6, 38, -348, 6),
    [-10, -370, -10, -392, -16, -415, 6, 2],
  ];
  // twigs that pass in front of the hanging things
  const TWIGS = [
    sub(SUBS[0], 0.35, -70, -222, 4, 2, 1),     // across the mandolin neck
    sub(SUBS[10], 0.3, -44, -288, -3, 2, 1),    // past the briefcase
  ];
  // roots: [.., r0, r1 as widths, depth bias]. Bias lifts a root toward the viewer so it
  // surfaces on the front of the trunk and runs down into the grass.
  const ROOTS = [
    [-30, -48, -62, -8, -138, 12, 44, 6, 0],
    [30, -48, 64, -10, 142, 11, 44, 6, 0],
    [-20, -34, -46, 8, -92, 27, 34, 6, 30],
    [24, -34, 50, 10, 98, 28, 34, 6, 30],
    [-38, -28, -46, 14, -62, 34, 26, 6, 45],
    [26, -28, 34, 16, 56, 35, 24, 6, 45],
  ];

  // where the things sit: front foliage is kept clear of these
  const ZONES = [[-84, -208, 27], [-24, -285, 23], [88, -284, 25], [-116, -257, 20]];

  function swayAt(y) {
    const k = clamp(-y / 430, 0, 1);
    return (Math.sin(T * 0.6) * 3 + Math.sin(T * 0.23 + 1) * 1.8) * k * k;
  }
  function branchPt(b, t) {
    const p = quad(b, t);
    return [bx + p[0], by + p[1]]; // the wood itself does not move; the leaves do
  }
  const trunkCx = h => 6 * Math.sin((h / TRUNK_H) * 2.4) + 2.5 * Math.sin((h / TRUNK_H) * 9);
  const trunkHw = h => {
    const t = clamp(h / TRUNK_H, 0, 1);
    return 46 - 15 * t + (t < 0.2 ? (0.2 - t) * (0.2 - t) * 300 : 0) + 2.5 * Math.sin(h * 0.11 + 1);
  };

  // ---------- foliage: sprites built once, then blitted ----------
  function makeBlob(x, y, r, id) {
    r = Math.round(r);
    const R = r + 3, n = 2 * R + 1, s = new Uint8Array(n * n);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        const n1 = hash(dx >> 1, dy >> 1, id);
        if (d + (n1 - 0.5) * 6 > r) continue;
        const n2 = hash(dx >> 1, dy >> 1, id + 500);
        const l = (-dx * 0.45 - dy * 0.9) / r + (n2 - 0.5) * 0.95;
        let tone = l < -0.45 ? 0 : l < -0.05 ? 1 : l < 0.42 ? 2 : l < 0.78 ? 3 : 4;
        if (d > r - 2.5 && dy > r * 0.3) tone = 0;
        s[(dy + R) * n + dx + R] = tone + 1;
      }
    return { x, y, r, R, n, s, id };
  }
  function drawBlob(b, pal) {
    const X = Math.round(bx + b.x + swayAt(b.y) + Math.sin(T * 0.9 + b.id * 1.7) * 1.5) - b.R;
    const Y = Math.round(by + b.y + Math.cos(T * 0.6 + b.id * 2.3) * 0.9) - b.R;
    const n = b.n, s = b.s;
    for (let j = 0; j < n; j++) {
      const yy = Y + j;
      if (yy < 0 || yy >= H) continue;
      const row = yy * W, o = j * n;
      for (let i = 0; i < n; i++) {
        const v = s[o + i];
        if (!v) continue;
        const xx = X + i;
        if (xx >= 0 && xx < W) buf[row + xx] = pal[v - 1];
      }
    }
  }
  const BACK = [], FRONT = [], SPRIGS = [];
  (function buildCanopy() {
    let id = 1, seed = 1;
    const clear = (x, y, r) => ZONES.every(z => Math.hypot(x - z[0], y - z[1]) > z[2] + r * 0.65);
    const addAt = p => {
      seed++;
      BACK.push(makeBlob(p[0] + (hash(seed, 1, 9) - 0.5) * 20, p[1] + (hash(seed, 2, 9) - 0.5) * 16, 30 + hash(seed, 3, 9) * 12, id++));
      const count = hash(seed, 10, 9) > 0.45 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const fx = p[0] + (hash(seed, 4 + k, 9) - 0.5) * 40;
        const fy = p[1] + (hash(seed, 6 + k, 9) - 0.5) * 32 - 6;
        const r = 18 + hash(seed, 8 + k, 9) * 12;
        if (clear(fx, fy, r)) FRONT.push(makeBlob(fx, fy, r, id++));
      }
    };
    for (const b of LIMBS) for (const t of [0.6, 0.8, 1]) addAt(quad(b, t));
    for (const b of SUBS) for (const t of [0.45, 0.75, 1]) addAt(quad(b, t));
    // fill the crown, and put dark leaves behind each hanging thing
    for (const f of [[0, -300, 44], [-60, -290, 40], [60, -300, 42], [0, -350, 40], [-130, -240, 36], [140, -250, 38], [20, -235, 34], [-30, -240, 32]])
      BACK.push(makeBlob(f[0], f[1], f[2], id++));
    for (const z of ZONES) BACK.push(makeBlob(z[0], z[1], z[2] + 6, id++));
    // small leaf sprigs that overlap the things
    for (const s of [[-70, -222, 8], [-106, -238, 8], [-44, -289, 8], [-10, -270, 7]])
      SPRIGS.push(makeBlob(s[0], s[1], s[2], id++));
    BACK.sort((a, b) => a.y - b.y); FRONT.sort((a, b) => a.y - b.y);
  })();

  // ---------- ground, roots, trunk ----------
  const TUFTS = [], FLOWERS = [];
  for (let i = 0; i < 100; i++) {
    const near = i < 66; // dense ring of grass hiding where the roots meet the ground
    TUFTS.push({
      x: near ? (hash(i, 1, 4) - 0.5) * 300 : (hash(i, 1, 4) - 0.5) * 420,
      y: near ? 12 + hash(i, 2, 4) * 20 : -8 + hash(i, 2, 4) * 40,
      h: 3 + ((hash(i, 3, 4) * 4) | 0), c: 3 + ((hash(i, 5, 4) * 3) | 0), near,
    });
  }
  TUFTS.sort((a, b) => a.y - b.y);
  for (let i = 0; i < 12; i++)
    FLOWERS.push([(hash(i, 1, 6) - 0.5) * 340, -6 + hash(i, 2, 6) * 30, ['#f2c94c', '#e98aa6', '#ffffff'][i % 3]]);

  function drawGround() {
    for (let dy = -31; dy <= 31; dy++)
      for (let dx = -234; dx <= 234; dx++) {
        const e = (dx / 232) * (dx / 232) + (dy / 30) * (dy / 30);
        if (e >= 1) continue;
        const n = hash(dx, dy, 3);
        let c;
        if (e > 0.72) { if (n < (e - 0.72) * 3.6) continue; c = GROUND[0]; }
        else if (e > 0.42) c = n < 0.5 ? GROUND[1] : GROUND[0];
        else c = n < 0.14 ? GROUND[3] : n < 0.6 ? GROUND[2] : GROUND[1];
        const s = (dx / 150) * (dx / 150) + ((dy - 2) / 17) * ((dy - 2) / 17);
        if (s < 1 && (s < 0.6 || ((dx + dy) & 1))) c = GROUND[3];
        P(bx + dx, by + 12 + dy, c);
      }
    for (const f of FLOWERS) { P(bx + f[0], by + 12 + f[1], C(f[2])); P(bx + f[0], by + 13 + f[1], GROUND[4]); }
  }
  function drawTufts(near) {
    for (let i = 0; i < TUFTS.length; i++) {
      const t = TUFTS[i];
      if (t.near !== near) continue;
      const x = bx + Math.round(t.x), y = by + Math.round(t.y), c = GROUND[t.c];
      const lean = Math.round(Math.sin(T * 1.3 + i) * 0.7);
      line(x, y, x - 2 + lean, y - t.h + 1, c);
      line(x + 1, y, x + 1 + lean, y - t.h, c);
      line(x + 2, y, x + 4 + lean, y - t.h + 2, c);
    }
  }

  // Trunk, roots, limbs and branches are built once as a single surface: every member is a
  // chain of spheres, the spheres are merged by depth with soft blending where they meet,
  // and the whole thing is lit by one light and textured with one bark pattern.
  const WX = -270, WY = -440, WW = 540, WH = 490;
  let wood;
  function buildWood() {
    const N = WW * WH, K = 0.45;
    const zm = new Float32Array(N).fill(-1e9), sw = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
    const ta = new Float32Array(N), tc = new Float32Array(N), tid = new Uint8Array(N);
    function ball(x, y, r, bias, a, tx, ty, id, clip) {
      const x0 = Math.max(0, Math.floor(x - r - WX)), x1 = Math.min(WW - 1, Math.ceil(x + r - WX));
      const y0 = Math.max(0, Math.floor(y - r - WY)), y1 = Math.min(WH - 1, Math.ceil(y + r - WY));
      for (let py = y0; py <= y1; py++)
        for (let px = x0; px <= x1; px++) {
          const dx = px + WX - x, dy = py + WY - y, d2 = dx * dx + dy * dy;
          if (d2 >= r * r || (clip && !clip(px + WX, py + WY))) continue;
          const h = Math.sqrt(r * r - d2), z = h + bias, i = py * WW + px, w = Math.exp(K * (z - 62));
          sw[i] += w; nx[i] += w * dx / r; ny[i] += w * dy / r; nz[i] += w * h / r;
          if (z > zm[i]) { zm[i] = z; ta[i] = a; tc[i] = -dx * ty + dy * tx; tid[i] = id; }
        }
    }
    function chain(b, id, bias) {
      const len = Math.hypot(b[2] - b[0], b[3] - b[1]) + Math.hypot(b[4] - b[2], b[5] - b[3]);
      const steps = Math.ceil(len / 1.5);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, p = quad(b, t);
        let tx = 2 * (1 - t) * (b[2] - b[0]) + 2 * t * (b[4] - b[2]), ty = 2 * (1 - t) * (b[3] - b[1]) + 2 * t * (b[5] - b[3]);
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const r = (b[6] + (b[7] - b[6]) * t) / 2 * (1 + 0.1 * Math.sin(t * 15 + b[5]));
        ball(p[0], p[1] + Math.sin(t * 8 + b[4]) * r * 0.22, r, bias, i * 1.5, tx, ty, id);
      }
    }
    // trunk: runs a little below the ground and is trimmed along the line where it meets it
    const foot = (x, y) => y <= 8 + 12 * Math.sqrt(Math.max(0, 1 - (x / 75) * (x / 75)));
    for (let h = -12; h <= TRUNK_H; h += 1.5) ball(trunkCx(h), -h, trunkHw(h), 0, h + 20, 0, -1, 1, foot);
    ROOTS.forEach((r, i) => chain(r, 2 + i, r[8]));
    LIMBS.forEach((b, i) => chain(b, 10 + i, 0));
    SUBS.forEach((b, i) => chain(b, 20 + i, 0));
    for (const k of [[-20, 104, 8], [24, 128, 7], [30, 52, 6], [-30, 60, 5]]) ball(trunkCx(k[1]) + k[0], -k[1], k[2], 34, 0, 1, 0, 40); // burls

    const Lx = -0.451, Ly = -0.702, Lz = 0.551;
    wood = new Uint8Array(N);
    for (let y = 1; y < WH - 1; y++)
      for (let x = 1; x < WW - 1; x++) {
        const i = y * WW + x;
        if (!sw[i]) continue;
        let a = nx[i], b = ny[i], c = nz[i];
        const m = Math.hypot(a, b, c) || 1;
        const l = (a * Lx + b * Ly + c * Lz) / m;
        let tone = l < 0.05 ? 0 : l < 0.36 ? 1 : l < 0.66 ? 2 : 3;
        const u = Math.floor(tc[i] / 2), v = ta[i], id = tid[i];
        const n = hash(u, Math.floor(v / 9), id);
        const furrow = hash(u, 0, id + 60) < 0.16 && hash(0, Math.floor(v / 23), u) > 0.25;
        if (furrow || n < 0.16) tone = Math.max(0, tone - 1);
        else if (n > 0.93) tone = Math.min(3, tone + 1);
        // dark line on the silhouette and wherever one member passes in front of another
        if (!sw[i - 1] || !sw[i + 1] || !sw[i - WW] || !sw[i + WW]) tone = 0;
        else if (Math.max(zm[i - 1], zm[i + 1], zm[i - WW], zm[i + WW]) - zm[i] > 7) tone = 0;
        wood[i] = tone + 1;
      }
  }
  buildWood();
  function drawWood() {
    const X = bx + WX, Y = by + WY;
    for (let j = 0; j < WH; j++) {
      const yy = Y + j;
      if (yy < 0 || yy >= H) continue;
      const row = yy * W, o = j * WW;
      for (let i = 0; i < WW; i++) {
        const v = wood[o + i];
        if (!v) continue;
        const xx = X + i;
        if (xx >= 0 && xx < W) buf[row + xx] = BARK[v - 1];
      }
    }
  }
  // thin twigs that cross in front of things
  function drawTwig(b) {
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, q = quad(b, t), r = (b[6] + (b[7] - b[6]) * t) / 2;
        disc(bx + q[0], by + q[1] + (pass ? 0 : 1), r, BARK[pass ? 2 : 0]);
      }
  }

  // signs that someone small has lived here a long time
  const HOME = { frame: C('#241a1d'), door: C('#7a4a2e'), plank: C('#5c3622'), knob: C('#f0c14a'), stone: C('#b4afa8'), stoneD: C('#8d8882'),
    glow: C('#ffd866'), glowD: C('#f0a93a'), cap: C('#d6453b'), stem: C('#efe6d4') };
  function drawHome() {
    // arched door tucked between two roots
    const dx0 = bx - 8, dy0 = by + 18;
    for (let j = 0; j < 22; j++)
      for (let i = -7; i <= 7; i++) {
        const top = 21 - j; // rows above the sill
        if (top > 15 && i * i + (top - 15) * (top - 15) > 49) continue;
        const edge = Math.abs(i) === 7 || (top > 15 && i * i + (top - 15) * (top - 15) > 34);
        P(dx0 + i, dy0 - top, edge ? HOME.frame : (i + 7) % 4 === 0 ? HOME.plank : HOME.door);
      }
    P(dx0 + 4, dy0 - 9, HOME.knob); P(dx0 + 4, dy0 - 8, HOME.glowD);
    rect(dx0 - 2, dy0 - 16, 4, 3, HOME.frame); rect(dx0 - 1, dy0 - 15, 2, 1, HOME.glow);
    rect(dx0 - 9, dy0, 19, 2, HOME.stone); rect(dx0 - 9, dy0 + 2, 19, 1, HOME.stoneD);
    // a small lit window higher up the trunk
    const wx = bx + Math.round(trunkCx(84)) + 14, wy = by - 84;
    const flick = Math.sin(T * 5.3) * Math.sin(T * 2.1) > 0.55;
    disc(wx, wy, 5.6, HOME.frame);
    disc(wx, wy, 4, flick ? HOME.glowD : HOME.glow);
    rect(wx - 4, wy, 9, 1, HOME.frame); rect(wx, wy - 4, 1, 9, HOME.frame);
    rect(wx - 6, wy + 6, 13, 1, HOME.frame);
    // mushrooms by the roots
    for (const m of [[-70, 22], [-63, 25], [72, 24], [108, 19]]) {
      const mx = bx + m[0], my = by + m[1];
      rect(mx, my - 3, 2, 3, HOME.stem);
      rect(mx - 2, my - 5, 6, 2, HOME.cap); rect(mx - 1, my - 6, 4, 1, HOME.cap);
      P(mx - 1, my - 5, HOME.stem); P(mx + 2, my - 6, HOME.stem);
    }
  }

  // ---------- things in the tree ----------
  // briefcase hanging by its handle
  function drawBriefcase() {
    const a = branchPt(SUBS[10], 0.55);
    const sw = Math.sin(T * 1.1 + 0.5) * 0.9;
    const cx = Math.round(a[0] + sw), top = Math.round(a[1] + 11);
    const dk = C('#3a231f'), mid = C('#8c5431'), hi = C('#ad6f40'), lo = C('#6c3d27'), brass = C('#e3b341'), hd = C('#2b1c1d');
    line(a[0], a[1], cx, top - 5, ROPE);
    rect(cx - 5, top - 5, 11, 2, hd);
    rect(cx - 5, top - 3, 2, 3, hd); rect(cx + 4, top - 3, 2, 3, hd);
    const x0 = cx - 12, w = 25, h = 17;
    rect(x0, top, w, h, dk);
    rect(x0 + 1, top + 1, w - 2, h - 2, mid);
    rect(x0 + 1, top + 1, w - 2, 2, hi);
    rect(x0 + 1, top + h - 4, w - 2, 3, lo);
    rect(x0 + 1, top + 5, w - 2, 1, dk);
    rect(x0 + 5, top + 4, 2, 3, brass); rect(x0 + w - 7, top + 4, 2, 3, brass);
    rect(x0 + 1, top + 1, 2, 2, lo); rect(x0 + w - 3, top + 1, 2, 2, lo);
    rect(x0 + 1, top + h - 3, 2, 2, dk); rect(x0 + w - 3, top + h - 3, 2, 2, dk);
    P(x0 + 3, top + 8, hi); P(x0 + 4, top + 9, hi);
  }

  // mandolin with a broken string, leaning in a fork
  const MANDO_PROFILE = [2, 3, 5, 6, 7, 8, 8, 9, 9, 9, 9, 9, 8, 8, 7, 6, 5, 3];
  const MC = {
    head: C('#472b20'), neck: C('#5f3a26'), fret: C('#9a7a56'), peg: C('#d2ccbd'), edge: C('#5a2e1b'),
    b1: C('#a65824'), b2: C('#d88932'), b3: C('#f1b54c'), hole: C('#2a1a16'), str: C('#efe9da'), snap: C('#e2ddd0'),
  };
  function mandoPix(a, b) {
    const ab = Math.abs(b);
    if (a >= 2 && a <= 31 && b === -1) return MC.str;
    if (a >= 27 && a <= 31 && b === 1) return MC.str;
    if (a === 31 && ab <= 3) return MC.hole;
    if ((a - 25) * (a - 25) + b * b <= 4) return MC.hole;
    if (a >= 0 && a <= 6) {
      if (ab <= 2) return MC.head;
      if (ab === 3 && (a === 1 || a === 3 || a === 5)) return MC.peg;
      return 0;
    }
    if (a >= 7 && a <= 17) return ab <= 1 ? (a % 3 === 0 ? MC.fret : MC.neck) : 0;
    const i = a - 18;
    if (i < 0 || i >= MANDO_PROFILE.length) return 0;
    const hw = MANDO_PROFILE[i];
    if (ab > hw) return 0;
    const last = i === MANDO_PROFILE.length - 1;
    if (ab === hw || last || (i > 0 && ab > MANDO_PROFILE[i - 1]) || (!last && ab > MANDO_PROFILE[i + 1])) return MC.edge;
    const d = Math.sqrt(b * b + (i - 10) * (i - 10));
    return d < 3.6 ? MC.b3 : d < 6.4 ? MC.b2 : MC.b1;
  }
  function drawMandolin() {
    const hang = branchPt(SUBS[0], 0.7);
    const sw = Math.sin(T * 0.9 + 2) * 0.9;
    const px = Math.round(bx - 90 + swayAt(-227) + sw), py = by - 227;
    const th = 0.35 + Math.sin(T * 0.9 + 2) * 0.03;
    const sn = Math.sin(th), cs = Math.cos(th);
    line(hang[0], hang[1], px, py, ROPE);
    for (let dy = -6; dy <= 42; dy++)
      for (let dx = -16; dx <= 28; dx++) {
        const c = mandoPix(Math.round(dx * sn + dy * cs), Math.round(dx * cs - dy * sn));
        if (c) P(px + dx, py + dy, c);
      }
    const F = (a, b) => P(px + a * sn + b * cs, py + a * cs - b * sn, MC.snap);
    // the broken string: one end sprung loose from the nut, the stub curling off the bridge
    for (let i = 0; i <= 13; i++) F(6 - i * 0.2 + Math.cos(i * 0.9) * 2.2 + i * i * 0.03, 2 + i * 0.55 + Math.sin(i * 0.9 + T * 1.6) * 1.1);
    for (let i = 0; i <= 6; i++) F(27 - Math.sin(i * 0.8) * 2.5, 2 + i * 0.8 + Math.sin(i * 1.1 + T * 1.2) * 0.8);
  }

  // broken CT90 wedged on a limb
  const BIKE_X = 146, BIKE_Y = 25;
  const smoke = [];
  let smokeClock = 0;
  let exhaustTip = [0, 0];
  function drawBike() {
    // on its centre stand in the grass: front tyre down, back wheel in the air
    const cx = bx + BIKE_X, cy = by + BIKE_Y - 11;
    const ang = 0.05;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const X = (lx, ly) => cx + lx * ca - ly * sa, Y = (lx, ly) => cy + lx * sa + ly * ca;
    const L = (x0, y0, x1, y1, w, c) => thick(X(x0, y0), Y(x0, y0), X(x1, y1), Y(x1, y1), w, c);
    const red = C('#d23c30'), redD = C('#962727'), tire = C('#24242b'), rim = C('#9aa0aa'), metal = C('#7b818d');
    const metalL = C('#c2c7cf'), seat = C('#1f1d24'), pipe = C('#45454d'), shield = C('#b6bbc4'), yel = C('#f2c94c'), orange = C('#f08a2c');

    // rear wheel: spinning
    const rx = X(-19, 0), ry = Y(-19, 0), spin = T * 7;
    for (let k = 0; k < 3; k++) {
      const s = spin + k * Math.PI / 3, dx = Math.cos(s) * 5.5, dy = Math.sin(s) * 5.5;
      line(rx - dx, ry - dy, rx + dx, ry + dy, metalL);
    }
    ring(rx, ry, 5.6, 6.7, rim);
    ring(rx, ry, 6.7, 9.3, tire);
    disc(rx, ry, 1.6, metal);
    P(rx + Math.cos(spin) * 6.1, ry + Math.sin(spin) * 6.1, orange);
    for (let k = 0; k < 6; k++) {
      const s = spin + k * Math.PI / 3;
      P(rx + Math.cos(s) * 10, ry + Math.sin(s) * 10, tire);
    }
    // front wheel: flat tyre, broken spokes, not turning
    const fx = X(19, 1), fy = Y(19, 1);
    line(fx, fy, fx + 5, fy + 2, metalL); line(fx, fy, fx - 3, fy - 4, metalL); line(fx - 1, fy + 1, fx - 2, fy + 3, metalL);
    ring(fx, fy, 5.6, 6.7, rim);
    ring(fx, fy, 6.7, 9.3, tire, (dx, dy) => dy < 8);
    rect(fx - 6, fy + 7, 13, 1, tire);
    disc(fx, fy, 1.6, metal);
    // fenders
    for (let s = -2.8; s <= -0.7; s += 0.08) P(rx + Math.cos(s + ang) * 11, ry + Math.sin(s + ang) * 11, red);
    for (let s = -2.3; s <= -1.0; s += 0.08) P(fx + Math.cos(s + ang) * 11, fy + Math.sin(s + ang) * 11, red);

    L(-4, -1, -19, 0, 2, metal);          // swingarm
    L(-15, -12, -19, -1, 1, metalL);      // rear shock
    L(-16, -12, -18, -5, 1, redD);
    L(12, -17, -1, -7, 4, red);           // backbone
    L(-1, -8, -15, -13, 4, red);          // rear frame
    L(11, -14, 0, -4, 1, redD);
    L(-1, -5, -14, -10, 1, redD);
    L(-6, -3, 2, -3, 6, metal);           // engine
    L(3, -3, 8, -2, 3, metalL);           // cylinder
    L(4, -4, 7, -4, 1, metal);
    disc(X(-3, -2), Y(-3, -2), 2.2, metalL);
    P(X(-3, -2), Y(-3, -2), metal);
    L(4, -5, 0, -9, 2, pipe);             // high exhaust
    L(0, -9, -26, -10, 3, pipe);
    L(-6, -10, -20, -11, 1, shield);
    L(-15, -17, 1, -16, 4, seat);         // seat
    L(-15, -18, -27, -18, 1, metalL);     // rack
    L(-27, -18, -27, -15, 1, metalL);
    L(-27, -15, -17, -13, 1, metalL);
    L(-21, -18, -21, -14, 1, metalL);
    L(12, -19, 19, 1, 2, metalL);         // fork
    L(12, -19, 10, -24, 1, metalL);       // bars
    L(8, -24, 11, -24, 2, seat);

    // headlight dangling on its wire, chain hanging loose
    const hx = X(15, -17), hy = Y(15, -17), hs = Math.sin(T * 1.7) * 1.6;
    line(hx, hy, hx + 1 + hs, hy + 6, seat);
    disc(hx + 1 + hs, hy + 8, 2.2, metalL);
    P(hx + 1 + hs, hy + 8, yel); P(hx + 2 + hs, hy + 8, yel);
    const chx = X(-8, 2), chy = Y(-8, 2), cs = Math.sin(T * 1.4 + 2) * 1.5;
    line(chx, chy, chx + cs * 0.4, chy + 4, seat); line(chx + cs * 0.4, chy + 4, chx + cs, chy + 9, seat);

    exhaustTip = [X(-29, -10), Y(-29, -10)];
    // centre stand
    L(-4, 0, -6, 10, 2, metal); thick(X(-9, 11), Y(-9, 11), X(-2, 11), Y(-2, 11), 1, metal);

    // open tool bag beside it
    const tx = bx + BIKE_X + 42, ty = by + BIKE_Y + 2;
    const bag = C('#7c6b45'), bagD = C('#584b30'), bagL = C('#a39266'), ink = C('#2b2419'), wood = C('#b8894f'), steel = C('#aab1bb');
    line(tx + 4, ty - 9, tx + 2, ty - 17, steel); P(tx + 1, ty - 18, steel); P(tx + 3, ty - 18, steel); // wrench
    rect(tx + 10, ty - 13, 1, 5, steel); rect(tx + 9, ty - 17, 3, 4, red);                               // screwdriver
    line(tx + 15, ty - 9, tx + 19, ty - 17, wood); rect(tx + 17, ty - 19, 5, 2, steel);                  // hammer
    rect(tx, ty - 9, 22, 10, ink); rect(tx + 1, ty - 6, 20, 6, bag); rect(tx + 1, ty - 2, 20, 2, bagD);
    rect(tx + 1, ty - 9, 20, 1, bagL); rect(tx + 1, ty - 6, 20, 1, bagL);
    P(tx + 6, ty - 4, bagL); P(tx + 15, ty - 4, bagL);
    line(tx - 1, ty - 8, tx - 4, ty - 3, bagD); line(tx - 4, ty - 3, tx - 1, ty - 1, bagD);              // handles flopped open
    line(tx + 22, ty - 8, tx + 25, ty - 3, bagD); line(tx + 25, ty - 3, tx + 22, ty - 1, bagD);
    line(tx - 14, ty + 2, tx - 7, ty, steel); ring(tx - 15, ty + 2, 1, 2.2, steel);                       // spanner in the grass
  }

  function stepSmoke(dt) {
    smokeClock -= dt;
    if (smokeClock <= 0) {
      smokeClock = Math.random() < 0.3 ? 0.12 : rnd(0.35, 0.6); // uneven put-put
      smoke.push({ x: exhaustTip[0], y: exhaustTip[1], vx: rnd(-9, -5), vy: rnd(-6, -2), age: 0, life: rnd(1.4, 2.1) });
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 0.6 * dt; s.vy -= 2 * dt;
      if (s.age > s.life) smoke.splice(i, 1);
    }
  }
  function drawSmoke() {
    for (const s of smoke) {
      const u = s.age / s.life;
      disc(s.x, s.y, u < 0.15 ? 0.8 : u < 0.5 ? 1.5 : 2.3, SMOKE[u < 0.3 ? 0 : u < 0.65 ? 1 : 2]);
    }
  }

  // ---------- a mirrorless camera swinging on its strap ----------
  function drawCamera() {
    const a = branchPt(SUBS[6], 0.6);
    const sw = Math.sin(T * 1.2) * 2.2 + Math.sin(T * 0.5 + 1) * 1.1; // catches the breeze
    const cx = Math.round(a[0] + sw), top = Math.round(a[1] + 13 - Math.abs(sw) * 0.15);
    const k = C('#232328'), k2 = C('#3a3a42'), k3 = C('#55555f'), glass = C('#31506e'), hi = C('#9fd0ee'), red = C('#e0483c'), strap = C('#2e2a2a');
    line(a[0], a[1], cx - 8, top + 2, strap); line(a[0] + 1, a[1], cx + 8, top + 2, strap);
    rect(cx - 3, top - 3, 7, 3, k); rect(cx - 2, top - 4, 5, 1, k2);          // viewfinder hump
    rect(cx - 9, top, 19, 11, k); rect(cx - 9, top, 19, 1, k2);               // body
    rect(cx - 9, top + 1, 4, 10, k2); rect(cx - 8, top + 3, 1, 6, k3);        // grip
    rect(cx + 5, top - 1, 3, 1, k3); P(cx + 8, top + 2, red);                 // dial, record button
    disc(cx + 1, top + 6, 5.2, k2); disc(cx + 1, top + 6, 4, k); disc(cx + 1, top + 6, 2.6, glass);
    P(cx, top + 5, hi); P(cx - 1, top + 5, hi); P(cx, top + 4, hi);
    ring(cx + 1, top + 6, 4.6, 5.3, k3);
  }

  // ---------- an old beige PC, shorting out ----------
  const PCC = { b: C('#d8d2bd'), d: C('#a9a28b'), l: C('#eee9da'), k: C('#2a2d33'), s: C('#12301f'), g: C('#5dff8a'), r: C('#ff5a4a') };
  const ZAPC = ['#ffffff', '#fff27a', '#9be8ff', '#d9f6ff'].map(C);
  const zaps = [], sparks = [];
  let zapClock = 1;
  const PCX = 74, PCY = -268; // bottom-left of the case, at rest
  function drawPC() {
    // hangs from the limb above by its power cord, turning a little in the breeze
    const a = branchPt(LIMBS[3], 0.85), swing = Math.sin(T * 1.1) * 3 + Math.sin(T * 0.43 + 2) * 1.5;
    const x = bx + PCX + Math.round(swing), y = by + PCY;
    line(a[0], a[1], a[0] + swing * 0.3, a[1] + 6, PCC.k); line(a[0] + swing * 0.3, a[1] + 6, x + 14, y - 29, PCC.k);
    rect(x + 13, y - 31, 3, 2, PCC.k);
    rect(x, y - 9, 28, 9, PCC.d); rect(x + 1, y - 8, 26, 7, PCC.b); rect(x + 1, y - 8, 26, 1, PCC.l);
    rect(x + 14, y - 6, 10, 1, PCC.k); rect(x + 14, y - 4, 10, 1, PCC.k);
    P(x + 3, y - 3, Math.sin(T * 23) > 0 ? PCC.r : PCC.g); rect(x + 6, y - 4, 3, 2, PCC.d);
    rect(x + 10, y - 11, 8, 2, PCC.d);
    rect(x + 3, y - 29, 22, 18, PCC.d); rect(x + 4, y - 28, 20, 16, PCC.b); rect(x + 4, y - 28, 20, 1, PCC.l);
    rect(x + 6, y - 26, 16, 11, PCC.k); rect(x + 7, y - 25, 14, 9, PCC.s);
    for (let k = 0; k < 3; k++) { // garbage scrolling up the screen
      const row = ((T * 11 + k * 3.7) % 9) | 0;
      rect(x + 7, y - 25 + row, 3 + ((hash(k, (T * 6) | 0, 5) * 11) | 0), 1, PCC.g);
    }
    P(x + 21, y - 14, PCC.g);
    // its mouse swings from the cord
    const sw = Math.sin(T * 1.3) * 3;
    line(x + 27, y - 3, x + 31 + sw * 0.5, y + 4, PCC.k); line(x + 31 + sw * 0.5, y + 4, x + 31 + sw, y + 10, PCC.k);
    rect(x + 30 + sw, y + 10, 3, 4, PCC.b); P(x + 31 + sw, y + 10, PCC.d);
  }
  function stepZaps(dt) {
    zapClock -= dt;
    if (zapClock <= 0) {
      zapClock = Math.random() < 0.4 ? 0.07 : rnd(0.4, 1.5); // stutters, then rests
      let a = rnd(0, Math.PI * 2), x = PCX + 14 + Math.cos(a) * 13, y = PCY - 14 + Math.sin(a) * 13;
      const pts = [[x, y]];
      for (let i = 0; i < 4; i++) { a += rnd(-1, 1); const d = rnd(3, 7); x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push([x, y]); }
      zaps.push({ pts, age: 0, life: rnd(0.16, 0.3), c: ZAPC[(Math.random() * 3) | 0] });
      for (let i = 0; i < 2; i++) sparks.push({ x, y, vx: rnd(-22, 22), vy: rnd(-30, -5), age: 0, life: rnd(0.4, 0.8) });
    }
    for (let i = zaps.length - 1; i >= 0; i--) if ((zaps[i].age += dt) > zaps[i].life) zaps.splice(i, 1);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 70 * dt;
      if (s.age > s.life) sparks.splice(i, 1);
    }
  }
  function drawZaps() {
    for (const z of zaps) {
      const u = z.age / z.life, n = u < 0.5 ? z.pts.length - 1 : Math.max(1, Math.round((z.pts.length - 1) * (1 - u) * 2));
      const c = u < 0.35 ? ZAPC[0] : u < 0.7 ? z.c : ZAPC[3];
      for (let i = z.pts.length - 1 - n; i < z.pts.length - 1; i++) // fades from the root outward
        line(bx + z.pts[i][0], by + z.pts[i][1], bx + z.pts[i + 1][0], by + z.pts[i + 1][1], c);
    }
    for (const s of sparks) P(bx + s.x, by + s.y, s.age / s.life < 0.5 ? ZAPC[1] : ZAPC[3]);
  }

  // ---------- a white school bus that chugs past in the background ----------
  const BUS = { o: C('#8f98a6'), b: C('#f5f7f9'), s: C('#d6dce4'), r: C('#3a3f47'), w: C('#4a5a6e'), red: C('#e0483c'), amb: C('#f2b23a'), t: C('#26262d'), h: C('#aab1bb'), sh: C('#e6e9ed') };
  const bus = { x: 0, dir: 1, wait: 4, puff: 0 };
  const BK = 2, BUS_LEN = 61 * BK; // drawn at twice the size
  const busSmoke = [];
  function stepBus(dt) {
    if (bus.wait > 0) {
      bus.wait -= dt;
      if (bus.wait <= 0) { bus.dir = Math.random() < 0.5 ? 1 : -1; bus.x = bus.dir > 0 ? -BUS_LEN - 8 : W + BUS_LEN + 8; }
    } else {
      bus.x += bus.dir * 44 * dt;
      bus.puff -= dt;
      if (bus.puff <= 0) {
        bus.puff = rnd(0.16, 0.4);
        busSmoke.push({ x: bus.x - bus.dir * 2, y: by - 14, vx: -bus.dir * rnd(4, 10), vy: rnd(-9, -4), age: 0, life: rnd(1, 1.7) });
      }
      if (bus.x < -BUS_LEN - 12 || bus.x > W + BUS_LEN + 12) bus.wait = rnd(12, 25);
    }
    for (let i = busSmoke.length - 1; i >= 0; i--) {
      const s = busSmoke[i];
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age > s.life) busSmoke.splice(i, 1);
    }
  }
  function drawBus() {
    const m = maskOn; maskOn = false;
    for (const s of busSmoke) { const u = s.age / s.life; disc(s.x, s.y, u < 0.2 ? 1.5 : u < 0.6 ? 2.6 : 3.6, SMOKE[u < 0.3 ? 0 : u < 0.65 ? 1 : 2]); }
    maskOn = m;
    if (bus.wait > 0) return;
    const d = bus.dir, K = BK, y0 = by - 6, bob = Math.sin(T * 13) > 0.2 ? -1 : 0; // chugga chugga
    const R = (dx, dy, w, h, c, still) => rect(d > 0 ? bus.x + dx * K : bus.x - (dx + w) * K + 1, y0 + dy * K + (still ? 0 : bob), w * K, h * K, c);
    R(2, 0, 57, 1, BUS.sh, true);
    R(0, -25, 47, 19, BUS.o); R(1, -24.5, 45, 17.5, BUS.b); R(1, -10, 45, 3.5, BUS.s);
    R(1, -15, 45, 0.5, BUS.r); R(1, -11, 45, 0.5, BUS.r); R(1, -8.5, 45, 0.5, BUS.r);
    for (let i = 0; i < 5; i++) { R(3 + i * 7, -22, 5, 5, BUS.w); R(3 + i * 7, -19.5, 5, 0.5, BUS.o); }
    R(39, -22, 5, 13, BUS.w); R(41.25, -22, 0.5, 13, BUS.o); R(39, -16, 5, 0.5, BUS.o); R(45, -22, 2, 6, BUS.w);
    R(47, -16, 12, 10, BUS.o); R(47, -15.5, 11.5, 9, BUS.b); R(47, -9, 11.5, 2.5, BUS.s);
    R(58, -13, 1, 5, BUS.r); R(57.5, -14.5, 1, 1, BUS.amb); R(58, -8, 3, 2, BUS.r);
    R(49, -15.5, 0.5, 6, BUS.s); R(53, -15.5, 0.5, 6, BUS.s);                   // hood seams
    R(46, -19, 2, 0.5, BUS.r); R(47.5, -21, 0.5, 4, BUS.r);                     // mirror
    R(-1, -8, 2, 2, BUS.r); R(0, -13, 1, 2, BUS.red); R(1, -25.5, 2, 1, BUS.red); R(43, -25.5, 2, 1, BUS.amb);
    R(36, -14.5, 2, 2, BUS.red);                                                // stop sign, folded in
    for (const wx of [10, 51]) {
      const cx = d > 0 ? bus.x + wx * K : bus.x - wx * K;
      disc(cx, y0 - 4 * K + 1, 4.3 * K, BUS.t); disc(cx, y0 - 4 * K + 1, 2.2 * K, BUS.h); disc(cx, y0 - 4 * K + 1, 1 * K, BUS.t);
    }
  }

  // ---------- wind: curls round on itself, then thins out and is gone ----------
  let gusts = [];
  function resetGust(g, initial) {
    g.x0 = rnd(-60, W * 0.85); g.y = rnd(12, H - 12);
    g.len = rnd(45, 95); g.v = rnd(34, 58); g.A = rnd(2, 7); g.k = rnd(0.015, 0.04);
    g.loops = [];
    let a = rnd(20, 60), R = rnd(6, 11), total = 0;
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) { g.loops.push([a, R]); total += 2 * Math.PI * R; a += rnd(20, 50); R *= 0.72; }
    g.loops.push([a, R]);                                   // a last, tighter curl it never finishes
    g.end = a + total + 2 * Math.PI * R * rnd(0.6, 0.95);
    g.u = initial ? rnd(0, g.end) : 0;
    g.wait = initial ? 0 : rnd(0, 3.5);
  }
  function gustPos(g, u) {
    let x = u;
    for (const L of g.loops) {
      if (x <= L[0]) break;
      const Lp = 2 * Math.PI * L[1];
      if (x < L[0] + Lp) {
        const th = (x - L[0]) / L[1];
        return [L[0] + L[1] * Math.sin(th), g.A * Math.sin(g.k * L[0]) - L[1] + L[1] * Math.cos(th)];
      }
      x -= Lp;
    }
    return [x, g.A * Math.sin(g.k * x)];
  }
  function stepWind(dt) {
    for (const g of gusts) {
      if (g.wait > 0) { g.wait -= dt; continue; }
      g.u += g.v * dt;
      if (g.u - g.len > g.end) resetGust(g, false);
    }
  }
  function drawWind() {
    for (const g of gusts) {
      if (g.wait > 0) continue;
      const over = Math.max(0, g.u - g.end) / g.len; // 0..1 while it dissipates
      for (let i = 0; i < g.len; i++) {
        const u = g.u - i;
        if (u > g.end) continue;
        if (u < 0) break;
        if (over > 0.45 && (i & 1)) continue;        // breaks up into dots
        const p = gustPos(g, u), f = i / g.len;
        P(g.x0 + p[0], g.y + p[1], WIND[Math.min(2, (f < 0.35 ? 0 : f < 0.7 ? 1 : 2) + (over > 0.15 ? 1 : 0))]);
      }
    }
  }

  // ---------- drifting leaves ----------
  const leaves = [];
  function resetLeaf(l) {
    l.x = bx + rnd(-200, 160); l.y = by + rnd(-400, -220);
    l.vx = rnd(10, 20); l.vy = rnd(7, 12); l.ph = rnd(0, 6); l.c = LEAF[2 + ((Math.random() * 3) | 0)];
    l.wait = rnd(1, 9);
  }
  function stepLeaves(dt) {
    for (const l of leaves) {
      if (l.wait > 0) { l.wait -= dt; continue; }
      l.ph += dt * 4;
      l.x += (l.vx + Math.sin(l.ph) * 9) * dt; l.y += (l.vy + Math.cos(l.ph * 0.7) * 5) * dt;
      if (l.x > W + 4 || l.y > by + 20) resetLeaf(l);
    }
  }
  function drawLeaves() {
    for (const l of leaves) {
      if (l.wait > 0) continue;
      const f = Math.sin(l.ph) > 0;
      P(l.x, l.y, l.c); P(l.x + (f ? 1 : 0), l.y + (f ? 0 : 1), l.c);
    }
  }

  // ---------- the cat: Freddy, a grey tabby with the M on his forehead ----------
  // He stays on the ground. He sleeps in his house until the pointer moves, trots to the foot
  // of the tree, stretches up after it, finds he cannot reach, then sits and washes: licks a
  // paw, rubs it over his ear. If the pointer comes down to the grass he chases and bats at it.
  const CAT = { k: C('#2b2a31'), g: C('#8b8b95'), G: C('#b3b3bd'), d: C('#3b3a42'), w: C('#f1f1f1'), p: C('#e88fa0'), e: C('#a6d94c') };
  const GY = 32, HOUSE_X = -172, BASE = 66;
  const HOLD = { notice: 0.75, stretch: 1, reachup: 2.6, wobble: 0.9, lookup: 1.4, lick: 2.4, ear: 2.4, watch: 1.5, reach: 1.5 };
  const cat = { gx: HOUSE_X, face: 1, moving: false, run: false, ph: 0, sp: 0, act: 'sleep', t: 0, q: [], cur: ['sleep'], own: false, up: false, tried: -99, nap: rnd(25, 45) };
  const mouse = { x: 0, y: 0, last: -99 };

  function plan() {
    const active = T - mouse.last < 3.5, high = by - mouse.y > 48, mx = clamp(mouse.x - bx, -225, 225);
    cat.own = !active;
    if (active) {
      if (high) {
        if (T - cat.tried > 14) {
          cat.tried = T;
          const side = cat.gx <= 0 ? -1 : 1;
          cat.q = [['go', side * BASE], ['face', -side], ['reachup'], ['lookup'], ['lick'], ['ear'], ['lick'], ['ear']];
        } else cat.q = [['watch']];
      } else if (Math.abs(mx - cat.gx) > 24) cat.q = [['follow']];
      else cat.q = [['reach'], ['watch']];
    } else if (Math.abs(cat.gx - HOUSE_X) > 3) cat.q = [['lick'], ['ear'], ['go', HOUSE_X], ['sleep']];
    else cat.q = [['sleep']];
  }
  function next() {
    if (!cat.q.length) plan();
    let s = cat.q.shift();
    if (s[0] === 'face') { cat.face = s[1]; s = cat.q.shift(); }
    cat.cur = s; cat.t = 0;
    cat.act = s[0] === 'go' || s[0] === 'follow' ? 'idle' : s[0];
    if (cat.act === 'reachup') cat.up = true; else if (cat.act !== 'wobble') cat.up = false;
    if (cat.act === 'sleep') { cat.gx = HOUSE_X; cat.nap = rnd(30, 50); }
  }
  function stepCat(dt) {
    if (dt <= 0) return;
    cat.t += dt;
    const active = T - mouse.last < 3.5;
    if (cat.act === 'sleep') {
      if (T - mouse.last < 0.5) { cat.q = [['notice']]; next(); }          // something moved: he wakes
      else if ((cat.nap -= dt) <= 0) {                                     // or gets up for a wander of his own
        cat.q = [['stretch'], ['go', (Math.random() < 0.5 ? -1 : 1) * rnd(85, 200)], ['lick'], ['ear'], ['go', HOUSE_X], ['sleep']];
        next(); cat.own = true;
      }
      return;
    }
    if (active && cat.own && cat.act !== 'notice') { cat.own = false; cat.moving = false; cat.q = [['notice']]; next(); return; }
    const s = cat.cur;
    if (s[0] === 'go' || s[0] === 'follow') {
      const mx = clamp(mouse.x - bx, -225, 225);
      if (s[0] === 'follow' && (!active || by - mouse.y > 48)) { cat.moving = false; cat.sp = 0; next(); return; }
      const wantX = s[0] === 'go' ? s[1] : mx + (cat.gx > mx ? 18 : -18);
      const dx = wantX - cat.gx, ad = Math.abs(dx);
      if (ad > 1.5) {
        cat.run = ad > (cat.run ? 40 : 75);           // walks, or trots if it is a long way
        cat.sp += ((cat.run ? 78 : 34) - cat.sp) * Math.min(1, dt * 5);
        const step = Math.min(ad, cat.sp * dt);
        cat.gx += Math.sign(dx) * step; cat.face = Math.sign(dx); cat.ph += step * (cat.run ? 0.2 : 0.3);
        cat.moving = true;
      } else { cat.moving = false; cat.sp = 0; next(); }
    } else if (cat.t > HOLD[cat.act]) next();
  }

  // side on, walking or trotting through the grass with his tail up
  function drawCatWalk(x, y, f, ph, run) {
    const bob = run ? -Math.round(Math.abs(Math.sin(ph)) * 1.5) : (Math.sin(ph * 2) > 0.6 ? -1 : 0);
    const X = dx => x + f * dx;
    for (let i = 0; i <= 11; i++) {
      const u = i / 11;
      const tx = -9 - u * 3 - Math.sin(u * 3.1) * 2.5 + Math.sin(T * 2 + u * 3) * u * 1.5, ty = -9 + bob - u * 11;
      const c = i % 3 === 2 || i > 9 ? CAT.d : CAT.g;
      P(X(tx), y + ty, c); P(X(tx + 1), y + ty, c);
    }
    const PI = Math.PI, amp = run ? 5 : 3.2;
    const legs = run
      ? [[-5, ph + 0.7, CAT.d], [8, ph + PI + 0.7, CAT.d], [-7, ph, CAT.g], [6, ph + PI, CAT.g]]
      : [[-5, ph + PI, CAT.d], [8, ph + PI * 1.5, CAT.d], [-7, ph, CAT.g], [6, ph + PI / 2, CAT.g]]; // one foot at a time
    for (const l of legs) {
      const swing = Math.sin(l[1]) * amp, lift = Math.max(0, Math.cos(l[1])) * (run ? 2 : 1.4);
      const fx = X(l[0] + swing);
      thick(X(l[0]), y - 6 + bob, fx, y - 1 - lift, 2, l[2]);
      if (l[2] === CAT.g) P(fx, y - lift, CAT.w);
    }
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -10; dx <= 9; dx++) {
        if ((dx / 10) * (dx / 10) + (dy / 4.3) * (dy / 4.3) > 1) continue;
        let c = CAT.g;
        if (dy >= 3) c = CAT.G;
        else if ((dx + 22) % 4 === 0 && dy < 2) c = CAT.d;
        else if (dy === -4) c = CAT.d;
        P(X(dx), y - 8 + bob + dy, c);
      }
    const hy = y - 11 + bob - (run ? 0 : 1);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 19) continue;
        let c = CAT.g;
        if (dx >= 2 && dy >= 1) c = CAT.w;
        else if (dy <= -3 && (dx === -1 || dx === 1)) c = CAT.d;
        else if (dx <= -3 && dy === 1) c = CAT.d;
        P(X(10 + dx), hy + dy, c);
      }
    P(X(7), hy - 5, CAT.g); P(X(8), hy - 5, CAT.g); P(X(7), hy - 6, CAT.d);
    P(X(11), hy - 5, CAT.g); P(X(12), hy - 5, CAT.g); P(X(12), hy - 6, CAT.d);
    P(X(12), hy - 1, CAT.e); P(X(13), hy - 1, CAT.k);
    P(X(14), hy + 1, CAT.p);
  }

  // up on his back legs against the foot of the tree, stretching for the pointer
  function drawCatStand(x, y, f) {
    const t = cat.t, wob = cat.act === 'wobble';
    const st = wob ? 1 : Math.min(1, t / 1.3);                              // stretches further and further
    const lean = wob ? -2 - 3.5 * Math.sin(t * 14) * (1 - t / 0.9) : 0;     // then tips over backwards, nearly
    const sh = dy => Math.round(lean * -dy / 26);
    const X = dx => x + f * dx;
    for (let i = 0; i <= 9; i++) {                                           // tail out behind for balance
      const ty = -1 - Math.max(0, i - 6) + Math.sin(T * (wob ? 14 : 5) + i * 0.5) * (i / 9) * 1.6;
      const c = i % 3 === 2 || i > 7 ? CAT.d : CAT.g;
      P(X(-5 - i), y + ty, c); P(X(-5 - i), y + ty - 1, c);
    }
    for (let dy = -4; dy <= 4; dy++)                                         // haunches
      for (let dx = -5; dx <= 5; dx++)
        if ((dx / 5.3) * (dx / 5.3) + (dy / 4.6) * (dy / 4.6) <= 1) P(X(-1 + dx), y - 5 + dy, (dx + 9) % 3 === 0 && dy < 1 ? CAT.d : CAT.g);
    rect(Math.min(X(1), X(4)), y - 1, 4, 2, CAT.w);
    const top = -23 - Math.round(st * 3);
    for (let dy = top; dy <= -6; dy++) {                                     // long stretched body
      const c0 = 1 + (-dy - 6) * 0.2 + sh(dy);
      for (let dx = -4; dx <= 3; dx++) P(X(c0 + dx), y + dy, dx >= 2 ? CAT.G : (dy % 3 === 0 && dx < 1) || dx === -4 ? CAT.d : CAT.g);
    }
    const hx = 6 + sh(top) + Math.round(st), hy = y + top - 3;
    for (let dy = -4; dy <= 4; dy++)                                         // head tipped back, nose up
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 18) continue;
        let c = CAT.g;
        if (dx >= 1 && dy <= -1) c = CAT.w;
        else if (dx <= -2 && (dy === -1 || dy === 1)) c = CAT.d;
        P(X(hx + dx), hy + dy, c);
      }
    P(X(hx + 3), hy - 3, CAT.p);
    P(X(hx + 1), hy + 1, CAT.e); P(X(hx + 2), hy + 1, CAT.k);
    P(X(hx - 4), hy - 2, CAT.g); P(X(hx - 5), hy - 3, CAT.d); P(X(hx - 3), hy + 3, CAT.g); P(X(hx - 4), hy + 4, CAT.d);
    for (let i = 0; i < 2; i++) {                                            // front paws scrabbling at the bark
      const sx = 4 + sh(top + 5), sy = top + 5;
      let px = 9 + i * 2 + Math.round(st * 2), py = top - 5 - Math.round(st * 3) + Math.sin(T * 12 + i * Math.PI) * 2;
      if (wob) { px = 6 + sh(top) + Math.sin(t * 18 + i * 3) * 5; py = top - 3 + Math.cos(t * 18 + i * 3) * 4; }
      thick(X(sx), y + sy, X(px), y + py, 2, i ? CAT.g : CAT.d);
      rect(Math.min(X(px), X(px + 1)), y + py - 1, 2, 2, CAT.w);
    }
  }

  // sitting, facing us: watching, noticing, batting at the pointer, washing
  function drawCatSit(x, y) {
    const s = mouse.x > x ? 1 : -1;
    const act = cat.act, t = cat.t;
    const lick = act === 'lick', ear = act === 'ear', notice = act === 'notice', reach = act === 'reach', wobble = act === 'wobble';
    const lookup = act === 'lookup' || ((act === 'watch' || act === 'idle') && mouse.y < y - 60 && T - mouse.last < 6);
    const yawn = act === 'stretch';
    let lean = 0;
    if (reach) lean = s * Math.min(3, t * 5);
    else if (wobble) lean = s * 3.5 * Math.cos(t * 15) * (1 - t / 0.9);
    else if (ear) lean = 1;
    const bxx = x + Math.round(lean * 0.4), hx = x + Math.round(lean);
    const hy = y - 16 + (lick && Math.sin(T * 9) > 0 ? 1 : 0) - (reach || notice || lookup ? 1 : 0);

    const flick = (reach || wobble ? Math.sin(T * 9) : Math.sin(T * 2.3)) > 0.6 ? 1 : 0;
    const tail = [[6, -1], [7, -1], [8, -1], [9, -1], [10, -2], [11, -2], [12, -3 - flick], [12, -4 - flick * 2]];
    tail.forEach((p, i) => { const c = i % 3 === 1 || i > 5 ? CAT.d : CAT.g; P(x - p[0], y + p[1], c); P(x - p[0], y + p[1] - 1, c); });
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        if ((dx / 6.4) * (dx / 6.4) + (dy / 6.6) * (dy / 6.6) > 1) continue;
        let c = CAT.g;
        if (Math.abs(dx) <= 1 && dy > -4) c = CAT.G;
        else if (Math.abs(dx) >= 3 && (dy + 12) % 3 === 0) c = CAT.d;
        P(bxx + dx + (dy < -2 ? Math.round(lean * 0.3) : 0), y - 7 + dy, c);
      }
    const up = lick || ear ? 1 : reach ? s : 0; // which front paw is off the ground
    if (up !== -1 && !wobble) rect(x - 4, y - 2, 3, 2, CAT.w);
    if (up !== 1 && !wobble) rect(x + 2, y - 2, 3, 2, CAT.w);
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        if ((dx / 6.5) * (dx / 6.5) + (dy / 5.3) * (dy / 5.3) > 1) continue;
        let c = CAT.g;
        if (Math.abs(dx) <= 2 && dy >= 1 && dy <= 3) c = CAT.w;
        else if (Math.abs(dx) >= 5 && (dy === 0 || dy === 2)) c = CAT.d;
        P(hx + dx, hy + dy, c);
      }
    const perk = notice || reach ? 1 : 0;
    for (const e of [-1, 1]) {
      if (ear && e === 1 && Math.sin(T * 8) > 0) { P(hx + 4, hy - 5, CAT.g); P(hx + 5, hy - 5, CAT.d); continue; } // ear folds under the paw
      P(hx + e * 5, hy - 5, CAT.g); P(hx + e * 4, hy - 5, CAT.g); P(hx + e * 3, hy - 5, CAT.g);
      P(hx + e * 5, hy - 6, CAT.g); P(hx + e * 4, hy - 6, CAT.p);
      if (perk) { P(hx + e * 5, hy - 7, CAT.g); P(hx + e * 5, hy - 8, CAT.d); }
      else P(hx + e * 5, hy - 7, CAT.d);
    }
    const M = ['X...X', 'XX.XX', 'X.X.X'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (M[r][c] === 'X') P(hx - 2 + c, hy - 4 + r, CAT.d);
    const shut = lick || ear || yawn || (T % 4.5) < 0.12;
    for (const e of [-1, 1]) {
      const ex = hx + e * 3 - (e < 0 ? 1 : 0);
      if (shut) { rect(ex, hy, 2, 1, CAT.d); continue; }
      const big = notice || reach || wobble || lookup;
      rect(ex, hy - (big ? 1 : 0), 2, big ? 2 : 1, CAT.e);
      P(ex + (s > 0 ? 1 : 0), hy - (lookup ? 1 : 0), CAT.k);
    }
    P(hx, hy + 1, CAT.p); P(hx, hy + 2, CAT.d);
    if (yawn) rect(hx - 1, hy + 2, 3, 2, CAT.p);

    if (lick) {              // paw up to his mouth, a little pink tongue
      thick(bxx + 4, y - 5, hx + 3, hy + 4, 2, CAT.g);
      rect(hx + 1, hy + 3, 3, 2, CAT.w);
      if (Math.sin(T * 9) > 0) { P(hx, hy + 3, CAT.p); P(hx + 1, hy + 3, CAT.p); }
    } else if (ear) {        // then the wet paw goes round and round over his ear
      const ax = hx + 5 + Math.round(Math.sin(T * 8) * 1.2), ay = hy - 3 + Math.round(Math.cos(T * 8) * 2);
      thick(bxx + 5, y - 6, ax, ay + 1, 2, CAT.g);
      rect(ax - 1, ay - 1, 3, 2, CAT.w);
    } else if (reach) {      // stretching a paw out toward the pointer
      const dx = mouse.x - (hx + s * 4), dy = Math.min(2, mouse.y - (y - 11)), d = Math.hypot(dx, dy) || 1;
      const r = Math.min(11, 5 + t * 5), sw = Math.sin(T * 11) * 1.5;
      const ax = hx + s * 4 + dx / d * r - dy / d * sw, ay = y - 11 + dy / d * r + dx / d * sw;
      thick(bxx + s * 4, y - 9, ax, ay, 2, CAT.g);
      rect(ax - 0.5, ay - 0.5, 2, 2, CAT.w);
    } else if (wobble) {     // both paws out, windmilling for balance
      for (const e of [-1, 1]) {
        const ay = y - 12 + Math.sin(t * 18 + e) * 3;
        thick(bxx + e * 4, y - 9, hx + e * 10, ay, 2, CAT.g);
        rect(hx + e * 10 - 0.5, ay - 0.5, 2, 2, CAT.w);
      }
    }
    if (notice) { rect(hx + 9, hy - 12, 1, 4, CAT.k); P(hx + 9, hy - 6, CAT.k); }
  }

  function drawCat() {
    if (cat.act === 'sleep') return; // he is in his house
    const x = bx + Math.round(cat.gx), y = by + GY;
    if (cat.moving) drawCatWalk(x, y, cat.face, cat.ph, cat.run);
    else if (cat.up) drawCatStand(x, y, cat.face);
    else drawCatSit(x, y);
  }

  // ---------- Freddy's house ----------
  const HS = { wall: C('#dcbd8e'), wallD: C('#b99766'), roof: C('#b84d3f'), roofD: C('#8c352d'), ink: C('#2b2126'), in: C('#3d2f33'), sign: C('#f4ecd8'), z: C('#6d6a75'), zL: C('#b9b6c0') };
  const GLYPH = { F: '111100110100100', R: '110101110101101', E: '111100110100111', D: '110101101101110', Y: '101101010010010' };
  function drawHouse() {
    const x = bx + HOUSE_X - 22, y = by + 27;
    rect(x, y - 22, 44, 22, HS.wallD); rect(x + 1, y - 21, 42, 20, HS.wall);
    for (let k = 0; k < 4; k++) rect(x + 1, y - 17 + k * 5, 42, 1, HS.wallD);
    for (let r = 0; r < 19; r++) {                       // pitched roof
      const w = Math.round(6 + r * 2.7);
      rect(x + 22 - (w >> 1), y - 41 + r, w, 1, r % 4 === 3 || r === 18 ? HS.roofD : HS.roof);
    }
    rect(x + 9, y - 33, 27, 8, HS.ink); rect(x + 10, y - 32, 25, 6, HS.sign); // name plate
    'FREDDY'.split('').forEach((ch, n) => {
      for (let i = 0; i < 15; i++) if (GLYPH[ch][i] === '1') P(x + 11 + n * 4 + (i % 3), y - 31 - 0 + ((i / 3) | 0), HS.ink);
    });
    for (let j = 0; j < 17; j++)                         // arched doorway
      for (let i = -8; i <= 8; i++) {
        const up = 16 - j;
        if (up > 8 && i * i + (up - 8) * (up - 8) > 64) continue;
        P(x + 22 + i, y - up, HS.in);
      }
    if (cat.act !== 'sleep') return;
    // curled up asleep in the doorway, breathing
    const br = Math.sin(T * 1.6) > 0 ? 1 : 0;
    for (let dy = -4 - br; dy <= 3; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if ((dx / 7.4) * (dx / 7.4) + (dy / (4.4 + br)) * (dy / (4.4 + br)) <= 1)
          P(x + 23 + dx, y - 4 + dy, (dx + 9) % 3 === 0 && dy < 1 ? CAT.d : dy > 1 ? CAT.G : CAT.g);
    disc(x + 17, y - 4, 3.2, CAT.g); P(x + 15, y - 8, CAT.g); P(x + 15, y - 9, CAT.d); P(x + 18, y - 8, CAT.g); P(x + 19, y - 9, CAT.d);
    rect(x + 15, y - 4, 2, 1, CAT.d); P(x + 14, y - 3, CAT.p); P(x + 17, y - 6, CAT.d);
    rect(x + 20, y - 1, 8, 1, CAT.d); rect(x + 18, y - 1, 2, 1, CAT.w);  // tail tucked round
    for (let k = 0; k < 3; k++) {                        // zzz drifting up and fading
      const u = (T * 0.4 + k / 3) % 1, n = 2 + Math.round(u * 2.4);
      const zx = x + 31 + u * 16 + Math.sin(u * 7) * 2, zy = y - 20 - u * 30, c = u < 0.6 ? HS.z : HS.zL;
      for (let i = 0; i <= n; i++) { P(zx + i, zy, c); P(zx + i, zy + n, c); P(zx + n - i, zy + i, c); }
    }
  }

  // ---------- hover outline ----------
  function outline() {
    const hits = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!mask[i] && (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W])) hits.push(i);
      }
    for (const i of hits) buf[i] = GOLD;
  }

  // ---------- links laid over the canvas ----------
  const SPOTS = [
    { id: 'spot-music', x: -108, y: -234, w: 46, h: 48, draw: drawMandolin },
    { id: 'spot-business', x: -41, y: -310, w: 34, h: 38, draw: drawBriefcase },
    { id: 'spot-moto', x: 112, y: -14, w: 104, h: 46, draw: drawBike },
    { id: 'spot-camera', x: -130, y: -280, w: 30, h: 36, draw: drawCamera },
    { id: 'spot-pc', x: 69, y: -314, w: 42, h: 62, draw: drawPC },
    { id: 'spot-freddy', x: 0, y: 0, w: 1, h: 1, draw() {} }, // these two move, see updateDyn
    { id: 'spot-bus', x: 0, y: 0, w: 1, h: 1, draw() {} },
  ];
  const SP_FREDDY = SPOTS[SPOTS.length - 2], SP_BUS = SPOTS[SPOTS.length - 1];
  const place = sp => {
    const st = sp.el.style;
    st.left = (bx + sp.x) * S + 'px'; st.top = (by + sp.y) * S + 'px';
    st.width = sp.w * S + 'px'; st.height = sp.h * S + 'px';
  };
  function updateDyn() {
    const f = SP_FREDDY, b = SP_BUS;
    if (cat.act === 'sleep') { f.x = HOUSE_X - 25; f.y = -16; f.w = 50; f.h = 46; }
    else { f.x = cat.gx - 17; f.y = GY - 38; f.w = 34; f.h = 40; }
    place(f);
    if (bus.wait > 0) { b.el.style.display = 'none'; if (hovered === b) hovered = null; }
    else { b.el.style.display = 'block'; b.x = (bus.dir > 0 ? bus.x : bus.x - BUS_LEN) - bx; b.y = -60; b.w = BUS_LEN; b.h = 58; place(b); }
  }
  const drawHot = (s, fn) => {
    if (hovered === s) { mask.fill(0); maskOn = true; fn(); maskOn = false; outline(); } else fn();
  };
  let hovered = null;
  for (const s of SPOTS) {
    s.el = document.getElementById(s.id);
    const on = () => { hovered = s; if (reduce) render(); };
    const off = () => { if (hovered === s) hovered = null; if (reduce) render(); };
    s.el.addEventListener('pointerenter', on); s.el.addEventListener('pointerleave', off);
    s.el.addEventListener('focus', on); s.el.addEventListener('blur', off);
  }

  // ---------- hover emphasis: a slight push-in, fast at first, then slower and slower ----------
  const zoom = { fast: 0, slow: 0, z: 1, fx: 0, fy: 0, tx: 0, ty: 0 };
  function stepZoom(dt) {
    const full = 0.14;
    const on = !!hovered;
    zoom.fast += ((on ? full * 0.78 : 0) - zoom.fast) * (1 - Math.exp(-dt / (on ? 0.14 : 0.22)));
    zoom.slow += ((on ? full * 0.22 : 0) - zoom.slow) * (1 - Math.exp(-dt / (on ? 4 : 0.22)));
    let z = 1 + zoom.fast + zoom.slow;
    if (z < 1.001) z = 1;
    if (on) {
      const cx = (bx + hovered.x + hovered.w / 2) * S, cy = (by + hovered.y + hovered.h / 2) * S;
      if (zoom.z === 1) { zoom.fx = cx; zoom.fy = cy; }
      else { const k = 1 - Math.exp(-dt / 0.12); zoom.fx += (cx - zoom.fx) * k; zoom.fy += (cy - zoom.fy) * k; }
    }
    zoom.z = z; zoom.tx = zoom.fx * (1 - z); zoom.ty = zoom.fy * (1 - z);
    stage.style.transform = z === 1 ? 'none' : `translate(${zoom.tx.toFixed(2)}px,${zoom.ty.toFixed(2)}px) scale(${z.toFixed(4)})`;
  }

  function layout() {
    // a window can report 0x0 while it is hidden; the resize event re-runs this
    const w = Math.max(innerWidth, 200), h = Math.max(innerHeight, 200);
    let s = Math.min(w / 500, h / 500);
    s = s >= 2 ? Math.floor(s) : s >= 1 ? Math.floor(s * 2) / 2 : Math.max(0.5, Math.floor(s * 4) / 4);
    S = s;
    W = Math.ceil(w / s); H = Math.ceil(h / s);
    cv.width = W; cv.height = H;
    cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    stage.style.width = W * s + 'px'; stage.style.height = H * s + 'px';
    img = ctx.createImageData(W, H);
    buf = new Uint32Array(img.data.buffer);
    mask = new Uint8Array(W * H);
    bx = W >> 1;
    by = Math.min(H - 46, Math.round(H / 2 + 218));
    for (const sp of SPOTS) {
      const st = sp.el.style;
      st.left = (bx + sp.x) * s + 'px'; st.top = (by + sp.y) * s + 'px';
      st.width = sp.w * s + 'px'; st.height = sp.h * s + 'px';
    }
    const n = Math.max(5, Math.round(W * H / 36000));
    gusts = [];
    for (let i = 0; i < n; i++) { const g = {}; resetGust(g, true); gusts.push(g); }
    leaves.length = 0;
    for (let i = 0; i < 5; i++) { const l = {}; resetLeaf(l); leaves.push(l); }
    smoke.length = 0;
  }

  function render() {
    buf.fill(WHITE);
    drawWind();
    drawHot(SP_BUS, drawBus);
    drawGround();
    drawTufts(false);
    for (const b of BACK) drawBlob(b, LEAF_BACK);
    drawWood();
    drawHome();
    if (cat.act === 'sleep') drawHot(SP_FREDDY, drawHouse); else drawHouse();
    for (const s of SPOTS) {
      if (hovered === s) { mask.fill(0); maskOn = true; s.draw(); maskOn = false; outline(); }
      else s.draw();
    }
    for (const t of TWIGS) drawTwig(t);
    for (const b of FRONT) drawBlob(b, LEAF);
    for (const b of SPRIGS) drawBlob(b, LEAF);
    drawSmoke();
    drawZaps();
    drawTufts(true);
    drawHot(SP_FREDDY, drawCat);
    drawLeaves();
    ctx.putImageData(img, 0, 0);
  }

  let prev = 0, slow = 1;
  function frame(now) {
    const dt = Math.min(0.05, (now - prev) / 1000 || 0);
    prev = now;
    // while the pointer rests on something, the whole scene eases into slow motion
    slow += ((hovered ? 0.25 : 1) - slow) * (1 - Math.exp(-dt / 0.25));
    const sdt = dt * slow;
    T += sdt;
    stepWind(sdt); stepLeaves(sdt); stepSmoke(sdt); stepZaps(sdt); stepBus(sdt); stepCat(sdt); stepZoom(dt);
    updateDyn();
    render();
    requestAnimationFrame(frame);
  }

  const track = e => {
    mouse.x = (e.clientX - zoom.tx) / zoom.z / S;
    mouse.y = (e.clientY - zoom.ty) / zoom.z / S;
    mouse.last = T;
  };
  addEventListener('pointermove', track);
  addEventListener('pointerdown', track);
  addEventListener('resize', () => { layout(); if (reduce) render(); });

  window.__scene = { bus, cat, render }; // handle for poking at the scene from the console
  layout();
  if (reduce) { T = 2; bus.wait = 0; bus.x = 30; updateDyn(); render(); } // still scene: bus parked where it can be clicked
  else requestAnimationFrame(frame);
})();
