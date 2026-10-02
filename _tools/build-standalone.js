/* Build the standalone Auto Ballooning application out of the website.

   The tool already runs entirely in the browser, so it can be lifted out and
   shipped as an offline app with no server and no internet. This extracts it
   rather than copying it by hand, so regenerating after a change to the site
   component cannot drift:

     node _tools/build-standalone.js

   Output: dist-app/  - open "KNEO Auto Ballooning.html" to run it.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-app');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const css = read('assets/css/main.css');
const js = read('assets/js/main.js');
const partial = read('_source/partials/auto-ballooning-demo.html');

/* ------------------------------------------------------------------ CSS --
   Walk the sheet's top-level blocks and keep the ones the component needs.
   Line ranges would go stale the moment a rule moves; matching on what the
   selector actually says does not. */
function topLevelBlocks(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    let depth = 0, j = open;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') { depth--; if (!depth) break; }
    }
    if (j >= text.length) break;
    out.push({ head: text.slice(i, open).trim(), body: text.slice(open + 1, j), full: text.slice(i, j + 1) });
    i = j + 1;
  }
  return out;
}

const WANT = /\babal\b|abal__|@keyframes\s+abal-|@keyframes\s+btn-shine/;
const kept = [];
for (const b of topLevelBlocks(css)) {
  if (/^@(media|supports)/.test(b.head)) {
    /* Keep only the component's rules from inside a media query, not the
       whole block - most of them are about the rest of the site. */
    const inner = topLevelBlocks(b.body).filter((r) => WANT.test(r.head));
    if (inner.length) kept.push(b.head + ' {\n' + inner.map((r) => '  ' + r.full.trim()).join('\n') + '\n}');
    continue;
  }
  if (WANT.test(b.head)) kept.push(b.full.trim());
}
let appCss = kept.join('\n\n');

/* Pull in every token the kept rules reference, and every token those
   reference in turn, straight from the site's :root. */
/* The head carries whatever comments preceded the rule, so compare on the
   selector itself rather than the whole slice. */
const selOf = (h) => h.replace(/\/\*[\s\S]*?\*\//g, '').trim();
const rootBlock = topLevelBlocks(css).find((b) => selOf(b.head) === ':root');
if (!rootBlock) { console.error('ABORT: :root not found'); process.exit(1); }
const rootVars = {};
rootBlock.body.replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (m, k, v) => { rootVars[k] = v.trim(); return m; });

const need = new Set();
(function collect(text) {
  const found = text.match(/var\((--[\w-]+)/g) || [];
  for (const f of found) {
    const name = f.slice(4);
    if (need.has(name) || !(name in rootVars)) continue;
    need.add(name);
    collect(rootVars[name]);
  }
})(appCss);

const tokens = [...need].sort().map((k) => '  ' + k + ': ' + rootVars[k] + ';').join('\n');

/* -------------------------------------------------------------------- JS --
   initAutoBalloon is self-contained apart from four utilities. */
const lines = js.split('\n');
const start = lines.findIndex((l) => l.trim() === 'function initAutoBalloon() {');
if (start < 0) { console.error('ABORT: initAutoBalloon not found'); process.exit(1); }
let end = -1;
for (let i = start + 1; i < lines.length; i++) {
  if (/^  function [a-zA-Z]/.test(lines[i])) { end = i; break; }
}
if (end < 0) { console.error('ABORT: end of initAutoBalloon not found'); process.exit(1); }
let fnBody = lines.slice(start, end).join('\n').replace(/\s+$/, '');

/* Two things differ once the tool is a file on disk rather than a page on a
   site, and both are patched here so the extraction stays mechanical. */
function must(re, replacement, what) {
  if (!re.test(fnBody)) { console.error('ABORT: ' + what); process.exit(1); }
  fnBody = fnBody.replace(re, replacement);
}

/* 1. The site works the vendor path out from its own <script> tag. There is
      no such tag here, and the fallback is an absolute site path. */
must(
  /var PDF_BASE = \(function \(\) \{[\s\S]*?\}\)\(\);/,
  "var PDF_BASE = 'vendor/pdf/';   /* beside this file */",
  'PDF_BASE block not found'
);

/* 2. A file: page has no origin, so the browser refuses to build a Worker
      from a file: URL. Loading the parser as an ordinary script lets PDF.js
      run it on this thread instead: slower on a large sheet, but it means the
      app needs no server at all. */
must(
  /(window\.pdfjsLib\.GlobalWorkerOptions\.workerSrc = PDF_BASE \+ 'pdf\.worker\.min\.js';\n)(\s*)(res\(window\.pdfjsLib\);)/,
  (m, setSrc, indent, resolve) =>
    setSrc +
    indent + "/* Opened straight from disk there is no origin, so a Worker\n" +
    indent + "   cannot be built from a file: URL. Load the parser as a plain\n" +
    indent + "   script and PDF.js will run it on this thread instead. */\n" +
    indent + "if (location.protocol === 'file:') {\n" +
    indent + "  var w = document.createElement('script');\n" +
    indent + "  w.src = PDF_BASE + 'pdf.worker.min.js';\n" +
    indent + "  w.onload = w.onerror = function () { res(window.pdfjsLib); };\n" +
    indent + "  document.head.appendChild(w);\n" +
    indent + "  return;\n" +
    indent + "}\n" +
    indent + resolve,
  'worker wiring not found'
);

/* --------------------------------------------------------------- markup --
   The partial is a page section; the app needs it as the whole window. */
let markup = partial
  .replace(/^[\s\S]*?<div class="abal" data-abal>/, '<div class="abal" data-abal>')
  .replace(/<\/div>\s*<\/div>\s*<\/section>\s*$/, '</div>')
  .replace(/\{\{BASE\}\}contact\.html/g, '#contact')
  .trim();
/* The marketing eyebrow and headline become the app's own title. Replacing
   just those two elements, rather than rewriting the head block, keeps the
   surrounding structure exactly as the site has it. */
const before = markup;
markup = markup
  .replace(/\s*<span class="eyebrow"[^>]*>[\s\S]*?<\/span>/, '')
  .replace(/<h2 id="abal-heading"[^>]*>[\s\S]*?<\/h2>/, '<h1 class="app__title">Auto Ballooning</h1>');
if (markup === before) { console.error('ABORT: heading not rewritten'); process.exit(1); }
markup = markup.replace(/ data-reveal(-group)?(="[^"]*")?/g, '').replace(/ style="--reveal-delay:[^"]*"/g, '');

/* ==================================================================== EMIT --
   A project, not a build folder: it opens in VS Code and can be worked on.
   index.html sits at the root so a double-click still runs it with no server,
   while css/, js/ and vendor/ keep the sources apart. */
const PROJECT = 'kneo-auto-ballooning';
const DIR = path.join(OUT, PROJECT);
/* Clear the previous build so a renamed file cannot linger. Windows keeps a
   handle on a directory any shell is sitting in, so removing the contents is
   tolerated where removing the directory itself is not. */
try {
  for (const e of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) {
    fs.rmSync(path.join(DIR, e), { recursive: true, force: true });
  }
} catch (e) {
  console.error('note: could not fully clear ' + PROJECT + ' (' + e.code + '); overwriting in place');
}
['css', 'js', 'vendor/pdf', '.vscode'].forEach((d) =>
  fs.mkdirSync(path.join(DIR, d), { recursive: true }));

['pdf.min.js', 'pdf.worker.min.js'].forEach((f) =>
  fs.copyFileSync(path.join(ROOT, 'assets/vendor/pdf', f), path.join(DIR, 'vendor/pdf', f)));

const write = (rel, text) => fs.writeFileSync(path.join(DIR, rel), text.replace(/\n?$/, '\n'));

write('css/app.css', APP_SHELL_CSS(tokens) + '\n\n' + appCss);
write('js/app.js', APP_JS(fnBody));
write('index.html', APP_HTML(markup));
write('README.md', fs.readFileSync(path.join(__dirname, 'app-readme.md'), 'utf8'));
write('server.js', SERVER_JS());
write('package.json', PACKAGE_JSON());
write('jsconfig.json', JSON.stringify({
  compilerOptions: { target: 'ES2017', lib: ['ES2017', 'DOM'], checkJs: false },
  include: ['js/**/*.js', 'server.js'],
  exclude: ['vendor']
}, null, 2));
write('.gitignore', ['node_modules/', '.DS_Store', 'Thumbs.db', '*.log'].join('\n'));
write('.vscode/extensions.json', JSON.stringify({
  recommendations: ['ritwickdey.liveserver']
}, null, 2));
write('.vscode/settings.json', JSON.stringify({
  'files.eol': '\n',
  'editor.tabSize': 2,
  'liveServer.settings.port': 5599,
  'search.exclude': { 'vendor/**': true }
}, null, 2));
write('.vscode/launch.json', JSON.stringify({
  version: '0.2.0',
  configurations: [{
    type: 'chrome', request: 'launch', name: 'Open the app',
    url: 'http://localhost:5173', webRoot: '${workspaceFolder}'
  }]
}, null, 2));

console.log('built ' + path.relative(ROOT, DIR));
console.log('  css rules kept : ' + kept.length);
console.log('  tokens inlined : ' + need.size);
console.log('  js bytes       : ' + fnBody.length);

function APP_SHELL_CSS(tokenBlock) {
  return `/* KNEO Auto Ballooning - standalone application.
   Generated by _tools/build-standalone.js. Do not edit by hand: change the
   website component and run the script again.

   The tokens below are lifted from the site so the app looks identical. The
   font stack falls back to the system UI faces, because an offline app cannot
   reach a web font and a missing one would reflow the whole layout. */
:root {
${tokenBlock}
  --font-display: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
  --font-body: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: #0E1020;
  color: var(--panel-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}
.app {
  min-height: 100%;
  padding: clamp(.75rem, 2vw, 1.5rem);
  display: flex; flex-direction: column; gap: 1rem;
}
.app__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: calc(1.5rem * var(--type-scale));
  font-weight: 700; letter-spacing: -.01em; color: #FFFFFF;
}
.app__note {
  margin: 0; font-size: calc(.8125rem * var(--body-scale)); color: var(--panel-muted);
}
.app__foot {
  margin-top: auto; padding-top: .5rem;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: .05em;
  color: var(--panel-muted); display: flex; flex-wrap: wrap; gap: .25rem 1rem;
}
/* The component was written as a section inside a page; here it is the app. */
.abal { max-width: none; }
.abal__app { flex: 1 1 auto; }
`;
}

function APP_JS(fn) {
  return `/* KNEO Auto Ballooning - standalone application.
   Generated by _tools/build-standalone.js from assets/js/main.js. Do not edit
   by hand: change the website component and run the script again.

   Everything happens in this window. No drawing is uploaded and the app makes
   no network request of any kind. */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersReduced = function () { return reduceMotion.matches; };
  function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts || false); }

${fn}

  document.addEventListener('DOMContentLoaded', function () {
    try { initAutoBalloon(); } catch (e) { console.error(e); }
  });
}());
`;
}

/* ===================================================================== */
function PACKAGE_JSON() {
  return JSON.stringify({
    name: PROJECT,
    version: '1.0.0',
    private: true,
    description: 'Auto Ballooning - reads dimensions off a CAD PDF and balloons them. Runs entirely on this machine.',
    scripts: {
      start: 'node server.js',
      dev: 'node server.js'
    },
    keywords: ['ballooning', 'inspection', 'gd&t', 'pdf', 'manufacturing'],
    license: 'UNLICENSED'
  }, null, 2);
}

function SERVER_JS() {
  return `/* A local server for development, with no dependencies to install.

     Opening index.html straight from disk works, but the browser will not let
     a file: page start a Worker, so PDF.js has to parse on the main thread.
     Served over http it uses the worker and a large sheet reads noticeably
     faster. Run it with:  npm start
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.map': 'application/json'
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  /* Never serve anything above the project folder. */
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log('Auto Ballooning running at  http://localhost:' + PORT + '/');
  console.log('Press Ctrl+C to stop.');
});
`;
}

function APP_HTML(body) {
  const indented = body.split('\n').join('\n    ');
  return [
    '<!doctype html>',
    '<html lang="en" data-theme="dark">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>KNEO Auto Ballooning</title>',
    '<!-- Everything this needs sits beside this file. The app makes no network',
    '     request, and no drawing ever leaves this computer. -->',
    '<link rel="stylesheet" href="css/app.css">',
    '</head>',
    '<body>',
    '  <main class="app">',
    '    ' + indented,
    '    <p class="app__foot">',
    '      <span>KNEO Automation &middot; Auto Ballooning</span>',
    '      <span>Runs offline. Your drawing is read in this window and is never uploaded.</span>',
    '    </p>',
    '  </main>',
    '  <script src="js/app.js"></script>',
    '</body>',
    '</html>'
  ].join('\n');
}
