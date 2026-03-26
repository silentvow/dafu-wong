# TODOs

## Deferred from Game Rules Overhaul v2 (2026-03-26)

### Card reveal flip animation
**What:** Add a flip/reveal animation when drawing chance or fate cards.
**Why:** Visual polish — the dramatic reveal heightens suspense before players see a瘟疫 or 天降地契.
**Effort:** S (human: ~2h / CC: ~10min)
**Priority:** P2

### Date stuck state when partner goes offline
**What:** If the date initiator picks a partner who then closes their browser, the game enters `date_rolling` with only one player present. The remaining player can roll but the absent partner never rolls, leaving the game permanently stuck.
**Why:** Currently there's no timeout or host-override to break the deadlock. Any disconnection during a date ruins the session.
**Effort:** M (human: ~1 day / CC: ~20min) — options include: (a) 60-second per-player roll timeout that auto-resolves with a random roll for the absent party, or (b) host-force-resolve button to abort the date and advance the turn.
**Priority:** P1 — reproducible in any multi-session game where someone rage-quits.
**Context:** Raised by /plan-eng-review 2026-03-26. The `date_rolling` phase stores `initiator_id` and `partner_id` in `phase_data`; a timeout could be checked server-side when any action arrives, similar to how `isRansomExpired` works for steals.

### Emoji reactions during steal countdown
**What:** 😱🤣🔥 emoji reactions displayed to all players during the 30-second steal countdown, sent via Supabase Realtime broadcast channel.
**Why:** Creates shared tension and social hilarity during the most dramatic moment of a turn.
**Effort:** M (human: ~1 day / CC: ~20min) — requires a new Realtime broadcast channel separate from postgres_changes.
**Priority:** P2
