# status/

`https://vulcx.xyz/status/` — served by the same GitHub Pages deploy as the rest of
`landing_page`. No build step, no vendor, no extra DNS record.

## How it works

`index.html` runs three checks in the visitor's browser, every 30s:

| Check | Endpoint | What a pass proves |
|---|---|---|
| API | `GET api.vulcx.xyz/health` | the process answers and reports `{"status":"ok"}` |
| Routing | `GET api.vulcx.xyz/api/v1/quote` | pool state is fresh enough to return a real route — `/health` can pass while quoting is broken |
| Swaps | `GET api.vulcx.xyz/health/swap` | a real transaction was routed, built and simulated against the chain within the last probe interval — the only check that touches the builder, the LUTs and the blockhash feed |

The three are deliberately in increasing order of how much they prove. `/health` and
`/api/v1/quote` both answered 200 straight through a total swap outage once, for
hours, across four deploys; the Swaps row exists because of that. Its endpoint is
served by `internal/canary` in route-engine, which probes on a timer and caches the
verdict — so the latency column times the fetch, not the swap, and the note carries
the age of the probe instead.

Only publicly released services belong here. A check for something that has not
shipped shows a permanent red and teaches readers to ignore the page.

**Self-hosting is not released yet**, so there is no license-server check. The block
to re-enable when it ships is commented out in `index.html` next to the others, with
a note on why it must use `mode: 'no-cors'`.

Thresholds live at the top of the script: `SLOW_MS` (1500) is the operational →
degraded line, `TIMEOUT_MS` (8000) is the → down line.

## The fourth row state

A row is `operational`, `degraded`, `down` — or **hollow-dotted and neutral**, which
means the check could not be judged. That state exists because the two failure modes
below are not outages, and painting them red is precisely how a status page trains
its readers to skip it:

| Row reads | When |
|---|---|
| `not monitored` | `/health/swap` answers `"status":"disabled"` (the canary is not switched on for this node), or 404s (the deployed engine predates the endpoint) |
| `unverifiable` | `fetch` rejected with a `TypeError` **and** the check declares a `browserBlocked` reason — see below |

Neutral rows are excluded from the headline verdict's arithmetic and counted
separately ("… 1 not verified from here."). Announcing "2 of 3 checks failing" when
one of them was never readable is the same false red, written as a sentence.

`browserBlocked` is opt-in per check, and must stay that way: `fetch` rejects with a
bare `TypeError` both for a CORS refusal and for a dead connection, and gives the page
nothing to tell them apart. Only a check that has a specific, known, non-outage reason
to be unreadable sets it — every other check still reads a `TypeError` as `down`, so a
real outage cannot hide behind that branch.

## Note: `/health` shipped with no CORS header

`/health` was registered above `r.Use(cors.New(...))`, and gin binds a route's
middleware chain at registration time — so it went to production with **no
`Access-Control-Allow-Origin` at all**. Verified against production 2026-09-08:
`/api/v1/quote` returns `Access-Control-Allow-Origin: *`, `/health` returns no CORS
header. A browser therefore cannot read it, the fetch rejects, and **the API row was
permanently red while the API was perfectly healthy** — the page's own worst failure
mode, shipped by the page's most trusted check.

The engine-side fix is on route-engine branch **`swap-canary`** (builds the CORS
middleware before the health routes and attaches it explicitly; pinned by
`internal/http/health_cors_test.go`). It is not deployed yet, and neither is
`/health/swap` — until it is, the API row reads `unverifiable` with the reason, and
the Swaps row reads `not monitored`. Both rows correct themselves the moment the
deploy lands; nothing here needs a second edit.

## Recording an incident

Append to `incidents.json` and push. Newest is sorted first; the ten most recent render.

```json
[
  {
    "date": "2026-08-31",
    "title": "License server unreachable over TLS",
    "status": "resolved",
    "body": "nginx served the retired api.argyros.xyz certificate for license.vulcx.xyz, so every client rejected the handshake. Rebound the correct certificate; self-host activation restored."
  }
]
```

`date` (ISO, used for sort), `title`, and `body` are shown; `status` renders as a tag
and is free text — `investigating`, `degraded`, `resolved`.

## Known limit

Checks run from the visitor's browser, so they measure the path between that visitor
and Vulcx — not a monitoring network's view. If the host serving this page is down,
the page cannot load to report it. The page says so. If that stops being acceptable,
the replacement is an external prober (Better Stack / Instatus) with
`status.vulcx.xyz` CNAME'd at it.
