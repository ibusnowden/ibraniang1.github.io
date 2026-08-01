// Regenerate the AI Engineering body in reading.html from the markdown source.
//
//   cd tools && npm install && npm run build
//
// The corpus lives in content/ai-engineering.json. This renders it to static
// HTML between the sentinels in reading.html, so the published page needs no
// markdown or highlighting library at runtime.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');

const root = path.join(__dirname, '..');
const SOURCE = path.join(root, 'content', 'ai-engineering.json');
const PAGE = path.join(root, 'reading.html');

const START = '<!-- reading:start -->';
const END = '<!-- reading:end -->';

// Only fenced blocks that name a language get highlighted. Most of the corpus
// is ASCII diagrams, and auto-detection turns those into noise.
const renderer = new marked.Renderer();
renderer.code = function (code, infostring) {
  const lang = (infostring || '').match(/\S*/)[0];
  if (lang && hljs.getLanguage(lang)) {
    const out = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    return `<pre><code class="hljs language-${lang}">${out}</code></pre>\n`;
  }
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre><code>${escaped}</code></pre>\n`;
};

marked.setOptions({ renderer, mangle: false, headerIds: false });

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

const sections = data
  .map((entry) => {
    // The page carries its own <h1>, so demote each section's first heading.
    const html = marked.parse(entry.content).replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/, '<h2$1>$2</h2>');
    return `<section id="${slugify(entry.title)}" class="reading-system">\n${html}</section>`;
  })
  .join('\n<hr />\n');

const page = fs.readFileSync(PAGE, 'utf8');
const from = page.indexOf(START);
const to = page.indexOf(END);
if (from === -1 || to === -1) throw new Error(`sentinels ${START} / ${END} not found in reading.html`);

// Replace via slices, not String.replace: the corpus contains `$` sequences
// that would otherwise be read as backreferences.
const out = page.slice(0, from + START.length) + '\n' + sections + '\n' + page.slice(to);
fs.writeFileSync(PAGE, out);

const highlighted = (sections.match(/class="hljs /g) || []).length;
console.log(`${data.length} sections, ${highlighted} highlighted blocks`);
console.log(`reading.html is now ${(out.length / 1024).toFixed(0)} KB`);
