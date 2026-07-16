'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fm = require('./frontmatter');

test('extract splits frontmatter from body', () => {
  const raw = '---\ntitle: Hi\n---\n\nBody here\n';
  const ex = fm.extract(raw);
  assert.equal(ex.hasFrontmatter, true);
  assert.equal(ex.fmText, 'title: Hi');
  assert.equal(ex.body, 'Body here\n');
});

test('extract returns no frontmatter when fence missing', () => {
  const ex = fm.extract('# Just a heading\n');
  assert.equal(ex.hasFrontmatter, false);
  assert.equal(ex.body, '# Just a heading\n');
});

test('parse handles scalar types', () => {
  const d = fm.parse('a: hello\nb: 42\nc: 3.14\nd: true\ne: false\nf: null\ng:');
  assert.deepEqual(d, { a: 'hello', b: 42, c: 3.14, d: true, e: false, f: null, g: null });
});

test('parse handles quoted strings and reserved-looking values', () => {
  const d = fm.parse('a: "true"\nb: \'2026-07-16\'\nc: "12:30"');
  assert.deepEqual(d, { a: 'true', b: '2026-07-16', c: '12:30' });
});

test('parse handles inline and block lists', () => {
  const inline = fm.parse('tags: [a, b, c]');
  assert.deepEqual(inline.tags, ['a', 'b', 'c']);
  const block = fm.parse('tags:\n  - a\n  - b');
  assert.deepEqual(block.tags, ['a', 'b']);
});

test('parse rejects malformed lines', () => {
  assert.throws(() => fm.parse('not valid yaml here'));
});

test('serialize quotes only when necessary', () => {
  assert.equal(fm.serialize({ date: '2026-07-16' }), 'date: 2026-07-16');
  assert.equal(fm.serialize({ n: '42' }), 'n: "42"');
  assert.equal(fm.serialize({ t: 'true' }), 't: "true"');
  assert.equal(fm.serialize({ s: 'plain' }), 's: plain');
  assert.equal(fm.serialize({ tags: [] }), 'tags: []');
});

test('roundtrip parse -> serialize -> parse is stable', () => {
  const src = 'title: Post\ndate: 2026-07-16\nstatus: published\ntags:\n  - x\n  - y\nslug: post';
  const once = fm.parse(src);
  const twice = fm.parse(fm.serialize(once));
  assert.deepEqual(twice, once);
});

test('stringify builds a well-formed document', () => {
  const out = fm.stringify({ title: 'A', slug: 'a' }, 'Body\n');
  assert.equal(out, '---\ntitle: A\nslug: a\n---\n\nBody\n');
  const back = fm.extract(out);
  assert.deepEqual(fm.parse(back.fmText), { title: 'A', slug: 'a' });
});
