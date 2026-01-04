# Montes Mystery Mansion (Apple IIe, Allowlist + Doubt)

Apple IIe-style terminal adventure built with Vite + TypeScript. The game is hidden behind Google sign-in *and* an email allowlist. Only approved users can see the UI or read Firestore. A single puzzle guards a brass key; an optional AI helper (Cloud Function) can translate freeform input into a supported command. “Doubt” whispers in the upper-right and quiets as you progress.

## Safety & Secrets
- Do **not** commit `.env.local` or `serviceAccountKey.json` (both gitignored).
- Frontend only loads Firebase client config via `VITE_FIREBASE_*` in `.env.local`.
- OpenAI keys are **never** in the browser. For the Cloud Function, set `OPENAI_API_KEY` in your shell (local) or via `firebase functions:secrets:set OPENAI_API_KEY` (deploy). Optional `OPENAI_MODEL` override (default: `gpt-5-mini-2025-08-07`).
- Firestore rules gate all reads: must be signed in *and* allowlisted. Client cannot write rooms/allowlist; per-user gameState is restricted to its owner + allowlist.

## Setup
1) `npm install`
2) Firebase prep: create a project, enable Firestore, enable Google sign-in in Authentication.
3) Link locally: `firebase login` then `firebase use --add` (sets `.firebaserc`).
4) Copy `.env.example` → `.env.local` and fill `VITE_FIREBASE_*` (keep private).
5) Admin creds for seeding: download a service account JSON and set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json` (or `SERVICE_ACCOUNT_PATH`). File stays local.
6) Allowlist emails: `export APPROVED_EMAILS="you@example.com,ally@example.com"` then seed: `npm run seed`
7) Deploy Firestore rules: `firebase deploy --only firestore:rules`
8) Functions (AI helper):
   - Local: `cd functions && npm install` (already locked), then `export OPENAI_API_KEY="..."` (and optionally `export OPENAI_MODEL="gpt-5"`), then `firebase emulators:start --only functions`
   - Deploy: `firebase functions:secrets:set OPENAI_API_KEY`, optional model override via `firebase functions:config:set openai.model="gpt-5"` (falls back to the default if unset). After any config change, run `firebase deploy --only functions`.
9) Run the app: `npm run dev` (browser talks to Firestore + callable function)

## Commands (local parser; AI helper only on unknowns if enabled)
- `help`, `look`
- `enter` / `go inside` (Entrance → Main), `back` / `go out` (Main → Entrance), `go inside|out`
- `examine desk|drawer|mirror|table|room`, `search` (hint)
- `enter code ####` / `use code ####` (correct: `4312`)
- `open drawer`, `take key`
- `inventory`
- `ai help on` / `ai help off`
- `quit` / `exit` (locks input and prints `SESSION ENDED`)

## Puzzle (only one)
- Main Room desk with locked drawer.
- Hint: `search` → “4 • 3 • 1 • 2”.
- `enter code 4312` unlocks drawer (`drawerUnlocked=true`, `solved=true`, doubtPhase ≥ 2).
- `open drawer` then `take key` (adds `brass key`, sets `keyTaken=true`, doubtPhase=3).

## Doubt Overlay
- Upper-right ghost text, no box. Phases:
  - 0: hesitant first-person (start).
  - 1: after entering Main.
  - 2: after solving code.
  - 3: after taking key (nearly silent).

## Data Model
- `rooms/{entrance|main}`: `name`, `description`, `exits` map, `createdAt`
- `allowlist/{uid}`: `email`, `approvedAt`
- `gameState/{uid}`: `currentRoomId`, `inventory` (string[]), `puzzle` ({`solved`, `drawerUnlocked`, `keyTaken`}), `doubtPhase` (0–3), `aiHelpEnabled`, `updatedAt`

## Files
- Frontend: `index.html`, `src/main.ts`, `src/app.ts`, `src/parser.ts`, `src/state.ts`, `src/world.ts`, `src/access.ts`, `src/auth.ts`, `src/aiClient.ts`, `src/doubt.ts`, `src/ui.ts`, `src/styles.css`
- Backend: `firestore.rules`, `firebase.json`, `.firebaserc`, `scripts/seed-firestore.ts`
- Functions: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`
- Env: `.env.example` (placeholders), `.env.local` (private)

## Sample Flow (Doubt progression + AI helper)
```
Not signed in: shows “Sign In with Google”.
Signed in but not allowlisted: “Access denied” with your email and Sign Out.
Approved user:
WELCOME TO MONTES MYSTERY MANSION
TYPE "HELP" FOR COMMANDS.
Mansion Entrance
A heavy door leads inside.
Exits: INSIDE
AI HELP: OFF | Doubt (phase 0): "This place is too much. Why bother stepping inside?"
] enter
You move inside.
Main Room
A dusty desk with a locked drawer sits nearby.
Exits: OUT
Doubt (phase 1) mutters.
] search
You trace the desk carvings: 4 • 3 • 1 • 2.
] enter code 4312
The lock clicks open. The drawer is now unlocked.
Doubt shifts (phase 2).
] open drawer
The drawer slides open. A brass key glints inside.
] take key
You take the brass key. Doubt fades (phase 3).
] ai help on
AI help enabled.
] what should i do now?
Consulting AI helper...
AI helper suggests: look
Mansion Entrance
...
] quit
SESSION ENDED
```
