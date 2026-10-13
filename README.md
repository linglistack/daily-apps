# Daily apps

A new, different iPhone app each day, made by a scheduled job, checked by a gate, and left here for
you to upload to the App Store by hand. Nothing in this repository uploads anything to Apple.

## How an app gets to the App Store

**Once, before your first upload**

1. Join the Apple Developer Program ($99 a year): https://developer.apple.com/programs/enroll/
2. Update this Mac to the newest macOS, then install Xcode from the Mac App Store. The Mac needs free
   space for both.
3. Open Xcode once and sign in with the same Apple account (Xcode > Settings > Accounts).

**For each app you want on the store**

1. Pick an app from the list below and look at its screenshots. If a screen looks wrong, skip it.
2. Click the app's name. That opens its upload sheet. Follow it from top to bottom: it has the one
   line to paste into Terminal, what to click in Xcode, and every text to paste into Apple's site.
3. Press "Add for Review" on Apple's site. Apple reviews the app and emails you. Once approved, it
   is on the App Store.

That is all. These apps need no server, no keys and no account other than Apple's.

## The apps

<!-- apps:start -->
| Made | App (opens its upload sheet) | What it is | Look first | Suggested price |
| --- | --- | --- | --- | --- |
| 2026-10-12 | [Larderweek: Meal Planner](apps/tablewright/UPLOAD.md) | weekly meal planner | [4 screens](apps/tablewright/listing/screenshots) | Free |
<!-- apps:end -->

Each app's row opens its upload sheet: what to paste into which box, and the three steps to send it.
**Look at its screenshots first.** They are taken from the app running, and no person has looked at
them. If a screen looks wrong, skip that app. You never have to upload one.

## What happens each day

| When (UTC) | What | Where |
| --- | --- | --- |
| 04:20 and 08:20 | Morning numbers: what is earning on the App Store today | `.github/workflows/watch.yml`, `ops/watch.mjs` |
| 09:30 | The maker: chooses a kind of app from those numbers and writes it | a Claude routine, `ops/jobs/maker.md` |
| on its pull request | Checks what is written, then a Mac builds it, opens it and takes its screenshots | `tests.yml`, `ops/check.mjs`, `ops/run.sh` |
| after that | The gate lets it in or says why not, then adds its icon, screenshots and upload sheet | `gate.yml`, `ops/gate.mjs`, `ops/kit.mjs` |

`ops/autopilot.json` switches the gate on and off. `ops/RULES.md` says what an app may be: it keeps
to the phone (no network, no account, no purchases inside it, nothing tracked), and each one is a
different kind of thing from every app before it.

## Good to know

- The privacy policy and support page every app uses is https://linglistack.github.io/apps/ and
  every upload sheet gives it. Each app links to it from its About screen. The page is the file
  `index.html` in the public repository `linglistack/apps`; its address and the email it shows are
  in `ops/factory.json`.
- The apps' ids begin with the prefix in `ops/factory.json`. Change it there before the first upload
  if you want another; after an app is uploaded its id cannot change.
- Uploading needs Xcode 26 or later. Xcode 26 needs macOS 15.6 or later, and the newest Xcode needs
  macOS 26.2 or later.

## On your own Mac

- `ops/open.sh <slug>` opens an app in Xcode.
- `ops/run.sh apps/<slug> out` builds it, runs it in the simulator and takes its screenshots again.
- `node --test "ops/*.test.mjs"` runs the tests of the checks and the gate.
