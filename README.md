# Eurovision Family Contest

A small React SPA for a family to predict the final standing of the Eurovision
Song Contest final, with an admin who manages the contestants and voting
window and enters the real result once the show is over.

## How it works

- Everyone signs in with their own **Google account** — no shared password to
  hand out. The first person to ever sign in becomes the first admin.
- **Admin(s)** set up the contestant countries and their running (performance)
  order, then manually **start voting**.
- While voting is **open**, each **family member** drags the contestants into
  the order they predict they'll actually finish in (1st place at the top).
  They can change their mind and resubmit as many times as they like.
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
- Firebase (Firestore for data, Google sign-in for identity)
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
   `firebase.json` pointing at this file).

### 2. Install and run locally

```bash
npm install
npm run dev
```

Open the printed local URL and sign in with your own Google account. Since
nobody has set up the contest yet, you'll see a **first-time setup** screen —
continuing there makes your Google account the first admin (stored as your
email in Firestore, in `meta/config.adminEmails`). You can add more admins
later from the Admin page (e.g. a spouse or co-organizer).

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

This is built for casual use by a trusted family, not a public product:

- Every participant signs in with a real Google account, so
  `request.auth` in Firestore rules is a genuine per-person identity — not
  just a formality. Rules enforce that you can only write your own
  prediction (`request.auth.uid == predictionId`), and that only emails
  listed in `meta/config.adminEmails` can manage contestants, voting status,
  and results (see `firebase/firestore.rules`).
- The one soft spot is bootstrapping: the `meta/config` document can be
  *created* by anyone signed in (so the first visitor can become the first
  admin) but only *updated* by an existing admin afterwards. In practice this
  means whoever opens the freshly-deployed link first claims admin — so set
  it up yourself before sharing the link with the family.
- Anyone with a Google account can sign in and submit a prediction under
  their own name; there's no invite-only allowlist of family members. That's
  fine for a link only your family has, but don't post it publicly.

## Project structure

```
src/
  components/     Reusable UI (drag-and-drop list, layout, leaderboard, ...)
  context/        Auth (Google sign-in state) and live Firestore data
  hooks/          useIsAdmin (checks the signed-in email against adminEmails)
  pages/          Login/setup, family member voting page, admin page
  services/       Firestore reads/writes, scoring algorithm
firebase/
  firestore.rules Security rules to paste into the Firebase console
.github/workflows/deploy.yml   CI build + GitHub Pages deploy
```

## Resetting for next year

The admin page has a "danger zone" with a **Reset contest** button that clears
all predictions and the final result (optionally the contestant list too) and
puts voting back to "not started", so the same deployment can be reused for
next year's contest. The admin list is left untouched.
