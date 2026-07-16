'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const md = require('./markdown');

test('renders headings and paragraphs', () => {
  assert.equal(md.render('# Title'), '<h1>Title</h1>');
  assert.equal(md.render('Hello world'), '<p>Hello world</p>');
});

test('escapes HTML in content', () => {
  assert.equal(md.render('a < b & c'), '<p>a &lt; b &amp; c</p>');
  assert.equal(md.render('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>');
});

test('inline code is protected from other passes', () => {
  assert.equal(md.inline('use `**not bold**` here'), 'use <code>**not bold**</code> here');
});

test('bold and italic', () => {
  assert.equal(md.inline('**b** and *i*'), '<strong>b</strong> and <em>i</em>');
  assert.equal(md.inline('a_b_c'), 'a<em>b</em>c');
});

test('fenced code block escapes and preserves', () => {
  const out = md.render('```js\nconst a = 1 < 2;\n```');
  assert.match(out, /<pre><code class="language-js">const a = 1 &lt; 2;\n<\/code><\/pre>/);
});

test('unordered and ordered lists', () => {
  assert.equal(md.render('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  assert.equal(md.render('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
});

test('blockquote', () => {
  assert.equal(md.render('> quoted'), '<blockquote>\n<p>quoted</p>\n</blockquote>');
});

test('thematic break', () => {
  assert.equal(md.render('---'), '<hr>');
});

test('links resolve via callback for .md targets', () => {
  const resolve = (t) => (t === 'a.md' ? { href: 'a.html', title: 'A' } : null);
  assert.equal(md.inline('[go](a.md)', resolve), '<a href="a.html">go</a>');
});

test('wikilinks resolve, unknown targets degrade gracefully', () => {
  const resolve = (t) => (t === 'welcome' ? { href: 'posts/welcome.html', title: 'Bienvenida' } : null);
  assert.equal(md.inline('[[welcome]]', resolve), '<a href="posts/welcome.html">Bienvenida</a>');
  assert.equal(md.inline('[[welcome|Hola]]', resolve), '<a href="posts/welcome.html">Hola</a>');
  assert.equal(md.inline('[[missing]]', resolve), '<span class="broken-link" title="no disponible">missing</span>');
});

test('images', () => {
  assert.equal(md.inline('![alt](/img.png)'), '<img src="/img.png" alt="alt">');
});
