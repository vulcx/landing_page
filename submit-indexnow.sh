#!/usr/bin/env bash
#
# Ping IndexNow with the URLs we publish, so Bing (and Yandex, Seznam, Naver)
# crawl a change in hours rather than waiting to rediscover it.
#
# Google does NOT participate in IndexNow — for Google the sitemap in
# robots.txt plus Search Console is the whole mechanism, and it takes as long
# as it takes. This is worth running anyway because it is one HTTP call.
#
# Ownership is proved by hosting <key>.txt containing the key at the root of
# the same host as the URLs being submitted, which is why the key file is
# committed here. The key is not a secret; being publicly fetchable is the
# entire mechanism.
#
# Run after publishing new pages:
#     ./submit-indexnow.sh
#
# It reads the URL lists straight from the live sitemaps, so it needs no
# updating when a page is added.

set -euo pipefail

KEY="afce967114afa0d8febcb841fa920133"

submit() {
    local host="$1" sitemap="$2"

    # Verify the key file is actually reachable first. IndexNow answers 202 to
    # almost anything and validates later, so a missing key file fails silently
    # hours after you thought you were done.
    local keyurl="https://${host}/${KEY}.txt"
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$keyurl")" != "200" ]; then
        echo "!! $keyurl is not reachable — IndexNow will reject the submission" >&2
        echo "!! (has the site deployed since the key file was committed?)" >&2
        return 1
    fi

    local urls
    urls=$(curl -s --max-time 30 "$sitemap" \
        | grep -oE '<loc>[^<]+</loc>' \
        | sed -e 's|<loc>||' -e 's|</loc>||')

    if [ -z "$urls" ]; then
        echo "!! no URLs parsed from $sitemap" >&2
        return 1
    fi

    local count
    count=$(printf '%s\n' "$urls" | wc -l | tr -d ' ')
    echo "==> $host: submitting $count URLs"

    local body
    body=$(printf '%s\n' "$urls" | python3 -c "
import json, sys
urls = [l.strip() for l in sys.stdin if l.strip()]
print(json.dumps({
    'host': '$host',
    'key': '$KEY',
    'keyLocation': '$keyurl',
    'urlList': urls,
}))")

    local code
    code=$(curl -s -o /tmp/indexnow-resp -w '%{http_code}' --max-time 30 \
        -X POST 'https://api.indexnow.org/indexnow' \
        -H 'Content-Type: application/json; charset=utf-8' \
        -d "$body")

    # 200 and 202 both mean accepted; 202 means the key is still being checked.
    case "$code" in
        200|202) echo "    accepted (HTTP $code)" ;;
        *)       echo "    REJECTED (HTTP $code): $(cat /tmp/indexnow-resp)" >&2; return 1 ;;
    esac
}

submit "vulcx.xyz" "https://vulcx.xyz/sitemap.xml"

# docs.vulcx.xyz is deliberately absent. IndexNow requires the key file on the
# same host as the URLs submitted, and Mintlify serves root files from an
# allowlist rather than from the repo — llms.txt and Assistant.md resolve,
# README.md and style.css do not, and neither does a key file. Verified
# against the deployed commit, not assumed. The docs pages are still found
# through the sitemap, which robots.txt declares and which is submitted to
# Bing and Google directly.

echo
echo "==> Done. Bing typically crawls within hours; check Bing Webmaster Tools"
echo "    → URL Inspection to confirm. Google is unaffected by this and follows"
echo "    the sitemap on its own schedule."
