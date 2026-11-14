'use strict';
/* ByteBite — vanilla JS single-page app (no build step, no dependencies) */
const $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const app = $('#app');
const S = { token: localStorage.getItem('bb_token'), user: null, cart: null, promos: null, cuisines: null, timers: [],
  f: { q: '', cuisine: '', veg: false, sort: 'rating' }, form: { address: localStorage.getItem('bb_addr') || '', payment: 'UPI' } };
const STEPS = [['PLACED', '🧾', 'Placed'], ['PREPARING', '👨‍🍳', 'Preparing'], ['OUT_FOR_DELIVERY', '🛵', 'On the way'], ['DELIVERED', '🏠', 'Delivered']];
const LABEL = { PLACED: 'Order placed', PREPARING: 'Preparing', OUT_FOR_DELIVERY: 'On the way', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };

async function api(path, method = 'GET', body) {
  const r = await fetch('/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && S.token) logout(true); const e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; }
  return d;
}
function toast(m, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m; $('#toasts').append(t); setTimeout(() => t.remove(), 3300); }
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

/* ---------- effects ---------- */
function countUp(el, to, prefix = '', dur = 1400) {
  const from = el._v || 0; el._v = to; const t0 = performance.now();
  const f = t => { const p = Math.min(1, (t - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = prefix + Math.round(from + (to - from) * e).toLocaleString('en-IN'); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function confetti() {
  const c = $('#fx'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#ff6a3d', '#ff3d8b', '#ffc53d', '#2ee6a6', '#8b6cff', '#4db8ff'];
  const ps = Array.from({ length: 160 }, () => ({ x: innerWidth / 2, y: innerHeight * .6, vx: (Math.random() - .5) * 18, vy: -Math.random() * 18 - 6, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * 6 | 0] }));
  let n = 0; (function step() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
    if (++n < 130) requestAnimationFrame(step); else x.clearRect(0, 0, c.width, c.height);
  })();
}
function fly(from, emoji) {
  const b = $('#cartBtn'); if (!b || !from) return;
  const t = b.getBoundingClientRect(), f = from.getBoundingClientRect(), el = document.createElement('div');
  el.className = 'fly'; el.textContent = emoji; el.style.left = f.left + 'px'; el.style.top = f.top + 'px'; document.body.append(el);
  const dx = t.left - f.left, dy = t.top - f.top;
  el.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx / 2}px,${Math.min(dy, 0) - 80}px) scale(1.7)`, offset: .45 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: .3 }],
    { duration: 800, easing: 'cubic-bezier(.45,0,.75,.55)' }).onfinish = () => { el.remove(); bump(b); };
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
document.addEventListener('mousemove', e => {
  const c = e.target.closest?.('.card'); if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%'); c.style.setProperty('--ry', (x - .5) * 9 + 'deg'); c.style.setProperty('--rx', (.5 - y) * 9 + 'deg');
});
document.addEventListener('mouseout', e => { const c = e.target.closest?.('.card'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });

/* ---------- modal ---------- */
const openModal = html => { $('#modal').innerHTML = `<div class="box">${html}</div>`; $('#modal').classList.add('on'); };
const closeModal = () => $('#modal').classList.remove('on');
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });
const ask = (title, msg, ok = 'Continue') => new Promise(res => {
  openModal(`<h2>${esc(title)}</h2><p class="mut" style="margin:10px 0 22px">${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no">Cancel</button><button class="btn" id="yes">${esc(ok)}</button></div>`);
  $('#yes').onclick = () => { closeModal(); res(true); }; $('#no').onclick = () => { closeModal(); res(false); };
});

/* ---------- theme / nav ---------- */
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem('bb_theme', t); };
setTheme(localStorage.getItem('bb_theme') || 'dark');
function updateNav() {
  const h = location.hash || '#/', admin = S.user?.role === 'ADMIN';
  const tabs = [['#/', '🏠', 'Discover'], ['#/orders', '🧾', 'Orders'], ...(admin ? [['#/admin', '📊', 'Dashboard']] : [])];
  const on = t => (t === '#/' ? h === '#/' || h.startsWith('#/r/') : h.startsWith(t)) ? 'on' : '';
  $('#nav').innerHTML = `<div class="logo" onclick="location.hash='#/'"><b>🍽️</b><span>ByteBite</span></div>
    <div class="links">${tabs.map(t => `<a href="${t[0]}" class="${on(t[0])}">${t[2]}</a>`).join('')}</div><div class="sp"></div>
    <button class="ib" id="themeBtn" title="Toggle theme">${document.documentElement.dataset.theme === 'dark' ? '🌙' : '☀️'}</button>
    <button class="ib" id="cartBtn" title="Cart">🛒<span class="badge" id="badge" style="display:${S.cart?.count ? 'grid' : 'none'}">${S.cart?.count || 0}</span></button>
    ${S.user ? `<div class="avatar" id="userBtn" title="${esc(S.user.name)} — click to log out" style="cursor:pointer">${esc(S.user.name[0].toUpperCase())}</div>` : `<a class="btn sm" href="#/login">Log in</a>`}`;
  $('#tabbar').innerHTML = tabs.map(t => `<a href="${t[0]}" class="${on(t[0])}"><span>${t[1]}</span>${t[2]}</a>`).join('');
  $('#themeBtn').onclick = () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); updateNav(); };
  $('#cartBtn').onclick = openDrawer;
  const u = $('#userBtn'); if (u) u.onclick = async () => { if (await ask('Log out?', `You're signed in as ${S.user.email}.`, 'Log out')) logout(); };
}
function setBadge() { const b = $('#badge'); if (!b) return; const n = S.cart?.count || 0; b.style.display = n ? 'grid' : 'none'; b.textContent = n; bump($('#cartBtn')); }
function logout(silent) { S.token = null; S.user = null; S.cart = null; localStorage.removeItem('bb_token'); updateNav(); if (!silent) toast('Logged out 👋'); location.hash = '#/'; route(); }
const needLogin = () => { if (S.user) return false; toast('Please log in first 🔐', true); sessionStorage.setItem('bb_after', location.hash); location.hash = '#/login'; return true; };

/* ---------- router ---------- */
const routes = [[/^#\/r\/(r\d+)$/, viewRest], [/^#\/orders$/, viewOrders, 1], [/^#\/track\/(o\d+)$/, viewTrack, 1], [/^#\/admin$/, viewAdmin, 2], [/^#\/login$/, viewAuth]];
function route() {
  S.timers.forEach(clearInterval); S.timers = []; closeDrawer(); closeModal(); updateNav(); scrollTo(0, 0);
  const h = location.hash || '#/';
  for (const [re, fn, lvl] of routes) { const m = h.match(re); if (!m) continue;
    if (lvl && !S.user) { sessionStorage.setItem('bb_after', h); location.hash = '#/login'; return; }
    if (lvl === 2 && S.user.role !== 'ADMIN') { toast('Admins only', true); location.hash = '#/'; return; }
    return guard(fn)(m[1]); }
  guard(viewHome)();
}
addEventListener('hashchange', route);
const page = html => { app.innerHTML = `<div class="view">${html}</div>`; };

/* ---------- home ---------- */
async function viewHome() {
  const words = ['pizza', 'biryani', 'sushi', 'burgers', 'tacos', 'desserts']; let wi = 0;
  page(`<section class="glass hero rise"><div class="float">🍕</div>
    <h1>Craving <span class="grad word" id="word">pizza</span>?<br>We'll fly it to you.</h1>
    <p>Hot food from the best kitchens in town, tracked live from oven to doorstep.</p>
    <div class="search"><span>🔎</span><input id="q" placeholder="Search restaurants, cuisines or dishes…" value="${esc(S.f.q)}"><button class="btn sm" id="go">Search</button></div>
    <div class="row wrap" style="margin-top:16px" id="promos"></div></section>
    <div class="chips" id="chips"></div>
    <div class="toolbar"><label class="sw ${S.f.veg ? 'on' : ''}" id="veg"><i></i>Pure veg</label><div class="sp"></div>
      <select class="chip" id="sort"><option value="rating">★ Top rated</option><option value="eta">⚡ Fastest</option><option value="fee">💸 Lowest fee</option><option value="name">A–Z</option></select></div>
    <div class="grid" id="list">${'<div class="skel"></div>'.repeat(6)}</div>`);
  $('#sort').value = S.f.sort;
  S.timers.push(setInterval(() => { const w = $('#word'); if (!w) return; w.classList.add('out'); setTimeout(() => { wi = (wi + 1) % words.length; w.textContent = words[wi]; $('.hero .float').textContent = ['🍕', '🍛', '🍣', '🍔', '🌮', '🧁'][wi]; w.classList.remove('out'); }, 400); }, 2600));
  const run = () => { S.f.q = $('#q').value.trim(); loadList(); };
  $('#go').onclick = run; $('#q').onkeydown = e => e.key === 'Enter' && run();
  let dt; $('#q').oninput = () => { clearTimeout(dt); dt = setTimeout(run, 280); };
  $('#sort').onchange = e => { S.f.sort = e.target.value; loadList(); };
  $('#veg').onclick = e => { S.f.veg = !S.f.veg; e.currentTarget.classList.toggle('on', S.f.veg); loadList(); };
  api('promos').then(p => { S.promos = p; $('#promos') && ($('#promos').innerHTML = Object.entries(p).map(([k, v]) => `<button class="pill" data-copy="${k}" title="${esc(v.desc)}">🎟️ ${k} <span class="mut">· ${esc(v.desc)}</span></button>`).join('')); });
  $('#promos').onclick = e => { const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard?.writeText(c.dataset.copy); toast(`Code ${c.dataset.copy} copied — apply it in your cart 🎟️`); } };
  if (!S.cuisines) { const all = await api('restaurants'); S.cuisines = [...new Set(all.map(r => r.cuisine))]; }
  const drawChips = () => $('#chips') && ($('#chips').innerHTML = ['', ...S.cuisines].map(c => `<button class="chip ${S.f.cuisine === c ? 'on' : ''}" data-c="${esc(c)}">${c || '✨ All'}</button>`).join(''));
  drawChips(); $('#chips').onclick = e => { const c = e.target.closest('[data-c]'); if (!c) return; S.f.cuisine = c.dataset.c; drawChips(); loadList(); };
  loadList();
}
const loadList = guard(async () => {
  const p = new URLSearchParams({ q: S.f.q, cuisine: S.f.cuisine, veg: S.f.veg ? 1 : 0, sort: S.f.sort });
  const list = await api('restaurants?' + p), el = $('#list'); if (!el) return;
  const favs = S.user?.favs || [];
  el.innerHTML = list.length ? list.map((r, i) => `<div class="card rise ${r.open ? '' : 'closed'}" style="--i:${i};--h:${r.hue}" data-id="${r.id}">
    <div class="art"><span>${r.emoji}</span>${r.tag ? `<div class="tag">${esc(r.tag)}</div>` : ''}<button class="heart ${favs.includes(r.id) ? 'on' : ''}" data-fav="${r.id}">❤️</button></div>
    <div class="body"><div class="row between"><h3>${esc(r.name)}</h3><span class="pill"><span class="star">★</span>${r.rating}</span></div>
    <p class="mut" style="margin-top:6px">${esc(r.cuisine)} · ⏱ ${r.etaMinutes} min · ${r.deliveryFee ? money(r.deliveryFee) + ' delivery' : 'Free delivery'}${r.open ? '' : ' · <b style="color:var(--bad)">Closed</b>'}</p></div></div>`).join('')
    : `<div class="empty" style="grid-column:1/-1"><span class="e">🔍</span><h3>Nothing matches that craving</h3><p>Try a different search or filter.</p></div>`;
  el.onclick = guard(async e => {
    const hb = e.target.closest('[data-fav]');
    if (hb) { e.stopPropagation(); if (needLogin()) return; const d = await api(`restaurants/${hb.dataset.fav}/favorite`, 'POST'); S.user.favs = d.favs; hb.classList.toggle('on', d.favs.includes(hb.dataset.fav)); return; }
    const c = e.target.closest('.card'); if (c) location.hash = '#/r/' + c.dataset.id;
  });
});

/* ---------- restaurant ---------- */
async function viewRest(id) {
  const r = await api('restaurants/' + id), cats = [...new Set(r.menu.map(i => i.category))];
  const qtyOf = i => S.cart?.items.find(x => x.itemId === i)?.qty || 0;
  const ctl = i => { const q = qtyOf(i.id); return q ? `<div class="stepper"><button data-q="${i.id}" data-d="-1">−</button><b>${q}</b><button data-q="${i.id}" data-d="1">+</button></div>` : `<button class="btn sm" data-add="${i.id}" data-em="${i.emoji}">Add +</button>`; };
  page(`<a href="#/" class="mut" style="font-weight:700">← All restaurants</a>
    <section class="glass banner rise" style="--h:${r.hue};margin-top:12px"><div class="big">${r.emoji}</div><div><h1 style="font-size:clamp(26px,4vw,42px)">${esc(r.name)}</h1>
    <p class="mut" style="margin:6px 0 10px">${esc(r.cuisine)} · ${esc(r.tag || 'Freshly made')}</p><div class="row wrap"><span class="pill"><span class="star">★</span>${r.rating} (${r.ratingCount})</span><span class="pill">⏱ ${r.etaMinutes} min</span><span class="pill">🛵 ${r.deliveryFee ? money(r.deliveryFee) : 'Free'}</span>${r.open ? '<span class="pill" style="color:var(--ok)">● Open</span>' : '<span class="pill" style="color:var(--bad)">● Closed</span>'}</div></div></section>
    <div class="chips">${cats.map(c => `<button class="chip" data-go="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${cats.map((c, ci) => `<h2 id="cat-${esc(c)}" style="margin:22px 0 14px" class="rise" style="--i:${ci}">${esc(c)}</h2><div class="menu">${r.menu.filter(i => i.category === c).map((i, n) => `
      <div class="item rise" style="--i:${n}"><div class="em">${i.emoji}</div><div class="info"><b><span class="${i.veg ? 'veg' : 'nonveg'}"></span>${esc(i.name)}</b>${i.popular ? '<span class="hot">🔥 Popular</span>' : ''}<p>${esc(i.description)}</p><b class="grad">${money(i.price)}</b></div><div class="ctl" data-id="${i.id}">${r.open ? ctl(i) : '<span class="mut">Closed</span>'}</div></div>`).join('')}</div>`).join('')}`);
  const refresh = () => $$('.ctl').forEach(c => { const it = r.menu.find(i => i.id === c.dataset.id); if (it && r.open) c.innerHTML = ctl(it); });
  app.onclick = guard(async e => {
    const go = e.target.closest('[data-go]'); if (go) return $(`[id="cat-${go.dataset.go}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const add = e.target.closest('[data-add]'), q = e.target.closest('[data-q]');
    if (add) { if (needLogin()) return; fly(add, add.dataset.em); await addItem(add.dataset.add); refresh(); }
    if (q) { await setQty(q.dataset.q, qtyOf(q.dataset.q) + +q.dataset.d); refresh(); }
  });
}
async function addItem(itemId) {
  try { S.cart = await api('cart/add', 'POST', { itemId, qty: 1 }); }
  catch (e) { if (e.status !== 409) throw e; if (!(await ask('Start a new cart?', e.message, 'Replace cart'))) return; S.cart = await api('cart/add', 'POST', { itemId, qty: 1, replace: true }); }
  setBadge(); drawDrawer();
}
async function setQty(id, qty) { S.cart = await api(`cart/items/${id}`, 'PUT', { qty }); setBadge(); drawDrawer(); }

/* ---------- cart drawer ---------- */
function openDrawer() { if (needLogin()) return; drawDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); }
function closeDrawer() { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = closeDrawer;
function drawDrawer() {
  const c = S.cart, d = $('#drawer'); if (!d) return;
  if (!c || !c.items.length) { d.innerHTML = `<div class="hd"><h2>Your cart</h2><button class="ib" onclick="closeDrawer()">✕</button></div><div class="bd"><div class="empty"><span class="e">🛒</span><h3>Your cart is hungry</h3><p>Add something delicious to get started.</p><br><button class="btn" onclick="closeDrawer();location.hash='#/'">Browse restaurants</button></div></div>`; return; }
  d.innerHTML = `<div class="hd"><div><h2>Your cart</h2><span class="mut">${c.restaurant.emoji} ${esc(c.restaurant.name)} · ⏱ ${c.restaurant.eta} min</span></div><button class="ib" onclick="closeDrawer()">✕</button></div>
  <div class="bd">${c.items.map(i => `<div class="line"><span style="font-size:30px">${i.emoji}</span><div style="flex:1"><b>${esc(i.name)}</b><div class="mut">${money(i.price)}</div></div>
    <div class="stepper"><button data-q="${i.itemId}" data-d="-1">−</button><b>${i.qty}</b><button data-q="${i.itemId}" data-d="1">+</button></div><b style="min-width:62px;text-align:right">${money(i.price * i.qty)}</b></div>`).join('')}
    <div class="lbl">Promo code</div><div class="row"><input class="field" id="promo" placeholder="e.g. BITE20" value="${esc(c.promo || '')}" style="text-transform:uppercase"><button class="btn ghost" id="applyPromo">Apply</button></div>
    ${c.promoNote ? `<p style="color:var(--warn);font-size:13px;margin-top:6px">⚠ ${esc(c.promoNote)}</p>` : c.promo && c.discount ? `<p style="color:var(--ok);font-size:13px;margin-top:6px">✓ ${esc(c.promo)} saved you ${money(c.discount)}</p>` : c.promo && !c.discount && c.deliveryFee === 0 ? `<p style="color:var(--ok);font-size:13px;margin-top:6px">✓ Free delivery applied</p>` : ''}
    <div class="lbl">Tip your courier</div><div class="seg" id="tip">${[0, 20, 50, 100].map(t => `<button class="${c.tip === t ? 'on' : ''}" data-tip="${t}">${t ? '₹' + t : 'None'}</button>`).join('')}</div>
    <div class="lbl">Delivery address</div><textarea class="field" id="addr" rows="2" placeholder="House no, street, landmark…">${esc(S.form.address)}</textarea>
    <div class="lbl">Payment</div><div class="seg" id="pay">${[['UPI', '📱 UPI'], ['Card', '💳 Card'], ['Cash', '💵 Cash']].map(([k, l]) => `<button class="${S.form.payment === k ? 'on' : ''}" data-pay="${k}">${l}</button>`).join('')}</div></div>
  <div class="ft"><div class="sum"><span>Subtotal</span><span>${money(c.subtotal)}</span></div>${c.discount ? `<div class="sum" style="color:var(--ok)"><span>Discount</span><span>−${money(c.discount)}</span></div>` : ''}
    <div class="sum"><span>Delivery</span><span>${c.deliveryFee ? money(c.deliveryFee) : 'FREE'}</span></div><div class="sum"><span>Taxes (5%)</span><span>${money(c.tax)}</span></div>${c.tip ? `<div class="sum"><span>Tip</span><span>${money(c.tip)}</span></div>` : ''}
    <div class="sum t"><span>Total</span><span id="tot">${money(c.total)}</span></div><div class="row" style="margin-top:12px"><button class="btn ghost" id="clear" title="Clear cart">🗑</button><button class="btn" id="place" style="flex:1">Place order · ${money(c.total)}</button></div></div>`;
  const tot = $('#tot'); if (tot) { tot._v = 0; countUp(tot, c.total, '₹', 500); }
}
$('#drawer').addEventListener('input', e => { if (e.target.id === 'addr') { S.form.address = e.target.value; localStorage.setItem('bb_addr', e.target.value); } });
$('#drawer').addEventListener('click', guard(async e => {
  const t = e.target, q = t.closest('[data-q]');
  if (q) { const cur = S.cart.items.find(i => i.itemId === q.dataset.q).qty; await setQty(q.dataset.q, cur + +q.dataset.d); if (location.hash.startsWith('#/r/')) route2(); }
  else if (t.closest('[data-tip]')) { S.cart = await api('cart/tip', 'POST', { tip: +t.closest('[data-tip]').dataset.tip }); drawDrawer(); }
  else if (t.closest('[data-pay]')) { S.form.payment = t.closest('[data-pay]').dataset.pay; $$('#pay button').forEach(b => b.classList.toggle('on', b.dataset.pay === S.form.payment)); }
  else if (t.id === 'applyPromo') { S.cart = await api('cart/promo', 'POST', { code: $('#promo').value }); drawDrawer(); }
  else if (t.id === 'clear') { if (await ask('Clear cart?', 'Remove everything from your cart?', 'Clear')) { S.cart = await api('cart', 'DELETE'); setBadge(); drawDrawer(); if (location.hash.startsWith('#/r/')) route2(); } }
  else if (t.id === 'place') {
    t.disabled = true;
    try { const o = await api('order/place', 'POST', { address: S.form.address, payment: S.form.payment }); S.cart = await api('cart'); setBadge(); closeDrawer(); confetti(); toast('Order placed! 🎉'); location.hash = '#/track/' + o.id; }
    finally { t.disabled = false; }
  }
}));
const route2 = () => { const h = location.hash, m = h.match(/^#\/r\/(r\d+)$/); if (m) viewRest(m[1]); };

/* ---------- auth ---------- */
function viewAuth() {
  let mode = 'login';
  const draw = () => { page(`<div class="glass auth rise"><h2>${mode === 'login' ? 'Welcome back 👋' : 'Join ByteBite 🍽️'}</h2><p class="mut">${mode === 'login' ? 'Log in to order and track deliveries.' : 'Create an account in seconds.'}</p>
    <div class="tabs"><button class="${mode === 'login' ? 'on' : ''}" data-m="login">Log in</button><button class="${mode === 'signup' ? 'on' : ''}" data-m="signup">Sign up</button></div>
    ${mode === 'signup' ? '<input class="field" id="name" placeholder="Full name" autocomplete="name">' : ''}<input class="field" id="email" type="email" placeholder="Email" autocomplete="email"><input class="field" id="pw" type="password" placeholder="Password" autocomplete="current-password">
    <button class="btn" id="submit" style="width:100%;margin-top:12px">${mode === 'login' ? 'Log in' : 'Create account'}</button>
    <div class="lbl" style="text-align:center">or try a demo</div><div class="row"><button class="btn ghost sm" style="flex:1" data-demo="user">🙋 Customer</button><button class="btn ghost sm" style="flex:1" data-demo="admin">🛠 Admin</button></div></div>`);
    const submit = guard(async () => {
      const body = { email: $('#email').value, password: $('#pw').value, ...(mode === 'signup' ? { name: $('#name').value } : {}) };
      const d = await api('auth/' + mode, 'POST', body); S.token = d.token; S.user = d.user; localStorage.setItem('bb_token', d.token); S.cart = await api('cart');
      toast(`Welcome, ${d.user.name.split(' ')[0]}! 🎉`); const a = sessionStorage.getItem('bb_after'); sessionStorage.removeItem('bb_after'); location.hash = a && a !== '#/login' ? a : '#/'; });
    $('#submit').onclick = submit; $('#pw').onkeydown = e => e.key === 'Enter' && submit();
    $$('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $$('[data-demo]').forEach(b => b.onclick = () => { mode = 'login'; draw(); $('#email').value = b.dataset.demo === 'admin' ? 'admin@bytebite.dev' : 'user@bytebite.dev'; $('#pw').value = b.dataset.demo === 'admin' ? 'Admin@123' : 'User@123'; submit(); });
  }; draw();
}

/* ---------- orders & tracking ---------- */
const when = t => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
async function viewOrders() {
  const list = await api('order/my');
  page(`<h1 class="rise" style="font-size:34px;margin-bottom:20px">Your orders</h1><div class="orders">${list.length ? list.map((o, i) => `
    <div class="glass order rise" style="--i:${i}" data-t="${o.id}"><div class="row between wrap"><div class="row"><span style="font-size:38px">${o.restaurantEmoji}</span><div><b>${esc(o.restaurantName)}</b><div class="mut" style="font-size:13px">#${o.id} · ${when(o.createdAt)}</div></div></div>
    <div class="row"><span class="status s-${o.status}">${LABEL[o.status]}</span><b>${money(o.total)}</b></div></div>
    <p class="mut" style="margin:10px 0">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</p>
    <div class="row"><button class="btn sm" data-t="${o.id}">${['DELIVERED', 'CANCELLED'].includes(o.status) ? 'View' : '📍 Track live'}</button><button class="btn ghost sm" data-re="${o.id}">🔁 Reorder</button></div></div>`).join('')
    : `<div class="empty"><span class="e">🧾</span><h3>No orders yet</h3><p>Your delicious history will show up here.</p><br><button class="btn" onclick="location.hash='#/'">Order now</button></div>`}</div>`);
  app.onclick = guard(async e => {
    const re = e.target.closest('[data-re]');
    if (re) { e.stopPropagation(); const o = list.find(x => x.id === re.dataset.re); await api('cart', 'DELETE');
      for (const i of o.items) S.cart = await api('cart/add', 'POST', { itemId: i.itemId, qty: i.qty, replace: true }); setBadge(); toast('Items added to your cart 🛒'); return openDrawer(); }
    const t = e.target.closest('[data-t]'); if (t) location.hash = '#/track/' + t.dataset.t;
  });
}
async function viewTrack(id) {
  let o = await api('order/' + id), celebrated = false;
  page(`<a href="#/orders" class="mut" style="font-weight:700">← My orders</a><div class="glass track rise" style="margin-top:12px">
    <div class="row between wrap"><div><h1 style="font-size:30px" id="head"></h1><p class="mut" id="sub"></p></div><span class="status" id="st"></span></div>
    <div class="route" id="route"><div class="rail"><div class="fill" id="fill"></div></div><div class="end" style="left:-12px">${o.restaurantEmoji}</div><div class="end" style="right:-12px">🏠</div><div class="courier" id="courier">🛵</div></div>
    <div class="steps">${STEPS.map(s => `<div class="step" data-s="${s[0]}"><div class="ic">${s[1]}</div><b>${s[2]}</b><small></small></div>`).join('')}</div></div>
    <div class="dash" style="margin-top:18px;grid-template-columns:1.2fr 1fr"><div class="glass panel"><h3>Order #${o.id}</h3>${o.items.map(i => `<div class="sum" style="color:var(--tx)"><span>${i.emoji} ${i.qty}× ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}<hr style="border:0;border-top:1px solid var(--bd);margin:10px 0">
      <div class="sum"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>${o.discount ? `<div class="sum"><span>Discount (${esc(o.promo)})</span><span>−${money(o.discount)}</span></div>` : ''}<div class="sum"><span>Delivery + tax${o.tip ? ' + tip' : ''}</span><span>${money(o.deliveryFee + o.tax + o.tip)}</span></div><div class="sum t"><span>Total</span><span>${money(o.total)}</span></div></div>
      <div class="glass panel" id="side"><h3>Delivering to</h3><p>📍 ${esc(o.address)}</p><p class="mut" style="margin-top:6px">Paid via ${esc(o.payment)}</p><div id="extra" style="margin-top:16px"></div></div></div>`);
  const prog = o => { const el = (Date.now() - o.createdAt) / 1000; return { PLACED: 6, PREPARING: 30, OUT_FOR_DELIVERY: 36 + Math.min(1, Math.max(0, (el - 30) / 25)) * 54, DELIVERED: 100, CANCELLED: 0 }[o.status]; };
  const paint = () => {
    if (!$('#head')) return;
    const idx = STEPS.findIndex(s => s[0] === o.status), p = prog(o), cancelled = o.status === 'CANCELLED';
    $('#fill').style.width = p + '%'; $('#courier').style.left = p + '%'; $('#courier').textContent = o.status === 'DELIVERED' ? '🎉' : cancelled ? '❌' : '🛵';
    $('#head').textContent = { PLACED: 'Order confirmed!', PREPARING: 'The kitchen is cooking 👨‍🍳', OUT_FOR_DELIVERY: 'Your food is on the way 🛵', DELIVERED: 'Delivered — enjoy! 🍽️', CANCELLED: 'Order cancelled' }[o.status];
    $('#sub').textContent = cancelled ? 'This order was cancelled.' : o.status === 'DELIVERED' ? 'Delivered at ' + when(o.timeline.at(-1).at) : 'Estimated arrival: about ' + Math.max(1, Math.ceil(55 - (Date.now() - o.createdAt) / 1000)) + ' seconds (demo speed)';
    const st = $('#st'); st.className = 'status s-' + o.status; st.textContent = LABEL[o.status];
    $$('.step').forEach((el, i) => { el.classList.toggle('done', i < idx || o.status === 'DELIVERED'); el.classList.toggle('cur', i === idx && o.status !== 'DELIVERED'); const t = o.timeline.find(x => x.status === STEPS[i][0]); el.querySelector('small').textContent = t ? new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''; });
    const ex = $('#extra');
    if (o.status === 'PLACED') ex.innerHTML = '<button class="btn bad sm" id="cancel">Cancel order</button>';
    else if (o.status === 'DELIVERED') ex.innerHTML = o.review ? `<h3>Your review</h3><div class="stars">${'⭐'.repeat(o.review.rating)}</div><p class="mut">${esc(o.review.comment)}</p>` : ex.querySelector('.stars') ? ex.innerHTML : `<h3 style="margin-bottom:8px">How was it?</h3><div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}">⭐</button>`).join('')}</div><input class="field" id="cmt" placeholder="Say something nice (optional)" style="margin:10px 0"><button class="btn sm ok" id="rev">Submit review</button>`;
    else ex.innerHTML = '';
    if (o.status === 'DELIVERED' && !celebrated && Date.now() - o.timeline.at(-1).at < 20000) { celebrated = true; confetti(); }
  };
  let stars = 0;
  $('#side').onclick = guard(async e => {
    if (e.target.id === 'cancel' && await ask('Cancel this order?', 'This cannot be undone.', 'Cancel order')) { o = await api(`order/${id}/cancel`, 'POST'); paint(); }
    const s = e.target.closest('[data-n]'); if (s) { stars = +s.dataset.n; $$('#stars button').forEach(b => b.classList.toggle('on', +b.dataset.n <= stars)); }
    if (e.target.id === 'rev') { if (!stars) return toast('Tap a star rating first ⭐', true); o = await api(`order/${id}/review`, 'POST', { rating: stars, comment: $('#cmt').value }); toast('Thanks for the feedback! 💛'); paint(); }
  });
  paint();
  S.timers.push(setInterval(async () => { try { o = await api('order/' + id); paint(); } catch { } }, 2000));
}

/* ---------- admin dashboard ---------- */
const COL = { PLACED: '#ffc53d', PREPARING: '#8b6cff', OUT_FOR_DELIVERY: '#4db8ff', DELIVERED: '#2ee6a6', CANCELLED: '#ff5470' };
function lineChart(daily) {
  const W = 700, H = 270, P = { l: 46, r: 14, t: 16, b: 30 }, max = Math.max(1, ...daily.map(d => d.revenue)) * 1.15, n = daily.length;
  const X = i => P.l + i * (W - P.l - P.r) / (n - 1), Y = v => H - P.b - v / max * (H - P.t - P.b);
  let d = `M${X(0)},${Y(daily[0].revenue)}`; for (let i = 1; i < n; i++) { const mx = (X(i - 1) + X(i)) / 2; d += ` C${mx},${Y(daily[i - 1].revenue)} ${mx},${Y(daily[i].revenue)} ${X(i)},${Y(daily[i].revenue)}`; }
  const grid = [0, .25, .5, .75, 1].map(f => `<line class="gridl" x1="${P.l}" x2="${W - P.r}" y1="${Y(max * f)}" y2="${Y(max * f)}"/><text x="${P.l - 8}" y="${Y(max * f) + 4}" text-anchor="end">${max * f >= 1000 ? Math.round(max * f / 1000) + 'k' : Math.round(max * f)}</text>`).join('');
  return `<div style="position:relative"><svg viewBox="0 0 ${W} ${H}" width="100%" id="lc"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a3d" stop-opacity=".5"/><stop offset="1" stop-color="#ff3d8b" stop-opacity="0"/></linearGradient><linearGradient id="lg"><stop offset="0" stop-color="#ff6a3d"/><stop offset="1" stop-color="#ff3d8b"/></linearGradient></defs>${grid}
    <path class="area" d="${d} L${X(n - 1)},${H - P.b} L${X(0)},${H - P.b}Z" fill="url(#ag)"/><path class="draw" pathLength="1" d="${d}" fill="none" stroke="url(#lg)" stroke-width="3.5" stroke-linecap="round"/>
    ${daily.map((v, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${v.label}</text><rect class="hit" x="${X(i) - (W - P.l - P.r) / (n - 1) / 2}" y="0" width="${(W - P.l - P.r) / (n - 1)}" height="${H}" fill="transparent" data-i="${i}"/><circle class="dot" cx="${X(i)}" cy="${Y(v.revenue)}" r="6" stroke="#fff" stroke-width="2" pointer-events="none"/>`).join('')}</svg><div class="tip" id="tip"></div></div>`;
}
function donut(status) {
  const tot = Object.values(status).reduce((a, b) => a + b, 0) || 1, C = 2 * Math.PI * 70; let off = 0;
  const segs = Object.entries(status).filter(([, v]) => v).map(([k, v]) => { const len = v / tot * C, s = `<circle r="70" cx="90" cy="90" fill="none" stroke="${COL[k]}" stroke-width="22" stroke-dasharray="0 ${C}" data-len="${len}" data-c="${C}" stroke-dashoffset="${-off}"/>`; off += len; return s; }).join('');
  return `<div class="donutwrap"><svg class="donut" viewBox="0 0 180 180" width="190"><g transform="rotate(-90 90 90)"><circle r="70" cx="90" cy="90" fill="none" stroke="var(--card2)" stroke-width="22"/>${segs}</g><text x="90" y="92" text-anchor="middle" style="font-size:30px;font-weight:900;fill:var(--tx)">${tot}</text><text x="90" y="110" text-anchor="middle">orders</text></svg>
    <div class="leg">${Object.entries(status).map(([k, v]) => `<div><i style="background:${COL[k]}"></i>${LABEL[k]} <b>${v}</b></div>`).join('')}</div></div>`;
}
const bars = (rows, key, fmt) => { const m = Math.max(1, ...rows.map(r => r[key])); return rows.map(r => `<div class="bar"><div class="row between"><span>${r.emoji ? r.emoji + ' ' : ''}${esc(r.name)}</span><b>${fmt(r[key])}</b></div><div class="track2"><i data-w="${r[key] / m * 100}"></i></div></div>`).join(''); };
const orderRows = list => list.slice(0, 12).map(o => `<tr data-o="${o.id}"><td><b>#${o.id}</b><div class="mut" style="font-size:12px">${when(o.createdAt)}</div></td><td>${esc(o.userName)}</td><td>${o.restaurantEmoji} ${esc(o.restaurantName)}</td><td><b>${money(o.total)}</b></td><td><span class="status s-${o.status}">${LABEL[o.status]}</span></td>
  <td style="white-space:nowrap">${['DELIVERED', 'CANCELLED'].includes(o.status) ? '<span class="mut">—</span>' : `<button class="btn sm ok" data-adv="${o.id}">Advance ▶</button> <button class="btn sm bad" data-can="${o.id}">✕</button>`}</td></tr>`).join('');

async function viewAdmin() {
  let st = await api('admin/stats'), orders = await api('admin/orders'), seen = new Map(orders.map(o => [o.id, o.status])), sig = '';
  page(`<div class="row between wrap rise"><div><h1 style="font-size:34px">Dashboard</h1><p class="mut">Everything happening on ByteBite, in real time.</p></div><span class="live">LIVE</span></div>
    <div class="kpis" style="margin-top:18px">${[['revenue', '💰', 'Revenue', '₹'], ['orders', '🧾', 'Orders', ''], ['active', '🔥', 'Active now', ''], ['customers', '👥', 'Customers', ''], ['avgOrder', '🧮', 'Avg. order', '₹']].map(([k, i, l], n) => `<div class="glass kpi rise" style="--i:${n}"><div class="ico">${i}</div><div class="l">${l}</div><div class="v" data-k="${k}">0</div></div>`).join('')}</div>
    <div class="dash"><div class="glass panel rise" style="--i:5"><h3>Revenue · last 14 days</h3><div id="chart"></div></div><div class="glass panel rise" style="--i:6"><h3>Order status</h3><div id="donut"></div></div></div>
    <div class="dash" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"><div class="glass panel rise" style="--i:7"><h3>🏆 Top restaurants</h3><div id="topR"></div></div><div class="glass panel rise" style="--i:8"><h3>🍽️ Best sellers</h3><div id="topI"></div></div></div>
    <div class="glass panel rise" style="--i:9;margin-bottom:18px"><h3>Live orders <span class="live">auto-refresh</span></h3><div class="scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Restaurant</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody id="orows"></tbody></table></div></div>
    <div class="glass panel rise" style="--i:10"><h3>Restaurants <button class="btn sm" id="addR">＋ Add restaurant</button></h3><div id="rests"></div></div>`);
  const kpis = s => $$('.v[data-k]').forEach(el => countUp(el, s[el.dataset.k], ['revenue', 'avgOrder'].includes(el.dataset.k) ? '₹' : ''));
  const charts = () => {
    $('#chart').innerHTML = lineChart(st.daily); $('#donut').innerHTML = donut(st.status);
    $('#topR').innerHTML = bars(st.topRestaurants, 'revenue', money); $('#topI').innerHTML = bars(st.topItems, 'qty', v => v + ' sold');
    requestAnimationFrame(() => requestAnimationFrame(() => { $$('.donut circle[data-len]').forEach(c => c.setAttribute('stroke-dasharray', `${c.dataset.len} ${c.dataset.c - c.dataset.len}`)); $$('.track2 i').forEach(i => i.style.width = i.dataset.w + '%'); }));
    const tip = $('#tip'); $('#lc').onmouseover = e => { const r = e.target.closest('.hit'); if (!r) return; const d = st.daily[+r.dataset.i], b = r.getBoundingClientRect(), p = $('#lc').getBoundingClientRect();
      tip.innerHTML = `<b>${d.date}</b><br>${money(d.revenue)} · ${d.orders} orders`; tip.style.left = b.left + b.width / 2 - p.left + 'px'; tip.style.top = '30px'; tip.style.opacity = 1; };
    $('#lc').onmouseleave = () => tip.style.opacity = 0;
  };
  const rows = fresh => { $('#orows').innerHTML = orderRows(orders); if (fresh) $$('#orows tr').forEach(tr => { if (seen.get(tr.dataset.o) !== orders.find(o => o.id === tr.dataset.o).status || !seen.has(tr.dataset.o)) tr.classList.add('flash'); }); seen = new Map(orders.map(o => [o.id, o.status])); };
  const restList = guard(async () => {
    const all = await api('restaurants?sort=name'); $('#rests') && ($('#rests').innerHTML = all.map(r => `<div class="row between wrap" style="padding:12px 0;border-top:1px solid var(--bd)"><div class="row"><span style="font-size:30px">${r.emoji}</span><div><b>${esc(r.name)}</b><div class="mut" style="font-size:13px">${esc(r.cuisine)} · ${r.menuCount} items · ⏱ ${r.etaMinutes}m</div></div></div>
      <div class="row"><label class="sw ${r.open ? 'on' : ''}" data-open="${r.id}" data-v="${r.open}"><i></i>${r.open ? 'Open' : 'Closed'}</label><button class="btn ghost sm" data-menu="${r.id}">Menu</button><button class="btn bad sm" data-del="${r.id}">Delete</button></div></div>`).join(''));
  });
  kpis(st); charts(); rows(false); restList();
  const refresh = async () => { try { st = await api('admin/stats'); orders = await api('admin/orders'); kpis(st); rows(true); const s = JSON.stringify([st.orders, st.status, st.revenue]); if (s !== sig && sig) charts(); sig = s; } catch { } };
  sig = JSON.stringify([st.orders, st.status, st.revenue]); S.timers.push(setInterval(refresh, 3000));
  const menuModal = guard(async id => {
    const r = await api('restaurants/' + id);
    openModal(`<div class="row between"><h2>${r.emoji} ${esc(r.name)} menu</h2><button class="ib" onclick="closeModal()">✕</button></div><div style="margin:14px 0">${r.menu.map(i => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--bd)"><span>${i.emoji} ${esc(i.name)} <span class="mut">${money(i.price)}</span></span><button class="btn bad sm" data-delm="${i.id}">✕</button></div>`).join('') || '<p class="mut">No items yet.</p>'}</div>
      <div class="lbl">Add item</div><div class="row wrap"><input class="field" id="mn" placeholder="Name" style="flex:2;min-width:140px"><input class="field" id="mp" type="number" placeholder="₹ Price" style="flex:1;min-width:90px"></div>
      <div class="row wrap" style="margin-top:8px"><input class="field" id="mc" placeholder="Category" style="flex:1"><input class="field" id="me" placeholder="Emoji" style="width:80px" value="🍽️"><label class="sw" id="mv"><i></i>Veg</label></div><input class="field" id="md" placeholder="Description" style="margin-top:8px"><button class="btn" id="addm" style="width:100%;margin-top:12px">Add to menu</button>`);
    $('#mv').onclick = e => e.currentTarget.classList.toggle('on');
    $('#modal').onclick = guard(async e => {
      if (e.target.id === 'modal') return closeModal();
      if (e.target.dataset.delm) { await api('admin/menu/' + e.target.dataset.delm, 'DELETE'); await menuModal(id); restList(); }
      if (e.target.id === 'addm') { await api(`admin/restaurants/${id}/menu`, 'POST', { name: $('#mn').value, price: +$('#mp').value, category: $('#mc').value || 'Mains', emoji: $('#me').value, description: $('#md').value, veg: $('#mv').classList.contains('on') }); toast('Item added ✨'); await menuModal(id); restList(); }
    });
  });
  app.onclick = guard(async e => {
    const t = e.target, g = a => t.closest(`[${a}]`)?.getAttribute(a);
    if (g('data-adv')) { const o = orders.find(x => x.id === g('data-adv')), nx = ['PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'][['PLACED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(o.status) + 1]; await api(`admin/orders/${o.id}/status`, 'PUT', { status: nx }); refresh(); }
    else if (g('data-can')) { if (await ask('Cancel order?', 'The customer will see it as cancelled.', 'Cancel order')) { await api(`admin/orders/${g('data-can')}/status`, 'PUT', { status: 'CANCELLED' }); refresh(); } }
    else if (g('data-open')) { const l = t.closest('[data-open]'); await api('admin/restaurants/' + l.dataset.open, 'PUT', { open: l.dataset.v !== 'true' }); restList(); }
    else if (g('data-menu')) menuModal(g('data-menu'));
    else if (g('data-del')) { if (await ask('Delete restaurant?', 'Its whole menu will be removed.', 'Delete')) { await api('admin/restaurants/' + g('data-del'), 'DELETE'); toast('Restaurant removed'); S.cuisines = null; restList(); } }
    else if (t.closest('#addR')) {
      openModal(`<h2>New restaurant</h2><div class="lbl">Details</div><input class="field" id="rn" placeholder="Name" style="margin-bottom:8px"><div class="row"><input class="field" id="rc" placeholder="Cuisine"><input class="field" id="re" placeholder="Emoji" value="🍽️" style="width:80px"></div><div class="row" style="margin-top:8px"><input class="field" id="rt" type="number" placeholder="ETA (min)" value="30"><input class="field" id="rf" type="number" placeholder="Delivery ₹" value="30"></div>
        <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" id="saveR">Create</button></div>`);
      $('#saveR').onclick = guard(async () => { await api('admin/restaurants', 'POST', { name: $('#rn').value, cuisine: $('#rc').value || 'Other', emoji: $('#re').value, etaMinutes: +$('#rt').value, deliveryFee: +$('#rf').value }); closeModal(); toast('Restaurant created 🎉'); S.cuisines = null; restList(); });
    }
  });
}

/* ---------- boot ---------- */
(async function init() {
  if (S.token) { try { S.user = await api('auth/me'); S.cart = await api('cart'); } catch { } }
  route();
})();
