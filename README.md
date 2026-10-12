# Daily apps

A new, different iPhone app each day, made by a scheduled job, checked by a gate, and left here for
you to upload to the App Store by hand. Nothing in this repository uploads anything to Apple.

## The apps

<!-- apps:start -->
No app yet. The first arrives with the next morning's run.
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

## Before the first upload of any app

- An Apple Developer membership ($99 a year).
- Xcode 26 or later on the Mac you upload from, signed in to that account.
- One public page with a privacy note and a support address, shared by every app here.
- The apps' ids begin with the prefix in `ops/factory.json`. Change it there before the first upload
  if you want another; after an app is uploaded its id cannot change.

## On your own Mac

- `ops/open.sh <slug>` opens an app in Xcode.
- `ops/run.sh apps/<slug> out` builds it, runs it in the simulator and takes its screenshots again.
- `node --test "ops/*.test.mjs"` runs the tests of the checks and the gate.
