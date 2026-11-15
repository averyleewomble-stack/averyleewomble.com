// Retro terminal for the tech-projects computer on averyleewomble.com
// Click the computer in the tree: the camera flies in, then this terminal opens.
// Wheel / arrow keys move the highlight, Enter or click opens a project, Esc goes back.
(() => {
  // =====================================================================
  //  EDIT YOUR PROJECTS HERE
  //    title    : name shown in the list
  //    tag      : short category label, shown on the right of the list
  //    year     : shown under the title
  //    summary  : one line, shown in the preview pane next to the list
  //    details  : paragraphs, typed out when the project is opened
  //    url      : optional. If set, an "OPEN FULL PAGE" option appears and
  //               takes the visitor to that page (e.g. 'my-pc-build.html')
  // =====================================================================
  const PROJECTS = [
    {
      title: 'The Tree (this website)',
      tag: 'WEB',
      year: '2026',
      summary: 'A pixel-art scene drawn in code, where every object is a link.',
      details: [
        'Everything on the home page is drawn procedurally on a canvas: the tree, the wind, the falling leaves, the cat, the bus and this very computer.',
        'Each object is a real link laid over the canvas, so it works with a keyboard and screen readers too.',
        'Hosted on GitHub Pages with a custom domain.'
      ],
      url: null
    },
    {
      title: 'Computer Build',
      tag: 'HARDWARE',
      year: '----',
      summary: '[PLACEHOLDER] Replace this with a real build.',
      details: [
        '[PLACEHOLDER] Describe the build here: parts, goals, what went right, what caught fire.',
        'To change or add projects, edit the PROJECTS list at the top of terminal.js in the repo.'
      ],
      url: null
    },
    {
      title: 'Software Project',
      tag: 'SOFTWARE',
      year: '----',
      summary: '[PLACEHOLDER] Replace this with a real project.',
      details: [
        '[PLACEHOLDER] What it does, what it is built with, and a link if there is one.',
        'Add a url to a project and an OPEN FULL PAGE option appears for it.'
      ],
      url: null
    }
  ];

  const scene = window.__scene;
  const pcLink = document.getElementById('spot-pc');
  if (!scene || !scene.focus || !pcLink) return; // scene not ready: the plain link still works

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- styles + font ----------
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
  document.head.appendChild(font);

  const css = document.createElement('style');
  css.textContent = `
body.in-terminal .title { opacity: 0; transition: opacity .4s; }
body.in-terminal .spot { pointer-events: none; }
body.in-terminal .spot span { display: none; }

#term {
  --g: #5dff8f; --gd: #1f9c4d; --gk: #02180b;
  position: fixed; inset: 0; z-index: 20; display: none; pointer-events: none; color: var(--g);
  font-family: 'VT323', ui-monospace, Menlo, Consolas, monospace;
}
#term.show { display: block; }
#term.static { background: rgba(1, 8, 3, .88); } /* reduced motion: no fly-in, so dim the page instead */
/* .pos is a fixed-size screen (see sizeFor in terminal.js) that is scaled and moved onto the computer's monitor */
#term .pos { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: auto; outline: none; }
#term.show .crt { animation: t-on .38s ease-out; }
#term.closing .crt { animation: t-off .22s ease-in forwards; }
@keyframes t-on { 0% { opacity: 0; transform: scale(1, .006); } 40% { opacity: 1; transform: scale(1, .006); } 100% { opacity: 1; transform: none; } }
@keyframes t-off { 0% { opacity: 1; transform: none; } 60% { opacity: 1; transform: scale(1, .006); } 100% { opacity: 0; transform: scale(1, .006); } }

#term .crt {
  position: relative; display: flex; flex-direction: column; width: 100%; height: 100%;
  padding: 22px 26px; overflow: hidden;
  background: radial-gradient(ellipse at center, #04281a 0%, #021509 100%);
  box-shadow: inset 0 0 70px rgba(0, 0, 0, .7);
  font-size: 22px; line-height: 1.15;
  text-shadow: 0 0 5px rgba(93, 255, 143, .65);
}
#term .crt::after { /* scanlines */
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, .28) 0 1px, transparent 1px 3px);
}
#term .crt::before { /* slow brightness flicker */
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: rgba(93, 255, 143, .035); animation: t-flick 4s steps(1) infinite;
}
@keyframes t-flick { 0% { opacity: 1; } 48% { opacity: .4; } 50% { opacity: 1; } 78% { opacity: .6; } 80% { opacity: 1; } }

#term .head { letter-spacing: .08em; text-transform: uppercase; }
#term .rule { border-bottom: 2px solid var(--gd); margin: .35em 0 .45em; }
#term .main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
#term .cols { flex: 1; min-height: 0; display: flex; gap: 1.4em; }
#term .list { flex: 1 1 55%; overflow-y: auto; scrollbar-width: none; }
#term .list::-webkit-scrollbar { display: none; }
#term .main > .list { flex: none; } /* the action list under a project's text takes only the room it needs */
#term .opt {
  display: flex; justify-content: space-between; gap: 1em; width: 100%;
  font: inherit; color: inherit; text-shadow: inherit; text-align: left; text-transform: uppercase;
  background: none; border: 0; padding: .1em .5em; cursor: pointer;
  animation: t-in .25s both;
}
#term .opt .l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#term .opt .r { opacity: .75; white-space: nowrap; }
#term .opt.sel { background: var(--g); color: var(--gk); text-shadow: none; }
@keyframes t-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
#term .prev { flex: 1 1 45%; border-left: 2px solid var(--gd); padding-left: 1em; overflow: auto; scrollbar-width: none; }
#term .prev .ttl, #term .text .ttl { text-transform: uppercase; margin-bottom: .2em; }
#term .meta { opacity: .75; margin-bottom: .5em; }
#term .text { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; margin-bottom: .5em; }
#term .text .ln { margin-bottom: .5em; }
#term .foot {
  border-top: 2px solid var(--gd); margin-top: .4em; padding-top: .3em;
  font-size: .72em; opacity: .8; text-transform: uppercase; letter-spacing: .05em;
}
#term .cur { display: inline-block; width: .5em; height: .9em; margin-left: 2px; vertical-align: -.1em; background: var(--g); animation: t-blink 1s steps(1) infinite; }
@keyframes t-blink { 50% { opacity: 0; } }
/* narrow windows get a smaller, tighter screen so the text stays readable */
#term .crt.narrow { padding: 14px 16px; font-size: 18px; }
#term .crt.narrow .head br { display: none; }
#term .crt.narrow .cols { flex-direction: column; gap: .4em; }
#term .crt.narrow .prev { display: none; }
@media (prefers-reduced-motion: reduce) {
  #term.show .crt, #term.closing .crt, #term .opt, #term .crt::before, #term .cur { animation: none; }
}
`;
  document.head.appendChild(css);

  // ---------- DOM ----------
  const term = document.createElement('div');
  term.id = 'term';
  term.tabIndex = -1;
  term.setAttribute('role', 'dialog');
  term.setAttribute('aria-modal', 'true');
  term.setAttribute('aria-label', 'Tech projects terminal');
  term.innerHTML =
    '<div class="pos"><div class="crt">' +
    '<div class="head">Avery-OS TermLink v1.0<br> Tech Projects Database</div>' +
    '<div class="rule"></div>' +
    '<div class="main"></div>' +
    '<div class="foot"></div>' +
    '</div></div>';
  document.body.appendChild(term);
  const pos = term.querySelector('.pos');
  const crt = term.querySelector('.crt');
  const main = term.querySelector('.main');
  const foot = term.querySelector('.foot');

  // The terminal is a fixed-size "screen" that gets scaled and moved so it sits exactly on the
  // monitor of the computer in the tree (tree.js reports where that screen is on every frame).
  let sizedFor = 0;
  function layoutTerm() {
    if (!st.open || !st.shown) return;
    const narrow = innerWidth < 640;
    const w = narrow ? 460 : 700, h = Math.round(w * 9 / 14);
    if (w !== sizedFor) {
      sizedFor = w;
      pos.style.width = w + 'px'; pos.style.height = h + 'px';
      crt.classList.toggle('narrow', narrow);
    }
    let x, y, k;
    if (reduce) { // no fly-in with reduced motion: show it centred instead
      k = Math.min(innerWidth * 0.92 / w, innerHeight * 0.88 / h);
      x = (innerWidth - w * k) / 2; y = (innerHeight - h * k) / 2;
    } else {
      const r = scene.screenRect();
      k = r.w / w; x = r.x; y = r.y;
    }
    pos.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- state ----------
  const st = { open: false, shown: false, view: 'menu', sel: 0, token: 0, viaKey: false };
  let cur = { items: [], els: [], onSel: null, textBox: null };
  let typer = null;

  // ---------- typewriter ----------
  function typeLines(box, lines) {
    const rows = lines.map(l => { const d = el('div', l.cls || 'ln'); box.appendChild(d); return [d, l.text]; });
    const cursor = el('span', 'cur');
    let li = 0, ci = 0, timer = 0;
    const api = { done: false };
    function finish() {
      clearTimeout(timer);
      rows.forEach(([d, t]) => { d.textContent = t; });
      if (rows.length) rows[rows.length - 1][0].appendChild(cursor);
      api.done = true;
    }
    function tick() {
      if (li >= rows.length) { finish(); return; }
      const [d, t] = rows[li];
      ci = Math.min(t.length, ci + 3);
      d.textContent = t.slice(0, ci);
      d.appendChild(cursor);
      if (ci >= t.length) { li++; ci = 0; }
      box.scrollTop = box.scrollHeight;
      timer = setTimeout(tick, 16);
    }
    api.skip = finish;
    api.stop = () => clearTimeout(timer);
    if (reduce) finish(); else tick();
    return api;
  }

  // ---------- list handling ----------
  function setSel(i) {
    i = Math.max(0, Math.min(cur.items.length - 1, i));
    st.sel = i;
    cur.els.forEach((b, k) => b.classList.toggle('sel', k === i));
    cur.els[i].scrollIntoView({ block: 'nearest' });
    if (cur.onSel) cur.onSel(i);
  }
  function buildList(items, fresh) {
    const list = el('div', 'list');
    list.setAttribute('role', 'listbox');
    const els = items.map((it, i) => {
      const b = el('button', 'opt');
      b.type = 'button';
      b.tabIndex = -1;
      b.setAttribute('role', 'option');
      b.appendChild(el('span', 'l', (it.exit ? '' : '> ') + it.label));
      if (it.right) b.appendChild(el('span', 'r', it.right));
      if (fresh && !reduce) b.style.animationDelay = (i * 60) + 'ms'; else b.style.animation = 'none';
      b.addEventListener('click', () => { setSel(i); it.act(); });
      b.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && st.sel !== i) setSel(i); });
      list.appendChild(b);
      return b;
    });
    cur.items = items; cur.els = els;
    return list;
  }

  // ---------- views ----------
  function renderMenu(fresh) {
    if (typer) { typer.stop(); typer = null; }
    st.view = 'menu';
    main.textContent = '';
    foot.textContent = 'Wheel / arrows: select   Enter: open   Esc: exit';
    const items = PROJECTS.map(p => ({ label: p.title, right: p.tag, act: () => renderDetail(p) }));
    items.push({ label: '< Exit terminal', exit: true, act: close });

    const cols = el('div', 'cols');
    const prev = el('div', 'prev');
    cur = { items: [], els: [], onSel: null, textBox: null };
    cols.appendChild(buildList(items, fresh));
    cols.appendChild(prev);
    main.appendChild(cols);
    cur.onSel = i => {
      prev.textContent = '';
      const p = PROJECTS[i];
      if (!p) { prev.appendChild(el('div', 'ttl', 'Log off')); prev.appendChild(el('div', 'ln', 'Return to the tree.')); return; }
      prev.appendChild(el('div', 'ttl', p.title));
      prev.appendChild(el('div', 'meta', '[' + p.tag + ']  ' + p.year));
      prev.appendChild(el('div', 'ln', p.summary));
    };
    setSel(Math.min(st.sel, items.length - 1));
  }

  function renderDetail(p) {
    if (typer) { typer.stop(); typer = null; }
    st.view = 'detail';
    st.proj = p;
    main.textContent = '';
    foot.textContent = 'Wheel / arrows: select   Enter: confirm   Esc: back';
    const box = el('div', 'text');
    const items = [];
    if (p.url) items.push({ label: 'Open full page', act: () => { location.href = p.url; } });
    items.push({ label: '< Back', exit: true, act: () => renderMenu(false) });
    cur = { items: [], els: [], onSel: null, textBox: box };
    main.appendChild(box);
    main.appendChild(buildList(items, false));
    st.sel = 0;
    setSel(0);
    const lines = [{ cls: 'ttl', text: p.title }, { cls: 'meta', text: '[' + p.tag + ']  ' + p.year }];
    p.details.forEach(t => lines.push({ text: t }));
    typer = typeLines(box, lines);
  }

  // ---------- open / close ----------
  function show() {
    st.shown = true;
    term.classList.remove('closing');
    term.classList.toggle('static', reduce);
    layoutTerm();
    term.classList.add('show');
    st.sel = 0;
    renderMenu(true);
    term.focus({ preventScroll: true });
  }

  function open(viaKey) {
    if (st.open) return;
    st.open = true; st.shown = false; st.viaKey = viaKey;
    term.classList.remove('closing');
    const tk = ++st.token;
    document.body.classList.add('in-terminal');
    if (!viaKey) pcLink.blur(); // otherwise the link keeps its hover-zoom after closing
    if (reduce) { show(); return; }
    scene.focus(true);
    const t0 = performance.now();
    (function wait() {
      if (tk !== st.token || !st.open) return;
      if (scene.focusK() >= 0.97 || performance.now() - t0 > 3000) show();
      else requestAnimationFrame(wait);
    })();
  }

  function close() {
    if (!st.open) return;
    const wasShown = st.shown;
    st.open = false; st.shown = false; st.token++;
    if (typer) { typer.stop(); typer = null; }
    const finish = () => {
      if (st.open) return; // opened again in the meantime
      term.classList.remove('show', 'closing');
      scene.focus(false); // camera backs out once the screen has switched off
      setTimeout(() => { if (!st.open) document.body.classList.remove('in-terminal'); }, reduce ? 0 : 950);
    };
    if (wasShown && !reduce) { term.classList.add('closing'); setTimeout(finish, 230); } else finish();
    if (st.viaKey) pcLink.focus({ preventScroll: true });
  }

  function back() {
    if (st.shown && st.view === 'detail') renderMenu(false);
    else close();
  }

  pcLink.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); // plain click opens the terminal; ctrl/cmd-click still goes to the page
    open(e.detail === 0);
  });

  // ---------- input ----------
  const move = d => { if (st.shown) setSel(st.sel + d); };
  const activate = () => {
    if (!st.shown) return;
    if (typer && !typer.done) { typer.skip(); return; } // first press finishes the typing
    const it = cur.items[st.sel];
    if (it) it.act();
  };

  document.addEventListener('keydown', e => {
    if (!st.open) return;
    const k = e.key;
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); back(); return; }
    if (!st.shown) return;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 's' || k === 'S') { e.preventDefault(); move(1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'w' || k === 'W') { e.preventDefault(); move(-1); }
    else if (k === 'Home') { e.preventDefault(); setSel(0); }
    else if (k === 'End') { e.preventDefault(); setSel(cur.items.length - 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); activate(); }
    else if (k === 'Tab') e.preventDefault();
  });

  let acc = 0, lastMove = 0;
  document.addEventListener('wheel', e => {
    if (!st.open) return;
    e.preventDefault();
    if (!st.shown) return;
    const box = cur.textBox;
    if (box && box.scrollHeight > box.clientHeight + 2) { box.scrollTop += e.deltaY; return; }
    if (acc && Math.sign(acc) !== Math.sign(e.deltaY)) acc = 0;
    acc += e.deltaY;
    const now = performance.now();
    if (Math.abs(acc) >= 40 && now - lastMove > 70) {
      move(acc > 0 ? 1 : -1);
      acc = 0; lastMove = now;
    }
  }, { passive: false });

  scene.onFrame = layoutTerm; // tree.js calls this every frame, right after it moves the camera
  addEventListener('resize', layoutTerm);

  // clicking the text while it types finishes it
  main.addEventListener('click', e => {
    if (typer && !typer.done && e.target.closest && e.target.closest('.text')) typer.skip();
  });
})();
