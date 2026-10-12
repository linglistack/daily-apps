#!/usr/bin/env node
/**
 * The gate a new app passes to go into `main` with no one pressing anything. The owner asked on
 * 12 October 2026 for a new, different app every day, finished and waiting for them to upload to the
 * App Store by hand. A job writes the app (ops/jobs/maker.md); this decides. Run by
 * .github/workflows/gate.yml, always from `main`, so an app cannot rewrite its own judge.
 *
 * An app comes from a branch named claude/app-<date>-<slug> and is held to this (`decide` below):
 * - every file it brings is inside apps/<slug>/, and none of them is something the tools make (the
 *   project file, the icon's picture, the screenshots, the upload sheet);
 * - "App checks" passed: everything an upload needs is written and fits Apple's limits, the app keeps
 *   to the phone, it is a different kind of app from every earlier one, and its name is free in the
 *   App Store (ops/check.mjs);
 * - "App runs" passed: on a Mac it builds, opens as a new user would open it, and shows a different,
 *   filled screen for each screenshot (ops/run.sh).
 *
 * An app that passes is merged; the workflow then adds the icon and screenshots the Mac made and
 * writes its upload sheet. What does not pass is reworked by the job that wrote it, at most twice,
 * and then closed. Nobody is asked to approve anything, and nothing here uploads to Apple: that is
 * the owner's, by hand.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CHECKS = ['App checks', 'App runs'];
const MADE_BY_TOOLS = /(^|\/)(project\.yml|Info\.plist|UPLOAD\.md|icon\.png)$|\.xcodeproj\/|\/listing\/screenshots\//;

/** The app a branch is for, or null when the branch is not one this gate judges. */
export const slugOf = (branch) => (String(branch).match(/^claude\/app-\d{4}-\d{2}-\d{2}-([a-z][a-z0-9-]{2,29})$/) || [])[1] || null;

/**
 * Whether an app may go into `main` alone. `slug` is the app its branch names; `files` are the pull
 * request's files as GitHub lists them; `tests` the Tests workflow's results, by check name; `on`
 * the switch (ops/autopilot.json).
 */
export function decide({ slug, files, tests, on }) {
  const waits = [];
  const say = (text) => waits.push(text);
  if (!slug) return { alone: false, ready: false, waits: ['Its branch is not named for an app (claude/app-<date>-<slug>).'] };
  if (!files.length) say('It brings no files.');
  if (files.length > 60) say(`It brings ${files.length} files (60 at most).`);
  for (const file of files) {
    const name = `\`${file.filename}\``;
    if (!file.filename.startsWith(`apps/${slug}/`)) say(`${name} is outside \`apps/${slug}/\`: a new app brings its own folder and nothing else.`);
    else if (MADE_BY_TOOLS.test(file.filename)) say(`${name} is made by the tools, not written: leave it out.`);
    else if (file.status === 'removed') say(`${name} is removed: a new app only adds files.`);
  }
  const failed = CHECKS.filter((name) => tests[name] !== 'success');
  if (failed.length) say(`The checks did not pass: ${failed.map((name) => `${name}: ${tests[name] || 'did not run'}`).join(', ')}.`);
  const ready = !waits.length;
  if (ready && on !== true) say('Apps going in alone is switched off (`ops/autopilot.json`).');
  return { alone: ready && on === true, ready, waits };
}

/** The lines of a failed check's log that say what is wrong, for the job that wrote the app. */
export function quote(log) {
  const lines = String(log).split('\n').map((line) => line.replace(/^\S+Z /, '').replace(/\u001b\[[0-9;]*m/g, ''));
  const said = lines.filter((line) => /^(error:|not ok \d|.*\berror: )/.test(line) && !/##\[error\]/.test(line));
  return [...new Set(said)].slice(0, 40).join('\n').slice(0, 3500);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { GITHUB_REPOSITORY: REPO, GH_TOKEN: TOKEN, HEAD_SHA, HEAD_REF, GITHUB_OUTPUT } = process.env;
  const github = async (route, { method = 'GET', body } = {}) => {
    const res = await fetch(`https://api.github.com/repos/${REPO}${route}`, {
      method,
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${route} answered ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  const slug = slugOf(HEAD_REF);
  if (!slug) { console.log(`${HEAD_REF} is not an app this gate judges.`); process.exit(0); }
  const [pull] = await github(`/pulls?state=open&base=main&head=${REPO.split('/')[0]}:${encodeURIComponent(HEAD_REF)}`);
  if (!pull) { console.log('No open pull request for this branch.'); process.exit(0); }
  // A newer commit was pushed since these checks ran: its own run judges it.
  if (pull.head.sha !== HEAD_SHA) { console.log('The branch has moved on; the newer commit is judged by its own run.'); process.exit(0); }
  const PR = pull.number;
  const say = (text, label) => Promise.all([
    github(`/issues/${PR}/comments`, { method: 'POST', body: { body: text } }),
    github(`/issues/${PR}/labels`, { method: 'POST', body: { labels: [label] } }).catch(() => null),
  ]);

  const files = [];
  for (let page = 1; page <= 5; page += 1) {
    const some = await github(`/pulls/${PR}/files?per_page=100&page=${page}`);
    files.push(...some);
    if (some.length < 100) break;
  }
  const all = (await github(`/commits/${HEAD_SHA}/check-runs?per_page=100`)).check_runs;
  const runs = CHECKS.map((name) => all.filter((run) => run.name === name).sort((a, b) => b.id - a.id)[0]).filter(Boolean);
  const tests = Object.fromEntries(runs.map((run) => [run.name, run.status === 'completed' ? run.conclusion : run.status]));
  const { on } = JSON.parse(readFileSync('ops/autopilot.json', 'utf8'));

  // What the failing checks said: the job that wrote the app has no Mac to build it on.
  let quoted = '';
  for (const run of runs.filter((one) => one.status === 'completed' && one.conclusion === 'failure')) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${run.id}/logs`, { headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json' } });
      const text = res.ok ? quote(await res.text()) : '';
      if (text) quoted += `\n\n**${run.name}** said:\n\n\`\`\`\n${text}\n\`\`\``;
    } catch { /* the reasons above still say which check failed */ }
  }

  const verdict = decide({ slug, files, tests, on });
  if (!verdict.alone) {
    await say(`**Not in.** This app did not pass the gate:\n\n${verdict.waits.map((text) => `- ${text}`).join('\n')}${quoted}\n\nNobody is asked to approve it. The job that wrote it reworks it on this branch, at most twice; if it still does not pass, it is closed.`, 'not-in');
    process.exit(0);
  }
  const merged = await github(`/pulls/${PR}/merge`, { method: 'PUT', body: { merge_method: 'squash', sha: HEAD_SHA, commit_title: `${pull.title} (#${PR})` } });
  await github(`/git/refs/heads/${HEAD_REF}`, { method: 'DELETE' }).catch(() => null);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `merged=${merged.sha}\nslug=${slug}\n`);
  await say(`**In.** It builds, opens and shows its screens, and everything an upload needs is written. Its icon, screenshots and upload sheet are being added to \`apps/${slug}/\` now. Uploading it to Apple is the owner's, by hand.`, 'in');
}
