#!/usr/bin/env node
/**
 * Reads an app's folder and says what is wrong with it, before any Mac time is spent on it.
 *   node ops/check.mjs apps/<slug> [--online]
 * It checks what can be read off the files: that everything an upload needs is there and fits Apple's
 * limits, that the app keeps to the phone (no network, no account, no purchases, nothing tracked),
 * that it is a different kind of app from every earlier one, and that the listing claims nothing it
 * should not. With --online it also asks the App Store whether the name is already taken.
 * Whether the app builds, opens and shows its screens is ops/run.sh's job, on a Mac.
 * Each line it prints is one thing to put right; nothing printed means the folder passes.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHAPES = ['circle', 'ring', 'bars', 'check', 'plus', 'drop', 'bolt', 'star', 'heart', 'moon', 'pin', 'grid', 'wave', 'clock', 'flag'];
export const CATEGORIES = ['Books', 'Business', 'Education', 'Entertainment', 'Finance', 'Food & Drink', 'Graphics & Design', 'Health & Fitness', 'Lifestyle', 'Music', 'Navigation', 'Photo & Video', 'Productivity', 'Reference', 'Shopping', 'Sports', 'Travel', 'Utilities', 'Weather'];
export const PRICES = ['Free', '$0.99', '$1.99', '$2.99', '$3.99', '$4.99'];
// Asking for one of these needs a sentence saying why, which iOS shows the person.
export const PERMISSIONS = {
  NSCameraUsageDescription: /AVCaptureDevice|AVCaptureSession|sourceType\s*=\s*\.camera/,
  NSMicrophoneUsageDescription: /AVAudioRecorder|requestRecordPermission|\.inputNode\b|SFSpeechRecognizer/,
  NSLocationWhenInUseUsageDescription: /CLLocationManager/,
  NSMotionUsageDescription: /CMMotionManager|CMPedometer|CMAltimeter|CMMotionActivityManager/,
  NSPhotoLibraryAddUsageDescription: /UIImageWriteToSavedPhotosAlbum|PHPhotoLibrary/,
};
// Kinds of app Apple says it has enough of (App Review Guidelines 4.3), and kinds that are not ours to make.
const CROWDED = /flashlight|wallpaper|fortune|horoscope|dating|drinking game|fart|burp|sound ?board|sound effects|stopwatch|\btimer\b|\bqr\b|vpn|cleaner|ringtone|keyboard|calculator|unit converter|casino|gambl|betting/i;
// What an app may not do: it keeps to the phone, sells nothing inside itself, and tracks nobody.
const NOT_IN_CODE = [
  [/\bURLSession\b|\bURLRequest\b|\bNWConnection\b|import\s+Network\b/, 'reaches the network'],
  [/\bWKWebView\b|import\s+WebKit\b|SFSafariViewController/, 'shows a web page'],
  [/https?:\/\//, 'holds a web address'],
  [/import\s+StoreKit\b|SKStoreReviewController|requestReview/, 'uses purchases or asks for a rating'],
  [/import\s+(HealthKit|CloudKit|WidgetKit|ActivityKit|WeatherKit|GameKit|PassKit|Contacts|EventKit)\b/, 'needs a capability or a kind of access these apps do not use'],
  [/AdSupport|AppTrackingTransparency|ASIdentifierManager|Firebase|GoogleMobileAds|Amplitude|Mixpanel/, 'tracks or advertises'],
  [/\b(TODO|FIXME)\b|lorem ipsum|coming soon/i, 'is unfinished'],
];
const NOT_IN_LISTING = [
  [/#\s?1\b|\bnumber one\b|\bbest\b|\bworld'?s\b/i, 'ranks itself'],
  [/guarantee/i, 'promises something'],
  [/\bofficial\b/i, 'calls itself official'],
  [/\bfree trial\b|\bsubscription\b|\bin-app purchase/i, 'speaks of a trial, a subscription or a purchase inside the app'],
  [/\bcures?\b|\bdiagnos|\btreats?\b|medical advice|doctor[- ]recommended/i, 'makes a medical claim'],
  [/https?:\/\//, 'holds a web address'],
  [/\b(android|google play)\b/i, 'names another platform'],
];
const LIMITS = { name: 30, subtitle: 30, promo: 170, keywords: 100, description: [300, 4000], home: 14, swiftLines: [150, 2500], files: 30 };

// The About screen every app carries unchanged.
const ABOUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../template/Sources/About.swift');

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const isText = (value, most, least = 1) => typeof value === 'string' && value.trim().length >= least && value.length <= most;

/**
 * Everything wrong with the app in `folder`. `others` are the app.json and listing.json of the apps
 * already made, as [{ slug, kind, name, listingName }], so that a new one is not a second of a kind.
 */
export function check(folder, { others = [], today = new Date().toISOString().slice(0, 10), bundlePrefix = '' } = {}) {
  const wrong = [];
  const say = (text) => wrong.push(text);
  const slug = path.basename(folder);

  const app = readJson(path.join(folder, 'app.json'));
  const icon = readJson(path.join(folder, 'icon.json'));
  const listing = readJson(path.join(folder, 'listing/listing.json'));
  if (!app) say('app.json is missing or is not JSON.');
  if (!icon) say('icon.json is missing or is not JSON.');
  if (!listing) say('listing/listing.json is missing or is not JSON.');

  for (const needed of ['Assets.xcassets/Contents.json', 'Assets.xcassets/AppIcon.appiconset/Contents.json', 'Assets.xcassets/AccentColor.colorset/Contents.json', 'Sources/DebugLaunch.swift']) {
    if (!existsSync(path.join(folder, needed))) say(`${needed} is missing (copy it from template/).`);
  }

  if (app) {
    if (app.slug !== slug || !/^[a-z][a-z0-9-]{2,29}$/.test(slug)) say(`app.json "slug" must be the folder's name: lower-case letters, digits and hyphens, 3 to 30 long.`);
    if (!/^[A-Z][A-Za-z0-9]{2,29}$/.test(app.target ?? '')) say('app.json "target" must be one word starting with a capital, letters and digits only, like DaysAbroad.');
    if (!isText(app.name, LIMITS.home)) say(`app.json "name" is what stands under the icon: 1 to ${LIMITS.home} characters.`);
    if (!isText(app.kind, 40, 5)) say('app.json "kind" says what kind of app this is in two to five plain words.');
    else if (CROWDED.test(app.kind)) say(`app.json "kind" is a kind the App Store has enough of, or one these apps do not make: "${app.kind}".`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(app.made ?? '') || app.made > today) say('app.json "made" is the day it was made, as YYYY-MM-DD.');
    if (!isText(app.why, 600, 40)) say('app.json "why" names the numbers this app was chosen by: the file, the field and the apps seen there.');
    if (!Number.isInteger(app.shots) || app.shots < 3 || app.shots > 5) say('app.json "shots" is how many screenshots to take: 3, 4 or 5.');
    const asked = Object.keys(app.permissions ?? {});
    for (const key of asked) {
      if (!(key in PERMISSIONS)) say(`app.json asks for ${key}, which these apps do not use.`);
      else if (!isText(app.permissions[key], 200, 20)) say(`app.json ${key} needs a plain sentence saying why, 20 to 200 characters.`);
    }
    const twin = others.find((other) => other.slug !== slug && (other.kind?.toLowerCase() === app.kind?.toLowerCase() || other.name?.toLowerCase() === app.name?.toLowerCase()));
    if (twin) say(`apps/${twin.slug} is already this kind of app or has this name: make a different kind.`);
  }

  if (icon) {
    if (!SHAPES.includes(icon.shape)) say(`icon.json "shape" must be one of: ${SHAPES.join(', ')}.`);
    for (const key of ['top', 'bottom']) if (!/^#[0-9A-Fa-f]{6}$/.test(icon[key] ?? '')) say(`icon.json "${key}" must be a colour like #1E3A8A.`);
    if (icon.ink !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(icon.ink)) say('icon.json "ink" must be a colour like #FFFFFF.');
  }

  if (listing) {
    if (!isText(listing.name, LIMITS.name, 3)) say(`listing "name" is the App Store name: 3 to ${LIMITS.name} characters.`);
    if (!isText(listing.subtitle, LIMITS.subtitle, 5)) say(`listing "subtitle": 5 to ${LIMITS.subtitle} characters.`);
    if (!isText(listing.promo, LIMITS.promo, 30)) say(`listing "promo": 30 to ${LIMITS.promo} characters.`);
    if (!isText(listing.description, LIMITS.description[1], LIMITS.description[0])) say(`listing "description": ${LIMITS.description[0]} to ${LIMITS.description[1]} characters.`);
    if (!isText(listing.keywords, LIMITS.keywords, 20) || /,\s/.test(listing.keywords ?? '')) say(`listing "keywords": words separated by commas with no spaces after them, 20 to ${LIMITS.keywords} characters in all.`);
    if (!CATEGORIES.includes(listing.category)) say(`listing "category" must be one of: ${CATEGORIES.join(', ')}.`);
    if (!PRICES.includes(listing.price)) say(`listing "price" must be one of: ${PRICES.join(', ')}.`);
    if (!isText(listing.reviewNotes, 600, 30)) say('listing "reviewNotes" tells Apple\'s reviewer in a sentence or two how to try the app.');
    if (!Array.isArray(listing.captions) || (app && listing.captions.length !== app.shots) || listing.captions.some((caption) => !isText(caption, 60, 5))) say('listing "captions" has one short line for each screenshot, saying what it shows.');
    const said = [listing.name, listing.subtitle, listing.promo, listing.description, listing.keywords].filter((text) => typeof text === 'string').join('\n');
    for (const [pattern, what] of NOT_IN_LISTING) {
      const found = said.match(pattern);
      if (found) say(`The listing ${what}: "${found[0]}".`);
    }
    const twin = others.find((other) => other.slug !== slug && other.listingName?.toLowerCase() === listing.name?.toLowerCase());
    if (twin) say(`apps/${twin.slug} already has this App Store name.`);
  }

  const sources = path.join(folder, 'Sources');
  const swift = existsSync(sources) ? readdirSync(sources).filter((file) => file.endsWith('.swift')) : [];
  if (swift.length < 3) say('Sources/ needs the app\'s Swift files (at least three, DebugLaunch.swift among them).');
  if (swift.length > LIMITS.files) say(`Sources/ holds ${swift.length} files (${LIMITS.files} at most).`);
  let lines = 0;
  let mains = 0;
  let code = '';
  let about = false;
  for (const file of swift) {
    const text = readFileSync(path.join(sources, file), 'utf8');
    lines += text.split('\n').length;
    if (/^\s*@main\b/m.test(text)) mains += 1;
    if (file !== 'About.swift' && /\bAboutButton\(\)/.test(text)) about = true;
    code += `\n${text}`;
    const body = text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    for (const [pattern, what] of NOT_IN_CODE) {
      const found = body.match(pattern);
      if (found) say(`Sources/${file} ${what}: "${found[0].trim()}".`);
    }
  }
  if (swift.length) {
    if (mains !== 1) say(`Exactly one Swift file starts the app with @main (found ${mains}).`);
    // Apple asks every app to carry the way to its privacy policy and to support (App Review Guidelines 5.1.1 and 1.5).
    const ours = path.join(sources, 'About.swift');
    if (!existsSync(ours) || readFileSync(ours, 'utf8') !== readFileSync(ABOUT, 'utf8')) say('Sources/About.swift must be the template\'s, unchanged (copy template/Sources/About.swift): it is the way to the privacy policy and to support.');
    if (!about) say('No screen shows `AboutButton()`: put it in the toolbar of the main screen, so the privacy policy and support can be reached from inside the app.');
    // Each screenshot after the first has to open something: a screen compares the number, or switches on it.
    const numbers = new Set([...code.matchAll(/DebugLaunch\.shot\s*==\s*(\d)/g)].map((found) => found[1]));
    if (!/switch\s+DebugLaunch\.shot/.test(code) && numbers.size < (app?.shots ?? 3) - 1) say('The screens do not open a different screen for each `-shot` number (compare `DebugLaunch.shot == 2`, `== 3`, … where each screen is opened), so the screenshots would repeat.');
    if (lines < LIMITS.swiftLines[0] || lines > LIMITS.swiftLines[1]) say(`The Swift files hold ${lines} lines (${LIMITS.swiftLines[0]} to ${LIMITS.swiftLines[1]}).`);
    for (const [key, uses] of Object.entries(PERMISSIONS)) {
      if (uses.test(code) && !app?.permissions?.[key]) say(`The code uses what ${key} is for, and app.json does not say why: the app would stop the moment it asks.`);
    }
  }
  for (const file of existsSync(sources) ? readdirSync(sources) : []) {
    if (!file.endsWith('.swift') || statSync(path.join(sources, file)).isDirectory()) say(`Sources/${file}: only Swift files, in one flat folder.`);
  }
  return wrong;
}

/** The apps already made, for the "a different kind" check. */
export function madeApps(appsFolder) {
  if (!existsSync(appsFolder)) return [];
  return readdirSync(appsFolder).map((slug) => {
    const app = readJson(path.join(appsFolder, slug, 'app.json'));
    const listing = readJson(path.join(appsFolder, slug, 'listing/listing.json'));
    return app ? { slug, kind: app.kind, name: app.name, listingName: listing?.name } : null;
  }).filter(Boolean);
}

/** Whether an app with this name is already in the App Store (US). Null when Apple did not answer. */
export async function nameTaken(name, fetchImpl = fetch) {
  const short = (text) => text.split(/[:\-–—|]/)[0].trim().toLowerCase();
  try {
    const res = await fetchImpl(`https://itunes.apple.com/search?country=us&entity=software&limit=25&term=${encodeURIComponent(short(name))}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const { results = [] } = await res.json();
    const twin = results.find((app) => app.trackName.toLowerCase() === name.toLowerCase() || short(app.trackName) === short(name));
    return twin ? twin.trackName : false;
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2]?.replace(/\/$/, '');
  if (!folder) { console.error('use: node ops/check.mjs apps/<slug> [--online]'); process.exit(2); }
  const wrong = check(folder, { others: madeApps(path.dirname(folder)) });
  if (process.argv.includes('--online')) {
    const name = readJson(path.join(folder, 'listing/listing.json'))?.name;
    const taken = name ? await nameTaken(name) : false;
    if (taken) wrong.push(`error: an app called "${taken}" is already in the App Store: choose another name (listing "name"; the part before a colon has to be new).`);
    if (taken === null) console.log('note: the App Store did not answer, so the name was not checked.');
  }
  for (const line of wrong) console.log(line.startsWith('error:') ? line : `error: ${line}`);
  if (!wrong.length) console.log(`ok: ${folder} has everything an upload needs`);
  process.exit(wrong.length ? 1 : 0);
}
