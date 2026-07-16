#!/usr/bin/env node
'use strict';

/**
 * Rebuild the search index (SEARCH_INDEX.json) from all content.
 * Deterministic + idempotent: entries sorted by (collection, slug); the file
 * is only rewritten when its content actually changes, so re-running is a
 * no-op for git. Excludes drafts/archived from the public index by default.
 */

const fs = require('fs');
const path = require('path');
const { repoRoot, loadConfig, listDocs } = require('./lib/cms');

const PUBLIC_STATUS = new Set(['published']);

function excerpt(body, n = 200) {
  const text = body
    .replace(/^#.*$/gm, '')
    .replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text;
}

const root = repoRoot();
const cfg = loadConfig(root);
const docs = listDocs(cfg, root).filter((d) => d.collection && !d.error);

const entries = docs
  .map((d) => ({
    collection: d.collection,
    slug: d.data.slug || null,
    title: d.data.title || null,
    status: d.data.status || null,
    date: d.data.date || null,
    updated: d.data.updated || null,
    tags: Array.isArray(d.data.tags) ? d.data.tags : [],
    summary: d.data.summary || excerpt(d.body),
    path: d.rel,
    public: PUBLIC_STATUS.has(d.data.status),
  }))
  .sort((a, b) =>
    a.collection === b.collection
      ? String(a.slug).localeCompare(String(b.slug))
      : a.collection.localeCompare(b.collection)
  );

const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort();

const index = {
  generatedFrom: 'scripts/build-index.js',
  version: cfg.version,
  counts: {
    total: entries.length,
    public: entries.filter((e) => e.public).length,
    byCollection: Object.fromEntries(
      Object.keys(cfg.collections).map((k) => [k, entries.filter((e) => e.collection === k).length])
    ),
  },
  tags: allTags,
  entries,
};

const out = path.join(root, cfg.indexFile);
const next = JSON.stringify(index, null, 2) + '\n';
const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (next !== prev) {
  fs.writeFileSync(out, next);
  console.log(`✓ index rebuilt: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} -> ${cfg.indexFile}`);
} else {
  console.log('✓ index up to date');
}
