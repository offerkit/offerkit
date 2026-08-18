---
"@offerkit/cli": minor
---

Fix CLI commands to call the typed SDK procedures with the correct inputs, including webhook delivery replay and staff password reset without the obsolete JSON data argument.

Technically breaking corrections for scripts that relied on commands which the API never supported:

- Remove `offerkit promotions tiers get`; use `offerkit promotions tiers list` to inspect promotion tiers.
- Remove `--data` from `offerkit users reset-password <id>`; the reset-password endpoint accepts only the user ID.
