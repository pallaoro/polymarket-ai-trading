# Roadmap

## X / Twitter sentiment signal (deferred)

A **momentum** signal sourced from X (Twitter), to sit *alongside* — not inside —
the mean-reversion engine. Off by default.

**Why it's separate, not a tweak.** The core strategy is contrarian: it fades
crowd overreaction. X sentiment is the opposite play — front-run breaking news
faster than retail. The Polymarket ecosystem confirms this is a real edge
(GraphAI / PolyTale / Alphascope monitor X sentiment + smart-money wallet flow
and alert on confluence), but it's *trend-following*. So it ships as a second,
toggleable `x-sentiment` strategy module with its own signals table, never as a
modifier on the Kelly/mean-reversion path.

**Wire it with the new packages — not the old credential binding.**
- Use **`@clawnify/connections`** (`connect("twitter", env)`) + the
  **`@clawnify/integrations`** descriptor registry. Reference consumer:
  **`open-ads-report`** (`src/server/requires.ts` + providers).
- Do **not** copy `open-post`'s pattern (`clawnify.json` `credentials: ["twitter"]`
  + `env.CREDENTIALS.getToken(...)`) — that's the superseded approach.
- Declare the X requirement via the connections `requires`/`describe` surface so
  the agent can see what's needed, instead of a raw `app.credentials` entry.

**Open design questions before building.**
- Live data only — the LLM's frozen knowledge is useless here; needs the X API
  (paid) and/or a news feed.
- Noise filter — an LLM pass to extract resolution-relevant events, not vibe.
- Confluence gate — pair X sentiment with smart-money wallet flow before acting,
  matching what actually works in the ecosystem.
- Only pays if fast; measure latency end-to-end.

Scope it as its own PR. Keep the v1 app purely price-driven until then.
