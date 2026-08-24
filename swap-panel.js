/* Vulcx swap panel — live against the public quote API.
   No build step, no dependencies. Quote only: signing and submission
   belong to the caller's wallet, not to this file. */
(function () {
  'use strict';

  var BASE = 'https://api.vulcx.xyz';
  var DEBOUNCE_MS = 260;
  var REFRESH_LEAD_MS = 400;   // re-quote this long before the quote expires
  // Hot-loop guard only -- NOT a budget knob. This is a floor on how often we
  // re-quote; when it sat above the quote's own TTL (4000 vs validForMs 3000)
  // every cycle ended with a dead quote on screen until the refresh fired.
  // Keep it below the shortest TTL the server hands out.
  var MIN_REFRESH_MS = 1000;
  var SWAP_COST = 5;           // /swap debits 5 units; /quote debits 1
  var EXPLORER = 'https://fogoscan.com';

  /* Publishable API key for this origin. Empty = keyless: the panel polls and
     is capped at ~1 req/s (burst 5), which is why the swap build costs the whole
     burst and a retry after a failure 429s.

     This key ships in page source and is world-readable BY DESIGN — it is safe
     only because it is minted with allowed_origins locked to this site, which
     the edge enforces on both the REST chain and the /stream handshake. Never
     paste a key here that is not origin-locked. */
  var API_KEY = '';
  var WS_BASE = BASE.replace(/^http/, 'ws');

  // Platform fee on swaps made here, in bps. /quote does not apply it, so
  // applyPlatformFee() subtracts it client-side and the figure on screen
  // matches what the built transaction delivers.
  var PLATFORM_FEE_BPS = 10;
  // Vulcx's fee-collection wallet on Fogo. Its output-mint ATA is created
  // idempotently inside the swap transaction itself — no separate setup step.
  var REFERRER_WALLET = 'BjpJiZB7mPAJeaXwTVPWUSFtMZfW7yHiM1thBzorut6Q';

  /* Client-side mirror of the server's keyless bucket (burst 5, refill ~1/s).
     Measured, not documented: 5 requests land, the 6th 429s. Spending blind here
     means the swap build — which costs the whole burst — fails at random. */
  var budget = API_KEY
    ? { units: 200, cap: 200, rate: 100, last: Date.now() }   // published per-key budget
    : { units: 5, cap: 5, rate: 1, last: Date.now() };
  function refill() {
    var now = Date.now();
    budget.units = Math.min(budget.cap, budget.units + (now - budget.last) / 1000 * budget.rate);
    budget.last = now;
  }
  function spend(n) {           // returns ms to wait, 0 if affordable now
    refill();
    if (budget.units >= n) { budget.units -= n; return 0; }
    return Math.ceil((n - budget.units) / budget.rate * 1000) + 150;
  }

  var el = {};
  var tokens = [];
  var state = {
    inMint: null, outMint: null,
    amount: '1',
    quote: null, status: 'idle', error: null,
    seq: 0,
    // 0.5% could not survive the build->sign->submit window: FOGO drifts ~0.9%
    // over minutes and the wallet dialog is open for tens of seconds, so the
    // min-out anchored at build time went unreachable and the program rejected
    // the swap with 0x1776 SlippageExceeded.
    slippageBps: 100,
    wallet: null,          // { address, label, chain, chainExact }
    tx: { status: 'idle', signature: null, error: null },
  };
  var debounceT = null, refreshT = null, tickT = null, inflight = null;

  /* ---------- amounts ---------- */

  function decimalsOf(mint) {
    var t = tokens.find(function (x) { return x.mint === mint; });
    return t ? t.decimals : 0;
  }
  function symbolOf(mint) {
    var t = tokens.find(function (x) { return x.mint === mint; });
    return t ? t.symbol : mint.slice(0, 4) + '…';
  }
  // "1.25" + 9 decimals -> "1250000000", without floating point
  function toBaseUnits(human, dec) {
    var s = String(human).trim();
    if (!s || !/^\d*\.?\d*$/.test(s)) return null;
    var parts = s.split('.');
    var whole = parts[0] || '0';
    var frac = (parts[1] || '').slice(0, dec);
    while (frac.length < dec) frac += '0';
    var out = (whole + frac).replace(/^0+(?=\d)/, '');
    return out === '' ? '0' : out;
  }
  function fromBaseUnits(base, dec) {
    var s = String(base);
    if (dec === 0) return s;
    while (s.length <= dec) s = '0' + s;
    var whole = s.slice(0, s.length - dec);
    var frac = s.slice(s.length - dec).replace(/0+$/, '');
    return frac ? whole + '.' + frac : whole;
  }

  /* ---------- api ---------- */

  function getTokens() {
    return fetch(BASE + '/api/v1/tokens')
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.tokens || (j.data && j.data.tokens) || []; });
  }

  function authHeaders(extra) {
    var h = extra || {};
    if (API_KEY) h.Authorization = 'Bearer ' + API_KEY;
    return h;
  }

  function getQuote(params) {
    if (inflight) inflight.abort();
    var ac = new AbortController();
    inflight = ac;
    var qs = new URLSearchParams(params).toString();
    return fetch(BASE + '/api/v1/quote?' + qs, { signal: ac.signal, headers: authHeaders() })
      .then(function (r) {
        return r.json().then(function (j) { return { http: r.status, body: j }; });
      })
      .then(function (res) {
        if (res.body && res.body.success === false) {
          var raw = res.body.error;
          var msg = typeof raw === 'string' ? raw : (raw && (raw.message || raw.code)) || 'Quote failed';
          var e = new Error(msg.charAt(0).toUpperCase() + msg.slice(1) + '.');
          e.code = (raw && raw.code) || res.http;
          throw e;
        }
        if (res.http >= 400) {
          var e2 = new Error('HTTP ' + res.http); e2.code = res.http; throw e2;
        }
        return res.body.data || res.body;
      })
      .finally(function () { if (inflight === ac) inflight = null; });
  }

  function postSwap(body) {
    return fetch(BASE + '/api/v1/swap', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) { return { http: r.status, body: j }; });
    }).then(function (res) {
      if (res.body && res.body.success === false) {
        var raw = res.body.error;
        var msg = typeof raw === 'string' ? raw : (raw && raw.message) || 'Swap build failed';
        var e = new Error(msg.charAt(0).toUpperCase() + msg.slice(1) + '.');
        e.code = res.http;
        throw e;
      }
      if (res.http >= 400) { var e2 = new Error('HTTP ' + res.http); e2.code = res.http; throw e2; }
      return res.body.data || res.body;
    });
  }

  /* ---------- quoting cycle ---------- */

  // Mutates q in place. BigInt keeps this exact at any token's decimals — these
  // are base-unit integer strings, never floats.
  //
  // Both figures must move together. Deducting the fee from amountOut alone left
  // "min received" on the raw pre-fee basis, so the panel showed a floor 0.4%
  // under the quote while the user had 0.5% selected — a tighter window than the
  // one they chose, and two numbers that could not both be right.
  function applyPlatformFee(q) {
    if (!q || !PLATFORM_FEE_BPS) return;
    var keep = BigInt(10000 - PLATFORM_FEE_BPS);
    ['amountOut', 'otherAmountThreshold'].forEach(function (k) {
      if (!q[k]) return;
      try {
        q[k] = (BigInt(q[k]) * keep / BigInt(10000)).toString();
      } catch (e) { /* non-integer: leave it untouched rather than guess */ }
    });
  }

  function scheduleRefresh(q) {
    clearTimeout(refreshT);
    var ttl = q && q.validForMs ? q.validForMs : 3000;
    // While the socket is live it re-prices faster than any poll could, so REST
    // only needs to refresh the structure. On disconnect onclose restores this.
    var delay = wsLive
      ? STREAM_REFRESH_MS
      : Math.max(MIN_REFRESH_MS, ttl - REFRESH_LEAD_MS);
    refreshT = setTimeout(function () { runQuote(true); }, delay);
  }

  /* ---------- live quote stream ----------

     /stream pushes a fresh price on every pool change, which is what makes the
     figure tick instead of stepping every few seconds. It does NOT carry the
     whole quote: no route composition, no feeBps, no threshold. So REST stays
     the source of structure and the stream only re-prices it — when the pair or
     amount changes we re-quote over REST, then re-subscribe.

     The endpoint always requires a key, keyless or not, so all of this stays
     dormant until API_KEY is set. */
  var wsSock = null, wsSub = null, wsBackoff = 1000, wsLive = false, wsTimer = null;
  var WS_BACKOFF_MAX = 15000;
  var STREAM_REFRESH_MS = 15000;  // structure only; price arrives on the socket

  function subKey(p) { return p ? p.in + '|' + p.out + '|' + p.amount : null; }

  function currentPair() {
    var base = toBaseUnits(state.amount, decimalsOf(state.inMint));
    if (!state.inMint || !state.outMint || !base || base === '0') return null;
    return { in: state.inMint, out: state.outMint, amount: base, exactIn: true };
  }

  function wsSend(obj) {
    if (wsSock && wsSock.readyState === 1) {
      try { wsSock.send(JSON.stringify(obj)); return true; } catch (e) { /* closing */ }
    }
    return false;
  }

  function wsResubscribe() {
    var pair = currentPair();
    var next = subKey(pair);
    if (next === wsSub) return;
    if (wsSub) {
      var prev = wsSub.split('|');
      wsSend({ op: 'unsubscribe', pairs: [{ in: prev[0], out: prev[1], amount: prev[2], exactIn: true }] });
    }
    wsSub = null;
    if (pair && wsSend({ op: 'subscribe', pairs: [pair] })) wsSub = next;
  }

  function wsConnect() {
    if (!API_KEY || wsSock) return;
    var sock;
    try {
      sock = new WebSocket(WS_BASE + '/api/v1/stream?key=' + encodeURIComponent(API_KEY));
    } catch (e) { return; }
    wsSock = sock;

    sock.onopen = function () {
      wsBackoff = 1000; wsLive = true; wsSub = null;
      wsResubscribe();
    };

    sock.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'quote') return onStreamQuote(msg);
      // A pinned quote drifted past the firm margin: drop the id so the next
      // swap builds a fresh route instead of racing a 409/410 at redemption.
      if (msg.type === 'invalidate' && state.quote && state.quote.quoteId === msg.quoteId) {
        state.quote.quoteId = null;
      }
    };

    sock.onclose = function () {
      if (wsSock !== sock) return;
      wsSock = null; wsSub = null; wsLive = false;
      // Polling is the fallback, so put the normal cadence back immediately
      // rather than leaving the panel on the slow structural refresh.
      if (state.quote) scheduleRefresh(state.quote);
      clearTimeout(wsTimer);
      wsTimer = setTimeout(wsConnect, wsBackoff);
      wsBackoff = Math.min(WS_BACKOFF_MAX, wsBackoff * 2);
    };

    sock.onerror = function () { try { sock.close(); } catch (e) { /* onclose handles it */ } };
  }

  // Re-price the current quote from a push. Structure (route, pools, feeBps)
  // stays as REST last reported it.
  function onStreamQuote(msg) {
    var q = state.quote;
    if (!q || state.status === 'error') return;
    var pair = currentPair();
    if (!pair || msg.in !== pair.in || msg.out !== pair.out || msg.amount !== pair.amount) return;
    if (!msg.amountOut) return;

    var merged = {};
    for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) merged[k] = q[k];

    // Rebuild from the push's RAW amountOut. q.amountOut has already had the
    // platform fee deducted in place, so deriving from it would compound the fee
    // on every tick.
    merged.amountOut = msg.amountOut;
    merged.otherAmountThreshold = null;
    try {
      merged.otherAmountThreshold =
        (BigInt(msg.amountOut) * BigInt(10000 - state.slippageBps) / BigInt(10000)).toString();
    } catch (e) { /* leave null: render falls back to em dash */ }

    if (typeof msg.hops === 'number') merged.hopCount = msg.hops;
    if (typeof msg.priceImpactBps === 'number') {
      merged.priceImpactBps = msg.priceImpactBps;
      merged.priceImpactPercent = (msg.priceImpactBps / 100).toFixed(2) + '%';
    }
    merged.quoteId = msg.quoteId || null;
    merged.validForMs = msg.validForMs || merged.validForMs;
    merged.firmForMs = msg.firmForMs || merged.firmForMs;
    merged.quoteSignature = msg.quoteSignature || null;
    merged.quoteExpiresAtMs = msg.quoteExpiresAtMs || null;

    applyPlatformFee(merged);
    state.quote = merged; state.status = 'quoted'; state.error = null;
    setStale(false);
    render();
    scheduleRefresh(merged);
  }

  function runQuote(isRefresh) {
    var dec = decimalsOf(state.inMint);
    var base = toBaseUnits(state.amount, dec);
    if (base === null || base === '0') {
      state.quote = null; state.status = 'idle'; state.error = null;
      clearTimeout(refreshT);
      render();
      return;
    }
    var wait = spend(1);
    if (wait > 0) {             // let the bucket recover; the swap build needs it more
      clearTimeout(refreshT);
      refreshT = setTimeout(function () { runQuote(true); }, wait);
      return;
    }
    var mySeq = ++state.seq;
    if (!isRefresh) { state.status = 'loading'; render(); }
    else { setStale(true); }

    getQuote({
      inputMint: state.inMint,
      outputMint: state.outMint,
      amount: base,
      swapMode: 'ExactIn',
      slippageBps: state.slippageBps,
    }).then(function (q) {
      if (mySeq !== state.seq) return;
      applyPlatformFee(q);
      state.quote = q; state.status = 'quoted'; state.error = null;
      render();
      scheduleRefresh(q);
      wsResubscribe();
    }).catch(function (err) {
      if (err.name === 'AbortError' || mySeq !== state.seq) return;
      state.status = 'error';
      state.error = err.code === 429
        ? 'Rate limited — keyless callers get about 1 request per second (burst 5). Backing off.'
        : (err.message || 'Could not reach the router.');
      render();
      clearTimeout(refreshT);
      refreshT = setTimeout(function () { runQuote(true); }, err.code === 429 ? 6000 : 4000);
    });
  }

  function doSwap() {
    var q = state.quote;
    var w = state.wallet;
    if (!q || !w || state.tx.status === 'signing') return;

    // Freeze the quote while the wallet dialog is open, or the price under the
    // user's confirmation changes while they are reading it.
    clearTimeout(refreshT);
    var need = spend(SWAP_COST);
    if (need > 0) {
      state.tx = { status: 'waiting', signature: null, error: null };
      render();
      setTimeout(doSwap, need);
      return;
    }
    state.tx = { status: 'signing', signature: null, error: null };
    render();

    // quoteId is only redeemable for validForMs (3s today). Anything older than
    // this races the TTL and comes back 410 before the wallet even opens, so we
    // fall back to a fresh server-side route guarded by slippageBps.
    // Re-quoting first would be better, but quote(1) + swap(5) = 6 units blows
    // the keyless burst of 5.
    var age = q.quoteExpiresAtMs ? (q.validForMs - (q.quoteExpiresAtMs - Date.now())) : 1e9;
    var body = {
      userWallet: w.address,
      inputMint: state.inMint,
      outputMint: state.outMint,
      amount: q.amountIn,
      swapMode: 'ExactIn',
      slippageBps: state.slippageBps,
    };
    if (q.quoteId && age < 1200) body.quoteId = q.quoteId;
    if (REFERRER_WALLET) {
      body.referrer = REFERRER_WALLET;
      body.integratorFeeBps = PLATFORM_FEE_BPS;
    }

    postSwap(body).catch(function (err) {
      // A pinned quote that lapsed between build and send: retry once at market.
      if (body.quoteId && (err.code === 410 || err.code === 409)) {
        delete body.quoteId;
        return postSwap(body);
      }
      throw err;
    }).then(function (built) {
      state.tx.status = 'confirming';
      render();
      return VulcxWallet.signAndSubmit(built.transaction, built.lastValidBlockHeight);
    }).then(function (sent) {
      state.tx = { status: 'landing', signature: sent.signature, error: null };
      render();
      return sent.confirm().then(function () {
        state.tx = { status: 'sent', signature: sent.signature, error: null };
        render();
        runQuote(true);
      });
    }).catch(function (err) {
      var msg = err && err.message ? err.message : 'Swap failed.';
      if (/reject|denied|cancel/i.test(msg)) msg = 'Cancelled in the wallet.';
      else if (err && err.code === 410) msg = 'Quote expired before signing — re-quoting.';
      else if (err && err.code === 409) msg = 'The quoted route moved. Re-quoting at the new price.';
      else if (err && err.code === 429) msg = 'Rate limited — a swap build costs 5 of the 5 keyless burst units. Try again in a second.';
      state.tx = { status: 'error', signature: null, error: msg };
      render();
      runQuote(true);
    });
  }

  function connectWallet() {
    var found = VulcxWallet.list();
    if (!found.length) {
      state.tx = { status: 'error', signature: null,
        error: 'No compatible wallet detected. Backpack supports Fogo mainnet natively.' };
      render();
      return;
    }
    // One wallet: connect it. Several: let the user pick.
    if (found.length === 1) return finishConnect(found[0]);
    state.picking = found;
    render();
  }

  function finishConnect(w) {
    state.picking = null;
    VulcxWallet.connect(w).then(function (c) {
      state.wallet = { address: c.account.address, label: w.name };
      state.tx = { status: 'idle', signature: null, error: null };
      render();
    }).catch(function (err) {
      state.tx = { status: 'error', signature: null,
        error: /reject|denied/i.test(err.message || '') ? 'Connection declined.' : err.message };
      render();
    });
  }

  function setStale(on) {
    if (el.panel) el.panel.classList.toggle('is-stale', !!on);
  }

  function onAmountInput(v) {
    state.amount = v;
    clearTimeout(debounceT);
    debounceT = setTimeout(function () { runQuote(false); }, DEBOUNCE_MS);
  }

  function flip() {
    var a = state.inMint; state.inMint = state.outMint; state.outMint = a;
    renderPickers();   // the selects hold their own DOM state; swapping mints alone leaves them stale
    runQuote(false);
  }

  /* ---------- freshness tick ---------- */

  function startTick() {
    clearInterval(tickT);
    tickT = setInterval(function () {
      var q = state.quote;
      if (!q || !q.quoteExpiresAtMs || !el.fresh) return;
      var left = q.quoteExpiresAtMs - Date.now();
      var ttl = q.validForMs || 3000;
      var pct = Math.max(0, Math.min(1, left / ttl));
      el.fresh.style.transform = 'scaleX(' + pct.toFixed(3) + ')';
      var firmLeft = q.firmForMs != null
        ? (q.quoteExpiresAtMs - (q.validForMs || 0) + q.firmForMs) - Date.now()
        : -1;
      el.firm.hidden = !(firmLeft > 0);
    }, 80);
  }

  /* ---------- render ---------- */

  // Keys are the wire values the API sends in routes[].poolType. Display names
  // are separate: the API still says "Vortex" for what is branded Valiant.
  var POOL_COLOR = {
    Vortex:   'var(--vx-accent-1)',
    Fluxbeam: 'var(--vx-accent-2)',
    Moonit:   'var(--vx-accent-3)',
  };
  var VENUE_NAME = { Vortex: 'Valiant' };
  function venueName(t) { return VENUE_NAME[t] || t; }
  var FALLBACK = ['var(--vx-accent-1)','var(--vx-accent-2)','var(--vx-accent-3)','var(--vx-accent-4)'];
  // A split can hit several pools of the SAME venue; give each leg its own hue so the
  // bars stay distinguishable instead of reading as one repeated colour.
  function legColors(routes) {
    var seen = {};
    return routes.map(function (r, i) {
      var n = (seen[r.poolType] = (seen[r.poolType] || 0) + 1);
      return n === 1 ? (POOL_COLOR[r.poolType] || FALLBACK[i % 4])
                     : FALLBACK[(i + n) % 4];
    });
  }

  var logoCache = {};   // mint -> resolved image url ('' once known-missing)

  function logoImg(mint, cls) {
    var src = logoCache[mint];
    if (!src) return '';
    return '<img class="' + cls + '" src="' + src + '" alt="" onerror="this.remove()">';
  }

  function tokenPicker(side) {
    var mint = side === 'in' ? state.inMint : state.outMint;
    return '<button type="button" class="sp-token" data-side="' + side + '">' +
      logoImg(mint, 'sp-token-logo') +
      '<span>' + symbolOf(mint) + '</span>' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="sp-tokenlist" data-side="' + side + '" hidden>' +
        tokens.map(function (t) {
          return '<button type="button" data-mint="' + t.mint + '" data-side="' + side + '"' +
            (t.mint === mint ? ' class="on"' : '') + '>' +
            logoImg(t.mint, 'sp-token-logo') + '<span>' + t.symbol + '</span></button>';
        }).join('') +
      '</div>';
  }

  /* Logos come from the mint's own metadata; the list's logoURI is only a hint. */
  function loadLogos() {
    tokens.forEach(function (t) {
      TokenMeta.resolve(t.mint).then(function (m) {
        var url = (m && m.image) || t.logoURI || '';
        if (!url) return;
        logoCache[t.mint] = url;
        renderPickers();
      });
    });
  }

  function render() {
    if (!el.panel) return;
    // On error the previous quote priced a DIFFERENT amount — never show it next to
    // the amount the user actually typed.
    var q = state.status === 'error' ? null : state.quote;
    var outDec = decimalsOf(state.outMint);
    var outHuman = q ? fromBaseUnits(q.amountOut, outDec) : '';
    var minHuman = q ? fromBaseUnits(q.otherAmountThreshold, outDec) : '';

    el.out.value = q ? outHuman : '';
    el.out.placeholder = state.status === 'loading' ? 'routing…'
                       : state.status === 'error' ? '—' : '0';
    el.panel.classList.toggle('is-error', state.status === 'error');
    setStale(false);

    // route legs
    if (state.status === 'error') {
      el.legs.innerHTML = '<p class="sp-msg">' + state.error + '</p>';
    } else if (q && q.routes && q.routes.length) {
      var colors = legColors(q.routes);
      el.legs.innerHTML = q.routes.map(function (r, i) {
        var c = colors[i];
        return '<div class="leg">' +
          '<span class="leg-venue" style="color:' + c + '">' + venueName(r.poolType) + '</span>' +
          '<span class="leg-track"><span class="leg-fill" style="width:' + r.percent + '%;background:' + c + '"></span></span>' +
          '<span class="leg-pct">' + r.percent + '%</span>' +
          '<a class="leg-kind" href="' + EXPLORER + '/account/' + r.poolAddress +
            '" target="_blank" rel="noopener" title="' + r.poolAddress + '">' +
            r.poolAddress.slice(0, 4) + '…' + r.poolAddress.slice(-4) + '</a>' +
          '</div>';
      }).join('');
    } else if (state.status === 'loading') {
      el.legs.innerHTML = '<p class="sp-msg">Searching every pool…</p>';
    } else {
      el.legs.innerHTML = '<p class="sp-msg">Enter an amount to see the route.</p>';
    }

    // meta
    var meta = q ? [
      ['Price impact', q.priceImpactPercent || '—'],
      ['Hops', String(q.hopCount)],
      ['Fee', q.feeBps + ' bps'],
      ['Min received', minHuman ? minHuman + ' ' + symbolOf(state.outMint) : '—'],
    ] : [
      ['Price impact', '—'], ['Hops', '—'], ['Fee', '—'], ['Min received', '—'],
    ];
    el.meta.innerHTML = meta.map(function (m) {
      return '<div><span class="meta-k">' + m[0] + '</span><span class="meta-v">' + m[1] + '</span></div>';
    }).join('');

    var sev = q && q.priceImpactSeverity;
    var loud = sev === 'high' || sev === 'extreme';
    el.warn.hidden = !(loud && q.priceImpactWarning);
    if (!el.warn.hidden) {
      el.warn.textContent = q.priceImpactWarning;
      el.warn.className = 'sp-warn sev-' + sev;
    }

    el.sig.hidden = !(q && q.quoteSignature);
    if (q && q.quoteSignature) {
      el.sig.textContent = 'Ed25519 ' + q.quoteSignature.slice(0, 8) + '…';
      el.sig.title = q.quoteSignature;
    }
    if (!q) { el.firm.hidden = true; el.fresh.style.transform = 'scaleX(0)'; }
    renderAction();
  }

  function renderSlip() {
    if (!el.slip) return;
    [].forEach.call(el.slip.querySelectorAll('button[data-bps]'), function (b) {
      b.classList.toggle('on', parseInt(b.dataset.bps, 10) === state.slippageBps);
    });
  }

  function shortAddr(a) { return a.slice(0, 4) + '…' + a.slice(-4); }

  function renderAction() {
    if (!el.go) return;
    var q = state.status === 'error' ? null : state.quote;
    var t = state.tx;
    var w = state.wallet;

    if (!w) {
      el.go.textContent = VulcxWallet.list().length ? 'Connect wallet' : 'No wallet detected';
      el.go.disabled = !VulcxWallet.list().length;
    } else if (t.status === 'signing') {
      el.go.textContent = 'Building…'; el.go.disabled = true;
    } else if (t.status === 'confirming') {
      el.go.textContent = 'Sign in wallet'; el.go.disabled = true;
    } else if (t.status === 'landing') {
      el.go.textContent = 'Confirming on Fogo…'; el.go.disabled = true;
    } else if (t.status === 'waiting') {
      el.go.textContent = 'Waiting for rate budget…'; el.go.disabled = true;
    } else if (!q) {
      el.go.textContent = 'Swap'; el.go.disabled = true;
    } else if (!q.quoteId) {
      // Split routes come back without a quoteId — there is nothing to pin.
      el.go.textContent = 'Swap at market'; el.go.disabled = false;
    } else {
      el.go.textContent = 'Swap'; el.go.disabled = false;
    }

    // wallet chip in the header
    if (el.walletChip) {
      el.walletChip.hidden = !w;
      if (w) {
        el.walletChip.textContent = w.label + ' · ' + shortAddr(w.address);
        el.walletChip.title = w.address;
      }
    }

    // wallet picker
    if (state.picking) {
      el.picker.hidden = false;
      el.picker.innerHTML = '<span class="mono-mini">Choose a wallet</span>' +
        state.picking.map(function (w2, i) {
          return '<button type="button" data-idx="' + i + '">' + w2.name + '</button>';
        }).join('');
    } else { el.picker.hidden = true; el.picker.innerHTML = ''; }

    // transaction status line
    var msg = '', cls = 'sp-txmsg';
    if (t.status === 'sent') {
      msg = 'Sent · ' + t.signature.slice(0, 10) + '…';
      cls += ' ok';
    } else if (t.status === 'error') { msg = t.error; cls += ' bad'; }
    else if (t.status === 'landing') {
      msg = 'Submitted to Fogo · waiting for confirmation';
    } else if (w && q) {
      msg = w.label + ' signs; this page submits to mainnet.fogo.io.';
    }
    el.txmsg.hidden = !msg;
    el.txmsg.className = cls;
    if (t.status === 'sent') {
      el.txmsg.innerHTML = 'Confirmed · <a href="' + EXPLORER + '/tx/' + t.signature +
        '" target="_blank" rel="noopener">' + t.signature.slice(0, 10) + '…</a>';
    } else { el.txmsg.textContent = msg; }
  }

  /* ---------- mount ---------- */

  function mount() {
    var host = document.getElementById('swap-panel');
    if (!host) return;

    host.innerHTML =
      '<div class="sp" id="sp-root">' +
        '<div class="sp-head">' +
          '<span class="mono-mini">Live quote · api.vulcx.xyz</span>' +
          '<span class="sp-wallet mono-mini" id="sp-wallet" hidden></span>' +
          '<span class="live"><span class="dot"></span>' +
            '<span class="mono-mini" id="sp-firm" style="color:var(--vx-accent-2)" hidden>Firm window open</span>' +
            '<span class="mono-mini" id="sp-sig" style="color:rgba(255,255,255,0.45)" hidden></span>' +
          '</span>' +
        '</div>' +
        '<div class="sp-freshwrap"><span class="sp-fresh" id="sp-fresh"></span></div>' +
        '<div class="sp-rows">' +
          '<label class="sp-row"><span class="sp-lab">You pay</span>' +
            '<input class="sp-amt" id="sp-in" inputmode="decimal" autocomplete="off" spellcheck="false" value="1">' +
            '<span class="sp-pick" id="sp-pick-in"></span></label>' +
          '<button class="sp-flip" id="sp-flip" type="button" aria-label="Swap direction">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v18M7 21l-4-4M17 21V3M17 3l4 4"/></svg>' +
          '</button>' +
          '<label class="sp-row"><span class="sp-lab">You receive</span>' +
            '<input class="sp-amt" id="sp-out" readonly placeholder="0">' +
            '<span class="sp-pick" id="sp-pick-out"></span></label>' +
        '</div>' +
        '<p class="sp-warn" id="sp-warn" hidden></p>' +
        '<div class="legs" id="sp-legs"></div>' +
        '<div class="rule"></div>' +
        '<div class="route-meta" id="sp-meta"></div>' +
        '<div class="sp-actions">' +
          '<div class="sp-slip" id="sp-slip">' +
            '<span class="mono-mini">Slippage</span>' +
            '<button type="button" data-bps="10">0.1%</button>' +
            '<button type="button" data-bps="50">0.5%</button>' +
            '<button type="button" data-bps="100">1%</button>' +
            '<button type="button" data-bps="200">2%</button>' +
          '</div>' +
          '<button class="btn btn-primary sp-go" id="sp-go" type="button"></button>' +
        '</div>' +
        '<div class="sp-picker" id="sp-picker" hidden></div>' +
        '<p class="sp-txmsg" id="sp-txmsg" hidden></p>' +
      '</div>';

    el.panel = document.getElementById('sp-root');
    el.in    = document.getElementById('sp-in');
    el.out   = document.getElementById('sp-out');
    el.legs  = document.getElementById('sp-legs');
    el.meta  = document.getElementById('sp-meta');
    el.fresh = document.getElementById('sp-fresh');
    el.firm  = document.getElementById('sp-firm');
    el.sig   = document.getElementById('sp-sig');
    el.warn  = document.getElementById('sp-warn');
    el.go     = document.getElementById('sp-go');
    el.slip   = document.getElementById('sp-slip');
    el.picker = document.getElementById('sp-picker');
    el.txmsg  = document.getElementById('sp-txmsg');
    el.walletChip = document.getElementById('sp-wallet');

    el.go.addEventListener('click', function () {
      if (!state.wallet) connectWallet(); else doSwap();
    });
    el.slip.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-bps]');
      if (!b) return;
      state.slippageBps = parseInt(b.dataset.bps, 10);
      renderSlip();
      runQuote(false);
    });
    el.picker.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-idx]');
      if (!b) return;
      finishConnect(state.picking[parseInt(b.dataset.idx, 10)]);
    });
    VulcxWallet.onChange(function () { if (!state.wallet) renderAction(); });
    renderSlip();

    el.in.addEventListener('input', function (e) { onAmountInput(e.target.value); });
    document.getElementById('sp-flip').addEventListener('click', flip);

    host.addEventListener('click', function (e) {
      var toggle = e.target.closest('.sp-token');
      if (toggle) {
        e.preventDefault();
        var open = host.querySelector('.sp-tokenlist[data-side="' + toggle.dataset.side + '"]');
        var wasHidden = open.hidden;
        closeLists();
        open.hidden = !wasHidden;
        return;
      }
      var opt = e.target.closest('.sp-tokenlist button[data-mint]');
      if (!opt) return;
      e.preventDefault();
      var side = opt.dataset.side, mint = opt.dataset.mint;
      if (side === 'in') {
        if (mint === state.outMint) state.outMint = state.inMint;
        state.inMint = mint;
      } else {
        if (mint === state.inMint) state.inMint = state.outMint;
        state.outMint = mint;
      }
      closeLists();
      renderPickers();
      runQuote(false);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.sp-pick')) closeLists();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(refreshT); }
      else if (state.quote || state.status === 'error') { runQuote(true); }
    });

    getTokens().then(function (list) {
      tokens = list;
      if (!tokens.length) throw new Error('No tokens listed.');
      state.inMint = tokens[0].mint;
      state.outMint = (tokens[1] || tokens[0]).mint;
      renderPickers();
      loadLogos();
      render();
      startTick();
      runQuote(false);
    }).catch(function (err) {
      state.status = 'error';
      state.error = 'Could not load the token list: ' + err.message;
      render();
    });
  }

  function closeLists() {
    [].forEach.call(document.querySelectorAll('.sp-tokenlist'), function (n) { n.hidden = true; });
  }

  function renderPickers() {
    document.getElementById('sp-pick-in').innerHTML = tokenPicker('in');
    document.getElementById('sp-pick-out').innerHTML = tokenPicker('out');
  }

  function boot() {
    mount();
    wsConnect();   // no-op without API_KEY; /stream always requires one
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
