# Eurovision Family Contest

A small React SPA for a family to predict the final standing of the Eurovision
Song Contest final, with an admin who manages the contestants and voting
window and enters the real result once the show is over.

## How it works

- Everyone signs in with their own **Google account** — no shared password to
  hand out. The first person to ever sign in becomes the first admin.
- Only **invited** Google accounts can participate. Admins invite people by
  email from the Admin page; an invited person is automatically activated the
  first time they sign in. Admins can always participate too, invite list or
  not.
- **Admin(s)** set up the contestant countries and their running (performance)
  order, then manually **start voting**. Admins can vote alongside everyone
  else. The Contestants card minimizes itself the moment voting starts (it's
  editable if reopened, but touching it while live could invalidate
  submitted picks) and expands again automatically once the contest is reset
  — setting up next season's contestants is the next thing an admin needs to
  do. It locks completely — no editing at all — once voting ends, until
  that reset happens.
- While voting is **open**, each **family member** (including admins) drags
  the contestants into the order they predict they'll actually finish in (1st
  place at the top), using the grip handle next to each row (dragging
  elsewhere on a row scrolls the page instead, so it works on mobile). They
  can change their mind and resubmit as many times as they like — the submit
  button only enables once the order actually differs from what's saved.
- Submitted picks stay hidden from everyone, including admins, until voting
  closes — an admin who's also playing can't peek at anyone's pick before
  finalizing their own. The admin's **Submissions** card expands itself the
  moment voting starts and shows who has submitted and when, in real time,
  while voting is open — that's tracked separately from the pick itself
  precisely so it can stay visible without revealing anyone's order.
- The admin manually **ends voting**, then enters the **actual final
  standing** once it's announced.
- The app automatically computes each family member's score (sum of how far
  off each country's predicted position was from its real position — lower is
  better, 0 is a perfect prediction) and shows a leaderboard, with F1-style
  championship points (25-18-15-12-10-8-6-4-2-1 for 1st through 10th) awarded
  for that contest's ranking. Click any name on the leaderboard to see their
  full pick and exactly how much each country's placement cost them, and
  compare it against anyone else's.
- An **all-time leaderboard** adds up everyone's points across every
  finalized contest, so the family can track a season-long "championship" the
  same way F1 does, alongside each person's win count and average score.
- Admins can see everyone they've invited, whether each person has ever
  signed in, and can **block** someone to revoke their access without
  deleting their history. Admins can also look back at anyone's submissions
  from past (reset) contests.

Everything updates live for everyone via Firestore, so nobody needs to
refresh when the admin opens/closes voting or the results come in.

## Tech stack

- React 19 + TypeScript + Vite
- React Router (`HashRouter`, so it works on GitHub Pages without extra
  server config)
- Firebase (Firestore for data, Google sign-in for identity)
- [`@dnd-kit`](https://dndkit.com/) for the drag-and-drop ordering lists
- Light/dark theme toggle (defaults to the device's OS preference, overridable
  per-visitor) and a mobile-friendly hamburger header
- Deployed to **GitHub Pages** via GitHub Actions

No custom backend to host — the whole app is static and talks to Firebase
directly from the browser.

## Project setup

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   create a new project (the free "Spark" plan is enough).
2. Enable **Firestore Database** (production mode is fine — rules are in
   `firebase/firestore.rules`).
3. Enable **Authentication > Sign-in method > Google** (pick a support email
   when asked).
4. Add a **Web app** to the project and copy the `firebaseConfig` values.
5. In this project, copy `.env.example` to `.env` and fill in those values:

   ```bash
   cp .env.example .env
   ```

6. Publish the security rules: open Firestore > Rules in the console and
   paste in the contents of `firebase/firestore.rules` (or use the Firebase
   CLI: `firebase deploy --only firestore:rules`, if you have a
   `firebase.json` pointing at this file). **Re-publish this file any time it
   changes in the repo** — Firestore doesn't pick up rule changes on its own.

### 2. Install and run locally

```bash
npm install
npm run dev
```

Open the printed local URL and sign in with your own Google account. Since
nobody has set up the contest yet, you'll see a **first-time setup** screen —
continuing there makes your Google account the first admin (stored as your
email in Firestore, in `meta/config.adminEmails`). You can add more admins
later from the Admin page (e.g. a spouse or co-organizer), and invite the
rest of the family from the **Invited players** card there too.

### 3. Deploy to GitHub Pages

1. Push this folder to a new GitHub repository.
2. In the repo, go to **Settings > Pages** and set **Source** to
   **GitHub Actions**.
3. Add the Firebase config values as **repository secrets** (Settings >
   Secrets and variables > Actions): `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`.
4. Push to `main` — the included workflow (`.github/workflows/deploy.yml`)
   builds the app and deploys it to GitHub Pages automatically.
5. **Important:** once deployed, add your GitHub Pages domain (e.g.
   `yourname.github.io`) to Firebase **Authentication > Settings > Authorized
   domains** — Google sign-in will fail on the live site until you do this.

The workflow sets the Vite `base` path to `/<repo-name>/` automatically, so
it works whatever you name the repository (see `vite.config.ts` if you ever
need to override this for local production builds via the `BASE_PATH` env
var).

## Security model (read this)

This is built for casual use by a trusted family, not a public product, but
picks are still meant to be locked at a point in time — so the rules enforce
that server-side, not just in the UI:

- Every participant signs in with a real Google account, so
  `request.auth` in Firestore rules is a genuine per-person identity — not
  just a formality. Rules enforce that:
  - you can only write your own prediction (`request.auth.uid ==
    predictionId`), only while your invite is active (or you're an admin),
    **and only while voting is actually open** — once the admin ends voting,
    nobody (other than an admin, e.g. restoring a backup) can create or
    change a prediction doc anymore, even via devtools;
  - a submitted prediction's `memberName` must match your admin-assigned name
    or real Google name — you can't write a pick under someone else's name;
  - everyone's picks (and the final result) are only *readable* by other
    participants — including admins — once voting is no longer open; while
    it's open, everyone (admins too) can only read their own, so there's
    nothing to peek at even by inspecting network traffic. The trade-off:
    an admin's **Export backup** skips predictions entirely while voting is
    open, for the same reason — export again once it closes to include them.
    Any other export failure (a dropped connection, say) still surfaces as an
    error rather than silently producing an incomplete backup;
  - only active participants (invited-and-not-blocked, or admins) can read
    the contestant list, predictions, results, or past-season archives at
    all — a Google account that was never invited can't enumerate any of it,
    only see a "not invited" screen;
  - "who has submitted, and when" is tracked in its own `submissionStatus`
    collection - a thin companion to each prediction with just `memberName`
    and `updatedAt`, no `order` field at all, written alongside the real
    prediction in the same batch. Since it structurally can't reveal a pick,
    it stays readable to active participants regardless of voting status,
    which is what lets the admin's Submissions card show live progress
    during voting without exposing anyone's actual order;
  - only emails listed in `meta/config.adminEmails` can manage contestants,
    voting status, results, and the invite list;
  - an invited person can flip their own invite from `invited` to `active`
    the first time they sign in, and nothing else about their own member
    record — so a blocked account (status `blocked`, not `invited`) can
    never self-reactivate, and an active one can't smuggle in changes to
    other fields while doing so.
  (See `firebase/firestore.rules` for the exact rules.)
- The one soft spot is bootstrapping: the `meta/config` document can be
  *created* by anyone signed in (so the first visitor can become the first
  admin) but only *updated* by an existing admin afterwards. In practice this
  means whoever opens the freshly-deployed link first claims admin — so set
  it up yourself before sharing the link with the family. `meta/config`
  itself (admin emails, voting status, title) stays readable by any signed-in
  account, since the app needs it to even tell someone they're not invited.
- Only people an admin has invited (by email) can submit predictions; anyone
  else who signs in sees a "not invited" screen and can't participate.
- The Admins card's UI won't let you empty the admin list or remove your own
  access, but the underlying rule only requires *being* an admin to update
  `meta/config` — it doesn't stop an admin from emptying the list via a raw
  API call. That's self-inflicted, not exploitable by anyone else, but worth
  knowing: `meta/config` has no delete rule and can only be *updated* by an
  existing admin, so a sole admin locking themselves out this way would need
  the Firebase console to recover.
- **Whenever `firebase/firestore.rules` changes in this repo (as it has
  changed alongside these notes), re-publish it in the Firebase console** —
  Firestore doesn't pick up rule changes on its own, so a `git pull` alone
  doesn't update your live project's actual security posture.

## Project structure

```
src/
  components/     Reusable UI (drag-and-drop list, layout, leaderboard, ...)
  context/        Auth (Google sign-in), membership (invite/admin status),
                   and live Firestore data
  hooks/          useIsAdmin
  pages/          Login/setup, voting page, admin page, all-time leaderboard
  services/       Firestore reads/writes, scoring algorithm
firebase/
  firestore.rules Security rules to paste into the Firebase console
.github/workflows/deploy.yml   CI build + GitHub Pages deploy
```

## Resetting for next year

The admin page has a "danger zone" with a **Reset contest** button that clears
all current predictions and the final result (optionally the contestant list
too) and puts voting back to "not started", so the same deployment can be
reused for next year's contest. Before clearing anything, it archives the
current contestants, predictions, and result as a "season" snapshot — that's
what powers the past-submissions history on each invited player's row in the
Admin page. The invite list and admin list are left untouched by a reset.
