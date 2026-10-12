# Larderweek: Meal Planner

Weekly meal planner. Made 2026-10-12 by the daily job; never uploaded unless you do it.

Look at the screenshots in `listing/screenshots/` first. They were taken from the app running, and nobody has looked at them. If a screen looks wrong, skip this app.

## Once, before the first upload of any app

- An Apple Developer membership, and Xcode 26 or later signed in to that account.
- One public page with a privacy note and a support address, used by every app here. Its address goes into both URL boxes below.

## 1. Send the build

1. In Terminal: `cd ~/Desktop/daily-apps && git pull && ops/open.sh tablewright`
2. In Xcode, click the project, then Signing & Capabilities, and choose your team.
3. Product > Archive. When it finishes: Distribute App > App Store Connect > Upload.

## 2. Make its page (appstoreconnect.apple.com > Apps > + > New App)

| Box | What to enter |
| --- | --- |
| Platform | iOS |
| Name | Larderweek: Meal Planner |
| Primary language | English (U.S.) |
| Bundle ID | `com.linglistack.tablewright` (it appears in the list after step 1) |
| SKU | `tablewright` |

## 3. Paste these

**Subtitle**

```
Plan the week, get the list
```

**Promotional text**

```
Set breakfast, lunch and dinner for each day of the week from your own dishes, and get one grocery list for all of it. Everything stays on your phone.
```

**Description**

```
Larderweek plans your week of meals from the dishes you already cook, and turns that plan into one grocery list.

Each day of the week has a breakfast, a lunch and a dinner. Tap one and pick a dish, or type a new one; it is kept for next time. Give a dish its ingredients, one per line, and a note such as where the recipe is. Move between weeks with the arrows, and swipe a meal to clear it.

The Groceries tab gathers every ingredient the week's dishes need, each once, and says when several meals call for the same thing. Tick items off as they go into the basket, add anything else you need, and start a new shop when you are done.

There are no recipes to browse and nothing to sign up for: it plans what you cook. Everything you enter is kept on your phone. There is no account, nothing is sent anywhere, and it works with no connection.
```

**Keywords**

```
menu,dinner,weekly,supper,grocery,shopping list,ingredients,cooking,food,lunch,breakfast,prep,dishes
```

**Category:** Food & Drink  **Price:** Free  **Age rating:** answer "None" or "No" to every question (4+)

**Screenshots** (iPhone 6.9" display): drag in the 4 files from `listing/screenshots/`.
1. Breakfast, lunch and dinner for the week
2. Pick one of your dishes or add a new one
3. One grocery list for the whole week
4. Each dish with what goes in it

**App Privacy:** "Data Not Collected". The app has no account, no network use and no tracking.

**Notes for the reviewer**

```
No account or connection is needed. On the Week tab, tap any meal and type a dish name; add its ingredients on the Dishes tab, and they appear on the Groceries tab.
```

## 4. Choose the build, then Add for Review
