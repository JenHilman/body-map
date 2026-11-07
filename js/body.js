/**
 * body.js — draws the interactive anatomical figure.
 *
 * The figure itself is a rendered PNG (front and back), keyed off its flat
 * magenta background by `tools/prep-body.py`. Everything interactive is drawn over it
 * in SVG.
 *
 * Two consequences of using artwork rather than a generated silhouette:
 *
 *   1. Region positions are stored NORMALISED (0..1 of the image's width and
 *      height) and multiplied up per view. The two renders differ slightly in
 *      pixel size, and normalised coordinates absorb that.
 *   2. The warm glow is confined to the body by an alpha MASK made from the
 *      image itself, which does the job the old clip path did.
 *
 * Region coordinates were measured off the artwork's alpha channel — the row
 * profile in `tools/prep-body.py` prints the landmarks they are based on.
 */

const ART = {
  front: { src: 'img/body-front.png', w: 433, h: 1387 },
  back:  { src: 'img/body-back.png',  w: 435, h: 1382 },
};

/* ---------- regions ---------- */
/* All coordinates are fractions: cx/rx of the image width, cy/ry of its height.
   `both: true` mirrors the blob about the centre line, so only the right-hand
   side is written. `frontBlobs` overrides `blobs` on the front view, for
   regions that sit somewhere different depending on which way the body faces. */

export const REGIONS = {
  head: {
    label: 'Head & Jaw', short: 'Head', views: ['front', 'back'],
    note: 'Headaches, jaw tension, eye strain',
    blobs: [{ cx: 0.50, cy: 0.070, rx: 0.155, ry: 0.078 }],
  },
  neck: {
    label: 'Neck', short: 'Neck', views: ['front', 'back'],
    note: 'Stiffness, text neck, turning your head',
    blobs: [{ cx: 0.50, cy: 0.149, rx: 0.125, ry: 0.032 }],
  },
  shoulders: {
    label: 'Shoulders & Traps', short: 'Shoulders', views: ['front', 'back'],
    note: 'Where the day collects',
    blobs: [
      { cx: 0.795, cy: 0.245, rx: 0.125, ry: 0.046, both: true },
      { cx: 0.50, cy: 0.205, rx: 0.195, ry: 0.033 },
    ],
  },
  chest: {
    label: 'Chest & Heart', short: 'Chest', views: ['front'],
    note: 'Rounded posture, shallow breath',
    blobs: [{ cx: 0.50, cy: 0.296, rx: 0.215, ry: 0.048 }],
  },
  arms: {
    label: 'Arms & Wrists', short: 'Arms', views: ['front', 'back'],
    note: 'Typing, gripping, carrying',
    blobs: [
      { cx: 0.856, cy: 0.360, rx: 0.072, ry: 0.052, both: true },
      { cx: 0.908, cy: 0.445, rx: 0.058, ry: 0.048, both: true },
      { cx: 0.935, cy: 0.508, rx: 0.052, ry: 0.028, both: true },
    ],
  },
  'upper-back': {
    label: 'Upper Back', short: 'Upper back', views: ['back'],
    note: 'Between the shoulder blades',
    blobs: [{ cx: 0.50, cy: 0.292, rx: 0.225, ry: 0.050 }],
  },
  'mid-back': {
    label: 'Mid Back & Ribs', short: 'Mid back', views: ['back'],
    note: 'Side body, ribs, twisting',
    blobs: [{ cx: 0.50, cy: 0.366, rx: 0.205, ry: 0.040 }],
  },
  core: {
    label: 'Core & Belly', short: 'Core', views: ['front'],
    note: 'The support underneath everything',
    blobs: [{ cx: 0.50, cy: 0.415, rx: 0.185, ry: 0.050 }],
  },
  'low-back': {
    label: 'Low Back & Sacrum', short: 'Low back', views: ['front', 'back'],
    note: 'Lumbar ache, sciatica, SI joint',
    // wide and shallow: it reads as a band across the small of the back
    blobs: [{ cx: 0.50, cy: 0.427, rx: 0.215, ry: 0.032 }],
    // From the front the low back is reached through the flanks; centred on the
    // belly it would bury the core region underneath it.
    frontBlobs: [{ cx: 0.700, cy: 0.404, rx: 0.070, ry: 0.038, both: true }],
  },
  hips: {
    label: 'Hips & Psoas', short: 'Hips', views: ['front', 'back'],
    note: 'Tight from sitting, pigeon, hip flexors',
    // at the sides in both views — as one wide central blob it swallowed the
    // sacrum above it and the glutes below
    blobs: [{ cx: 0.735, cy: 0.505, rx: 0.080, ry: 0.040, both: true }],
  },
  glutes: {
    label: 'Glutes & Piriformis', short: 'Glutes', views: ['back'],
    note: 'Deep seat, piriformis, sciatic root',
    blobs: [{ cx: 0.50, cy: 0.527, rx: 0.185, ry: 0.038 }],
  },
  quads: {
    label: 'Quads & Thighs', short: 'Quads', views: ['front'],
    note: 'Front of the leg, lunges',
    blobs: [{ cx: 0.655, cy: 0.625, rx: 0.112, ry: 0.054, both: true }],
  },
  hamstrings: {
    label: 'Hamstrings', short: 'Hamstrings', views: ['back'],
    note: 'Forward folds, back of the leg',
    blobs: [{ cx: 0.655, cy: 0.630, rx: 0.112, ry: 0.054, both: true }],
  },
  knees: {
    label: 'Knees', short: 'Knees', views: ['front', 'back'],
    note: 'Tracking, stability, safe bending',
    blobs: [{ cx: 0.675, cy: 0.706, rx: 0.082, ry: 0.029, both: true }],
  },
  calves: {
    label: 'Calves & Shins', short: 'Calves', views: ['front', 'back'],
    note: 'Standing all day, cramping',
    blobs: [{ cx: 0.690, cy: 0.796, rx: 0.092, ry: 0.046, both: true }],
  },
  feet: {
    label: 'Feet & Ankles', short: 'Feet', views: ['front', 'back'],
    note: 'Arches, plantar fascia, your foundation',
    blobs: [{ cx: 0.705, cy: 0.950, rx: 0.074, ry: 0.043, both: true }],
  },
};

/* ---------- rendering ---------- */

const ell = (b, cls, A) =>
  `<ellipse class="${cls}" cx="${(b.cx * A.w).toFixed(1)}" cy="${(b.cy * A.h).toFixed(1)}"
     rx="${(b.rx * A.w).toFixed(1)}" ry="${(b.ry * A.h).toFixed(1)}"/>`;

/**
 * Build the figure SVG for one view.
 *
 * Layers, bottom to top:
 *   aura    a blurred copy of the artwork, breathing, behind everything
 *   art     the render itself
 *   glows   warm region blobs, blurred as one group and masked to the body
 *   edges   a hairline round each lit region plus a bright core dot
 *   hits    transparent, and the only layer that takes pointer events
 *
 * Glow, edge and hit layers are siblings rather than one group per region, so
 * hover and selection are driven by JS toggling a class on every element
 * carrying the same data-region.
 *
 * @param {'front'|'back'} view
 */
export function renderBody(view) {
  const A = ART[view];

  const parts = { glow: '', edge: '', hit: '' };
  for (const [key, reg] of Object.entries(REGIONS)) {
    if (!reg.views.includes(view)) continue;
    const src = (view === 'front' && reg.frontBlobs) || reg.blobs;
    const shapes = src.flatMap((b) => (b.both ? [b, { ...b, cx: 1 - b.cx }] : [b]));
    const tag = `data-region="${key}"`;

    parts.glow += `<g class="r-glow" ${tag}>${shapes.map((b) => ell(b, 'glow-blob', A)).join('')}</g>`;
    parts.edge += `<g class="r-edge" ${tag}>${
      shapes.map((b) => ell(b, 'edge-blob', A)).join('')}${
      shapes.map((b) => `<circle class="core-dot" cx="${(b.cx * A.w).toFixed(1)}" cy="${(b.cy * A.h).toFixed(1)}" r="3.4"/>`).join('')}</g>`;
    parts.hit += `<g class="region" ${tag} role="button" tabindex="0"
        aria-label="${reg.label}" aria-pressed="false">${shapes.map((b) => ell(b, 'hit-blob', A)).join('')}</g>`;
  }

  const img = (cls, extra = '') =>
    `<image class="${cls}" href="${A.src}" x="0" y="0" width="${A.w}" height="${A.h}"
       preserveAspectRatio="xMidYMid meet"${extra}/>`;

  return `
<svg class="figure" viewBox="0 0 ${A.w} ${A.h}" xmlns="http://www.w3.org/2000/svg"
     preserveAspectRatio="xMidYMid meet" aria-label="Interactive body map, ${view} view">
  <defs>
    <!-- The artwork's own alpha keeps the glow inside the body, exactly as the
         clip path did when the figure was generated. mask-type:alpha matters:
         a luminance mask would read the dark teal as nearly black and erase it. -->
    <mask id="body-${view}" maskUnits="userSpaceOnUse" x="0" y="0"
          width="${A.w}" height="${A.h}" style="mask-type:alpha">
      ${img('mask-art')}
    </mask>

    <radialGradient id="glow-${view}" cx="50%" cy="50%" r="52%">
      <stop offset="0%"   stop-color="#FFF6E2" stop-opacity="1"/>
      <stop offset="34%"  stop-color="#F4D79B" stop-opacity=".97"/>
      <stop offset="68%"  stop-color="#E2BB63" stop-opacity=".82"/>
      <stop offset="90%"  stop-color="#C78725" stop-opacity=".3"/>
      <stop offset="100%" stop-color="#C78725" stop-opacity="0"/>
    </radialGradient>

    <filter id="soften-${view}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${(A.w * 0.022).toFixed(1)}"/>
    </filter>

    <filter id="bloom-${view}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${(A.w * 0.035).toFixed(1)}"/>
    </filter>
  </defs>

  <g class="aura" filter="url(#bloom-${view})">${img('aura-art')}</g>

  ${img('art')}

  <g mask="url(#body-${view})">
    <g class="glows" filter="url(#soften-${view})">${parts.glow}</g>
    <g class="edges">${parts.edge}</g>
  </g>

  <g class="hits">${parts.hit}</g>
</svg>`;
}

export const REGION_KEYS = Object.keys(REGIONS);
