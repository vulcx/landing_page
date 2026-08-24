/* Wallet connector for Fogo — Wallet Standard, no bundler, no dependencies.
 *
 * Why sign-only instead of signAndSendTransaction:
 * no wallet currently advertises a Fogo chain (Backpack, Brave, Solflare and
 * Nightly all report only solana:mainnet/devnet/testnet/localnet). Asking a
 * wallet to SEND would put the transaction on Solana, not Fogo. So the wallet
 * signs bytes and this file submits them to a Fogo RPC — the network is never
 * the wallet's to choose.
 *
 * This file never holds a key and never submits anything the user has not
 * confirmed in their own wallet UI. */
window.VulcxWallet = (function () {
  'use strict';

  var RPC = 'https://mainnet.fogo.io';

  var registered = [];
  var listeners = [];

  /* ---- Wallet Standard discovery handshake ---- */
  var api = {
    register: function () {
      registered = registered.concat(Array.prototype.slice.call(arguments));
      listeners.forEach(function (f) { try { f(list()); } catch (_) {} });
      return function () {};
    },
    get: function () { return registered.slice(); },
    on: function () { return function () {}; },
  };
  window.addEventListener('wallet-standard:register-wallet', function (e) {
    try { e.detail(api); } catch (_) {}
  });
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));

  function onChange(f) {
    listeners.push(f);
    return function () { listeners = listeners.filter(function (g) { return g !== f; }); };
  }

  function usable(w) {
    return w && w.features && w.features['standard:connect'] &&
           w.features['solana:signTransaction'];
  }
  // Wallets register more than once (Backpack registers per chain); one entry each.
  function list() {
    var seen = {};
    return registered.filter(usable).filter(function (w) {
      if (seen[w.name]) return false;
      seen[w.name] = 1; return true;
    });
  }

  /* ---- encoding ---- */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function toBase58(bytes) {
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
  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  /* ---- Fogo RPC ---- */
  function rpc(method, params) {
    return fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) throw new Error(j.error.message || ('RPC ' + method + ' failed'));
        return j.result;
      });
  }

  function submit(signedBytes) {
    return rpc('sendTransaction', [bytesToB64(signedBytes), {
      encoding: 'base64', skipPreflight: false, maxRetries: 3,
      preflightCommitment: 'confirmed',
    }]);
  }

  /* Poll until the network confirms, or the quote's block height passes. */
  function confirm(signature, lastValidBlockHeight, onTick) {
    var started = Date.now();
    return new Promise(function (resolve, reject) {
      (function poll() {
        if (Date.now() - started > 90000) return reject(new Error('Confirmation timed out.'));
        rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: false }])
          .then(function (res) {
            var st = res && res.value && res.value[0];
            if (st) {
              if (st.err) return reject(new Error('Transaction failed on chain.'));
              if (st.confirmationStatus === 'confirmed' || st.confirmationStatus === 'finalized') {
                return resolve(st.confirmationStatus);
              }
            }
            if (lastValidBlockHeight) {
              return rpc('getBlockHeight', [{ commitment: 'confirmed' }]).then(function (h) {
                if (h > lastValidBlockHeight && !st) {
                  return reject(new Error('Transaction expired before it landed.'));
                }
                if (onTick) onTick();
                setTimeout(poll, 900);
              }).catch(function () { setTimeout(poll, 900); });
            }
            if (onTick) onTick();
            setTimeout(poll, 900);
          })
          .catch(function () { setTimeout(poll, 1200); });
      })();
    });
  }

  /* ---- session ---- */
  var current = null;

  function connect(wallet) {
    return wallet.features['standard:connect'].connect().then(function (res) {
      var accounts = (res && res.accounts) || wallet.accounts || [];
      if (!accounts.length) throw new Error('Wallet returned no account.');
      current = { wallet: wallet, account: accounts[0] };
      return current;
    });
  }

  function disconnect() {
    var w = current && current.wallet;
    current = null;
    if (w && w.features && w.features['standard:disconnect']) {
      try { return w.features['standard:disconnect'].disconnect(); } catch (_) {}
    }
    return Promise.resolve();
  }

  /* Sign in the wallet, then submit to Fogo ourselves.
     Returns { signature, confirm } — confirm() resolves when it lands. */
  function signAndSubmit(base64Tx, lastValidBlockHeight) {
    if (!current) return Promise.reject(new Error('No wallet connected.'));
    var f = current.wallet.features['solana:signTransaction'];
    // No `chain` is passed on purpose: the wallet is signing bytes, not
    // choosing a network. Submission is ours.
    return f.signTransaction({
      account: current.account,
      transaction: b64ToBytes(base64Tx),
    }).then(function (out) {
      var r = out && out[0];
      var signed = r && (r.signedTransaction || r.signedTransactionBytes);
      if (!signed) throw new Error('Wallet returned no signed transaction.');
      return submit(new Uint8Array(signed));
    }).then(function (signature) {
      return {
        signature: signature,
        confirm: function (onTick) { return confirm(signature, lastValidBlockHeight, onTick); },
      };
    });
  }

  return {
    rpcUrl: RPC,
    list: list,
    onChange: onChange,
    connect: connect,
    disconnect: disconnect,
    signAndSubmit: signAndSubmit,
    current: function () { return current; },
    toBase58: toBase58,
  };
})();
