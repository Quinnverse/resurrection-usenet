# Privacy notice — Resurrection

**Project creator:** Quinnverse. **Licence:** MIT (see `LICENSE`).

## What the game stores
- **Your progress only.** Each game is saved on the game server as one file containing the game state (evidence found, choices made, record text, agent state) and two timestamps: when the game was created and when it was last used.
- **A random session ID.** The game creates a 256-bit random identifier. Your browser keeps it in local storage under the key `resurrection.sessionId`. Anyone who has this identifier can read or delete that save, so treat it as a password.
- **Nothing else.** No account, name, email address, IP address, cookie, or device fingerprint is requested or stored by the game.

## What the game does not store
- The game server does not write IP addresses, user agents, request headers or email addresses to its logs. Log lines contain only start-up messages and save-cleanup counts.
- Session IDs are never written to logs. Save file names are never shown to visitors.
- The in-game text contains fictional email-style addresses (for example `elena.vance@palimpsest`). These are invented characters in the story, not real contacts.

## How long a save lasts
- A save expires after **seven days without activity**. Each action and each page load counts as activity.
- The game server removes expired saves when it starts and then every 24 hours.
- Saves are not backed up. If the server's disk is lost, or a save expires, the progress is gone.

## How to delete a save
- In the game, choose **Reset game**, then **Delete save only, then return to the start** (or **Delete and start over**, which also begins a new game).
- Clearing this site's data in your browser forgets the session ID, but the server copy is then unreachable and expires on its own.
- Programmatically: `DELETE /api/sessions/{sessionId}` returns `{"deleted": true}`. Only the session ID in the path is needed.

## Infrastructure providers
The game can run on any host. A hosting provider may independently process network metadata such as IP addresses, request times and user agents to route and protect traffic, under its own privacy policy. The game does not add these to its saves or logs, but it cannot control what the provider keeps. Check the provider's policy before any public deployment.

## Protecting a save
- Save files are created with owner-only permissions (`0600`) inside an owner-only directory (`0700`).
- Saves are limited to 256 KB. Oversized saves are refused, and the previous save is kept.
- Writes are atomic: a save is either fully written or not written at all.

## Changes to this notice
Update this file, the opening-screen notice in `frontend/src/main.jsx`, and the tests in `test/session.test.js` together.
