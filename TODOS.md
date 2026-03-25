# TODOs

## Deferred from Game Rules Overhaul v2 (2026-03-26)

### Card reveal flip animation
**What:** Add a flip/reveal animation when drawing chance or fate cards.
**Why:** Visual polish — the dramatic reveal heightens suspense before players see a瘟疫 or 天降地契.
**Effort:** S (human: ~2h / CC: ~10min)
**Priority:** P2

### Emoji reactions during steal countdown
**What:** 😱🤣🔥 emoji reactions displayed to all players during the 30-second steal countdown, sent via Supabase Realtime broadcast channel.
**Why:** Creates shared tension and social hilarity during the most dramatic moment of a turn.
**Effort:** M (human: ~1 day / CC: ~20min) — requires a new Realtime broadcast channel separate from postgres_changes.
**Priority:** P2
