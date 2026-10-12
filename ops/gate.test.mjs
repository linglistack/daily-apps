import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, quote, slugOf } from './gate.mjs';
import { appsTable, uploadSheet } from './kit.mjs';
import { bundleId, projectYml } from './project.mjs';

const file = (filename, status = 'added') => ({ filename, status });
const app = [file('apps/days-abroad/app.json'), file('apps/days-abroad/Sources/DaysApp.swift'), file('apps/days-abroad/listing/listing.json')];
const pass = { 'App checks': 'success', 'App runs': 'success' };
const judge = (over = {}) => decide({ slug: 'days-abroad', files: app, tests: pass, on: true, ...over });
const reasons = (over) => judge(over).waits.join('\n');

test('an app that passed both checks and brings only its own folder goes in alone', () => {
  assert.deepEqual(judge(), { alone: true, ready: true, waits: [] });
});

test('the switch holds everything, and says it is the switch', () => {
  const verdict = judge({ on: false });
  assert.deepEqual([verdict.alone, verdict.ready], [false, true]);
  assert.match(verdict.waits[0], /switched off/);
});

test('an app brings its own folder and nothing else', () => {
  assert.match(reasons({ files: [...app, file('ops/gate.mjs', 'modified')] }), /outside `apps\/days-abroad\/`/);
  assert.match(reasons({ files: [...app, file('.github/workflows/tests.yml', 'modified')] }), /outside/);
  assert.match(reasons({ files: [...app, file('apps/other-app/app.json')] }), /outside/);
  assert.match(reasons({ files: [...app, file('README.md', 'modified')] }), /outside/);
  assert.match(reasons({ files: [] }), /brings no files/);
});

test('what the tools make is not written by the job', () => {
  for (const made of ['project.yml', 'Info.plist', 'UPLOAD.md', 'Assets.xcassets/AppIcon.appiconset/icon.png', 'listing/screenshots/1.jpg', 'DaysAbroad.xcodeproj/project.pbxproj']) {
    assert.match(reasons({ files: [...app, file(`apps/days-abroad/${made}`)] }), /made by the tools/, made);
  }
});

test('both checks have to pass: written right, and running on a Mac', () => {
  assert.match(reasons({ tests: { 'App checks': 'success', 'App runs': 'failure' } }), /App runs: failure/);
  assert.match(reasons({ tests: { 'App checks': 'failure' } }), /App checks: failure, App runs: did not run/);
  assert.match(reasons({ tests: { 'App checks': 'success', 'App runs': 'skipped' } }), /App runs: skipped/);
});

test('only branches named for an app are judged', () => {
  assert.equal(slugOf('claude/app-2026-10-13-days-abroad'), 'days-abroad');
  for (const branch of ['claude/app-days-abroad', 'claude/app-2026-10-13-', 'claude/app-2026-10-13-Days', 'main', 'claude/change-3-x', undefined]) assert.equal(slugOf(branch), null, String(branch));
  assert.match(decide({ slug: null, files: app, tests: pass, on: true }).waits[0], /not named for an app/);
});

test('a failed check is quoted by its error lines, each once', () => {
  const log = ['2026-10-13T00:00:00.0000000Z building', '2026-10-13T00:00:01.0000000Z Sources/RootView.swift:10:5: error: cannot find \'Foo\' in scope', '2026-10-13T00:00:01.0000000Z Sources/RootView.swift:10:5: error: cannot find \'Foo\' in scope', '2026-10-13T00:00:02.0000000Z error: the app does not build', '2026-10-13T00:00:03.0000000Z ##[error]Process completed with exit code 1.'].join('\n');
  assert.equal(quote(log), "Sources/RootView.swift:10:5: error: cannot find 'Foo' in scope\nerror: the app does not build");
  assert.equal(quote('all fine'), '');
});

const made = { slug: 'days-abroad', target: 'DaysAbroad', name: 'Days Abroad', kind: 'country day counter', made: '2026-10-13', shots: 3, permissions: { NSLocationWhenInUseUsageDescription: 'Shows "where" you are.' } };
const listing = { name: 'Days Abroad: Stay Counter', subtitle: 'Count your days in each country', promo: 'Know how long you have stayed.', description: 'Counts days.', keywords: 'travel,visa,days', category: 'Travel', price: '$1.99', reviewNotes: 'Open it and add a trip.', captions: ['Your days in each country', 'Add a trip', 'One country'] };

test('the project file is made from app.json, with the reason for each permission', () => {
  const yml = projectYml(made);
  assert.match(yml, /^name: DaysAbroad$/m);
  assert.match(yml, /CFBundleDisplayName: "Days Abroad"/);
  assert.match(yml, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER: ${bundleId('days-abroad').replaceAll('.', '\\.')}$`, 'm'));
  assert.match(yml, /NSLocationWhenInUseUsageDescription: "Shows \\"where\\" you are\."/);
  assert.match(bundleId('days-abroad'), /\.daysabroad$/);
  assert.doesNotMatch(projectYml({ ...made, permissions: {} }), /UsageDescription/);
});

test('the upload sheet holds every box to fill and the list shows the newest app first', () => {
  const sheet = uploadSheet(made, listing, ['1.jpg', '2.jpg', '3.jpg']);
  for (const text of ['ops/open.sh days-abroad', 'Days Abroad: Stay Counter', 'travel,visa,days', 'Data Not Collected', 'drag in the 3 files', '$1.99', 'Add for Review']) assert.ok(sheet.includes(text), text);
  assert.match(uploadSheet(made, listing, []), /do not upload this app/);
  const table = appsTable([{ app: { ...made, made: '2026-10-12', slug: 'older' }, listing: { ...listing, name: 'Older' }, shots: [] }, { app: made, listing, shots: ['1.jpg'] }]);
  assert.ok(table.indexOf('Days Abroad') < table.indexOf('Older'));
  assert.match(appsTable([]), /No app yet/);
});
