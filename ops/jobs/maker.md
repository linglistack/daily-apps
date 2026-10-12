# The maker

Read `ops/RULES.md` first. Each day this job makes one new app, different in kind from every app made
before, and ends with it proposed for `main`, or with one line saying why there is none today. Nobody
approves it: `.github/workflows/gate.yml` judges it with `ops/gate.mjs`. Nothing here uploads to Apple.

## 0. Is there one of yours waiting?

```
gh api 'repos/linglistack/daily-apps/pulls?state=open&per_page=50' --jq '.[] | select(.head.ref | startswith("claude/app-")) | {number, title, ref: .head.ref, labels: [.labels[].name], commits}'
```

An open pull request of yours from an earlier day, labelled `not-in`: read the gate's last comment
(`gh api repos/linglistack/daily-apps/issues/<number>/comments --jq '.[-1].body'`). With one or two
commits on it, rework it as part 5 says and that is today's app. With three or more, close it with one
line saying why it could not be made to pass, and go on to make a new app.

## 1. Choose what to make

What exists already, so that today's is a different kind:

```
for f in apps/*/app.json; do node -e 'const a=require("./"+process.argv[1]); console.log(a.slug+" | "+a.kind+" | "+a.name)' "$f"; done
```

What is earning lately (`ops/RULES.md`, part 1):

```
node -e 'const d=require("./numbers/latest.json"); console.log(d.date); for (const w of d.waves) console.log("WAVE", w.word, w.makers, w.apps.map(a=>a.name+" #"+a.rank+" "+a.category).join("; ")); for (const a of d.newEarners) console.log(a.category+" #"+a.rank+" | "+a.name+" | "+a.released+" | "+a.ratings+" ratings")'
```

If nothing there can be made within the rules, look wider: every app on an earning chart, the more
recently released first.

```
node -e 'const d=require("./numbers/latest.json"), apps=require("./numbers/apps.json"); const rows=[]; for (const [k,ids] of Object.entries(d.charts)) { if (!k.startsWith("earning|")) continue; ids.slice(0,60).forEach((id,i)=>{ const a=apps[id]; if (a && a.released>="2025-01-01") rows.push(a.released+" | "+k.split("|")[1]+" #"+(i+1)+" | "+a.name+" | "+a.ratings+" ratings"); }); } console.log(rows.sort().reverse().join("\n"))'
```

Pick the kind of app that:

1. someone is visibly paying for: an app of that kind sits on an earning chart, the more recently
   released the better. Name it in `why`, with its chart, rank and release date;
2. can be made whole within `ops/RULES.md` part 2. Most of what earns cannot: it needs a server, a
   model, videos, stories, a catalogue, live data. What can is what a person keeps for themselves and
   works out on the phone: a log, a tracker, a counter, a planner, a collection, a checklist, a
   practice tool, something that reads the phone's own sensors;
3. is not a kind already in `apps/`, and not one `ops/check.mjs` calls crowded;
4. you can make properly in one sitting: one job, done well, in two to four screens.

Make the kind of thing, never the thing: your own name, your own words, your own layout. Do not take
another app's name, or part of it, or a brand, a character or a team.

Nothing fits: one line in the job log (the open issue labelled `log`),
`<today> maker: no app today: <what was looked at and why none could be made>`, and stop.

## 2. Write it

Start from the starter, which builds and runs:

```
cp -R template apps/<slug>
```

Then make it the new app. In `apps/<slug>/`:

- **`app.json`**: `slug` (the folder's name), `target` (one capitalised word, the Xcode target),
  `name` (under the icon, 14 characters at most), `kind` (what kind of app, in two to five plain
  words), `made` (today), `why` (part 1), `shots` (3 to 5), `permissions` (only what the code needs,
  each with a plain sentence saying why; most apps need none).
- **`icon.json`**: one `shape` from the list in `ops/check.mjs`, and two colours that suit the app.
- **`Sources/`**: the app. Rename `StarterApp.swift` and its struct. Keep `DebugLaunch.swift` and
  `Storage.swift` as they are. Rewrite the rest.
- **`listing/listing.json`**: what the store page says (part 4).

How to write Swift you cannot build (`ops/RULES.md`, part 5):

- Keep to what `template/Sources/` uses and how it uses it: `NavigationStack` with a path,
  `List` and `Form`, `.sheet`, `@StateObject` and `@EnvironmentObject` on a `@MainActor` store,
  `Codable` values saved with `Saved`. Read each line you write against the type it calls.
- Nothing newer than iOS 17, nothing deprecated in it, no package, no `import` beyond SwiftUI,
  Foundation and the iOS frameworks the app truly needs.
- Give every initialiser its arguments, every `switch` all its cases, every `ForEach` values that are
  `Identifiable`. These are what a compiler refuses most often in code written blind.
- Every button does something. An empty list says what to do first. Numbers and dates are formatted
  with `.formatted(…)`. Text is plain and short, as the starter's is.
- Colours come from the system (`.primary`, `.secondary`, `Color(.systemGroupedBackground)`, the
  accent) so the app reads in light and in dark. Change `AccentColor.colorset` to suit it.
- Buttons made of a picture alone get an `accessibilityLabel`.

**Screenshots.** The Mac starts the app with `-shot 1`, `-shot 2`, … up to `shots`, and takes a
picture each time. So when `DebugLaunch.shot` is set, the store holds sample data that looks like a
real person's use (and saves nothing), and each number opens a different screen: 1 is the main screen
filled in; the others open a sheet, a detail, another tab, as `RootView.swift` in the starter does
with `DebugLaunch.shot == 2` and `== 3`. These are real screens of the app, reached the way a person
reaches them. Never a screen made for the picture.

## 3. Check it where you are

```
node ops/check.mjs apps/<slug>
```

Put right every line it prints, and run it again until it prints `ok`. It cannot open web pages
where you work, so whether the name is free in the App Store is checked later, by the gate.

Then read the whole app once more as a compiler would, file by file, before pushing. A build on the
Mac that fails costs a rework, and there are two.

## 4. The store page

`listing/listing.json`:

- `name`: 30 characters at most. A name of your own, then what it is: "Tidewater: Tide Log". The part
  before the colon has to be new in the App Store, so choose one unlikely to exist.
- `subtitle`: 30 at most. What it does, not a slogan.
- `promo`: one or two sentences, 170 characters at most.
- `description`: what it does in the first sentence; how it is used; that everything stays on the
  phone. 300 to 4,000 characters. Plain words. Only what the app really does.
- `keywords`: what a person would type to find it, separated by commas with no spaces, 100 characters
  in all. Not the words already in the name. No other app's name, no brand.
- `category`, `price` (from the lists in `ops/check.mjs`; "Free" unless a paid app of this kind is on
  an earning chart), `reviewNotes` (how Apple's reviewer can try it, in a sentence or two), and
  `captions`: one short line per screenshot saying what it shows.

Never: a rank ("best", "#1"), a promise, a medical claim, a trial or a subscription, a web address,
another platform. The check refuses these.

## 5. Propose, and rework

Branch `claude/app-<today>-<slug>`, one commit, one pull request:

```
gh api repos/linglistack/daily-apps/pulls -X POST -f title='…' -f head='claude/app-…' -f base=main -f body='…'
```

The title is the app's store name and what it is: "Tidewater: a tide log". The body says what the app
does, what kind it is and why that kind (the numbers), and what its screenshots show.

Then wait for the gate. Ask every 30 seconds, for up to 25 minutes:

```
gh api repos/linglistack/daily-apps/pulls/<number> --jq '{merged, labels: [.labels[].name]}'
```

- Merged: done.
- Labelled `not-in`: read its last comment (`gh api repos/linglistack/daily-apps/issues/<number>/comments --jq '.[-1].body'`).
  It quotes the compiler or the check. Put right exactly what it names, and anything of the same sort
  elsewhere in the app, run `node ops/check.mjs` again, push one more commit to the same branch, and
  wait again. The label stays from the first time, so tell a new verdict by a new comment:
  `gh api repos/linglistack/daily-apps/issues/<number>/comments --jq 'length'`.
- After two reworks it still does not pass: close the pull request with one line saying why
  (`gh api repos/linglistack/daily-apps/pulls/<number> -X PATCH -f state=closed`), and one line in
  the job log.
- Neither after 25 minutes: stop, and say so in your final message. Tomorrow's run picks it up.

## 6. Say what you did

Your final message is one line: the pull request's link and the app's name and kind, and whether it
is in; or "No app today" and the reason.
