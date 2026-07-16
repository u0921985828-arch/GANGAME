'use strict';

/**
 * Minimal, zero-dependency Markdown -> HTML renderer for the CMS.
 *
 * Supports: ATX headings, paragraphs, fenced code, blockquotes, ordered/
 * unordered lists, thematic breaks, inline code, images, links, wikilinks,
 * bold, italic. Output is HTML-escaped by default (no raw HTML passthrough),
 * which keeps rendering safe on untrusted content.
 *
 * `resolve(target)` maps a wikilink target or a relative `.md` link to an
 * output href: return { href, title } or null when unresolved.
 */

// Private-use sentinels shield inline code spans from later inline passes.
const OPEN = '';
const CLOSE = '';
const RESTORE = new RegExp(OPEN + '(\\d+)' + CLOSE, 'g');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

const BLOCK_START = /^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+\.\s)/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

function inline(text, resolve) {
  let s = escapeHtml(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return OPEN + (codes.length - 1) + CLOSE;
  });

  // images
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt, src, t) =>
      `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt}"${t ? ` title="${t}"` : ''}>`
  );

  // wikilinks: [[target]] or [[target|label]]
  s = s.replace(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_, tgt, label) => {
      const key = tgt.trim();
      const r = resolve ? resolve(key) : null;
      const shown = label != null ? label.trim() : (r && r.title) || key;
      if (r && r.href) {
        return `<a href="${r.href.replace(/"/g, '&quot;')}">${shown}</a>`;
      }
      return `<span class="broken-link" title="no disponible">${shown}</span>`;
    }
  );

  // links: [text](href)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, txt, href, t) => {
      let h = href;
      if (resolve && /\.md(?:#|$)/.test(href)) {
        const r = resolve(href);
        if (r && r.href) h = r.href;
      }
      return `<a href="${h.replace(/"/g, '&quot;')}"${t ? ` title="${t}"` : ''}>${txt}</a>`;
    }
  );

  // bold then italic
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\s][^_]*?)_/g, '$1<em>$2</em>');

  s = s.replace(RESTORE, (_, n) => `<code>${escapeHtml(codes[n])}</code>`);
  return s;
}

function render(md, resolve) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        `<pre><code${lang ? ` class="language-${escapeAttr(lang)}"` : ''}>` +
          `${escapeHtml(buf.join('\n'))}\n</code></pre>`
      );
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    if (HR.test(line)) { out.push('<hr>'); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2].trim(), resolve)}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>\n${render(buf.join('\n'), resolve)}\n</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      }
      out.push(`<ul>\n${items.map((t) => `<li>${inline(t, resolve)}</li>`).join('\n')}\n</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      }
      out.push(`<ol>\n${items.map((t) => `<li>${inline(t, resolve)}</li>`).join('\n')}\n</ol>`);
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !BLOCK_START.test(lines[i]) && !HR.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join('\n'), resolve)}</p>`);
  }

  return out.join('\n');
}

module.exports = { render, inline, escapeHtml, escapeAttr };
