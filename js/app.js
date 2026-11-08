import { renderBody, REGIONS } from './body.js';
import { track, startMeasure } from './measure.js';

/* ================================================================
   state
   ================================================================ */

const S = {
  data: null,
  videos: [],
  view: 'front',
  regions: new Set(),
  feelings: new Set(),
  budget: 'any',  // a length band (LENGTHS), not a total: Jen picks 90 min, she means a long class
  level: 'any',
  session: [],       // what the list shows, best first; also the player's queue
  shown: 12,         // rows on screen before "show more"
  lead: null,        // the area whose top three head the list (the last one tapped)
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
];
/* The Body Map features yoga only (Jen, 2026-11-02): massage videos, courses and the
   Massage at Home program are hidden, not deleted; set this false to bring them back.
   "Yoga & Massage Therapy" in Jen's old video titles is her studio name, not massage content. */
const HIDE_MASSAGE = true;
const isMassage = (v) => HIDE_MASSAGE && v.intents.includes('massage')
  && /massag|thai|asmr/i.test(v.title.replace(/(austin )?yoga (&|and) massage( therapy)?/ig, ''));

/* The Architecture of Asana upsell (Jen, 2026-11-02). Off until AA is on sale: its pages send
   visitors home before launch. Turning it on is a step of the final launch sequence
   (09_Build/FINAL_LAUNCH_SEQUENCE.md). ?aa=preview shows it for review. */
const AA_OPEN = true || new URLSearchParams(location.search).get('aa') === 'preview';
const AA = {
  id: 'architecture-of-asana',
  title: 'The Architecture of Asana',
  url: 'https://www.jenhilman.com/the-architecture-of-asana',
  price: '$57',
  line: 'Stop just following the poses. Start understanding them. The Architecture of Asana is 25 pose breakdowns in five modules, and a Pose Library that takes you to the exact moment Jen teaches each detail.',
};
const aaCard = (where) => `
  <a class="offer offer-aa" href="${AA.url}" data-offer="${AA.id}" data-where="${where}" target="_top">
    <span class="offer-kicker">${AA.title}</span>
    <strong class="offer-hook">Looking for more than a playlist?</strong>
    <span>${AA.line}</span>
    <span class="offer-cta">See the course &middot; ${AA.price} &rarr;</span>
  </a>`;

// The bundle includes Massage at Home, so it is not offered while massage is hidden.
const BUNDLE = { title: 'All three programs', price: '$57', save: 'save $24', url: SHOP + 'all-three-guided-programs-with-jen-hilman' };
// Links inside Jen's own sites never carry utm_ tags: Wix would take them as a new source and
// overwrite where the visitor really came from. Which card was pressed is measured instead.
const offerUrl = (o) => o.url;
const offerCard = (o, where) => `
  <a class="offer" href="${offerUrl(o)}" data-offer="${o.id}" data-where="${where}" target="_blank" rel="noopener">
    <span class="offer-kicker">${o.title}</span>
    <strong class="offer-hook">Want a path, not a playlist?</strong>
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
    <a class="program-card" href="${offerUrl(o)}" data-offer="${o.id}" data-where="section" target="_blank" rel="noopener">
      <img class="program-img" src="${o.img}" alt="${o.title} guide pages" loading="lazy">
      <div class="program-txt">
        <span class="eyebrow">${o.kicker}</span>
        <h3>${o.title}</h3>
        <p>${o.line}</p>
        <ul>${o.points.map((p) => `<li>${p}</li>`).join('')}</ul>
        <span class="btn solid">Get it &middot; ${o.price}</span>
      </div>
    </a>`).join('');
  if (HIDE_MASSAGE) { $('#programBundle').innerHTML = ''; return; }
  $('#programBundle').innerHTML = `<a href="${BUNDLE.url}" data-offer="bundle-3" data-where="bundle" target="_blank" rel="noopener">
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
   finding the videos (rebuilt 2026-11-05)

   Jen: "I have selected hamstrings and this list is showing me shoulder
   stretches and videos for back pain. I selected 90 minutes and all the videos
   are less than 30 minutes." The old code built a "session" of mixed videos
   to fill a time budget and let any neighbouring area count. Now:

   - A video answers an area when it is MADE for it (v.focus: its title, every
     video checked by hand in tools/curation.json) or when the class spends
     real time on it (v.works: counted from what Jen says in the class).
   - Made-for videos always come first; the more targeted, the higher.
   - Length and level are filters on the video itself, never a total.
   ================================================================ */

const LENGTHS = {
  any:   { label: 'Any length',           min: 0,       max: Infinity },
  short: { label: 'Under 15 minutes',     min: 0,       max: 15 * 60 },
  mid:   { label: '15 to 25 minutes',     min: 15 * 60, max: 25 * 60 },
  long:  { label: '25 to 45 minutes',     min: 25 * 60, max: 45 * 60 },
  full:  { label: '45 minutes or longer', min: 45 * 60, max: Infinity },
};
const LEVELS = {
  any:      { label: 'Any level' },
  gentle:   { label: 'Gentle: new to yoga or in pain', tag: 'Gentle' },
  moderate: { label: 'Moderate: some yoga experience', tag: 'Moderate' },
  strong:   { label: 'Strong: ready for a workout',    tag: 'Strong' },
};

// With no level chosen, the gentler video wins a tie: anyone can start there.
const LEVEL_EASE = { gentle: 6, moderate: 0, strong: -10 };
const onMap = (v) => v.practice !== false && !v.notJen;
const fitsLength = (v, key = S.budget) => {
  const b = LENGTHS[key] || LENGTHS.any, d = v.duration || 0;
  return d >= b.min && d < b.max;
};
const fitsLevel = (v, key = S.level) => key === 'any' || v.level === key;

/** How well one video answers one area; 0 = not at all. */
function areaScore(v, key) {
  if (v.focus.includes(key)) {
    // made for it: a hamstring class beats a hips-hamstrings-quads class
    // and one that names the area in its title beats one that reaches it through a pose
    return 100 - 7 * (v.focus.length - 1) + 3 * Math.min(2, v.spoken?.[key] || 0)
      + (v.named?.includes(key) ? 12 : 0) + LEVEL_EASE[v.level];
  }
  if (v.works.includes(key)) return 40 + 5 * Math.min(4, v.spoken?.[key] || 1) + LEVEL_EASE[v.level] / 2;
  return 0;
}
const popularity = (v) => Math.log10((v.views || 10) + 1);

/** Every video for one area, best first, ignoring the filters. */
function rankArea(key) {
  return S.videos
    .filter(onMap)
    .map((v) => ({ v, s: areaScore(v, key) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || popularity(b.v) - popularity(a.v))
    .map((x) => x.v);
}

/** Top practices for one area within the chosen length and level. */
const forRegion = (key, limit = 3) =>
  rankArea(key).filter((v) => fitsLength(v) && fitsLevel(v)).slice(0, limit);
const countFor = (key) => rankArea(key).filter((v) => fitsLength(v) && fitsLevel(v)).length;

/** Everything that matches the areas and feelings picked, before length and level. */
function matches() {
  const regions = [...S.regions], feelings = [...S.feelings];
  if (!regions.length && !feelings.length) return [];
  return S.videos
    .filter(onMap)
    .map((v) => {
      let s = 0;
      if (regions.length) {
        // a video for two of the areas you picked beats one for a single area
        for (const r of regions) s += areaScore(v, r);
        if (!s) return null;
      }
      const felt = feelings.filter((f) => v.intents.includes(f)).length;
      if (!regions.length && !felt) return null;
      s += felt * 30;
      return { v, s };
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s || popularity(b.v) - popularity(a.v))
    .map((x) => x.v);
}

function build() {
  let rows = matches().filter((v) => fitsLength(v) && fitsLevel(v));
  // The three in the side panel head the list, in the same order, so what
  // springs out of the body and what is below always agree.
  const lead = S.lead && S.regions.has(S.lead) ? forRegion(S.lead, 3) : [];
  if (lead.length) {
    const ids = new Set(lead.map((v) => v.id));
    rows = [...lead, ...rows.filter((v) => !ids.has(v.id))];
  }
  S.session = rows;
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
    if (!on) { track('body_region_selected', { extra: { region: key } }); S.lead = key; }
    else if (S.lead === key) S.lead = [...S.regions].pop() || null;
    S.shown = 12;
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

      const n = rankArea(key).length;
      tip.innerHTML = `<b>${reg.label}</b><span>${reg.note}</span>
        <i>${n} video${n === 1 ? '' : 's'}</i>`;
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
      ${list.length ? '' : `<p class="reveal-none">Nothing for this area at the length and level you chose. Change them below to see more.</p>`}
      <button class="reveal-more" id="revealMore">${total > 3 ? `See all ${total} videos` : 'See them below'} <span>&darr;</span></button>
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
    $('#practice').scrollIntoView({ behavior: 'smooth' });
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
  $('#hint').textContent = note || 'Tap an area to choose it. Tap it again to remove it.';
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

/* A word for each area, in Jen's voice: what the visitor is probably feeling,
   and that a little care helps. Shown in the green header once they choose. */
const CHEER = {
  head: 'Tension headaches often start in the neck and shoulders. Gentle release there can bring real relief.',
  neck: 'Desks, phones and stress all land here. Slow, easy stretches let your neck soften again.',
  shoulders: 'This is where the day collects. A few minutes of care can help you let it go.',
  chest: 'Opening the chest helps you stand taller and breathe more fully.',
  arms: 'Typing, carrying and gripping add up. Your arms and wrists deserve some care too.',
  'upper-back': 'That ache between the shoulder blades often comes from hours of sitting. Movement helps.',
  'mid-back': 'Twists and side stretches bring ease and space to your ribs and mid back.',
  'low-back': 'Low back pain is so common, and gentle, steady stretching is one of the kindest things you can do for it.',
  core: 'A strong, supported core takes the strain off your back.',
  hips: 'Sitting all day tightens the hips. Opening them often eases the low back too.',
  glutes: 'Tight glutes can pull on the low back and even the sciatic nerve. Slow stretching helps.',
  hamstrings: 'Tight hamstrings pull on the low back. A little patient stretching here goes a long way.',
  quads: 'Strong, supple thighs carry you through the day and protect your knees.',
  knees: 'Knees feel better when the muscles around them are strong and flexible. Go slowly.',
  calves: 'Calves work hard every step you take. Show them some care.',
  feet: 'Your feet hold you up all day. A little attention here helps everything above.',
};
const FEEL_LINE = {
  'pain-relief': 'when something hurts', flexibility: 'when you feel stiff', calm: 'when you feel anxious',
  sleep: "when you can't sleep", energise: 'when your energy is low', strength: 'when you want to get stronger',
  beginner: 'when you are new to yoga', desk: 'after a day at a desk', meditation: 'when you need stillness',
  yin: 'when you want to go slow', prenatal: 'during pregnancy',
};
const listNames = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

function renderHead() {
  const regions = [...S.regions].map((r) => REGIONS[r]);
  const feelings = [...S.feelings];
  const kicker = $('#sessionKicker'), title = $('#sessionTitle'), line = $('#sessionLine');
  if (!regions.length && !feelings.length) {
    kicker.textContent = 'Start here';
    title.textContent = 'Tap the place that needs some care';
    line.textContent = 'Choose an area on the body above, and Jen\'s videos for it will appear right here, best matches first.';
  } else if (regions.length) {
    kicker.textContent = 'Videos for your';
    title.textContent = listNames(regions.map((r) => r.label));
    line.textContent = regions.length === 1
      ? (CHEER[[...S.regions][0]] || 'A little care here goes a long way.')
      : 'Videos made for these areas come first. Take it one video at a time, and listen to your body.';
  } else {
    kicker.textContent = 'Videos for';
    title.textContent = listNames(feelings.map((f) => FEEL_LINE[f] || f));
    line.textContent = 'Breathe, go gently, and stop anywhere that does not feel right.';
  }
}

/** Why this video is in the list, in plain words. */
function whyTag(v) {
  const keys = [...S.regions];
  const made = keys.filter((k) => v.focus.includes(k));
  const names = (ks) => listNames(ks.map((k) => REGIONS[k].short.toLowerCase()));
  if (made.length) return `<span class="tag tag-made">Made for your ${names(made)}</span>`;
  const also = keys.filter((k) => v.works.includes(k));
  if (also.length) return `<span class="tag">Also works your ${names(also)}</span>`;
  return '';
}

/** Option labels carry their own counts, so nobody picks a filter that empties the list. */
function renderFilters() {
  const base = matches();
  const any = S.regions.size || S.feelings.size;
  $('#budget').innerHTML = Object.entries(LENGTHS).map(([k, b]) => {
    const n = base.filter((v) => fitsLength(v, k) && fitsLevel(v)).length;
    return `<option value="${k}"${k === S.budget ? ' selected' : ''}>${b.label}${any ? ` (${n})` : ''}</option>`;
  }).join('');
  $('#level').innerHTML = Object.entries(LEVELS).map(([k, l]) => {
    const n = base.filter((v) => fitsLevel(v, k) && fitsLength(v)).length;
    return `<option value="${k}"${k === S.level ? ' selected' : ''}>${l.label}${any ? ` (${n})` : ''}</option>`;
  }).join('');
}

function renderSession() {
  const list = $('#list');
  renderHead();
  renderFilters();
  const rows = S.session;
  $('#statCount').textContent = rows.length;
  $('#statCountLabel').textContent = rows.length === 1 ? 'video' : 'videos';
  $('#sessionStats').style.display = (S.regions.size || S.feelings.size) ? '' : 'none';
  $('#playAll').style.display = rows.length ? '' : 'none';

  if (!S.regions.size && !S.feelings.size) {
    list.innerHTML = `<div class="empty">
      <span class="script">Start anywhere</span>
      <p>Tap a part of the body above, or choose how you feel.<br>
      Jen's videos for it will appear here, the best matches first.</p>
    </div>`;
    return;
  }

  if (!rows.length) {
    const all = matches().length;
    list.innerHTML = `<div class="empty">
      <span class="script">Nothing quite fits</span>
      <p>None of the ${all} videos for this are ${S.budget !== 'any' ? LENGTHS[S.budget].label.toLowerCase() : ''}${S.budget !== 'any' && S.level !== 'any' ? ' at ' : ''}${S.level !== 'any' ? `the ${LEVELS[S.level].tag.toLowerCase()} level` : ''}.</p>
      <button class="btn solid" id="resetFilters">Show all ${all} videos</button>
    </div>`;
    return;
  }

  const shown = rows.slice(0, S.shown);
  const top = S.session === rows ? 3 : 0;
  list.innerHTML = shown.map((v, i) => `
    <button class="item${i < top ? ' is-top' : ''}" data-play="${v.id}" style="animation-delay:${Math.min(i, 12) * 42}ms">
      <div class="item-thumb">
        <img loading="lazy" src="${thumb(v.id)}" alt="">
        <span class="idx">${i + 1}</span>
        ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ''}
      </div>
      <div>
        ${i < top ? '<span class="top-pick">Top pick</span>' : ''}
        <h4>${v.title}</h4>
        <div class="tags">
          <span class="tag tag-time">${Math.max(1, Math.round((v.duration || 0) / 60))} min</span>
          ${LEVELS[v.level] ? `<span class="tag tag-level tag-${v.level}">${LEVELS[v.level].tag}</span>` : ''}
          ${whyTag(v)}
        </div>
      </div>
    </button>`).join('')
    + (rows.length > S.shown
      ? `<button class="more-rows" id="moreRows">Show ${Math.min(12, rows.length - S.shown)} more videos <span>(${rows.length - S.shown} left)</span></button>`
      : '');
  track('recommendation_viewed', { extra: { videos: rows.length } });
  if (AA_OPEN) { list.insertAdjacentHTML('beforeend', aaCard('session')); track('offer_viewed', { offer_id: AA.id, placement: 'session' }); return; }
  const o = offerFor();
  if (o) { list.insertAdjacentHTML('beforeend', offerCard(o, 'session')); track('offer_viewed', { offer_id: o.id, placement: 'session' }); }
}

function renderLibrary() {
  let rows = S.videos.filter((v) => !v.intents.includes('offstage') && !v.notJen);

  if (S.libRegion) {
    rows = rows.filter((v) => areaScore(v, S.libRegion) > 0);
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
/** Length or level changed: the open panel's three must follow, like the list. */
function refilter() {
  S.shown = 12;
  refresh();
  if (S.revealed) openReveal(S.revealed);
  save();
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
    if (r.budget && LENGTHS[r.budget]) S.budget = r.budget;
    if (r.level && LEVELS[r.level]) S.level = r.level;
    if (r.regions) S.lead = r.regions[r.regions.length - 1] || null;
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
      if (S.lead === k) S.lead = [...S.regions].pop() || null;
      if (S.revealed === k) closeReveal();
      syncRegions(); refresh(); save(); return;
    }

    const df = e.target.closest('[data-drop-feel]');
    if (df) { S.feelings.delete(df.dataset.dropFeel); renderChips(); refresh(); save(); return; }

    if (e.target.id === 'clearAll') {
      S.regions.clear(); S.feelings.clear(); S.lead = null;
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

  $('#budget').addEventListener('change', (e) => { S.budget = e.target.value; refilter(); });
  $('#level').addEventListener('change',  (e) => { S.level  = e.target.value; refilter(); });
  $('#list').addEventListener('click', (e) => {
    if (e.target.closest('#moreRows')) { S.shown += 12; renderSession(); }
    if (e.target.closest('#resetFilters')) { S.budget = 'any'; S.level = 'any'; refilter(); }
  });

  $('#playAll').addEventListener('click', () => { if (S.session[0]) play(S.session[0].id, S.session); });

  $('#next').addEventListener('click', () => {
    const n = S.queue[S.queueAt + 1];
    if (n) play(n.id, S.queue);
  });

  $('#closePlayer').addEventListener('click', closePlayer);
  $('#backToMap').addEventListener('click', () => { closePlayer(); window.scrollTo({ top: $('#studio').getBoundingClientRect().top + window.scrollY - 70 }); });
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
  startMeasure();
  // A program card pressed anywhere on the map (a click, never a sale: Wix confirms the sale).
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-offer]'); if (a) track('offer_clicked', { offer_id: a.dataset.offer, placement: a.dataset.where }); }, true);
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
  S.videos = data.videos.filter((v) => !isMassage(v) && !v.notJen && !v.hidden);
  S.byId = new Map(S.videos.map((v) => [v.id, v]));
  // courses keep only what is still shown; a massage course goes
  S.courses = (data.courses || []).map((c) => ({ ...c, videos: c.videos.filter((id) => S.byId.has(id)) }))
    .filter((c) => c.videos.length >= 2 && !(HIDE_MASSAGE && /massag/i.test(c.title)))
    .map((c) => ({ ...c, seconds: c.videos.reduce((t, id) => t + (S.byId.get(id).duration || 0), 0) }));
  // guided courses skip a hidden video step instead of disappearing
  const hidden = new Set(data.videos.filter(isMassage).map((v) => v.id));
  S.guided = (guided.courses || []).map((c) => ({ ...c, steps: c.steps.filter((st) => st.type !== 'video' || !hidden.has(st.id)) }))
    .filter((c) => c.steps.every((st) => st.type !== 'video' || S.byId.has(st.id)));
  data.intentCounts = {};
  for (const v of S.videos) for (const t of v.intents) data.intentCounts[t] = (data.intentCounts[t] || 0) + 1;
  data.totalSeconds = S.videos.reduce((t, v) => t + (v.duration || 0), 0);
  if (AA_OPEN) {
    const h = $('#heroOffer');
    h.href = AA.url; h.target = '_top'; h.dataset.offer = AA.id; h.dataset.where = 'hero';
    h.innerHTML = "New: <b>The Architecture of Asana</b>, Jen's in-depth course on the poses &rarr;";
  }

  load();

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
