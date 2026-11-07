/* Kuro's measurement on the Body Map (Queendom OS lib/measure.mjs holds the record and the rules).
   Small, nameless events: a visit, a tapped body area, a session shown, a program card shown or
   pressed. Never an email, a name or anything typed (a logged-in member's Wix id rides along so the
   garden can join a visit to a later order; it becomes a keyed hash there and is dropped). Each event has its own id, so a resend is
   kept once. Events wait in this browser's storage and are sent again until the collector takes them.

   Honest limits: nothing is sent when the browser asks not to be tracked (Global Privacy Control
   or Do Not Track), when storage or the network is blocked, or before ENDPOINT is switched on.
   Where the visitor came from reaches this frame only from the jenhilman.com page around it
   (tools/wix-velo/body-map-page.js); without that bridge a visit is recorded as of unknown source. */

// Switched on only when the collector on jenhilman.com exists (tools/wix-velo/README.md).
const ENDPOINT = 'https://www.jenhilman.com/_functions/track'; // collector live on jenhilman.com since 2026-11-06
const VERSION = 1;
const SESSION_GAP = 30 * 60 * 1000;
const MAX_QUEUE = 200;
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id'];
const BRIDGE = /(^|\.)filesusr\.com$|(^|\.)jenhilman\.com$|(^|\.)wixsite\.com$/;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
const env = () => (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) ? 'synthetic'
  : new URLSearchParams(location.search).get('qm_test') === '1' || store.get('bm.test') ? 'test' : 'production');
const device = () => (matchMedia('(max-width: 640px)').matches ? 'mobile' : matchMedia('(max-width: 1024px)').matches ? 'tablet' : 'desktop');

function visitor() { let v = store.get('bm.visitor'); if (!v) { v = id(); store.set('bm.visitor', v); } return v; }
function session() {
  const s = store.get('bm.session');
  const t = Date.now();
  if (s && t - s.last < SESSION_GAP) { s.last = t; store.set('bm.session', s); return s.id; }
  const n = { id: id(), last: t };
  store.set('bm.session', n);
  return n.id;
}

let tags = {};
export function track(name, fields = {}) {
  if (optedOut()) return;
  const ev = {
    event_id: id(), name, version: VERSION, occurred_at: new Date().toISOString(), env: env(),
    visitor_ref: visitor(), session_ref: session(), device: device(), page: location.pathname,
    ...(name === 'body_map_landing_viewed' ? tags : {}), ...fields,
  };
  // the Wix member id from the page around the map: the garden turns it into its lead hash and drops it
  const member = store.get('bm.member');
  if (member) ev.extra = { ...(ev.extra || {}), member_id: member };
  const q = store.get('bm.queue') || [];
  q.push(ev);
  store.set('bm.queue', q.slice(-MAX_QUEUE));
  flush();
}

let sending = false;
async function flush(beacon = false) {
  if (!ENDPOINT || sending) return;
  const q = store.get('bm.queue') || [];
  if (!q.length) return;
  const batch = q.slice(0, 25);
  const body = JSON.stringify({ events: batch });
  const done = () => store.set('bm.queue', (store.get('bm.queue') || []).filter((e) => !batch.some((b) => b.event_id === e.event_id)));
  if (beacon && navigator.sendBeacon) { if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) done(); return; }
  sending = true;
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' });
    if (r.ok) { done(); sending = false; if (q.length > batch.length) flush(); return; }
  } catch { /* offline or blocked: kept for the next try */ }
  sending = false;
  setTimeout(flush, 15000 + Math.random() * 15000);
}

/* The landing: wait a moment for the page around the map to say where the visitor came from. */
export function startMeasure() {
  if (optedOut()) return;
  let sent = false;
  const land = () => { if (!sent) { sent = true; track('body_map_landing_viewed'); } };
  addEventListener('message', (m) => {
    let host = '';
    try { host = new URL(m.origin).hostname; } catch { return; }
    if (!BRIDGE.test(host) || m.data?.type !== 'bm-attribution') return;
    for (const k of UTM) if (typeof m.data[k] === 'string' && m.data[k]) tags[k] = m.data[k].slice(0, 120).toLowerCase();
    if (m.data.qm_test === '1') store.set('bm.test', true);
    if (typeof m.data.member_id === 'string' && /^[0-9a-f-]{20,40}$/i.test(m.data.member_id)) store.set('bm.member', m.data.member_id);
    // Two senders answer: the page code (member id, tags from the address) and the site's custom code
    // (tags saved before sign-up, tools/wix-velo/custom-code-keep-tags.html). Land as soon as tags
    // arrive; a message without them waits for the deadline below in case the other one has them.
    if (UTM.some((k) => tags[k])) land();
  });
  try { window.parent !== window && window.parent.postMessage({ type: 'bm-ready' }, '*'); } catch {}
  setTimeout(land, 2000);
  addEventListener('pagehide', () => flush(true));
  addEventListener('online', () => flush());
  flush();
}
