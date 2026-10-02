#!/usr/bin/env bash
# =============================================================================
#  Go-live check
#
#  Everything that has to be true before this site stops being a staging copy.
#  Run it against the domain you intend to launch on:
#
#      bash _tools/golive.sh https://www.kneo.in
#
#  With no argument it checks the current staging URL, which is useful for
#  confirming the checks themselves work before you point them anywhere real.
#
#  It changes nothing. It only reports.
# =============================================================================
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-https://kneo-website.vercel.app}"
TARGET="${TARGET%/}"

pass=0; fail=0; warn=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail+1)); }
note() { printf '  \033[33mNOTE\033[0m  %s\n' "$1"; warn=$((warn+1)); }

echo
echo "Go-live check against: $TARGET"
echo "-------------------------------------------------------------------"

# --- 1. Does the domain answer at all? --------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$TARGET/" 2>/dev/null)
if [ "$code" = "200" ]; then
  ok "domain responds 200"
else
  bad "domain returned '$code' - it is not serving this site yet"
  echo
  echo "Nothing below can be trusted until that is fixed."
  echo
  exit 1
fi

body=$(curl -s --max-time 25 "$TARGET/")
hdrs=$(curl -sI --max-time 25 "$TARGET/")

# --- 2. Indexing ------------------------------------------------------------
# The staging config deliberately noindexes *.vercel.app so it never competes
# with the real domain. On the real domain that header must be gone, or the
# site is invisible to search no matter how good the SEO is.
if echo "$hdrs" | grep -qi 'x-robots-tag:.*noindex'; then
  case "$TARGET" in
    *vercel.app*) ok  "noindex present (correct for staging)" ;;
    *)            bad "X-Robots-Tag: noindex is being sent on the LIVE domain - search engines will ignore this site" ;;
  esac
else
  case "$TARGET" in
    *vercel.app*) note "staging is NOT noindexed - it may compete with the real domain in search" ;;
    *)            ok  "no noindex header" ;;
  esac
fi

# --- 3. Canonical must point at the domain being served ---------------------
canon=$(printf '%s' "$body" | grep -o '<link rel="canonical" href="[^"]*"' | head -1 | sed 's/.*href="//;s/"//')
if [ -z "$canon" ]; then
  bad "no canonical tag found"
elif [ "${canon%/}" = "$TARGET" ]; then
  ok "canonical matches the domain ($canon)"
else
  bad "canonical points elsewhere: $canon"
  echo "          rebuild with:  SITE_URL=$TARGET bash build.sh"
fi

# --- 4. Sitemap and robots --------------------------------------------------
sc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$TARGET/sitemap.xml")
[ "$sc" = "200" ] && ok "sitemap.xml reachable" || bad "sitemap.xml returned $sc"

rc=$(curl -s --max-time 20 "$TARGET/robots.txt")
if printf '%s' "$rc" | grep -q "Sitemap: $TARGET/sitemap.xml"; then
  ok "robots.txt advertises the right sitemap"
else
  bad "robots.txt sitemap line does not match this domain"
  printf '%s\n' "$rc" | grep -i sitemap | sed 's/^/          /'
fi

if printf '%s' "$rc" | grep -qi '^Disallow: /$'; then
  bad "robots.txt disallows the whole site"
fi

# --- 5. Stale references to the old host ------------------------------------
stale=$(printf '%s' "$body" | grep -o 'kneo-website\.vercel\.app' | wc -l | tr -d ' ')
case "$TARGET" in
  *vercel.app*) : ;;
  *) if [ "$stale" -gt 0 ]; then
       bad "$stale reference(s) to the staging host still in the homepage HTML"
     else
       ok "no staging-host references left in the page"
     fi ;;
esac

# --- 6. The enquiry endpoint ------------------------------------------------
# 200 = a mail provider is configured and the enquiry was delivered.
# 501 = the endpoint is live but no provider key is set, so the form falls
#       back to the visitor's mail client and enquiries can be lost silently.
ec=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -X POST "$TARGET/api/enquiry" \
      -H 'Content-Type: application/json' \
      -d '{"name":"Go-live check","email":"golive@example.com","message":"Automated go-live check - ignore.","company_website":"bot"}' 2>/dev/null)
case "$ec" in
  200) ok   "enquiry endpoint live and a mail provider is configured" ;;
  501) bad  "enquiry endpoint is up but NO mail provider is configured - the form still falls back to a mail client (see api/README.md)" ;;
  404) bad  "enquiry endpoint not found - is the host running Vercel functions?" ;;
  *)   note "enquiry endpoint returned $ec - check the function logs" ;;
esac

# --- 7. HTTPS and www/apex consistency --------------------------------------
case "$TARGET" in
  https://*) ok "served over HTTPS" ;;
  *)         bad "not HTTPS" ;;
esac

host=${TARGET#https://}; host=${host#http://}
case "$host" in
  www.*) other="https://${host#www.}" ;;
  *)     other="https://www.$host" ;;
esac
oc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$other/" 2>/dev/null)
if [ "$oc" = "301" ] || [ "$oc" = "308" ]; then
  ok "$other redirects to the canonical host"
elif [ "$oc" = "200" ]; then
  bad "$other also serves 200 - both hosts are live, which splits your search authority. Redirect one to the other."
else
  note "$other returned $oc (fine if that hostname is not in use)"
fi

# --- 8. 404 handling --------------------------------------------------------
nc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$TARGET/this-page-does-not-exist-9x8y7z/")
[ "$nc" = "404" ] && ok "unknown URLs return a real 404" \
                  || bad "unknown URLs return $nc - soft 404s confuse crawlers"

echo "-------------------------------------------------------------------"
printf '  %d passed, %d failed, %d to note\n\n' "$pass" "$fail" "$warn"
[ "$fail" -gt 0 ] && exit 1
exit 0
