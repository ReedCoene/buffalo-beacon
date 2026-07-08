# Buffalo Beacon

A live directory of open shelters, food pantries, and warming centers — built so
that when a Buffalo winter storm hits, the people who need a warm place or a hot
meal can find one, and the organizations that open their doors can tell everyone
in seconds.

## Why this exists

During the December 2022 blizzard (Winter Storm Elliott), dozens of people in Erie
County died — many stranded or trying to walk for help. When a church, pantry, or
community center decides to open during a storm, there's no reliable place for the
people who need it most to find out. It ends up as a hand-written sign on a door or
a scattered Facebook post the most vulnerable residents never see. Buffalo Beacon is
the missing layer: one clean page anyone can check, and one-tap email alerts when a
place opens.

## What it does

- **Public directory** — anyone can view open/closed status, hours, what's offered,
  and a one-click Google Maps directions link. Open orgs sort to the top.
- **Organization dashboard** — vetted orgs log in with a passwordless magic link and
  update their status in seconds. Name, address, and hours are required.
- **AI description helper** — a coordinator types a rough note ("open 9-3 today, hot
  food, giving away toiletries") and Claude turns it into a clean, warm public listing
  they can accept or discard. Facts are preserved; nothing is invented.
- **Subscriber alerts** — neighbors, family, and social workers subscribe to a
  specific org and get an email the moment it opens or closes. Every email has an
  unsubscribe link.

## How AI is used

Claude (`claude-sonnet-4-6`, see `lib/claude.js`) rewrites a staff member's shorthand
into a public-ready description. The prompt is constrained to **keep every concrete
fact and invent nothing** — critical when people act on this info in a crisis. The
"Improve with AI" button shows a preview the org can accept or reject; it never
auto-overwrites their words.

## Safety decisions (deliberate)

- **Org accounts are admin-provisioned, not self-signup.** Anyone could otherwise
  claim to be "a shelter" and post fake "we're open" info that someone relies on in a
  storm. Orgs are added via `add-org.js` only after being vetted.
- **Magic-link login** — no passwords to leak; tokens are single-use and expire in 15
  minutes (`lib/logic.js` `isTokenUsable`).
- **Login doesn't reveal which emails have accounts** — same "check your email"
  message either way.
- **Subscribers are only notified on real changes** (open/closed or hours), never on a
  cosmetic description edit, so alerts stay trustworthy and don't become spam.

## Running it

```bash
npm install
npm run seed        # adds the two seeded Buffalo orgs
npm start           # http://localhost:3000
npm test            # runs the security/notify self-checks
```

Without API keys it runs fully in **dev mode**: emails (login links + alerts) print to
the terminal instead of sending, and "Improve with AI" returns the original text
unchanged. Add keys in `.env` (copy from `.env.example`) to go live:

- `ANTHROPIC_API_KEY` — turns on real AI description polishing
- `RESEND_API_KEY` — turns on real email delivery

## Adding a real organization

```bash
node add-org.js "Friends of Night People" "their-real-email@example.org"
```

They then log in at `/login` with that email — no password.

## Tech

Node's built-in `http`/`sqlite` + Express + EJS. No build step, no ORM, no native
compilation. `lib/logic.js` holds the pure security/notify logic and is unit-tested in
`test.js`.

## Troubleshooting notes (things that broke and how they were fixed)

1. **`better-sqlite3` wouldn't install** — its native build needs Python + a C++
   toolchain, which failed on this machine (unsupported Python). Fix: switched to
   Node's built-in `node:sqlite` module (stable since Node 22.5), same API shape, zero
   native compilation. One-line change in `db.js`, dependency deleted.
2. **Preview server refused to launch** — the process ran from a different working
   directory, so relative `views`/`public`/`.env` paths didn't resolve. Fix: made all
   paths absolute with `path.join(__dirname, ...)` in `server.js`.
