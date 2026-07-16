'use strict';

const fs = require('fs');
const path = require('path');
const fm = require('./frontmatter');

function repoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function loadConfig(root = repoRoot()) {
  const p = path.join(root, 'cms.config.json');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  return cfg;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Map an absolute .md path to its collection key, or null. */
function collectionOf(cfg, root, absPath) {
  const rel = path.relative(root, absPath).split(path.sep).join('/');
  for (const [key, col] of Object.entries(cfg.collections)) {
    const dir = col.dir.replace(/\/$/, '') + '/';
    if (rel.startsWith(dir)) return key;
  }
  return null;
}

/** Read + parse one doc. Returns { path, rel, collection, data, body, hasFrontmatter, error }. */
function readDoc(cfg, root, absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const rel = path.relative(root, absPath).split(path.sep).join('/');
  const ex = fm.extract(raw);
  const doc = {
    path: absPath,
    rel,
    collection: collectionOf(cfg, root, absPath),
    hasFrontmatter: ex.hasFrontmatter,
    body: ex.body,
    eol: ex.eol,
    data: {},
    error: null,
  };
  if (ex.hasFrontmatter) {
    try {
      doc.data = fm.parse(ex.fmText);
    } catch (e) {
      doc.error = e.message;
    }
  }
  return doc;
}

function listDocs(cfg, root = repoRoot()) {
  const contentDir = path.join(root, cfg.contentDir);
  return walk(contentDir).map((p) => readDoc(cfg, root, p));
}

module.exports = { repoRoot, loadConfig, walk, collectionOf, readDoc, listDocs, fm };
