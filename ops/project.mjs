#!/usr/bin/env node
// Writes an app's project.yml (what xcodegen makes the Xcode project from) out of its app.json,
// so the job that writes an app never has to get a project file right by hand.
//   node ops/project.mjs apps/<slug>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const factory = JSON.parse(readFileSync(path.join(here, 'factory.json'), 'utf8'));

export const bundleId = (slug) => `${factory.bundlePrefix}.${slug.replace(/-/g, '')}`;

// A value written so YAML reads it back as the same text.
const quoted = (text) => JSON.stringify(String(text));

export function projectYml(app) {
  const permissions = Object.entries(app.permissions ?? {}).map(([key, why]) => `        ${key}: ${quoted(why)}`);
  return `# Made by ops/project.mjs from app.json. Do not edit: change app.json instead.
name: ${app.target}
options:
  deploymentTarget:
    iOS: "${factory.minimumOS}"
settings:
  base:
    SWIFT_VERSION: "5.0"
    MARKETING_VERSION: "${app.version ?? '1.0'}"
    CURRENT_PROJECT_VERSION: "${app.build ?? 1}"
targets:
  ${app.target}:
    type: application
    platform: iOS
    sources:
      - Sources
      - Assets.xcassets
    info:
      path: Info.plist
      properties:
        CFBundleDisplayName: ${quoted(app.name)}
        UILaunchScreen: {}
        UISupportedInterfaceOrientations:
          - UIInterfaceOrientationPortrait
        ITSAppUsesNonExemptEncryption: false
${permissions.join('\n')}${permissions.length ? '\n' : ''}    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: ${bundleId(app.slug)}
        TARGETED_DEVICE_FAMILY: "1"
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: AccentColor
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  const app = JSON.parse(readFileSync(path.join(folder, 'app.json'), 'utf8'));
  writeFileSync(path.join(folder, 'project.yml'), projectYml(app));
  console.log(`${app.target} ${bundleId(app.slug)} ${app.shots}`);
}
