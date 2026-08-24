/* Resolve a token's logo from its on-chain Metaplex metadata.
 *
 * The API's token list carries a logoURI, but it is not always right — the FOGO
 * entry points at vulcx.xyz/tokens/fogo.png, which 404s. The mint's metadata
 * account is the authority: derive the PDA, read `uri`, fetch the JSON, take
 * `image`. Results are cached in localStorage; nothing here blocks a quote. */
window.TokenMeta = (function () {
  'use strict';

  var RPC = 'https://mainnet.fogo.io';
  var MPL = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  var CACHE_KEY = 'vulcx.tokenmeta.v1';
  var CACHE_TTL = 7 * 24 * 3600 * 1000;

  /* ---- base58 ---- */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58decode(str) {
    var bytes = [0], i, j, carry;
    for (i = 0; i < str.length; i++) {
      carry = B58.indexOf(str[i]);
      if (carry < 0) throw new Error('bad base58');
      for (j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8;
      }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (i = 0; str[i] === '1' && i < str.length - 1; i++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function b58encode(bytes) {
    var digits = [0], i, j, carry;
    for (i = 0; i < bytes.length; i++) {
      carry = bytes[i];
      for (j = 0; j < digits.length; j++) {
        carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0;
      }
      while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
    }
    var out = '';
    for (i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) out += '1';
    for (j = digits.length - 1; j >= 0; j--) out += B58[digits[j]];
    return out;
  }

  /* ---- ed25519 on-curve test (a PDA must be OFF the curve) ---- */
  var P = (1n << 255n) - 19n;
  function inv(a) { return power(a, P - 2n); }
  function power(b, e) {
    var r = 1n; b %= P;
    while (e > 0n) { if (e & 1n) r = r * b % P; b = b * b % P; e >>= 1n; }
    return r;
  }
  var D = (P - 121665n) * inv(121666n) % P;
  function onCurve(bytes) {
    var y = 0n;
    for (var i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]);
    var sign = y >> 255n;
    y &= (1n << 255n) - 1n;
    if (y >= P) return false;
    var yy = y * y % P;
    var u = (yy - 1n + P) % P;
    var v = (D * yy + 1n) % P;
    var x2 = u * inv(v) % P;
    var x = power(x2, (P + 3n) / 8n);
    if ((x * x - x2) % P !== 0n) x = x * power(2n, (P - 1n) / 4n) % P;
    if ((x * x - x2 + P * P) % P !== 0n) return false;
    if (x === 0n && sign) return false;
    return true;
  }

  var PDA_TAIL = new TextEncoder().encode('ProgramDerivedAddress');
  function concat(parts) {
    var n = 0, i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function sha256(bytes) {
    return crypto.subtle.digest('SHA-256', bytes).then(function (b) { return new Uint8Array(b); });
  }

  function findPda(seeds, programId) {
    var prog = b58decode(programId);
    var bump = 255;
    function attempt() {
      if (bump < 0) return Promise.reject(new Error('no PDA'));
      var msg = concat(seeds.concat([new Uint8Array([bump]), prog, PDA_TAIL]));
      return sha256(msg).then(function (h) {
        if (!onCurve(h)) return b58encode(h);
        bump--; return attempt();
      });
    }
    return attempt();
  }

  /* ---- cache ---- */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (_) { return {}; }
  }
  function writeCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (_) {}
  }

  /* ---- decode the Metadata account ---- */
  function decodeMetadata(bytes) {
    // key(1) updateAuthority(32) mint(32) then borsh strings: name, symbol, uri
    var o = 65, dec = new TextDecoder();
    function str() {
      var len = bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
      o += 4;
      if (len < 0 || o + len > bytes.length) throw new Error('bad metadata string');
      var s = dec.decode(bytes.subarray(o, o + len)).replace(/\0+$/, '');
      o += len; return s;
    }
    return { name: str(), symbol: str(), uri: str() };
  }

  function rpc(method, params) {
    return fetch(RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message);
      return j.result;
    });
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var inflight = {};

  /* Resolves to { image, name, symbol } or null. Never throws at the caller. */
  function resolve(mint) {
    var cache = readCache(), hit = cache[mint];
    if (hit && Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.v);
    if (inflight[mint]) return inflight[mint];

    var seeds = [new TextEncoder().encode('metadata'), b58decode(MPL), b58decode(mint)];
    inflight[mint] = findPda(seeds, MPL)
      .then(function (pda) { return rpc('getAccountInfo', [pda, { encoding: 'base64' }]); })
      .then(function (res) {
        var v = res && res.value;
        if (!v) return null;
        var meta = decodeMetadata(b64ToBytes(v.data[0]));
        if (!/^https?:/.test(meta.uri)) return { image: '', name: meta.name, symbol: meta.symbol };
        return fetch(meta.uri).then(function (r) { return r.json(); }).then(function (j) {
          return { image: j.image || '', name: meta.name, symbol: meta.symbol };
        }).catch(function () { return { image: '', name: meta.name, symbol: meta.symbol }; });
      })
      .catch(function () { return null; })
      .then(function (v) {
        var c = readCache(); c[mint] = { at: Date.now(), v: v }; writeCache(c);
        delete inflight[mint];
        return v;
      });
    return inflight[mint];
  }

  return { resolve: resolve, findPda: findPda, b58encode: b58encode, b58decode: b58decode };
})();
