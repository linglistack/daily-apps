import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check, nameTaken } from './check.mjs';

// A copy of the starter app under the name its app.json gives, changed by `edit` before it is checked.
function app(edit = () => {}) {
  const folder = path.join(mkdtempSync(path.join(tmpdir(), 'app-')), 'starter');
  cpSync('template', folder, { recursive: true, filter: (file) => !/\.xcodeproj|project\.yml|Info\.plist|icon\.png/.test(file) });
  const json = (file, change) => {
    const full = path.join(folder, file);
    const value = JSON.parse(readFileSync(full, 'utf8'));
    change(value);
    writeFileSync(full, JSON.stringify(value));
  };
  const swift = (file, change) => writeFileSync(path.join(folder, 'Sources', file), change(readFileSync(path.join(folder, 'Sources', file), 'utf8')));
  edit({ json, swift, folder });
  return folder;
}
const wrong = (edit, options) => check(app(edit), options).join('\n');

test('the starter app passes', () => {
  assert.deepEqual(check(app()), []);
});

test('what an upload needs has to be there and fit Apple\'s limits', () => {
  assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.name = 'A name that is far too long for the App Store'; })), /listing "name"/);
  assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.keywords = 'log, tracker, list, journal'; })), /no spaces after them/);
  assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.description = 'Too short.'; })), /"description"/);
  assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.category = 'Medical'; })), /"category"/);
  assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.captions = ['only one']; })), /"captions"/);
  assert.match(wrong(({ json }) => json('app.json', (a) => { a.shots = 9; })), /"shots"/);
  assert.match(wrong(({ json }) => json('app.json', (a) => { a.target = 'two words'; })), /"target"/);
  assert.match(wrong(({ json }) => json('app.json', (a) => { a.name = 'A very long home screen name'; })), /under the icon/);
  assert.match(wrong(({ json }) => json('icon.json', (i) => { i.shape = 'unicorn'; })), /"shape" must be one of/);
});

test('an app keeps to the phone: no network, web page, purchase or tracking', () => {
  for (const [line, why] of [
    ['let task = URLSession.shared', /reaches the network/],
    ['let link = "https://example.com"', /holds a web address/],
    ['import StoreKit', /purchases or asks for a rating/],
    ['import WebKit', /shows a web page/],
    ['import HealthKit', /needs a capability/],
    ['import FirebaseAnalytics', /tracks or advertises/],
    ['// TODO finish this', null],
    ['let label = "Coming soon"', /is unfinished/],
  ]) {
    const said = wrong(({ swift }) => swift('Store.swift', (text) => `${text}\n${line}\n`));
    if (why) assert.match(said, why, line); else assert.equal(said, '', line);
  }
});

test('using the camera or the location without saying why is caught before it can stop the app', () => {
  const uses = ({ swift }) => swift('Store.swift', (text) => `${text}\nimport CoreLocation\nlet manager = CLLocationManager()\n`);
  assert.match(wrong(uses), /NSLocationWhenInUseUsageDescription/);
  assert.equal(wrong((tools) => { uses(tools); tools.json('app.json', (a) => { a.permissions = { NSLocationWhenInUseUsageDescription: 'Shows how far you are from the places you saved.' }; }); }), '');
  assert.match(wrong(({ json }) => json('app.json', (a) => { a.permissions = { NSContactsUsageDescription: 'To find your friends in your contacts.' }; })), /which these apps do not use/);
});

test('every screenshot has to be able to show a different screen, and there is one way in', () => {
  assert.match(wrong(({ swift }) => swift('RootView.swift', (text) => text.replaceAll('DebugLaunch.shot', 'nil as Int?'))), /do not open a different screen for each/);
  assert.match(wrong(({ swift }) => swift('Store.swift', (text) => `@main\nstruct Second {}\n${text}`)), /Exactly one Swift file starts the app/);
});

test('a second app of a kind, a crowded kind and a borrowed claim are refused', () => {
  const others = [{ slug: 'older', kind: 'Starter Example', name: 'Other', listingName: 'Other: A Log' }];
  assert.match(check(app(), { others }).join('\n'), /apps\/older is already this kind of app/);
  assert.match(check(app(), { others: [{ slug: 'older', kind: 'x y z', name: 'Other', listingName: 'starter: a simple log' }] }).join('\n'), /already has this App Store name/);
  assert.match(wrong(({ json }) => json('app.json', (a) => { a.kind = 'flashlight with strobe'; })), /has enough of/);
  for (const [text, why] of [['The best log there is.', /ranks itself/], ['Guaranteed results.', /promises something/], ['Start your free trial.', /trial/], ['Cures bad habits.', /medical claim/]]) {
    assert.match(wrong(({ json }) => json('listing/listing.json', (l) => { l.promo = `A plain log for anything. ${text}`; })), why, text);
  }
});

test('the App Store is asked whether the name is taken, by the part before the colon too', async () => {
  const store = (names) => async () => ({ ok: true, json: async () => ({ results: names.map((trackName) => ({ trackName })) }) });
  assert.equal(await nameTaken('Days Abroad: Stay Counter', store(['Days Abroad - Travel Log'])), 'Days Abroad - Travel Log');
  assert.equal(await nameTaken('Days Abroad: Stay Counter', store(['Days Abroad Planner', 'Abroad'])), false);
  assert.equal(await nameTaken('Days Abroad', async () => ({ ok: false })), null);
});
