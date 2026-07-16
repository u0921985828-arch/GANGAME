#!/usr/bin/env node
'use strict';

/**
 * Frontmatter + link validator for the Markdown/Git CMS.
 *
 *   node scripts/validate.js            # report only, exit 1 on error
 *   node scripts/validate.js --fix      # auto-repair safe issues, then report
 *   node scripts/validate.js --quiet    # only print on error
 *
 * Auto-fix (safe, idempotent) covers: missing/empty frontmatter, missing
 * title (from H1 or filename), missing date (today), missing status (draft),
 * missing slug (from filename), tags coerced to a list. Ambiguous problems
 * (invalid enum value, malformed date, unresolvable link, duplicate slug) are
 * reported and never guessed.
 */

const fs = require('fs');
const path = require('path');
const { repoRoot, loadConfig, listDocs, fm } = require('./lib/cms');

const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');
const QUIET = args.has('--quiet');

const root = repoRoot();
const cfg = loadConfig(root);

const errors = [];
const fixes = [];

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

function titleFrom(doc, base) {
  const h1 = doc.body.match(/^\s*#\s+(.+?)\s*$/m);
  if (h1) return h1[1].trim();
  return base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const slugRe = new RegExp(cfg.rules.slugPattern);

const docs = listDocs(cfg, root);
const slugSeen = new Map(); // slug -> rel

for (const doc of docs) {
  const base = path.basename(doc.rel, '.md');
  const col = doc.collection ? cfg.collections[doc.collection] : null;

  if (doc.error) {
    errors.push(`${doc.rel}: malformed frontmatter — ${doc.error}`);
    continue;
  }
  if (!doc.collection) {
    // Content outside a known collection: warn but do not fail the build.
    continue;
  }

  let changed = false;
  const d = doc.data;

  if (!doc.hasFrontmatter) {
    if (!FIX) {
      errors.push(`${doc.rel}: missing frontmatter`);
      continue;
    }
    doc.hasFrontmatter = true;
    changed = true;
  }

  // --- safe auto-fills ---
  if (col.required.includes('title') && (d.title == null || d.title === '')) {
    if (FIX) { d.title = titleFrom(doc, base); fixes.push(`${doc.rel}: set title`); changed = true; }
  }
  if (col.required.includes('date') && (d.date == null || d.date === '')) {
    if (FIX) { d.date = today(); fixes.push(`${doc.rel}: set date`); changed = true; }
  }
  if (col.required.includes('status') && (d.status == null || d.status === '')) {
    if (FIX) { d.status = 'draft'; fixes.push(`${doc.rel}: set status=draft`); changed = true; }
  }
  if (col.required.includes('slug') && (d.slug == null || d.slug === '')) {
    if (FIX) { d.slug = slugify(base); fixes.push(`${doc.rel}: set slug`); changed = true; }
  }
  if ('tags' in d && d.tags != null && !Array.isArray(d.tags)) {
    if (FIX) { d.tags = [d.tags]; fixes.push(`${doc.rel}: tags -> list`); changed = true; }
  }
  if (col.required.includes('tags') && d.tags == null) {
    if (FIX) { d.tags = []; fixes.push(`${doc.rel}: set tags=[]`); changed = true; }
  }

  // --- hard checks (never auto-guessed) ---
  for (const field of col.required) {
    if (d[field] == null || d[field] === '') {
      errors.push(`${doc.rel}: missing required field "${field}"`);
    }
  }
  if (d.status != null && !cfg.enums.status.includes(d.status)) {
    errors.push(`${doc.rel}: invalid status "${d.status}" (allowed: ${cfg.enums.status.join(', ')})`);
  }
  if (d.date != null && !dateRe.test(String(d.date))) {
    errors.push(`${doc.rel}: date "${d.date}" not ${cfg.rules.dateFormat}`);
  }
  if (d.slug != null && !slugRe.test(String(d.slug))) {
    errors.push(`${doc.rel}: slug "${d.slug}" fails ${cfg.rules.slugPattern}`);
  }
  if (cfg.rules.uniqueSlug && d.slug != null) {
    if (slugSeen.has(d.slug)) {
      errors.push(`${doc.rel}: duplicate slug "${d.slug}" (also ${slugSeen.get(d.slug)})`);
    } else {
      slugSeen.set(d.slug, doc.rel);
    }
  }

  if (changed) {
    // Preserve key order: required fields first, then the rest as authored.
    const ordered = {};
    for (const k of [...col.required, ...col.optional]) if (k in d) ordered[k] = d[k];
    for (const k of Object.keys(d)) if (!(k in ordered)) ordered[k] = d[k];
    fs.writeFileSync(doc.path, fm.stringify(ordered, doc.body, doc.eol));
    doc.data = ordered;
  }
}

// --- link integrity (report only; auto-fix of links is unsafe) ---
const bySlug = new Map();
const byRel = new Set();
for (const doc of docs) {
  byRel.add(doc.rel);
  if (doc.data && doc.data.slug) bySlug.set(String(doc.data.slug), doc.rel);
}
for (const doc of docs) {
  if (!doc.hasFrontmatter && !doc.body) continue;
  const wiki = [...doc.body.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)];
  for (const w of wiki) {
    const target = w[1].trim();
    const asSlug = bySlug.has(target);
    const asRel = byRel.has(target) || byRel.has(target + '.md');
    if (!asSlug && !asRel) {
      errors.push(`${doc.rel}: broken wikilink [[${target}]]`);
    }
  }
  const rel = [...doc.body.matchAll(/\[[^\]]*\]\(([^)]+\.md)(?:#[^)]*)?\)/g)];
  for (const r of rel) {
    let tgt = r[1].trim();
    if (/^https?:\/\//.test(tgt)) continue;
    const resolved = path
      .relative(root, path.resolve(path.dirname(doc.path), tgt))
      .split(path.sep)
      .join('/');
    if (!byRel.has(resolved)) {
      errors.push(`${doc.rel}: broken link (${tgt})`);
    }
  }
}

if (FIX && fixes.length && !QUIET) {
  console.log(`✓ fixed ${fixes.length}:`);
  for (const f of fixes) console.log(`  - ${f}`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (!QUIET) console.log(`✓ ${docs.length} doc(s) valid`);
