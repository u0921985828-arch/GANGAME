'use strict';

/**
 * Zero-dependency Frontmatter engine for the Markdown/Git CMS.
 *
 * Supported YAML subset (strict by design — the CMS controls its own schema):
 *   key: value                → scalar (string | number | boolean | null)
 *   key: "quoted"             → string (single or double quotes)
 *   key: [a, b, c]            → inline list of scalars
 *   key:                      → block list on following indented "- item" lines
 *     - a
 *     - b
 *   # comment                 → ignored (whole-line only)
 *
 * Anything outside this subset is reported as a parse error rather than
 * silently mis-parsed. This keeps validation deterministic and idempotent.
 */

const FENCE = '---';

/** Split raw file into { data, body, hasFrontmatter, eol }. Does not throw. */
function extract(raw) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith(FENCE + '\n') && text.trimStart().startsWith(FENCE)) {
    // Leading blank lines before fence -> normalize later; treat as no FM for safety
  }
  if (!text.startsWith(FENCE + '\n')) {
    return { fmText: null, body: raw, hasFrontmatter: false, eol };
  }
  const end = text.indexOf('\n' + FENCE, FENCE.length);
  if (end === -1) {
    return { fmText: null, body: raw, hasFrontmatter: false, eol };
  }
  const fmText = text.slice(FENCE.length + 1, end);
  let rest = text.slice(end + 1 + FENCE.length);
  rest = rest.replace(/^\n/, ''); // closing-fence line terminator
  rest = rest.replace(/^\n/, ''); // conventional blank separator line
  return { fmText, body: rest, hasFrontmatter: true, eol };
}

function parseScalar(token) {
  const t = token.trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function parseInlineList(token) {
  const inner = token.trim().slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => parseScalar(s));
}

/** Parse the FM subset. Throws Error with a human message on malformed input. */
function parse(fmText) {
  const obj = {};
  const lines = fmText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      throw new Error(`Unexpected indentation at line ${i + 1}: "${line}"`);
    }
    const m = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!m) throw new Error(`Malformed line ${i + 1}: "${line}"`);
    const key = m[1];
    const valuePart = m[2].trim();
    if (valuePart === '') {
      // Possible block list on following indented "- " lines
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        items.push(parseScalar(lines[j].replace(/^\s+-\s+/, '')));
        j++;
      }
      obj[key] = items.length ? items : null;
      i = j - 1;
    } else if (valuePart.startsWith('[') && valuePart.endsWith(']')) {
      obj[key] = parseInlineList(valuePart);
    } else {
      obj[key] = parseScalar(valuePart);
    }
  }
  return obj;
}

function needsQuote(s) {
  // Quote only when leaving it bare would change type/structure on re-parse.
  return (
    /[:#\[\]{}",]/.test(s) ||       // structural characters
    /^\s|\s$|^$/.test(s) ||          // leading/trailing space or empty
    /^(true|false|null|~)$/.test(s) || // reserved words
    /^-?\d+$/.test(s) ||             // parses as integer
    /^-?\d*\.\d+$/.test(s)           // parses as float
  );
}

function serializeScalar(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  const s = String(v);
  return needsQuote(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

/** Serialize object -> FM text (stable key order preserved by caller). */
function serialize(obj) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${k}: []`);
      } else {
        out.push(`${k}:`);
        for (const item of v) out.push(`  - ${serializeScalar(item)}`);
      }
    } else {
      out.push(`${k}: ${serializeScalar(v)}`);
    }
  }
  return out.join('\n');
}

/** Rebuild a full file from data + body. */
function stringify(data, body, eol = '\n') {
  const fm = serialize(data);
  const b = body.startsWith('\n') ? body.slice(1) : body;
  return (`${FENCE}\n${fm}\n${FENCE}\n\n${b.replace(/^\n+/, '')}`).replace(/\n/g, eol);
}

module.exports = { extract, parse, serialize, stringify, parseScalar };
