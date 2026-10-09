#!/usr/bin/env bash
# =============================================================================
#  KNEO Automation — static site builder
#  -----------------------------------------------------------------------
#  Assembles every page in _source/pages/ with the shared partials in
#  _source/partials/ and writes plain, standalone HTML into the project root.
#
#  Usage:   bash build.sh
#  Requires: bash + awk + sed (all ship with Git for Windows / Linux / macOS)
#
#  ---------------------------------------------------------------------------
#  URL STRUCTURE — IMPORTANT
#  ---------------------------------------------------------------------------
#  Pages are written as directory indexes so the public URL keeps its existing
#  shape and Google does not treat the relaunch as a set of brand-new pages:
#
#      @OUT about.html                  ->  about/index.html          ->  /about/
#      @OUT services/foo.html           ->  services/foo/index.html   ->  /services/foo/
#      @OUT index.html                  ->  index.html                ->  /
#      @OUT 404.html                    ->  404.html                  ->  /404.html
#
#  Source pages still write links as {{BASE}}about.html — the builder rewrites
#  those to {{BASE}}about/ automatically, so nothing in the page sources has to
#  know about the URL scheme. 404.html stays a real file because hosts serve it
#  by path, and index.html stays at the root.
#
#  ---------------------------------------------------------------------------
#  Page front-matter
#  ---------------------------------------------------------------------------
#      @TITLE  Page title | KNEO Automation
#      @DESC   Meta description used for SEO / social cards.
#      @NAV    services            <- highlights that item in the main nav
#      @OUT    services/foo.html   <- logical page path (see mapping above)
#      @@
#      ...page body HTML...
# =============================================================================

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"
SRC="$ROOT/_source"
PAGES="$SRC/pages"
PARTS="$SRC/partials"
# The address this site is served from. Everything that needs an absolute
# URL - canonical tags, Open Graph, JSON-LD, the sitemap - is built from
# this one line, so moving to the real domain is a single edit here.
#
# Override for a build without editing this file:
#     SITE_URL=https://www.kneo.in bash build.sh
#
# Setting it permanently is one edit to the default below. Do NOT point it at
# the real domain until that domain is actually serving this site: canonical
# tags, Open Graph URLs, JSON-LD and the sitemap all derive from it, and
# pointing them at a domain that does not answer yet is worse than leaving
# them on the staging URL.
SITE_URL="${SITE_URL:-https://kneo-website.vercel.app}"

if [ ! -d "$PAGES" ]; then
  echo "ERROR: $PAGES not found." >&2
  exit 1
fi

# Clean and prepare output dist directory
mkdir -p "$DIST/assets"
cp -r "$ROOT/assets"/* "$DIST/assets/"
[ -f "$ROOT/.htaccess" ] && cp "$ROOT/.htaccess" "$DIST/.htaccess"
[ -f "$ROOT/favicon.ico" ] && cp "$ROOT/favicon.ico" "$DIST/favicon.ico"
[ -f "$ROOT/site.webmanifest" ] && cp "$ROOT/site.webmanifest" "$DIST/site.webmanifest"

built=0
declare -a CANONICALS=()

# -----------------------------------------------------------------------------
# Brand logos.
#
# Every platform tile carries data-logo="slug". If a matching image exists in
# assets/img/logos/ the wordmark is swapped for that image at build time; if not,
# the wordmark stays. So adding a real logo is: drop the file in, run the build.
# No HTML editing, no broken-image requests for logos you do not have.
#
# The brand name in the markup becomes the image's alt text.
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Reusable blocks.
#
# A line containing only {{INCLUDE:name}} is replaced by _source/partials/name.html.
# Used for content that appears on more than one page — the architecture diagram
# lives on both the home page and the MAPP page — so the copies cannot drift.
# Expanded before every other substitution, so {{BASE}} inside an included file
# still resolves correctly for the page that pulled it in.
# -----------------------------------------------------------------------------
read -r -d '' PERL_INCLUDE <<'PERLEOF' || true
my $dir = shift;
while (my $line = <STDIN>) {
  if ($line =~ /^\s*\{\{INCLUDE:([A-Za-z0-9_-]+)\}\}\s*$/) {
    my $f = "$dir/$1.html";
    if (open my $fh, '<', $f) { print <$fh>; close $fh; next; }
    warn "  ! include not found: $1\n";
    next;
  }
  print $line;
}
PERLEOF

read -r -d '' PERL_LOGOS <<'PERLEOF' || true
my $dir = shift;
my %logo;
if (opendir(my $dh, $dir)) {
  for my $f (sort readdir $dh) {
    next unless $f =~ /^([A-Za-z0-9_-]+)\.(svg|png|webp|jpg|jpeg)$/i;
    $logo{lc $1} = $f unless exists $logo{lc $1};
  }
  closedir $dh;
}

# Intrinsic size, read from the file itself.
#
# Without width and height the browser cannot reserve space for an image it has
# not downloaded yet, so every logo pushes the page around as it arrives - which
# is exactly what Cumulative Layout Shift measures, and these are lazy-loaded so
# they land late. The logos are all different shapes, so one hard-coded pair
# would be wrong for most of them; reading each file keeps the aspect honest.
sub dimensions {
  my ($path) = @_;
  open my $fh, '<:raw', $path or return ();
  read($fh, my $head, 4096);
  close $fh;

  if (substr($head, 1, 3) eq 'PNG') {                    # IHDR is always first
    return unpack('NN', substr($head, 16, 8));
  }
  if (substr($head, 0, 2) eq "\xFF\xD8") {               # JPEG: walk the markers
    my $p = 2;
    while ($p + 9 < length $head) {
      last unless substr($head, $p, 1) eq "\xFF";
      my $marker = ord substr($head, $p + 1, 1);
      my $len    = unpack 'n', substr($head, $p + 2, 2);
      # SOF0..SOF15, skipping the four that are not frame headers
      if ($marker >= 0xC0 && $marker <= 0xCF
          && $marker != 0xC4 && $marker != 0xC8 && $marker != 0xCC) {
        my ($h, $w) = unpack 'nn', substr($head, $p + 5, 4);
        return ($w, $h);
      }
      $p += 2 + $len;
    }
    return ();
  }
  if ($head =~ /<svg\b[^>]*>/i) {
    my $tag = $&;
    # viewBox is the reliable one; width/height are often percentages or absent.
    if ($tag =~ /viewBox\s*=\s*["']\s*[-\d.]+[,\s]+[-\d.]+[,\s]+([\d.]+)[,\s]+([\d.]+)/i) {
      return (int($1 + 0.5), int($2 + 0.5));
    }
    if ($tag =~ /width\s*=\s*["']([\d.]+)(?:px)?["']/i) {
      my $w = $1;
      if ($tag =~ /height\s*=\s*["']([\d.]+)(?:px)?["']/i) {
        return (int($w + 0.5), int($1 + 0.5));
      }
    }
  }
  return ();
}

my %dim;
for my $slug (keys %logo) {
  my @wh = dimensions("$dir/$logo{$slug}");
  $dim{$slug} = @wh == 2 && $wh[0] && $wh[1]
    ? qq{ width="$wh[0]" height="$wh[1]"} : '';
}
while (my $line = <STDIN>) {
  $line =~ s{<div class="logo-tile" data-logo="([A-Za-z0-9_-]+)"><span class="logo-tile__name">([^<]*)</span>}{
    my ($slug, $name) = (lc $1, $2);
    # The logo is added above the name, not in place of it — the brand name
    # stays visible as text. alt is empty because the name is right there in
    # the markup; giving the image alt text too would make a screen reader
    # announce the brand twice.
    exists $logo{$slug}
      ? qq{<div class="logo-tile logo-tile--has-logo" data-logo="$slug"><img class="logo-tile__img" src="{{BASE}}assets/img/logos/$logo{$slug}" alt="" loading="lazy" decoding="async"$dim{$slug}><span class="logo-tile__name">$name</span>}
      : qq{<div class="logo-tile" data-logo="$slug"><span class="logo-tile__name">$name</span>}
  }ge;
  print $line;
}
PERLEOF

read -r -d '' PERL_CRUMBS <<'PERLEOF' || true
# BreadcrumbList structured data, generated from the breadcrumb trail that is
# already on the page.
#
# 53 pages showed a trail to the reader but gave a crawler nothing, so search
# results fell back to printing the bare URL instead of "Home > Services >
# Ignition SCADA". Deriving it from the rendered markup rather than from a
# second hand-maintained list means the two cannot disagree: if the visible
# trail changes, so does the data describing it.
#
# Runs after the .html -> / link rewrite, so the hrefs here are already public
# URLs; {{SITE}} is resolved in the substitution pass that follows.
my $path = shift // '';
my $buf  = do { local $/; <STDIN> };

sub unent {
  my $s = shift;
  $s =~ s/<[^>]+>//g;
  $s =~ s/&amp;/&/g; $s =~ s/&nbsp;/ /g; $s =~ s/&#39;/'/g;
  $s =~ s/&lt;/</g;  $s =~ s/&gt;/>/g;   $s =~ s/&quot;/"/g;
  $s =~ s/\s+/ /g;   $s =~ s/^ | $//g;
  $s;
}
sub jstr {
  my $s = shift;
  $s =~ s/\\/\\\\/g; $s =~ s/"/\\"/g;
  $s;
}

if ($buf =~ m{<nav class="crumbs"[^>]*>(.*?)</nav>}s) {
  my $inner = $1;
  my @items;

  while ($inner =~ m{<a\s+href="\{\{BASE\}\}([^"]*)"[^>]*>(.*?)</a>}gs) {
    my ($href, $label) = ($1, unent($2));
    next unless length $label;
    push @items, [$label, "{{SITE}}/$href"];
  }
  if ($inner =~ m{aria-current="page"[^>]*>(.*?)</span>}s) {
    my $label = unent($1);
    push @items, [$label, "{{SITE}}/$path"] if length $label;
  }

  if (@items > 1) {
    my @json;
    my $pos = 0;
    for my $it (@items) {
      $pos++;
      push @json, sprintf(
        '{"@type":"ListItem","position":%d,"name":"%s","item":"%s"}',
        $pos, jstr($it->[0]), jstr($it->[1]));
    }
    my $ld = '<script type="application/ld+json">'
           . '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":['
           . join(',', @json) . ']}</script>';
    $buf =~ s{(<nav class="crumbs"[^>]*>.*?</nav>)}{$1\n$ld}s;
  }
}
print $buf;
PERLEOF

read -r -d '' PERL_ARTICLE <<'PERLEOF' || true
# BlogPosting structured data for articles in /blog/
my $path = shift // '';
my $buf  = do { local $/; <STDIN> };

if ($path =~ m{^blog/([^/]+)/?$}) {
  my $slug = $1;
  my $headline = '';
  my $desc = '';
  my $date = '';
  my $category = '';
  my $image = "{{SITE}}/assets/img/insights/wide/$slug.jpg";

  if ($buf =~ m{<h1[^>]*>(.*?)</h1>}s) {
    $headline = $1;
    $headline =~ s/<[^>]+>//g;
    $headline =~ s/\s+/ /g;
    $headline =~ s/^ | $//g;
    $headline =~ s/"/\\"/g;
  }
  if ($buf =~ m{<meta\s+name="description"\s+content="([^"]*)"}i) {
    $desc = $1;
    $desc =~ s/"/\\"/g;
  }
  if ($buf =~ m{<time\s+datetime="([^"]+)"}i) {
    $date = $1;
  }
  if ($buf =~ m{<span\s+class="eyebrow"[^>]*>(.*?)</span>}s) {
    $category = $1;
    $category =~ s/<[^>]+>//g;
    $category =~ s/\s+/ /g;
    $category =~ s/^ | $//g;
    $category =~ s/"/\\"/g;
  }

  if (length $headline && length $date) {
    my $articleJson = <<"JSON";
<script type="application/ld+json">
{
  "\@context": "https://schema.org",
  "\@type": "BlogPosting",
  "headline": "$headline",
  "description": "$desc",
  "image": "$image",
  "datePublished": "$date",
  "dateModified": "$date",
  "articleSection": "$category",
  "author": {
    "\@type": "Organization",
    "name": "KNEO Automation Pvt. Ltd.",
    "url": "{{SITE}}/"
  },
  "publisher": {
    "\@type": "Organization",
    "name": "KNEO Automation Pvt. Ltd.",
    "logo": {
      "\@type": "ImageObject",
      "url": "{{SITE}}/assets/img/favicon.svg"
    }
  },
  "mainEntityOfPage": {
    "\@type": "WebPage",
    "\@id": "{{SITE}}/$path"
  }
}
</script>
JSON
    $buf =~ s{(</head>)}{$articleJson$1}s;
  }
}
print $buf;
PERLEOF

logo_count=$(find "$ROOT/assets/img/logos" -maxdepth 1 -type f \
  \( -iname '*.svg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.jpg' -o -iname '*.jpeg' \) 2>/dev/null | wc -l)

# -----------------------------------------------------------------------------
# Cache-busting stamp.
#
# Taken from the newest modification time of the stylesheet and the script, and
# appended to their URLs as ?v=… Every rebuild that touches either file produces
# a new URL, so browsers fetch the new version immediately instead of serving a
# stale cached copy. Without this, a CSS change can look like it "did nothing"
# until the visitor hard-refreshes.
# -----------------------------------------------------------------------------
VER=$(
  {
    [ -f "$ROOT/assets/css/main.css" ] && stat -c %Y "$ROOT/assets/css/main.css" 2>/dev/null
    [ -f "$ROOT/assets/js/main.js" ]   && stat -c %Y "$ROOT/assets/js/main.js"   2>/dev/null
  } | sort -rn | head -1
)
[ -z "${VER:-}" ] && VER=1

# -----------------------------------------------------------------------------
# Minified assets.
#
# assets/css/main.css and assets/js/main.js stay the readable source — their
# comments carry most of the reasoning in this project and are not disposable.
# What the pages actually load is a minified copy beside each one, which halves
# the transferred bytes: 62K -> 29K of CSS and 80K -> 40K of JS, gzipped. That
# is ~72K off every first page load, and it is the whole site's largest single
# saving, because these two files are on all 55 pages.
#
# The tools are devDependencies (npm install). If they are not present the
# build does NOT fail and does NOT silently ship a stale file: it copies the
# source over the .min path, so the site is correct and merely larger. The
# minified JS is parsed with `node --check` before it is accepted, so a bad
# mangle can never reach the site.
# -----------------------------------------------------------------------------
MIN_NOTE=""
MIN_SIZES=""
# The minifiers live in _tools/, not the repo root. A package.json at the root
# is enough on its own for Vercel to stop serving this repo as static files and
# start looking for a build to run, and the HTML here is already built.
minify_assets() {
  local css_src="$ROOT/assets/css/main.css" css_out="$DIST/assets/css/main.min.css"
  local js_src="$ROOT/assets/js/main.js"    js_out="$DIST/assets/js/main.min.js"
  local cleancss="$ROOT/_tools/node_modules/clean-css-cli/bin/cleancss"
  local terser="$ROOT/_tools/node_modules/terser/bin/terser"

  if ! command -v node >/dev/null 2>&1 || [ ! -f "$cleancss" ] || [ ! -f "$terser" ]; then
    cp "$css_src" "$css_out"; cp "$js_src" "$js_out"
    MIN_NOTE="not minified (cd _tools && npm install) — assets copied as-is"
    return
  fi

  if node "$cleancss" -O2 -o "$css_out.tmp" "$css_src" >/dev/null 2>&1 && [ -s "$css_out.tmp" ]; then
    mv -f "$css_out.tmp" "$css_out"
    cp -f "$css_out" "$ROOT/assets/css/main.min.css" 2>/dev/null || true
  else
    rm -f "$css_out.tmp"; cp "$css_src" "$css_out"
    MIN_NOTE="CSS minifier failed — stylesheet copied as-is"
  fi

  # The temp file keeps a .js extension: `node --check` refuses an unknown
  # one, and would reject a good minify on its filename alone.
  if node "$terser" "$js_src" --compress --mangle -o "$js_out.tmp.js" >/dev/null 2>&1 \
     && [ -s "$js_out.tmp.js" ] && node --check "$js_out.tmp.js" >/dev/null 2>&1; then
    mv -f "$js_out.tmp.js" "$js_out"
    cp -f "$js_out" "$ROOT/assets/js/main.min.js" 2>/dev/null || true
  else
    rm -f "$js_out.tmp.js"; cp "$js_src" "$js_out"
    MIN_NOTE="${MIN_NOTE:+$MIN_NOTE; }JS minifier failed or unparsable — script copied as-is"
  fi

  MIN_SIZES=$(
    awk -v a="$(wc -c < "$css_src")" -v b="$(wc -c < "$css_out")" \
        -v c="$(wc -c < "$js_src")" -v d="$(wc -c < "$js_out")" \
        'BEGIN{printf "css %.0fK->%.0fK · js %.0fK->%.0fK", a/1024, b/1024, c/1024, d/1024}'
  )
}
minify_assets

# Years in business, computed rather than typed. A hardcoded count is wrong
# from the next New Year onward - the site carried "24+" against a 2003 start
# date, which had already drifted by one.
YEARS=$(( $(date +%Y) - 2003 ))

# -----------------------------------------------------------------------------
# awk program: literal (non-regex, non-& aware) placeholder replacement
# -----------------------------------------------------------------------------
read -r -d '' AWK_REPLACE <<'AWKEOF' || true
function rep(s, from, to,   out, p) {
  out = ""
  while ((p = index(s, from)) > 0) {
    out = out substr(s, 1, p - 1) to
    s = substr(s, p + length(from))
  }
  return out s
}
{
  line = $0
  line = rep(line, "{{BASE}}",   BASE)
  line = rep(line, "{{TITLE}}",  TITLE)
  line = rep(line, "{{DESC}}",   DESC)
  line = rep(line, "{{NAV}}",    NAV)
  line = rep(line, "{{PATH}}",   PATH)
  line = rep(line, "{{VER}}",    VER)
  line = rep(line, "{{YEARS}}",  YEARS)
  line = rep(line, "{{SITE}}",   SITE)
  line = rep(line, "{{ROBOTS}}", ROBOTS)
  if (NAV != "" && index(line, "data-nav=\"" NAV "\"") > 0) {
    line = rep(line, "data-nav=\"" NAV "\"", "data-nav=\"" NAV "\" aria-current=\"page\"")
  }
  print line
}
AWKEOF

# -----------------------------------------------------------------------------
# Build every page
# -----------------------------------------------------------------------------
while IFS= read -r page; do
  [ -f "$page" ] || continue

  TITLE=$( awk '/^@TITLE[ \t]/{ sub(/^@TITLE[ \t]+/,""); print; exit }' "$page")
  DESC=$(  awk '/^@DESC[ \t]/ { sub(/^@DESC[ \t]+/,"");  print; exit }' "$page")
  NAV=$(   awk '/^@NAV[ \t]/  { sub(/^@NAV[ \t]+/,"");   print; exit }' "$page")
  OUT=$(   awk '/^@OUT[ \t]/  { sub(/^@OUT[ \t]+/,"");   print; exit }' "$page")
  ROBOTS=$(awk '/^@ROBOTS[ \t]/{ sub(/^@ROBOTS[ \t]+/,""); print; exit }' "$page")
  [ -z "${ROBOTS:-}" ] && ROBOTS="index, follow, max-image-preview:large"

  if [ -z "${OUT:-}" ]; then
    echo "  ! skipped (no @OUT): ${page#$ROOT/}" >&2
    continue
  fi

  # --- Map the logical page path to a file path and a public URL -------------
  case "$OUT" in
    index.html) DEST_REL="index.html"; CANON="" ;;
    404.html)   DEST_REL="404.html";   CANON="404.html" ;;
    *.html)     stem="${OUT%.html}"; DEST_REL="$stem/index.html"; CANON="$stem/" ;;
    *)          DEST_REL="$OUT";      CANON="$OUT" ;;
  esac

  # Relative prefix back to the site root: one "../" per directory level.
  # "./" at the root keeps `href="{{BASE}}"` (the home link) a valid URL.
  depth=$(printf '%s' "$DEST_REL" | awk -F'/' '{print NF-1}')
  if [ "$depth" -eq 0 ]; then
    BASE="./"
  else
    BASE=""
    i=0
    while [ "$i" -lt "$depth" ]; do BASE="../$BASE"; i=$((i + 1)); done
  fi

  DEST="$DIST/$DEST_REL"
  mkdir -p "$(dirname "$DEST")"

  {
    cat "$PARTS/head.html"
    cat "$PARTS/header.html"
    awk 'f{print} /^@@[ \t]*$/{f=1}' "$page"
    cat "$PARTS/footer.html"
  } \
  | perl -e "$PERL_INCLUDE" "$PARTS" \
  | perl -e "$PERL_LOGOS" "$ROOT/assets/img/logos" \
  | sed -e 's|{{BASE}}404\.html|{{BASE}}\x01404\x01|g' \
        -e 's|{{BASE}}index\.html|{{BASE}}\x02\x02|g' \
        -e 's|{{BASE}}\([A-Za-z0-9][A-Za-z0-9/_-]*\)\.html|{{BASE}}\1/|g' \
        -e 's|{{BASE}}\x01404\x01|{{BASE}}404.html|g' \
        -e 's|{{BASE}}\x02\x02|{{BASE}}|g' \
  | perl -e "$PERL_CRUMBS" "$CANON" \
  | perl -e "$PERL_ARTICLE" "$CANON" \
  | awk -v BASE="$BASE" -v TITLE="$TITLE" -v DESC="$DESC" \
        -v NAV="$NAV" -v PATH="$CANON" -v VER="$VER" -v YEARS="$YEARS" \
        -v SITE="$SITE_URL" -v ROBOTS="$ROBOTS" "$AWK_REPLACE" > "$DEST"

  CANONICALS+=("$CANON")
  built=$((built + 1))
  printf '  ✓ %-46s → /%s\n' "$DEST_REL" "$CANON"
done < <(find "$PAGES" -type f -name '*.html' | sort)

# -----------------------------------------------------------------------------
# sitemap.xml — uses the public URL, not the file path
# -----------------------------------------------------------------------------
TODAY=$(date +%Y-%m-%d)
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  for c in "${CANONICALS[@]}"; do
    case "$c" in
      404.html|thankyou/) continue ;;
    esac
    prio="0.7"
    [ -z "$c" ] && prio="1.0"
    case "$c" in
      about/|services/|mapp/|products/|industries/|contact/|industrial-automation/|expertise/) prio="0.9" ;;
      privacy-policy/|terms/|sitemap/) prio="0.3" ;;
    esac
    printf '  <url><loc>%s/%s</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>%s</priority></url>\n' \
      "$SITE_URL" "$c" "$TODAY" "$prio"
  done
  echo '</urlset>'
} > "$DIST/sitemap.xml"

# -----------------------------------------------------------------------------
# robots.txt
# -----------------------------------------------------------------------------
cat > "$DIST/robots.txt" <<ROBOTS
User-agent: *
Allow: /

Sitemap: $SITE_URL/sitemap.xml
ROBOTS

# -----------------------------------------------------------------------------
# Solve-router drift check.
#
# The list of "what are you trying to solve" routes exists twice: as cards in
# the home page's START HERE section, and as links in the compact strip partial
# that every deep page carries. They are two different presentations of one
# list, and the failure mode is silent - someone adds a route to the home page,
# forgets the strip, and thirty pages quietly offer a smaller menu than the
# home page does.
#
# Comparing destinations rather than labels, because the wording is deliberately
# different between a card and a chip.
#
# Industry links are excluded from the comparison on purpose: the home page has
# room to name all six industries, while the strip sends people to the hub. That
# is a presentation choice, not drift, and flagging it would train everyone to
# ignore this warning.
# -----------------------------------------------------------------------------
router_drift() {
  local home strip
  home=$(awk '/id="start-here"/,/<\/section>/' "$PAGES/index.html" \
         | grep -o 'href="{{BASE}}[^"]*"' | sed 's/href="{{BASE}}//;s/"//' \
         | grep -v '^contact\.html' | grep -v '^industries' | sort -u)
  strip=$(grep -o 'href="{{BASE}}[^"]*"' "$PARTS/solve-compact.html" \
         | sed 's/href="{{BASE}}//;s/"//' | grep -v '^industries' | sort -u)

  local only_home only_strip
  only_home=$(comm -23 <(printf '%s\n' "$home") <(printf '%s\n' "$strip"))
  only_strip=$(comm -13 <(printf '%s\n' "$home") <(printf '%s\n' "$strip"))

  if [ -n "$only_home" ] || [ -n "$only_strip" ]; then
    echo ""
    echo "  ! solve-router drift: the home page and the compact strip disagree."
    [ -n "$only_home" ]  && { echo "    only on the home page:"; printf '      %s\n' $only_home; }
    [ -n "$only_strip" ] && { echo "    only in the compact strip:"; printf '      %s\n' $only_strip; }
    echo "    Fix: _source/pages/index.html (START HERE) and"
    echo "         _source/partials/solve-compact.html"
  fi
}
router_drift

echo ""
echo "Built $built page(s) into dist/ · sitemap.xml + robots.txt regenerated."
if [ -n "${MIN_NOTE:-}" ]; then
  echo "  ! assets: $MIN_NOTE"
else
  echo "Assets minified: ${MIN_SIZES:-}"
fi
if [ "$logo_count" -gt 0 ]; then
  echo "Brand logos found: $logo_count (swapped in automatically)."
else
  echo "Brand logos: none in assets/img/logos/ — wordmarks used. See README §6."
fi
