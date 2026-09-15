# Eurovision Family Contest

A small React SPA for a family to predict the final standing of the Eurovision
Song Contest final, with an admin who manages the contestants and voting
window and enters the real result once the show is over.

## How it works

- **Admin** sets up the contestant countries and their running (performance)
  order, then manually **starts voting**.
- While voting is **open**, each **family member** logs in with their name and
  a shared family PIN, then drags the contestants into the order they predict
  they'll actually finish in (1st place at the top). They can change their
  mind and resubmit as many times as they like.
- The admin manually **ends voting**, then enters the **actual final
  standing** once it's announced.
- The app automatically computes each family member's score (sum of how far
  off each country's predicted position was from its real position — lower is
  better, 0 is a perfect prediction) and shows a leaderboard.

Everything updates live for everyone via Firestore, so nobody needs to
refresh when the admin opens/closes voting or the results come in.

## Tech stack

- React 19 + TypeScript + Vite
- React Router (`HashRouter`, so it works on GitHub Pages without extra
  server config)
- Firebase (Firestore for data, anonymous Auth just to satisfy security
  rules — see "Security model" below)
- [`@dnd-kit`](https://dndkit.com/) for the drag-and-drop ordering lists
- Deployed to **GitHub Pages** via GitHub Actions

No custom backend to host — the whole app is static and talks to Firebase
directly from the browser.

## Project setup

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   create a new project (the free "Spark" plan is enough).
2. Enable **Firestore Database** (production mode is fine — rules are in
   `firebase/firestore.rules`).
3. Enable **Authentication > Sign-in method > Anonymous**.
4. Add a **Web app** to the project and copy the `firebaseConfig` values.
5. In this project, copy `.env.example` to `.env` and fill in those values:

   ```bash
   cp .env.example .env
   ```

6. Publish the security rules: open Firestore > Rules in the console and
   paste in the contents of `firebase/firestore.rules` (or use the Firebase
   CLI: `firebase deploy --only firestore:rules`, if you have a
   `firebase.json` pointing at this file).

### 2. Install and run locally

```bash
npm install
npm run dev
```

Open the printed local URL. The very first person to open the app (usually
you, testing it) will see a **first-time setup** screen to choose the shared
family PIN and the admin password — these are hashed (SHA-256) before being
stored in Firestore, never stored in plain text.

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

The workflow sets the Vite `base` path to `/<repo-name>/` automatically, so
it works whatever you name the repository (see `vite.config.ts` if you ever
need to override this for local production builds via the `BASE_PATH` env
var).

## Security model (read this)

This is built for casual use by a trusted family, not a public product:

- The family PIN and admin password are stored as SHA-256 hashes in Firestore
  and checked client-side — there's no server to keep secrets on, since the
  whole app is static.
- Firestore security rules only require that a request is authenticated
  (anonymously — anyone can get an anonymous Firebase session with no
  credentials). They do **not** independently enforce the PIN/admin checks.
- Practically: anyone who has your Firebase config values (which are public
  in the built JS bundle, by nature of being a client-side app) could in
  principle write directly to Firestore, bypassing the UI.

For a family prediction game this is a reasonable trade-off. If you want
stronger guarantees, move the PIN/admin verification into Firebase Cloud
Functions (callable functions) and tighten `firestore.rules` to only allow
writes through those functions.

## Project structure

```
src/
  components/     Reusable UI (drag-and-drop list, layout, leaderboard, ...)
  context/        Session (who's logged in) and live Firestore data
  pages/          Login/setup, family member voting page, admin page
  services/       Firestore reads/writes, scoring algorithm, hashing
firebase/
  firestore.rules Security rules to paste into the Firebase console
.github/workflows/deploy.yml   CI build + GitHub Pages deploy
```

## Resetting for next year

The admin page has a "danger zone" with a **Reset contest** button that clears
all predictions and the final result (optionally the contestant list too) and
puts voting back to "not started", so the same deployment can be reused for
next year's contest.
