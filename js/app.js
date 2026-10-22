import { renderBody, REGIONS } from './body.js';

/* ================================================================
   state
   ================================================================ */

const S = {
  data: null,
  videos: [],
  view: 'front',
  regions: new Set(),
  feelings: new Set(),
  budget: '30',   // 'however long' returns four hours of video, which is not a session
  level: 'any',
  session: [],
  queue: [],
  queueAt: 0,
  libCat: 'all',
  libQuery: '',
  libShown: 24,
  byId: new Map(),
  courses: [],
  courseKind: 'all',
  guided: [],        // authored slideshow courses from data/courses.json
  deck: null,
  deckAt: 0,
  courseOpen: null,
  libRegion: null,   // set by "view all videos" in the reveal panel
  revealed: null,    // which region's panel is open
};

const FEELINGS = [
  { key: 'pain-relief', label: 'In pain' },
  { key: 'flexibility', label: 'Stiff' },
  { key: 'calm',        label: 'Anxious' },
  { key: 'sleep',       label: "Can't sleep" },
  { key: 'energise',    label: 'Low energy' },
  { key: 'strength',    label: 'Want strength' },
  { key: 'beginner',    label: 'New to yoga' },
  { key: 'desk',        label: 'Desk-bound' },
  { key: 'meditation',  label: 'Need stillness' },
  { key: 'massage',     label: 'Self-massage' },
  { key: 'yin',         label: 'Go slow (yin)' },
  { key: 'prenatal',    label: 'Pregnant' },
];

/* Paid guided programs, sold on jenhilman.com. Shown when a visitor's picks
   overlap the program's regions, and at the end of the matching free course.
   The videos stay free here; the program sells the path through them. */
const SHOP = 'https://www.jenhilman.com/product-page/';
const OFFERS = [
  {
    id: 'back-21',
    title: 'Your Back, From the Ground Up',
    kicker: '21 day guided practice',
    line: 'A 21 day guided practice: one practice a day, a note from Jen for each, and your own routine at the end.',
    points: ['Week 1: Begin where you are', 'Week 2: The hips hold the back', 'Week 3: Build your support'],
    img: 'img/back-21.jpg',
    price: '$27',
    url: SHOP + 'your-back-from-the-ground-up-21-day-guided-practice',
    regions: ['low-back', 'mid-back', 'hips', 'glutes', 'core', 'hamstrings', 'upper-back'],
    feelings: ['pain-relief'],   // only when no region is picked
    course: 'back-from-the-ground-up',
  },
  {
    id: 'neck-14',
    title: 'Undo the Desk: Neck and Shoulders',
    kicker: '14 day guided practice',
    line: 'A 14 day guided practice for the neck and shoulders, many of the practices in a chair, with a note from Jen for each day.',
    points: ['Week 1: Soften the neck', 'Week 2: Open the front, support the back'],
    img: 'img/neck-14.jpg',
    price: '$27',
    url: SHOP + 'undo-the-desk-neck-and-shoulders-14-day-guided-practice',
    regions: ['neck', 'shoulders', 'head', 'chest', 'upper-back', 'arms'],
    feelings: ['desk'],
    course: 'undo-the-desk',
  },
  {
    id: 'massage-home',
    title: 'Massage at Home',
    kicker: 'Guided course · a lovely gift',
    line: 'Learn to give a loving massage: 14 of Jen\'s video lessons in order, from the back to the feet, ending in a full ritual.',
    points: ['Foundations and the back', 'Head, neck, face, arms and hands', 'Legs and feet', 'A full massage ritual'],
    img: 'img/massage-home.jpg',
    price: '$27',
    url: SHOP + 'massage-at-home-a-guided-course-in-giving-a-loving-massage',
    regions: [],
    feelings: ['massage'],
    course: null,
  },
];
const BUNDLE = { title: 'All three programs', price: '$57', save: 'save $24', url: SHOP + 'all-three-guided-programs-with-jen-hilman' };
const offerUrl = (o, where) => `${o.url}?utm_source=bodymap&utm_medium=site&utm_campaign=${where}`;
const offerCard = (o, where) => `
  <a class="offer" href="${offerUrl(o, where)}" target="_blank" rel="noopener">
    <span class="offer-kicker">Want a path, not a playlist?</span>
    <strong>${o.title}</strong>
    <span>${o.line}</span>
    <span class="offer-cta">Get the guide &middot; ${o.price} &rarr;</span>
  </a>`;
// The program that matches the most of what the visitor picked (regions first,
// then feelings), or nothing when none of them fit.
const offerFor = () => {
  const hits = (o) => [...S.regions].filter((r) => o.regions.includes(r)).length * 10
    + [...S.feelings].filter((f) => o.feelings.includes(f)).length;
  const best = OFFERS.map((o) => [hits(o), o]).sort((a, b) => b[0] - a[0])[0];
  return best && best[0] > 0 ? best[1] : null;
};
function renderPrograms() {
  $('#programGrid').innerHTML = OFFERS.map((o) => `
    <a class="program-card" href="${offerUrl(o, 'section')}" target="_blank" rel="noopener">
      <img class="program-img" src="${o.img}" alt="${o.title} guide pages" loading="lazy">
      <div class="program-txt">
        <span class="eyebrow">${o.kicker}</span>
        <h3>${o.title}</h3>
        <p>${o.line}</p>
        <ul>${o.points.map((p) => `<li>${p}</li>`).join('')}</ul>
        <span class="btn solid">Get it &middot; ${o.price}</span>
      </div>
    </a>`).join('');
  $('#programBundle').innerHTML = `<a href="${BUNDLE.url}?utm_source=bodymap&utm_medium=site&utm_campaign=bundle" target="_blank" rel="noopener">
    <b>${BUNDLE.title}</b> for ${BUNDLE.price} <span>(${BUNDLE.save})</span> &rarr;</a>`;
}

const LIB_CATS = [
  ['all', 'Everything'],
  ['pain-relief', 'Pain relief'],
  ['beginner', 'Beginners'],
  ['flexibility', 'Flexibility'],
  ['strength', 'Strength'],
  ['relax', 'Gentle & restorative'],
  ['yin', 'Yin'],
  ['meditation', 'Meditation'],
  ['massage', 'Massage'],
  ['learn', 'Pose breakdowns'],
  ['chakra', 'Chakra'],
  ['long-form', 'Full classes'],
  ['energise', 'Energising'],
  ['nutrition', 'Nutrition'],
];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const fmt = (sec) => {
  if (!sec) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const clock = (sec) => {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const nice = (t) =>
  ({ 'pain-relief': 'pain relief', 'long-form': 'full class', energise: 'energising',
     learn: 'breakdown', calm: 'calming', relax: 'gentle', desk: 'desk' }[t] || t);

/* ================================================================
   session building
   ================================================================ */

/**
 * What to reach for when a region has little of its own.
 * This is body sense, not string similarity: knee trouble is usually treated
 * through the hips and quads, and low back through the hips and hamstrings —
 * which is exactly how Jen teaches it. It also keeps the thinner regions
 * (knees, calves, arms) from returning an almost-empty session.
 */
const NEAR = {
  head: ['neck', 'shoulders'],
  neck: ['shoulders', 'upper-back', 'head'],
  shoulders: ['neck', 'upper-back', 'chest', 'arms'],
  chest: ['shoulders', 'upper-back'],
  arms: ['shoulders', 'neck', 'upper-back'],
  'upper-back': ['neck', 'shoulders', 'mid-back', 'chest'],
  'mid-back': ['upper-back', 'low-back', 'core'],
  'low-back': ['hips', 'glutes', 'core', 'mid-back', 'hamstrings'],
  core: ['low-back', 'hips'],
  hips: ['low-back', 'glutes', 'hamstrings', 'quads'],
  glutes: ['hips', 'low-back', 'hamstrings'],
  quads: ['hips', 'knees'],
  hamstrings: ['low-back', 'hips', 'knees', 'calves'],
  knees: ['quads', 'hamstrings', 'hips', 'calves'],
  calves: ['feet', 'knees', 'hamstrings'],
  feet: ['calves', 'knees'],
  'whole-body': [],
};

// A practice is more relevant when it addresses a region you actually picked.
// "whole-body" counts, but only faintly — otherwise every flow drowns out the
// video that is genuinely about your neck.
function score(v) {
  let s = 0;
  for (const r of S.regions) {
    if (v.regions.includes(r)) s += 10;
    else if ((NEAR[r] || []).some((n) => v.regions.includes(n))) s += 4;
    else if (v.regions.includes('whole-body')) s += 1.5;
  }
  for (const f of S.feelings) if (v.intents.includes(f)) s += 7;

  if (S.level === 'beginner' && v.intents.includes('beginner')) s += 5;
  if (S.level === 'beginner' && v.intents.includes('strength')) s -= 2;

  // popularity as a gentle tie-breaker, not a driver
  s += Math.log10((v.views || 10) + 1) * 0.6;

  // videos she filed herself are more trustworthy than keyword guesses
  if (v.playlists.length) s += 1.2;

  if (v.intents.includes('offstage')) s -= 25;
  if (v.intents.includes('nutrition') && !S.feelings.has('nutrition')) s -= 6;
  return s;
}

// Order the chosen videos like a class: settle in, do the work, rest.
function phase(v) {
  const i = v.intents;
  if (i.includes('meditation') || i.includes('sleep')) return 2;
  if (i.includes('relax') && !i.includes('strength')) return 2;
  if ((v.duration || 0) <= 660 && (i.includes('learn') || i.includes('beginner'))) return 0;
  return 1;
}

function build() {
  if (!S.regions.size && !S.feelings.size) { S.session = []; return; }

  let pool = S.videos
    .filter((v) => !v.intents.includes('offstage'))
    .map((v) => ({ v, s: score(v) }))
    .filter((x) => x.s > 4)
    .sort((a, b) => b.s - a.s);

  if (S.level === 'beginner') {
    pool = pool.filter((x) => x.v.intents.includes('beginner') || (x.v.duration || 0) <= 2100);
  }

  const cap = S.budget === 'any' ? Infinity : Number(S.budget) * 60;
  const picked = [];
  let total = 0;
  const seenPlaylist = new Map();

  for (const { v } of pool) {
    if (picked.length >= 12) break;
    const d = v.duration || 900;

    if (cap !== Infinity) {
      // leave a little headroom rather than overshooting the time they have
      if (total + d > cap * 1.08) continue;
    }
    // keep one series from swallowing the whole session
    const key = v.playlists[0] || 'none';
    const n = seenPlaylist.get(key) || 0;
    if (n >= 4) continue;

    seenPlaylist.set(key, n + 1);
    picked.push(v);
    total += d;

    if (cap !== Infinity && total >= cap * 0.88) break;
  }

  picked.sort((a, b) => phase(a) - phase(b) || (b.views || 0) - (a.views || 0));
  S.session = picked;
}

/* ================================================================
   figure
   ================================================================ */

function paintFigure() {
  const slot = $('#figureSlot');
  const old = $('.figure', slot);
  const el = document.createElement('div');
  el.innerHTML = renderBody(S.view);
  const svg = el.firstElementChild;
  svg.classList.add('is-out');
  slot.appendChild(svg);

  // Driven by timers, not requestAnimationFrame: rAF is paused while the tab is
  // in the background, which left the previous figure stacked under the new one
  // and both catching pointer events. The fade is cosmetic; the swap is not.
  setTimeout(() => {
    svg.classList.remove('is-out');
    svg.classList.add('is-in');
    if (old) old.classList.add('is-out');
  }, 20);
  if (old) setTimeout(() => old.remove(), 700);

  wireRegions(svg);
  syncRegions();
}

/** Every layer that represents a region: the glow, the ring, and the hit area. */
const layersFor = (key, svg = document) => $$(`[data-region="${key}"]`, svg);

function wireRegions(svg) {
  const tip = $('#tip');
  // Drag across the body to pick up several areas in one gesture.
  let painting = false;
  const stopPainting = () => { painting = false; };
  svg.addEventListener('pointerup', stopPainting);
  svg.addEventListener('pointerleave', stopPainting);
  window.addEventListener('pointerup', stopPainting);

  const select = (key, mode) => {
    const on = S.regions.has(key);
    if (mode === 'add' && on) return;          // painting never un-picks
    on ? S.regions.delete(key) : S.regions.add(key);
    syncRegions(); refresh(); save();
    if (on) { if (S.revealed === key) closeReveal(); }
    else openReveal(key);
  };

  $$('.region', svg).forEach((g) => {
    const key = g.dataset.region;
    const reg = REGIONS[key];

    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      painting = true;
      select(key, 'toggle');
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(key, 'toggle'); }
    });

    g.addEventListener('pointerenter', () => {
      if (painting) select(key, 'add');
      layersFor(key, svg).forEach((el) => el.classList.add('is-hot'));

      const direct = S.videos.filter((v) => v.regions.includes(key)).length;
      const near = S.videos.filter(
        (v) => !v.regions.includes(key) && (NEAR[key] || []).some((n) => v.regions.includes(n))
      ).length;
      tip.innerHTML = `<b>${reg.label}</b><span>${reg.note}</span>
        <i>${direct} focused${near ? ` · ${near} related` : ''}</i>`;
      // Park the label clear of the silhouette, on whichever side the region
      // sits, and centre it on that region's height. Over the body it hid the
      // thing you were pointing at.
      const box = g.getBoundingClientRect();
      const host = $('.stage-inner').getBoundingClientRect();
      const body = $('.art', svg).getBoundingClientRect();
      const onLeft = box.left + box.width / 2 < body.left + body.width / 2;

      tip.dataset.side = onLeft ? 'left' : 'right';
      tip.style.left = `${(onLeft ? body.left - 12 : body.right + 12) - host.left}px`;
      tip.style.top = `${box.top + box.height / 2 - host.top}px`;
      tip.classList.add('on');
      setFoot(reg.note);
    });

    g.addEventListener('pointerleave', () => {
      layersFor(key, svg).forEach((el) => el.classList.remove('is-hot'));
      tip.classList.remove('on');
      setFoot();
    });
  });
}

/* ================================================================
   the reveal panel — springs out of the region you just chose
   ================================================================ */

/** Top practices for one region, best first. */
function forRegion(key, limit = 3) {
  return S.videos
    .filter((v) => !v.intents.includes('offstage'))
    .map((v) => {
      let s = 0;
      if (v.regions.includes(key)) s += 10;
      else if ((NEAR[key] || []).some((n) => v.regions.includes(n))) s += 4;
      else if (v.regions.includes('whole-body')) s += 1;
      if (!s) return null;
      if (v.playlists.length) s += 1.2;
      s += Math.log10((v.views || 10) + 1) * 0.6;
      return { v, s };
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.v);
}

const countFor = (key) => S.videos.filter(
  (v) => !v.intents.includes('offstage') &&
    (v.regions.includes(key) || (NEAR[key] || []).some((n) => v.regions.includes(n)))
).length;

const PLAY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.8v12.4L14 8z"/></svg>';

function closeReveal() {
  const host = $('#reveal');
  const slot = $('#figureSlot');
  if (slot) slot.style.setProperty('--shift', '0px');
  const card = $('.reveal-card', host);
  S.revealed = null;
  if (!card) { host.innerHTML = ''; return; }
  card.classList.add('closing');
  setTimeout(() => { if (!S.revealed) host.innerHTML = ''; }, 280);
}

/**
 * Open the panel for a region: a tab pinned beside the body, a hairline curving
 * out from the lit spot, and the card scaling up from that same point — so the
 * whole thing reads as unfolding out of the body rather than appearing over it.
 */
function openReveal(key) {
  const host = $('#reveal');
  const stage = $('.stage-inner');
  const svg = $('.figure.is-in', stage) || $('.figure', stage);
  if (!svg) return;

  const reg = REGIONS[key];
  const g = $(`.hits [data-region="${key}"]`, svg);
  if (!g) return;

  const slot = $('#figureSlot');
  const hostBox = stage.getBoundingClientRect();
  const body = $('.art', svg).getBoundingClientRect();
  const b = g.getBoundingClientRect();

  const bodyRight = body.right - hostBox.left;
  const bodyLeft = body.left - hostBox.left;
  const side = (hostBox.width - bodyRight) >= bodyLeft ? 'right' : 'left';

  const GAP = 40, EDGE = 8;
  const CARD_W = Math.min(258, Math.max(196, hostBox.width - bodyRight - GAP - EDGE, hostBox.width * 0.36));

  // The stage is rarely wide enough for body + gap + card, so the figure steps
  // aside to make the room — which also reads as the body presenting the panel.
  let shift = 0;
  if (side === 'right') {
    shift = -Math.max(0, (bodyRight + GAP + CARD_W + EDGE) - hostBox.width);
  } else {
    shift = Math.max(0, (CARD_W + GAP + EDGE) - bodyLeft);
  }
  slot.style.setProperty('--shift', `${shift.toFixed(0)}px`);

  // anchor = centre of the lit region, in stage coordinates, after the step aside
  const ax = b.left + b.width / 2 - hostBox.left + shift;
  const ay = b.top + b.height / 2 - hostBox.top;

  const cx = side === 'right'
    ? bodyRight + shift + GAP
    : Math.max(EDGE, bodyLeft + shift - GAP - CARD_W);

  const list = forRegion(key, 3);
  const total = countFor(key);

  // Insert first, measure second: the card's height depends on its titles, and
  // guessing it left the panel hanging off the bottom of the stage.
  host.innerHTML = `
    <div class="reveal-card" style="left:${cx.toFixed(0)}px; width:${CARD_W.toFixed(0)}px;
         --ox:${side === 'right' ? '0%' : '100%'}; --dx:${side === 'right' ? '-18px' : '18px'}">
      <button class="reveal-close" aria-label="Close">&times;</button>
      <div class="reveal-head">
        <h3>${reg.label}</h3>
        <p>${reg.note}</p>
      </div>
      <div class="reveal-list">
        ${list.map((v, i) => `
          <button class="rv" data-play="${v.id}" style="animation-delay:${150 + i * 95}ms">
            <div class="rv-thumb">
              <img loading="lazy" src="${thumb(v.id)}" alt="">
              <span class="rv-play">${PLAY_ICON}</span>
              ${v.duration ? `<span class="rv-dur">${clock(v.duration)}</span>` : ''}
            </div>
            <h4>${v.title}</h4>
          </button>`).join('')}
      </div>
      <button class="reveal-more" id="revealMore">View all ${total} videos <span>&rarr;</span></button>
    </div>`;

  const card = $('.reveal-card', host);
  const cardH = card.offsetHeight;
  const cy = Math.max(EDGE, Math.min(ay - cardH * 0.34, hostBox.height - cardH - EDGE));
  card.style.top = `${cy.toFixed(0)}px`;
  card.style.setProperty('--oy', `${Math.max(0, Math.min(100, ((ay - cy) / cardH) * 100)).toFixed(0)}%`);

  const tabX = side === 'right' ? cx + 20 : cx + CARD_W - 20;
  const tabY = cy - 18;
  const joinX = side === 'right' ? tabX - 8 : tabX + 8;

  card.insertAdjacentHTML('beforebegin', `
    <svg class="reveal-line" aria-hidden="true">
      <path d="M ${ax.toFixed(1)} ${ay.toFixed(1)}
               C ${((ax + joinX) / 2).toFixed(1)} ${ay.toFixed(1)},
                 ${((ax + joinX) / 2).toFixed(1)} ${(tabY + 15).toFixed(1)},
                 ${joinX.toFixed(1)} ${(tabY + 15).toFixed(1)}"/>
    </svg>
    <div class="reveal-tab" style="left:${tabX.toFixed(0)}px; top:${tabY.toFixed(0)}px;
         --tdx:${side === 'right' ? '-8px' : '8px'}">${reg.short}</div>`);

  S.revealed = key;

  $('.reveal-close', host).addEventListener('click', closeReveal);
  $('#revealMore', host).addEventListener('click', () => {
    closeReveal();
    S.libRegion = key;
    S.libCat = 'all';
    S.libQuery = '';
    S.libShown = 24;
    $('#search').value = '';
    $$('[data-cat]').forEach((x) => x.classList.toggle('on', x.dataset.cat === 'all'));
    renderLibrary();
    $('#library').scrollIntoView({ behavior: 'smooth' });
  });
}

/** The figure leans very slightly towards the cursor. */
function wireTilt() {
  const stage = $('.stage-inner');
  const slot = $('#figureSlot');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    slot.style.setProperty('--tilt-y', `${(x * 9).toFixed(2)}deg`);
    slot.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
  });
  stage.addEventListener('pointerleave', () => {
    slot.style.setProperty('--tilt-y', '0deg');
    slot.style.setProperty('--tilt-x', '0deg');
  });
}

function setFoot(note) {
  const n = S.regions.size;
  $('#selCount').textContent = n
    ? `${n} area${n > 1 ? 's' : ''} selected`
    : 'No areas selected';
  $('#hint').textContent = note || 'Tap an area to add or remove';
}

function syncRegions() {
  // every layer carrying the region — glow, ring and hit area — moves together
  $$('[data-region]').forEach((el) => {
    const on = S.regions.has(el.dataset.region);
    el.classList.toggle('is-on', on);
    if (el.classList.contains('region')) el.setAttribute('aria-pressed', String(on));
  });
  setFoot();
}

/* ================================================================
   rendering
   ================================================================ */

function renderChips() {
  $('#chips').innerHTML = FEELINGS.map((f) => {
    const n = S.videos.filter((v) => v.intents.includes(f.key)).length;
    if (!n) return '';
    return `<button class="chip${S.feelings.has(f.key) ? ' on' : ''}" data-feel="${f.key}">
      ${f.label}<span class="n">${n}</span></button>`;
  }).join('');
}

function renderPicked() {
  const bits = [];
  for (const r of S.regions) {
    bits.push(`<span class="pill">${REGIONS[r].short}<button data-drop-region="${r}" aria-label="Remove">&times;</button></span>`);
  }
  for (const f of S.feelings) {
    const lab = FEELINGS.find((x) => x.key === f)?.label || f;
    bits.push(`<span class="pill">${lab}<button data-drop-feel="${f}" aria-label="Remove">&times;</button></span>`);
  }
  if (bits.length > 1) bits.push('<button class="pill clear" id="clearAll">clear all</button>');
  $('#picked').innerHTML = bits.join('');
}

function renderSession() {
  const list = $('#list');
  const secs = S.session.reduce((a, v) => a + (v.duration || 0), 0);

  $('#statCount').textContent = S.session.length || '—';
  $('#statTime').textContent = S.session.length ? fmt(secs) : '—';
  $('#playAll').style.display = S.session.length ? '' : 'none';

  if (!S.session.length) {
    list.innerHTML = `<div class="empty">
      <span class="script">Start anywhere</span>
      <p>Tap a part of the body, or pick how you feel.<br>
      Jen's ${S.videos.length} practices will arrange themselves around it.</p>
    </div>`;
    return;
  }

  list.innerHTML = S.session.map((v, i) => `
    <button class="item" data-play="${v.id}" style="animation-delay:${i * 42}ms">
      <div class="item-thumb">
        <img loading="lazy" src="${thumb(v.id)}" alt="">
        <span class="idx">${i + 1}</span>
        ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ''}
      </div>
      <div>
        <h4>${v.title}</h4>
        <div class="tags">${v.intents.filter((t) => t !== 'offstage').slice(0, 3).map((t) => `<span class="tag">${nice(t)}</span>`).join('')}</div>
      </div>
    </button>`).join('');
  const o = offerFor();
  if (o) list.insertAdjacentHTML('beforeend', offerCard(o, 'session'));
}

function renderLibrary() {
  let rows = S.videos.filter((v) => !v.intents.includes('offstage'));

  if (S.libRegion) {
    rows = rows.filter((v) => v.regions.includes(S.libRegion)
      || (NEAR[S.libRegion] || []).some((n) => v.regions.includes(n)));
  }
  if (S.libCat !== 'all') rows = rows.filter((v) => v.intents.includes(S.libCat));
  if (S.libQuery) {
    const q = S.libQuery.toLowerCase();
    rows = rows.filter((v) => (v.title + ' ' + v.desc).toLowerCase().includes(q));
  }

  $('#libCount').textContent = S.libRegion
    ? `${rows.length} for ${REGIONS[S.libRegion].label.toLowerCase()} — show everything`
    : `${rows.length} practice${rows.length === 1 ? '' : 's'}`;
  $('#libCount').classList.toggle('clickable', !!S.libRegion);
  const shown = rows.slice(0, S.libShown);

  $('#grid').innerHTML = shown.map((v, i) => `
    <button class="card" data-play="${v.id}" style="animation-delay:${Math.min(i, 24) * 26}ms">
      <div class="card-thumb">
        <img loading="lazy" src="${thumb(v.id)}" alt="">
        ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ''}
      </div>
      <div class="card-body">
        <h4>${v.title}</h4>
        <div class="tags">${v.intents.filter((t) => t !== 'offstage').slice(0, 3).map((t) => `<span class="tag">${nice(t)}</span>`).join('')}</div>
      </div>
    </button>`).join('') || '<p class="empty">Nothing matches that yet — try a shorter word.</p>';

  $('#more').style.display = rows.length > S.libShown ? '' : 'none';
}

function refresh() {
  build();
  renderPicked();
  renderSession();
}

/* ================================================================
   player
   ================================================================ */

function play(id, queue) {
  const v = S.videos.find((x) => x.id === id);
  if (!v) return;
  S.queue = queue || S.session.slice();
  S.queueAt = Math.max(0, S.queue.findIndex((x) => x.id === id));

  $('#frame').innerHTML =
    `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
       title="${v.title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture"
       allowfullscreen></iframe>`;
  $('#playTitle').textContent = v.title;

  const hasNext = S.queueAt > -1 && S.queueAt < S.queue.length - 1;
  $('#next').style.display = hasNext ? '' : 'none';
  $('#next').textContent = hasNext ? `Next: ${S.queue[S.queueAt + 1].title.slice(0, 44)}…` : '';

  $('#player').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  $('#player').classList.remove('on');
  $('#frame').innerHTML = '';
  // the player can open on top of the course view — don't unlock the page
  // underneath while that is still up
  document.body.style.overflow = $('#courseView').classList.contains('on') ? 'hidden' : '';
}

/* ================================================================
   persistence
   ================================================================ */

const save = () => {
  try {
    localStorage.setItem('jh.state', JSON.stringify({
      regions: [...S.regions], feelings: [...S.feelings],
      budget: S.budget, level: S.level, view: S.view,
    }));
  } catch { /* private window — the page still works, it just forgets */ }
};

const load = () => {
  try {
    const r = JSON.parse(localStorage.getItem('jh.state') || '{}');
    if (r.regions) S.regions = new Set(r.regions);
    if (r.feelings) S.feelings = new Set(r.feelings);
    if (r.budget) S.budget = r.budget;
    if (r.level) S.level = r.level;
    if (r.view) S.view = r.view;
  } catch { /* ignore */ }
};

/* ================================================================
   wiring
   ================================================================ */

function wire() {
  // view toggle
  $$('.view-toggle button').forEach((b) => b.addEventListener('click', () => {
    if (S.view === b.dataset.view) return;
    S.view = b.dataset.view;
    closeReveal();
    $$('.view-toggle button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    paintFigure(); save();
  }));

  // feelings + pill removal (delegated)
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-feel]');
    if (chip) {
      const k = chip.dataset.feel;
      S.feelings.has(k) ? S.feelings.delete(k) : S.feelings.add(k);
      chip.classList.toggle('on');
      refresh(); save(); return;
    }

    const dr = e.target.closest('[data-drop-region]');
    if (dr) {
      const k = dr.dataset.dropRegion;
      S.regions.delete(k);
      if (S.revealed === k) closeReveal();
      syncRegions(); refresh(); save(); return;
    }

    const df = e.target.closest('[data-drop-feel]');
    if (df) { S.feelings.delete(df.dataset.dropFeel); renderChips(); refresh(); save(); return; }

    if (e.target.id === 'clearAll') {
      S.regions.clear(); S.feelings.clear();
      closeReveal(); syncRegions(); renderChips(); refresh(); save(); return;
    }

    const p = e.target.closest('[data-play]');
    if (p) {
      if (p.dataset.coursePlay) {
        const c = S.courses.find((x) => x.id === p.dataset.coursePlay);
        play(p.dataset.play, c ? courseVideos(c) : null);
        return;
      }
      const standalone = p.closest('#grid') || p.closest('#reveal');
      play(p.dataset.play, standalone ? null : S.session);
      return;
    }

    const cat = e.target.closest('[data-cat]');
    if (cat) {
      S.libCat = cat.dataset.cat; S.libShown = 24;
      $$('[data-cat]').forEach((x) => x.classList.toggle('on', x === cat));
      renderLibrary(); return;
    }
  });

  $('#budget').addEventListener('change', (e) => { S.budget = e.target.value; refresh(); save(); });
  $('#level').addEventListener('change',  (e) => { S.level  = e.target.value; refresh(); save(); });

  $('#playAll').addEventListener('click', () => { if (S.session[0]) play(S.session[0].id, S.session); });

  $('#next').addEventListener('click', () => {
    const n = S.queue[S.queueAt + 1];
    if (n) play(n.id, S.queue);
  });

  $('#closePlayer').addEventListener('click', closePlayer);
  $('#player').addEventListener('click', (e) => { if (e.target.id === 'player') closePlayer(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#player').classList.contains('on')) closePlayer();
    else if ($('#deck').classList.contains('on')) closeDeck();
    else if ($('#courseView').classList.contains('on')) closeCourse();
    else if ($('.reveal-card')) closeReveal();
  });

  let t;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { S.libQuery = e.target.value.trim(); S.libShown = 24; renderLibrary(); }, 160);
  });

  $('#more').addEventListener('click', () => { S.libShown += 24; renderLibrary(); });

  $('#libCount').addEventListener('click', () => {
    if (!S.libRegion) return;
    S.libRegion = null; S.libShown = 24; renderLibrary();
  });

  // the panel is positioned from measured layout, so a resize invalidates it
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(closeReveal, 120); });
}

/* ================================================================
   boot
   ================================================================ */

(async function init() {
  let data, guided = { courses: [] };
  try {
    data = await fetch('data/videos.json').then((r) => r.json());
    // Authored courses are optional: a missing or broken file must not take the
    // rest of the page down with it.
    guided = await fetch('data/courses.json').then((r) => r.json()).catch(() => ({ courses: [] }));
  } catch (err) {
    $('#list').innerHTML =
      `<div class="empty"><span class="script">Hmm</span>
       <p>Couldn't load the catalogue. This page needs a local server —<br>
       run <code>./start.command</code> in the project folder rather than opening the file directly.</p></div>`;
    return;
  }

  S.data = data;
  S.videos = data.videos;
  S.byId = new Map(data.videos.map((v) => [v.id, v]));
  S.courses = data.courses || [];
  S.guided = (guided.courses || []).filter((c) => c.steps.every((st) => st.type !== 'video' || S.byId.has(st.id)));

  load();

  $('#budget').value = S.budget;
  $('#level').value = S.level;
  $$('.view-toggle button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.view === S.view)));

  $('#cats').innerHTML = LIB_CATS
    .filter(([k]) => k === 'all' || (data.intentCounts[k] || 0) > 0)
    .map(([k, l]) => `<button class="chip${k === 'all' ? ' on' : ''}" data-cat="${k}">${l}
      ${k === 'all' ? '' : `<span class="n">${data.intentCounts[k]}</span>`}</button>`).join('');

  $('#totalVideos').textContent = S.videos.length;
  $('#totalHours').textContent = Math.round(data.totalSeconds / 3600);

  paintFigure();
  wireTilt();
  renderChips();
  wire();
  refresh();
  renderCourses();
  renderPrograms();
  wireCourses();
  wireDeck();
  renderLibrary();
})();

/* ================================================================
   courses
   ================================================================ */

const courseVideos = (c) => c.videos.map((id) => S.byId.get(id)).filter(Boolean);

function renderCourses() {
  const guided = S.guided.map((c) => ({ ...c, kind: 'guided' }));
  const all = [...guided, ...S.courses];
  const rows = all.filter((c) => S.courseKind === 'all' || c.kind === S.courseKind);
  $('#courseCount').textContent = S.courseKind === 'guided'
    ? `${rows.length} guided courses — practices with the teaching in between`
    : `${rows.length} courses — guided courses, her own collections, and the series she taught in parts`;

  $('#courseGrid').innerHTML = rows.map((c, i) => {
    const isGuided = c.kind === 'guided';
    const vids = isGuided ? c.steps.filter((s) => s.type === 'video') : null;
    const cover = isGuided ? c.cover : c.videos[0];
    const secs = isGuided
      ? vids.reduce((t, s) => t + (S.byId.get(s.id)?.duration || 0), 0)
      : c.seconds;
    const badge = isGuided ? 'Guided course' : c.kind === 'series' ? 'Series' : 'Collection';
    const count = isGuided ? `${c.steps.length} steps` : `${c.videos.length} parts`;
    return `
      <button class="course${isGuided ? ' is-guided' : ''}"
              ${isGuided ? `data-deck="${c.id}"` : `data-course="${c.id}"`}
              style="animation-delay:${Math.min(i, 16) * 30}ms">
        <div class="course-cover">
          <span class="course-badge">${badge}</span>
          <img loading="lazy" src="${thumb(cover)}" alt="">
          <div class="course-stats"><span>${count}</span><span>${fmt(secs)}</span></div>
        </div>
        <div class="course-body">
          <h4>${c.title}</h4>
          <p>${c.blurb}</p>
        </div>
      </button>`;
  }).join('');
}

function openCourse(id) {
  const c = S.courses.find((x) => x.id === id);
  if (!c) return;
  const vids = courseVideos(c);
  S.courseOpen = c;

  $('#cvKind').textContent = c.kind === 'series' ? 'A series, in order' : 'A collection by Jen';
  $('#cvTitle').textContent = c.title;
  $('#cvBlurb').textContent = c.blurb;
  $('#cvMeta').textContent = `${vids.length} parts · ${fmt(c.seconds)}`;

  $('#cvList').innerHTML = vids.map((v, i) => `
    <button class="item" data-play="${v.id}" data-course-play="${c.id}" style="animation-delay:${i * 34}ms">
      <div class="item-thumb">
        <img loading="lazy" src="${thumb(v.id)}" alt="">
        <span class="idx">${i + 1}</span>
        ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ''}
      </div>
      <div>
        <h4>${v.title}</h4>
        <div class="tags">${v.intents.filter((t) => t !== 'offstage').slice(0, 3)
          .map((t) => `<span class="tag">${nice(t)}</span>`).join('')}</div>
      </div>
    </button>`).join('');

  $('#courseView').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeCourse() {
  $('#courseView').classList.remove('on');
  S.courseOpen = null;
  // the player may have opened on top of this; don't unlock scroll underneath it
  if (!$('#player').classList.contains('on')) document.body.style.overflow = '';
}

function wireCourses() {
  document.addEventListener('click', (e) => {
    const deckCard = e.target.closest('[data-deck]');
    if (deckCard) { openDeck(deckCard.dataset.deck); return; }

    const card = e.target.closest('[data-course]');
    if (card) { openCourse(card.dataset.course); return; }

    const tab = e.target.closest('[data-ckind]');
    if (tab) {
      S.courseKind = tab.dataset.ckind;
      $$('[data-ckind]').forEach((x) => x.classList.toggle('on', x === tab));
      renderCourses();
    }
  });

  $('#cvClose').addEventListener('click', closeCourse);
  $('#courseView').addEventListener('click', (e) => { if (e.target.id === 'courseView') closeCourse(); });
  $('#cvStart').addEventListener('click', () => {
    const vids = courseVideos(S.courseOpen);
    if (vids.length) play(vids[0].id, vids);
  });
}

/* ================================================================
   guided courses — the slideshow
   ================================================================ */

/** Minimal inline markup: **bold** and *italic* only, on escaped text. */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (t) => esc(t)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

const PLAY_BIG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18l15-9z"/></svg>';

const deckProgressKey = (id) => `jh.deck.${id}`;

function renderSlide() {
  const c = S.deck, i = S.deckAt, step = c.steps[i];
  const stage = $('#deckStage');

  $('#deckStep').textContent = `${i + 1} / ${c.steps.length}`;
  $('#deckFill').style.width = `${((i + 1) / c.steps.length) * 100}%`;
  $$('#deckDots i').forEach((d, n) => {
    d.className = n === i ? 'now' : n < i ? 'done' : '';
  });
  $('#deckPrev').disabled = i === 0;
  $('#deckNext').disabled = i === c.steps.length - 1;

  const links = (step.links || []).map((l) => `
    <a href="${l.url}" target="_blank" rel="noopener">
      <span class="ll"><b>${esc(l.label)}</b><span>${esc(l.source)}</span></span>
      <span class="lg">&#8599;</span>
    </a>`).join('');

  if (step.type === 'video') {
    const v = S.byId.get(step.id);
    stage.innerHTML = `
      <div class="slide slide-video">
        <span class="eyebrow">Session ${c.steps.slice(0, i + 1).filter((s) => s.type === 'video').length}
          of ${c.steps.filter((s) => s.type === 'video').length}</span>
        <h3>${esc(v.title)}</h3>
        <div class="slide-frame" id="slideFrame">
          <button class="slide-poster" id="slidePlay" aria-label="Play this session">
            <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="">
            <span class="pp">${PLAY_BIG}</span>
          </button>
        </div>
        <div class="slide-meta"><span>${clock(v.duration)}</span><span>${
          v.intents.filter((t) => t !== 'offstage').slice(0, 3).map(nice).join(' · ')}</span></div>
        ${step.why ? `<p class="slide-why">${rich(step.why)}</p>` : ''}
        ${step.cue ? `<div class="slide-cue"><b>While you practise</b>${rich(step.cue)}</div>` : ''}
      </div>`;

    // Load the iframe only on click — three embeds per course would otherwise
    // all start fetching as you page through.
    $('#slidePlay').addEventListener('click', () => {
      $('#slideFrame').innerHTML =
        `<iframe src="https://www.youtube.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1"
           title="${esc(v.title).replace(/"/g, '&quot;')}"
           allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    });
    return;
  }

  if (step.type === 'finish') {
    stage.innerHTML = `
      <div class="slide">
        <span class="eyebrow">${esc(step.eyebrow || '')}</span>
        <h3>${esc(step.title)}</h3>
        ${(step.body || []).map((b) => `<p>${rich(b)}</p>`).join('')}
        ${step.next ? `<div class="slide-next">${step.next.map((n) => `
          <button data-goto-course="${n.course}">${esc(n.label)} <span>&rarr;</span></button>`).join('')}</div>` : ''}
        ${links ? `<div class="slide-links">${links}</div>` : ''}
        ${(() => { const o = OFFERS.find((x) => x.course === S.deck?.id); return o ? offerCard(o, 'course-finish') : ''; })()}
      </div>`;
    $$('[data-goto-course]', stage).forEach((b) => b.addEventListener('click', () => {
      closeDeck();
      openCourse(b.dataset.gotoCourse);
    }));
    return;
  }

  // lesson and safety
  stage.innerHTML = `
    <div class="slide${step.type === 'safety' ? ' is-safety' : ''}">
      <span class="eyebrow">${esc(step.eyebrow || '')}</span>
      <h3>${esc(step.title)}</h3>
      ${(step.body || []).map((b) => `<p>${rich(b)}</p>`).join('')}
      ${step.points ? `<ul class="slide-points">${step.points.map((p) => `<li>${rich(p)}</li>`).join('')}</ul>` : ''}
      ${links ? `<div class="slide-links">${links}</div>` : ''}
      ${step.note ? `<p class="slide-note">${rich(step.note)}</p>` : ''}
    </div>`;
}

function goToSlide(n) {
  S.deckAt = Math.max(0, Math.min(n, S.deck.steps.length - 1));
  try { localStorage.setItem(deckProgressKey(S.deck.id), String(S.deckAt)); } catch { /* private window */ }
  renderSlide();
  $('#deckStage').scrollTop = 0;
}

function openDeck(id, { resume = true } = {}) {
  const c = S.guided.find((x) => x.id === id);
  if (!c) return;
  S.deck = c;

  $('#deckKicker').textContent = c.kicker;
  $('#deckTitle').textContent = c.title;
  $('#deckDots').innerHTML = c.steps.map((_, n) => `<i data-slide="${n}"></i>`).join('');
  $$('#deckDots i').forEach((d) => d.addEventListener('click', () => goToSlide(Number(d.dataset.slide))));

  let at = 0;
  if (resume) {
    try { at = Number(localStorage.getItem(deckProgressKey(id))) || 0; } catch { /* ignore */ }
  }
  S.deckAt = Math.min(at, c.steps.length - 1);

  $('#deck').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderSlide();
}

function closeDeck() {
  $('#deck').classList.remove('on');
  $('#deckStage').innerHTML = '';      // stops any playing embed
  S.deck = null;
  document.body.style.overflow = '';
}

function wireDeck() {
  $('#deckClose').addEventListener('click', closeDeck);
  $('#deckPrev').addEventListener('click', () => goToSlide(S.deckAt - 1));
  $('#deckNext').addEventListener('click', () => goToSlide(S.deckAt + 1));

  document.addEventListener('keydown', (e) => {
    if (!S.deck) return;
    // e.target is not always an Element (it can be the document), and calling
    // .matches on that throws — which silently killed arrow-key navigation.
    const el = e.target instanceof Element ? e.target : null;
    if (el && el.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goToSlide(S.deckAt + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToSlide(S.deckAt - 1); }
  });
}
