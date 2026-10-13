#!/usr/bin/env node
/**
 * Writes what the owner reads: each app's UPLOAD.md (what to paste where when uploading it by hand)
 * and the list of apps at the top of README.md. Run after an app is merged, by the gate's workflow.
 *   node ops/kit.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleId, factory } from './project.mjs';

const START = '<!-- apps:start -->';
const END = '<!-- apps:end -->';

/** One app's upload sheet. */
export function uploadSheet(app, listing, shots) {
  const block = (text) => `\`\`\`\n${text}\n\`\`\``;
  return `# ${listing.name}

${app.kind[0].toUpperCase()}${app.kind.slice(1)}. Made ${app.made} by the daily job; never uploaded unless you do it.

Look at the screenshots in \`listing/screenshots/\` first. They were taken from the app running, and nobody has looked at them. If a screen looks wrong, skip this app.

## Once, before the first upload of any app

- An Apple Developer membership, and Xcode 26 or later signed in to that account.

## 1. Send the build

1. In Terminal: \`cd ~/Desktop/daily-apps && git pull && ops/open.sh ${app.slug}\`
2. In Xcode, click the project, then Signing & Capabilities, and choose your team.
3. Product > Archive. When it finishes: Distribute App > App Store Connect > Upload.

## 2. Make its page (appstoreconnect.apple.com > Apps > + > New App)

| Box | What to enter |
| --- | --- |
| Platform | iOS |
| Name | ${listing.name} |
| Primary language | English (U.S.) |
| Bundle ID | \`${bundleId(app.slug)}\` (it appears in the list after step 1) |
| SKU | \`${app.slug}\` |

## 3. Paste these

**Subtitle**

${block(listing.subtitle)}

**Promotional text**

${block(listing.promo)}

**Description**

${block(listing.description)}

**Keywords**

${block(listing.keywords)}

**Support URL** and **Privacy Policy URL** (the second is under App Privacy): the same address in both. Leave Marketing URL empty.

${block(factory.page)}

**Copyright:** \`${app.made.slice(0, 4)}\` and then your name or your company's, as on your Apple Developer account.

**Category:** ${listing.category}  **Price:** ${listing.price}  **Age rating:** answer "None" or "No" to every question (4+)

**Screenshots** (iPhone 6.9" display): ${shots.length ? `drag in the ${shots.length} files from \`listing/screenshots/\`.` : 'none were made; do not upload this app.'}
${listing.captions.map((caption, i) => `${i + 1}. ${caption}`).join('\n')}

**App Privacy:** "Data Not Collected". The app has no account, no network use and no tracking.

**App Review contact:** your own name, phone number and email, so Apple's reviewer can reach you.

**Notes for the reviewer**

${block(listing.reviewNotes)}

## 4. Choose the build, then Add for Review
`;
}

/** The table of apps in README.md, newest first. */
export function appsTable(apps) {
  if (!apps.length) return 'No app yet. The first arrives with the next morning\'s run.';
  const rows = [...apps].sort((a, b) => b.app.made.localeCompare(a.app.made) || a.app.slug.localeCompare(b.app.slug)).map(({ app, listing, shots }) =>
    `| ${app.made} | [${listing.name}](apps/${app.slug}/UPLOAD.md) | ${app.kind} | ${shots.length ? `[${shots.length} screens](apps/${app.slug}/listing/screenshots)` : 'no screenshots'} | ${listing.price} |`);
  return ['| Made | App (opens its upload sheet) | What it is | Look first | Suggested price |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const apps = [];
  for (const slug of existsSync('apps') ? readdirSync('apps') : []) {
    const folder = path.join('apps', slug);
    if (!existsSync(path.join(folder, 'app.json'))) continue;
    const app = JSON.parse(readFileSync(path.join(folder, 'app.json'), 'utf8'));
    const listing = JSON.parse(readFileSync(path.join(folder, 'listing/listing.json'), 'utf8'));
    const shotsFolder = path.join(folder, 'listing/screenshots');
    const shots = existsSync(shotsFolder) ? readdirSync(shotsFolder).filter((file) => /\.(jpg|png)$/.test(file)).sort() : [];
    writeFileSync(path.join(folder, 'UPLOAD.md'), uploadSheet(app, listing, shots));
    apps.push({ app, listing, shots });
  }
  const readme = readFileSync('README.md', 'utf8');
  const [before, rest] = readme.split(START);
  const after = rest.split(END)[1];
  writeFileSync('README.md', `${before}${START}\n${appsTable(apps)}\n${END}${after}`);
  console.log(`${apps.length} apps listed`);
}
