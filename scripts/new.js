#!/usr/bin/env node
'use strict';

/**
 * Scaffold a new content document from its collection template.
 *
 *   node scripts/new.js <collection> "Title" [--slug x] [--status draft] [--tags a,b]
 *
 * Fills frontmatter deterministically (title, slug, date, status, tags),
 * refuses to overwrite an existing file, and leaves the doc passing
 * validation on the first commit.
 */

const fs = require('fs');
const path = require('path');
const { repoRoot, loadConfig, fm } = require('./lib/cms');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const argv = process.argv.slice(2);
const positional = [];
const opts = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}

const [collection, title] = positional;
if (!collection || !title) {
  fail('usage: node scripts/new.js <collection> "Title" [--slug x] [--status s] [--tags a,b]');
}

const root = repoRoot();
const cfg = loadConfig(root);
const col = cfg.collections[collection];
if (!col) fail(`unknown collection "${collection}" (have: ${Object.keys(cfg.collections).join(', ')})`);

const slug = slugify(opts.slug || title);
if (!new RegExp(cfg.rules.slugPattern).test(slug)) fail(`derived slug "${slug}" is invalid`);

const status = opts.status || 'draft';
if (!cfg.enums.status.includes(status)) {
  fail(`invalid status "${status}" (allowed: ${cfg.enums.status.join(', ')})`);
}

const dest = path.join(root, col.dir, `${slug}.md`);
if (fs.existsSync(dest)) fail(`already exists: ${path.relative(root, dest)}`);

// Start from the template's field set, then override with real values.
const tplPath = path.join(root, col.template);
let base = {};
if (fs.existsSync(tplPath)) {
  const ex = fm.extract(fs.readFileSync(tplPath, 'utf8'));
  if (ex.hasFrontmatter) {
    try { base = fm.parse(ex.fmText); } catch { base = {}; }
  }
}

const data = { ...base };
data.title = title;
data.slug = slug;
data.status = status;
if (col.required.includes('date') || 'date' in base) data.date = today();
if (col.required.includes('tags') || 'tags' in base) {
  data.tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

// Order: required fields first, then optional, then leftovers.
const ordered = {};
for (const k of [...col.required, ...col.optional]) if (k in data) ordered[k] = data[k];
for (const k of Object.keys(data)) if (!(k in ordered)) ordered[k] = data[k];

const body = `# ${title}\n\nContenido en Markdown.\n`;
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, fm.stringify(ordered, body));
console.log(`✓ created ${path.relative(root, dest)}`);
