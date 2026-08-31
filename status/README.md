# status/

`https://vulcx.xyz/status/` — served by the same GitHub Pages deploy as the rest of
`landing_page`. No build step, no vendor, no extra DNS record.

## How it works

`index.html` runs three checks in the visitor's browser, every 30s:

| Check | Endpoint | What a pass proves |
|---|---|---|
| API | `GET api.vulcx.xyz/health` | the process answers and reports `{"status":"ok"}` |
| Routing | `GET api.vulcx.xyz/api/v1/quote` | pool state is fresh enough to return a real route — `/health` can pass while quoting is broken |

Only publicly released services belong here. A check for something that has not
shipped shows a permanent red and teaches readers to ignore the page.

**Self-hosting is not released yet**, so there is no license-server check. The block
to re-enable when it ships is commented out in `index.html` next to the others, with
a note on why it must use `mode: 'no-cors'`.

Thresholds live at the top of the script: `SLOW_MS` (1500) is the operational →
degraded line, `TIMEOUT_MS` (8000) is the → down line.

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
