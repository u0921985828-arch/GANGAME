#!/usr/bin/env node
'use strict';

/**
 * Static site generator: renders published content to self-contained HTML.
 *
 *   node scripts/build-site.js            # -> site/
 *   node scripts/build-site.js --out dist # custom output dir
 *   node scripts/build-site.js --drafts   # include non-published docs
 *
 * Produces: index.html (home), search.html (client-side search over an
 * embedded public index), <collection>/<slug>.html per doc, assets/style.css.
 * Wikilinks and relative .md links are resolved to output hrefs. Only
 * `published` docs ship by default, so drafts never leak to the public site.
 */

const fs = require('fs');
const path = require('path');
const { repoRoot, loadConfig, listDocs } = require('./lib/cms');
const md = require('./lib/markdown');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const outArg = (() => {
  const i = argv.indexOf('--out');
  return i !== -1 ? argv[i + 1] : 'site';
})();
const INCLUDE_DRAFTS = flags.has('--drafts');

const root = repoRoot();
const cfg = loadConfig(root);
const outDir = path.join(root, outArg);

const esc = md.escapeHtml;
const escA = md.escapeAttr;

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function write(rel, content) {
  const full = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const docs = listDocs(cfg, root).filter((d) => d.collection && !d.error);
const pub = docs.filter((d) => INCLUDE_DRAFTS || d.data.status === 'published');

rmrf(outDir); // clean build: stale/unpublished pages never linger

// slug -> page, and source-rel -> page, for link resolution.
const bySlug = new Map();
const byRel = new Map();
for (const d of pub) {
  const page = {
    doc: d,
    collection: d.collection,
    slug: String(d.data.slug),
    title: String(d.data.title || d.data.slug),
    out: `${d.collection}/${d.data.slug}.html`,
  };
  bySlug.set(page.slug, page);
  byRel.set(d.rel, page);
}

// Demote body headings one level so the frontmatter title is the page's sole
// <h1> (single-h1 = valid document outline). Rendered code is HTML-escaped, so
// only genuine heading tags are matched.
function demoteHeadings(html) {
  let out = html;
  for (let n = 5; n >= 1; n--) {
    out = out.replace(new RegExp(`<(/?)h${n}>`, 'g'), `<$1h${n + 1}>`);
  }
  return out;
}

function relHref(fromOut, toOut) {
  const rel = path.posix.relative(path.posix.dirname(fromOut), toOut);
  return rel || path.posix.basename(toOut);
}

function makeResolver(fromOut) {
  return (target) => {
    // relative .md link
    if (/\.md(?:#|$)/.test(target)) {
      const srcDir = path.posix.dirname(byRelSource(fromOut));
      const resolved = path.posix.normalize(path.posix.join(srcDir, target.replace(/#.*$/, '')));
      const page = byRel.get(resolved);
      return page ? { href: relHref(fromOut, page.out), title: page.title } : null;
    }
    const page = bySlug.get(target);
    return page ? { href: relHref(fromOut, page.out), title: page.title } : null;
  };
}
// Reverse-map an output path back to its source rel dir for relative links.
function byRelSource(fromOut) {
  for (const p of byRel.values()) if (p.out === fromOut) return p.doc.rel;
  return fromOut;
}

function layout({ title, description, prefix, active, main }) {
  const nav = [
    ['index.html', 'Inicio', 'home'],
    ['search.html', 'Buscar', 'search'],
  ]
    .map(
      ([href, label, key]) =>
        `<a href="${prefix}${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`
    )
    .join('\n        ');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escA(description || title)}">
<link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
<a class="skip" href="#main">Saltar al contenido</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${prefix}index.html">GANGAME</a>
    <nav aria-label="Principal">
        ${nav}
    </nav>
  </div>
</header>
<main id="main" class="wrap" tabindex="-1">
${main}
</main>
<footer class="site-footer"><div class="wrap">Generado desde Markdown · versionado en Git.</div></footer>
</body>
</html>
`;
}

function entryCard(page, fromOut) {
  const d = page.doc.data;
  const href = relHref(fromOut, page.out);
  const date = d.date ? `<time datetime="${escA(d.date)}">${esc(d.date)}</time>` : '';
  const tags = Array.isArray(d.tags) && d.tags.length
    ? `<ul class="tags">${d.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';
  const summary = d.summary ? `<p>${esc(d.summary)}</p>` : '';
  return `<article class="card">
  <h3><a href="${escA(href)}">${esc(page.title)}</a></h3>
  <div class="meta">${date}${d.status && d.status !== 'published' ? ` · <span class="badge">${esc(d.status)}</span>` : ''}</div>
  ${summary}${tags}
</article>`;
}

// ---- render content pages ----
for (const page of bySlug.values()) {
  const d = page.doc.data;
  const resolve = makeResolver(page.out);
  const bodyHtml = demoteHeadings(md.render(page.doc.body, resolve));
  const date = d.date ? `<time datetime="${escA(d.date)}">${esc(d.date)}</time>` : '';
  const tags = Array.isArray(d.tags) && d.tags.length
    ? `<ul class="tags">${d.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';
  const main = `<article class="doc">
  <header class="doc-head">
    <p class="kicker">${esc(page.collection)}</p>
    <h1>${esc(page.title)}</h1>
    <div class="meta">${date}${d.author ? ` · ${esc(String(d.author))}` : ''}</div>
    ${tags}
  </header>
  ${bodyHtml}
</article>`;
  write(page.out, layout({
    title: page.title,
    description: d.summary || page.title,
    prefix: '../',
    active: '',
    main,
  }));
}

// ---- home ----
const byCollection = {};
for (const page of bySlug.values()) (byCollection[page.collection] ||= []).push(page);
for (const key of Object.keys(byCollection)) {
  byCollection[key].sort((a, b) => {
    const da = a.doc.data.date || '';
    const db = b.doc.data.date || '';
    if (da || db) return String(db).localeCompare(String(da)); // newest first
    return (a.doc.data.order || 0) - (b.doc.data.order || 0);
  });
}
const homeSections = Object.keys(cfg.collections)
  .filter((k) => byCollection[k] && byCollection[k].length)
  .map(
    (k) => `<section aria-labelledby="c-${k}">
  <h2 id="c-${k}">${esc(k)}</h2>
  <div class="grid">${byCollection[k].map((p) => entryCard(p, 'index.html')).join('\n')}</div>
</section>`
  )
  .join('\n');
write('index.html', layout({
  title: 'GANGAME — CMS',
  description: 'Contenido en Markdown, versionado en Git.',
  prefix: '',
  active: 'home',
  main: `<div class="hero">
  <h1>GANGAME</h1>
  <p>CMS en Markdown, versionado en Git. ${bySlug.size} documento(s) publicado(s).</p>
  <p><a class="btn" href="search.html">Buscar contenido →</a></p>
</div>
${homeSections || '<p>Sin contenido publicado todavía.</p>'}`,
}));

// ---- search index + page (embedded, works offline / file://) ----
const searchEntries = [...bySlug.values()]
  .map((p) => ({
    title: p.title,
    url: p.out,
    collection: p.collection,
    tags: Array.isArray(p.doc.data.tags) ? p.doc.data.tags : [],
    date: p.doc.data.date || null,
    summary: p.doc.data.summary || '',
  }))
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

const searchMain = `<div class="search">
  <h1>Buscar</h1>
  <label for="q">Buscar por título, etiqueta o resumen</label>
  <input id="q" type="search" autocomplete="off" placeholder="Escribe para filtrar…" aria-controls="results">
  <p id="count" class="meta" aria-live="polite"></p>
  <div id="results" class="grid"></div>
</div>
<script>
const DATA = ${JSON.stringify(searchEntries)};
const q = document.getElementById('q');
const results = document.getElementById('results');
const count = document.getElementById('count');
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function card(e){
  const tags = e.tags.length ? '<ul class="tags">'+e.tags.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>' : '';
  const date = e.date ? '<time datetime="'+esc(e.date)+'">'+esc(e.date)+'</time>' : '';
  return '<article class="card"><h3><a href="'+esc(e.url)+'">'+esc(e.title)+'</a></h3>'+
    '<div class="meta">'+esc(e.collection)+(date?' · '+date:'')+'</div>'+
    (e.summary?'<p>'+esc(e.summary)+'</p>':'')+tags+'</article>';
}
function run(){
  const term = q.value.trim().toLowerCase();
  const list = !term ? DATA : DATA.filter(e =>
    e.title.toLowerCase().includes(term) ||
    e.summary.toLowerCase().includes(term) ||
    e.collection.toLowerCase().includes(term) ||
    e.tags.some(t => String(t).toLowerCase().includes(term)));
  results.innerHTML = list.map(card).join('');
  count.textContent = list.length + ' resultado(s)' + (term ? ' para "'+q.value.trim()+'"' : '');
}
q.addEventListener('input', run);
run();
</script>`;
write('search.html', layout({
  title: 'Buscar — GANGAME',
  description: 'Búsqueda del contenido publicado.',
  prefix: '',
  active: 'search',
  main: searchMain,
}));

// ---- stylesheet ----
write('assets/style.css', STYLE());

console.log(`✓ site built: ${bySlug.size} page(s) -> ${outArg}/`);

function STYLE() {
  return `:root{
  --bg:#ffffff; --fg:#1a1a1a; --muted:#5a5f66; --line:#e3e6ea;
  --card:#f7f8fa; --accent:#0a5ad6; --accent-fg:#ffffff; --code:#f0f2f5;
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#0f1216; --fg:#e8eaed; --muted:#9aa1ab; --line:#252b33;
    --card:#161a20; --accent:#5c9dff; --accent-fg:#0f1216; --code:#1b2027; }
}
*{box-sizing:border-box}
html{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{margin:0;background:var(--bg);color:var(--fg)}
.wrap{width:min(880px,92vw);margin-inline:auto}
a{color:var(--accent)}
a:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px;top:0;background:var(--accent);color:var(--accent-fg);padding:.5rem 1rem}
.skip:focus{left:0}
.site-header{border-bottom:1px solid var(--line)}
.site-header .wrap{display:flex;align-items:center;justify-content:space-between;padding:.9rem 0}
.brand{font-weight:700;text-decoration:none;color:var(--fg);letter-spacing:.02em}
nav a{margin-left:1.1rem;text-decoration:none}
nav a[aria-current]{font-weight:600;text-decoration:underline}
main{padding:2rem 0 3rem}
.hero{padding:2rem 0 1rem;border-bottom:1px solid var(--line);margin-bottom:1.5rem}
.hero h1{font-size:2.4rem;margin:0 0 .3rem}
.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);padding:.55rem 1rem;border-radius:8px;text-decoration:none;font-weight:600}
h1,h2,h3{line-height:1.25}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem}
.card h3{margin:.1rem 0 .4rem}
.card p{margin:.3rem 0;color:var(--fg)}
.meta{color:var(--muted);font-size:.88rem}
.badge{background:var(--code);padding:.1rem .45rem;border-radius:5px}
.kicker{color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-size:.75rem;margin:0}
.tags{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem;padding:0;margin:.6rem 0 0}
.tags li{background:var(--code);color:var(--muted);border-radius:20px;padding:.1rem .6rem;font-size:.8rem}
.doc{max-width:70ch}
.doc-head{border-bottom:1px solid var(--line);padding-bottom:1rem;margin-bottom:1.4rem}
.doc h1{margin:.2rem 0}
.doc img{max-width:100%;height:auto}
.doc pre{background:var(--code);padding:1rem;border-radius:8px;overflow:auto}
.doc code{background:var(--code);padding:.1rem .35rem;border-radius:5px;font-size:.92em}
.doc pre code{padding:0;background:none}
.doc blockquote{margin:1rem 0;padding:.2rem 1rem;border-left:3px solid var(--accent);color:var(--muted)}
.broken-link{color:var(--muted);text-decoration:underline dotted}
.search label{display:block;font-weight:600;margin:.5rem 0 .3rem}
.search input{width:100%;padding:.7rem .9rem;font-size:1rem;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.search .grid{margin-top:1.2rem}
.site-footer{border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
.site-footer .wrap{padding:1.5rem 0}
`;
}
