// The morning market watch. Reads Apple's public App Store feeds (no key) and saves:
//   numbers/<date>.json   today's charts, who is new on the earning charts, and kinds of
//                         app arriving together (what the daily job chooses an app by)
//   numbers/latest.json   the same, for whoever reads it next
//   numbers/apps.json     what is known about every app seen so far (ratings as of `seen`,
//                         refreshed weekly)
// A chart rank is an order, not dollars: in a quiet category an app with a handful
// of ratings can sit in the top 100 by earnings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'numbers');
const today = new Date().toISOString().slice(0, 10);
// Asked for twice a morning because GitHub's clock runs late; the second run finds the day done.
if (fs.existsSync(path.join(out, `${today}.json`)) && !process.argv.includes('--again')) {
  console.log(`${today}: already saved`);
  process.exit(0);
}

const CATEGORIES = { 6000: 'Business', 6001: 'Weather', 6002: 'Utilities', 6003: 'Travel', 6004: 'Sports', 6005: 'Social', 6006: 'Reference', 6007: 'Productivity', 6008: 'Photo & Video', 6009: 'News', 6010: 'Navigation', 6011: 'Music', 6012: 'Lifestyle', 6013: 'Health & Fitness', 6015: 'Finance', 6016: 'Entertainment', 6017: 'Education', 6018: 'Books', 6020: 'Medical', 6023: 'Food & Drink', 6024: 'Shopping', 6027: 'Graphics & Design' };
const NEW_DAYS = 120; // "new" on an earning chart: released this recently
const WAVE_SIZE = 3; // this many new apps from different makers sharing a word is worth a look
const COMMON = new Set('with your from that this free best easy fast smart simple daily live video photo maker editor tracker scanner finder planner widgets widget assistant chat stories story learn guide tools plus lite pro app apps the and for'.split(' '));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return await res.json();
    } catch {}
    await sleep(5000 * attempt);
  }
  return null;
}

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

// 1. Today's charts.
const charts = {};
for (const [kind, feed] of [['earning', 'topgrossingapplications'], ['free', 'topfreeapplications']]) {
  for (const [genre, name] of Object.entries(CATEGORIES)) {
    const data = await get(`https://itunes.apple.com/us/rss/${feed}/limit=200/genre=${genre}/json`);
    const entries = [data?.feed?.entry ?? []].flat();
    charts[`${kind}|${name}`] = entries.map((e) => e.id.attributes['im:id']);
    await sleep(400);
  }
}

// 2. What each app is: looked up once, then refreshed only while it stays on a chart.
const apps = readJson(path.join(out, 'apps.json'), {});
const ids = [...new Set(Object.values(charts).flat())];
const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
const stale = ids.filter((id) => !apps[id] || apps[id].seen <= weekAgo);
for (let i = 0; i < stale.length; i += 150) {
  const data = await get(`https://itunes.apple.com/lookup?country=us&id=${stale.slice(i, i + 150).join(',')}`);
  for (const r of data?.results ?? []) {
    apps[r.trackId] = { name: r.trackName, maker: r.sellerName, released: (r.releaseDate ?? '').slice(0, 10), ratings: r.userRatingCount ?? 0, seen: today };
  }
  await sleep(3200);
}

// 3. New arrivals on the earning charts, and kinds of app arriving together.
const cutoff = new Date(Date.now() - NEW_DAYS * 86_400_000).toISOString().slice(0, 10);
const newEarners = [];
for (const [key, list] of Object.entries(charts)) {
  const [kind, category] = key.split('|');
  if (kind !== 'earning') continue;
  list.forEach((id, i) => {
    const app = apps[id];
    if (app && app.released >= cutoff) newEarners.push({ id, category, rank: i + 1, ...app });
  });
}
const byWord = new Map();
for (const app of newEarners) {
  const words = new Set(app.name.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  for (const word of words) {
    if (COMMON.has(word)) continue;
    if (!byWord.has(word)) byWord.set(word, []);
    byWord.get(word).push(app);
  }
}
const waves = [...byWord.entries()]
  .map(([word, list]) => ({ word, makers: new Set(list.map((a) => a.maker)).size, apps: list.map((a) => ({ name: a.name, category: a.category, rank: a.rank, released: a.released, ratings: a.ratings })) }))
  .filter((w) => w.makers >= WAVE_SIZE)
  .sort((a, b) => b.makers - a.makers);

// 4. Since yesterday: apps on an earning chart that were on none the day before.
const previousFile = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < `${today}.json`).sort().pop() : null;
const previous = previousFile ? readJson(path.join(out, previousFile), null) : null;
let entered = null;
if (previous) {
  const before = new Set(Object.entries(previous.charts).filter(([k]) => k.startsWith('earning|')).flatMap(([, v]) => v));
  entered = [];
  for (const [key, list] of Object.entries(charts)) {
    if (!key.startsWith('earning|')) continue;
    list.forEach((id, i) => {
      if (!before.has(id) && apps[id]) entered.push({ id, category: key.split('|')[1], rank: i + 1, name: apps[id].name, maker: apps[id].maker, released: apps[id].released, ratings: apps[id].ratings });
    });
  }
}

const result = { date: today, charts, newEarners: newEarners.sort((a, b) => a.rank - b.rank), waves, entered, comparedWith: previous?.date ?? null };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `${today}.json`), JSON.stringify(result));
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(out, 'apps.json'), JSON.stringify(apps));

console.log(`${today}: ${ids.length} apps on ${Object.keys(charts).length} charts; ${newEarners.length} released in the last ${NEW_DAYS} days are on an earning chart; ${waves.length} kinds arriving together; ${entered ? `${entered.length} entered an earning chart since ${previous.date}` : 'first day, nothing to compare with'}`);
for (const w of waves.slice(0, 8)) console.log(`  "${w.word}": ${w.makers} makers, e.g. ${w.apps.slice(0, 3).map((a) => `${a.name} (#${a.rank} ${a.category})`).join('; ')}`);
