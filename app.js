/* ================================================================
   DOCSY — application logic
   Browser-only. No backend. Document data stays on this device.
   ================================================================ */

// ---------- Utilities ----------
const $ = (id) => document.getElementById(id);
const MM_TO_PX = 96 / 25.4;
const mmToPx = (mm) => mm * MM_TO_PX;
const pxToMm = (px) => px / MM_TO_PX;
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Global state ----------
let zoom = 1;
let viewMode = 'split';
let saveTimer = null;
let renderTimer = null;
let deferredInstall = null;
let printStyleEl = null;

// All controls that contribute to document appearance
const SETTINGS_IDS = [
  'paperSize', 'orientation', 'customW', 'customH',
  'fontFamily', 'fontSize', 'lineSpacing', 'textColor',
  'pageColor', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'alignment', 'paraGap',
  'headerText', 'footerText', 'pageNumbers', 'watermark'
];

// ---------- Toasts ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2300);
}

// ---------- Settings ----------
function getSettings() {
  const s = {};
  SETTINGS_IDS.forEach((id) => {
    const el = $(id);
    if (el) s[id] = el.value;
  });
  return s;
}

function setSettings(s) {
  if (!s) return;
  Object.entries(s).forEach(([id, v]) => {
    const el = $(id);
    if (el) el.value = v;
  });
}

// Paper dimensions in mm
function getDims() {
  const size = $('paperSize').value;
  const orientation = $('orientation').value;
  const map = {
    A4: [210, 297], A3: [297, 420], A5: [148, 210],
    Letter: [215.9, 279.4], Legal: [215.9, 355.6]
  };
  let [w, h] = map[size] || [+$('customW').value || 210, +$('customH').value || 297];
  if (orientation === 'landscape') [w, h] = [h, w];
  return [w, h];
}

// ---------- Filename ----------
function safeName() {
  const t = $('docTitle').value.trim() || 'document';
  return t.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'document';
}

// ---------- Autosave ----------
function scheduleSave() {
  $('saveState').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('docsy-draft-v2', JSON.stringify({
        html: editor.innerHTML,
        title: $('docTitle').value,
        settings: getSettings()
      }));
      $('saveState').textContent = 'Saved';
    } catch (e) {
      $('saveState').textContent = 'Not saved';
    }
  }, 500);
}

function loadDraft() {
  try {
    const raw = localStorage.getItem('docsy-draft-v2');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.html) editor.innerHTML = d.html;
    if (d.title) $('docTitle').value = d.title;
    setSettings(d.settings);
    return true;
  } catch (e) { return false; }
}

function clearDraft() {
  localStorage.removeItem('docsy-draft-v2');
  $('saveState').textContent = 'Draft cleared';
}

// ================================================================
// PAGINATION ENGINE
// Real multi-page rendering. Splits editor blocks across pages
// using a hidden measuring element sized to the content area.
// ================================================================
function paginate(s) {
  const [wMM, hMM] = getDims();
  const ml = +s.marginLeft, mr = +s.marginRight;
  const mt = +s.marginTop, mb = +s.marginBottom;
  const contentWpx = mmToPx(wMM - ml - mr);
  const contentHpx = mmToPx(hMM - mt - mb);

  // Hidden measurer that mimics the preview content box
  const measurer = document.createElement('div');
  measurer.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: ${contentWpx}px;
    font-family: ${s.fontFamily};
    font-size: ${s.fontSize}pt;
    line-height: ${s.lineSpacing};
    text-align: ${s.alignment};
    color: ${s.textColor};
    visibility: hidden; pointer-events: none;
    overflow-wrap: anywhere;
  `;
  document.body.appendChild(measurer);

  // Normalize child nodes → blocks
  const blocks = [];
  Array.from(editor.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      if (!node.nodeValue.trim()) return;
      const p = document.createElement('p');
      p.textContent = node.nodeValue;
      blocks.push(p);
    } else if (node.nodeType === 1) {
      blocks.push(node);
    }
  });

  const pages = [];
  let current = [];
  let used = 0;
  const gap = +s.paraGap;

  for (const block of blocks) {
    measurer.innerHTML = '';
    const clone = block.cloneNode(true);
    if (clone.tagName === 'P') clone.style.marginBottom = gap + 'px';
    clone.style.marginTop = '0';
    measurer.appendChild(clone);
    const h = measurer.getBoundingClientRect().height + (block.tagName === 'P' ? gap : 0);

    if (current.length > 0 && used + h > contentHpx - 2) {
      pages.push(current);
      current = [block];
      used = h;
    } else {
      current.push(block);
      used += h;
    }
  }
  if (current.length > 0) pages.push(current);
  if (pages.length === 0) pages.push([]);

  document.body.removeChild(measurer);
  return { pages, wMM, hMM, ml, mr, mt, mb };
}

function buildPages(s) {
  const { pages, wMM, hMM, ml, mr, mt, mb } = paginate(s);
  const total = pages.length;
  const pagesEl = $('pages');
  pagesEl.innerHTML = '';
  pagesEl.style.zoom = zoom;

  pages.forEach((blocks, idx) => {
    const paper = document.createElement('div');
    paper.className = 'paper';
    paper.style.setProperty('--pw', wMM + 'mm');
    paper.style.setProperty('--ph', hMM + 'mm');
    paper.style.width = mmToPx(wMM) + 'px';
    paper.style.height = mmToPx(hMM) + 'px';
    paper.style.background = s.pageColor;
    paper.style.padding = `${mmToPx(mt)}px ${mmToPx(mr)}px ${mmToPx(mb)}px ${mmToPx(ml)}px`;

    if (s.watermark.trim()) {
      const wm = document.createElement('div');
      wm.className = 'paper-watermark';
      wm.textContent = s.watermark;
      paper.appendChild(wm);
    }

    if (s.headerText.trim()) {
      const hd = document.createElement('div');
      hd.className = 'paper-header';
      hd.style.top = mmToPx(mt * 0.35) + 'px';
      hd.style.paddingLeft = mmToPx(ml) + 'px';
      hd.style.paddingRight = mmToPx(mr) + 'px';
      hd.textContent = s.headerText;
      paper.appendChild(hd);
    }

    const content = document.createElement('div');
    content.className = 'preview-content';
    content.style.fontFamily = s.fontFamily;
    content.style.fontSize = s.fontSize + 'pt';
    content.style.lineHeight = s.lineSpacing;
    content.style.color = s.textColor;
    content.style.textAlign = s.alignment;
    blocks.forEach((b) => {
      const clone = b.cloneNode(true);
      if (clone.tagName === 'P') clone.style.marginBottom = (+s.paraGap) + 'px';
      content.appendChild(clone);
    });
    paper.appendChild(content);

    const showPageNum = s.pageNumbers !== 'none';
    if (s.footerText.trim() || showPageNum) {
      const ft = document.createElement('div');
      ft.className = 'paper-footer';
      ft.style.bottom = mmToPx(mb * 0.35) + 'px';
      ft.style.paddingLeft = mmToPx(ml) + 'px';
      ft.style.paddingRight = mmToPx(mr) + 'px';
      if (s.footerText.trim()) {
        const fl = document.createElement('span');
        fl.textContent = s.footerText;
        ft.appendChild(fl);
      }
      if (showPageNum) {
        const pn = document.createElement('span');
        pn.className = 'page-number ' + s.pageNumbers;
        pn.textContent = `${idx + 1} / ${total}`;
        ft.appendChild(pn);
      }
      paper.appendChild(ft);
    }

    pagesEl.appendChild(paper);
  });

  $('pageEstimate').textContent = `${total} page${total === 1 ? '' : 's'}`;
  return total;
}

// ================================================================
// RENDER
// ================================================================
function applySettingsToEditor(s) {
  editor.style.fontFamily = s.fontFamily;
  editor.style.fontSize = s.fontSize + 'pt';
  editor.style.lineHeight = s.lineSpacing;
  editor.style.color = s.textColor;
  editor.style.textAlign = s.alignment;
  editor.querySelectorAll('p').forEach((p) => (p.style.marginBottom = (+s.paraGap) + 'px'));
}

function updateStats() {
  const text = editor.innerText.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chars = text.length;
  $('wordCount').textContent = `${words} word${words === 1 ? '' : 's'}`;
  $('charCount').textContent = `${chars} character${chars === 1 ? '' : 's'}`;
}

function render() {
  const s = getSettings();
  $('fontSizeOut').textContent = s.fontSize + ' pt';
  $('lineOut').textContent = (+s.lineSpacing).toFixed(1);
  $('customSize').hidden = s.paperSize !== 'Custom';

  applySettingsToEditor(s);
  buildPages(s);
  updateStats();
  scheduleSave();
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 90);
}

// ---------- Zoom ----------
function setZoom(z) {
  zoom = Math.max(0.3, Math.min(2, +z));
  $('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  const pagesEl = $('pages');
  if (pagesEl) pagesEl.style.zoom = zoom;
}

function fitZoom() {
  const scroll = $('previewScroll');
  const [wMM] = getDims();
  const paperW = mmToPx(wMM);
  const avail = scroll.clientWidth - 40;
  setZoom(Math.min(1, avail / paperW));
}

// ---------- View modes ----------
function setView(mode) {
  const isMobile = window.matchMedia('(max-width: 960px)').matches;
  if (isMobile && mode === 'split') mode = 'edit';
  viewMode = mode;
  const body = $('canvasBody');
  body.classList.remove('view-split', 'view-edit', 'view-preview');
  body.classList.add('view-' + mode);
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === mode));
  if (mode !== 'edit') setTimeout(render, 30);
}

// ================================================================
// EXPORTS
// ================================================================

function updatePrintStyle() {
  const [wMM, hMM] = getDims();
  if (!printStyleEl) {
    printStyleEl = document.createElement('style');
    printStyleEl.id = 'print-page-style';
    document.head.appendChild(printStyleEl);
  }
  printStyleEl.textContent = `@page { size: ${wMM}mm ${hMM}mm; margin: 0; }`;
}

function exportPdf() {
  updatePrintStyle();
  if (viewMode === 'edit') setView('preview');
  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 60);
  });
}

function exportDocx() {
  if (!window.docx) {
    toast('DOCX library unavailable. Connect to the internet and reload.');
    return;
  }
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;
  const s = getSettings();
  const [wMM, hMM] = getDims();

  const alignmentFor = (a) => ({
    left: AlignmentType.LEFT, center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED
  }[a] || AlignmentType.LEFT);

  function inlineRuns(el, fmt = {}) {
    const runs = [];
    (function walk(node, f) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue) runs.push(new TextRun({ text: node.nodeValue, ...f }));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const nf = { ...f };
        if (tag === 'b' || tag === 'strong') nf.bold = true;
        if (tag === 'i' || tag === 'em') nf.italics = true;
        if (tag === 'u') nf.underline = {};
        if (tag === 's' || tag === 'strike' || tag === 'del') nf.strike = true;
        if (tag === 'br') { runs.push(new TextRun({ text: '' })); return; }
        node.childNodes.forEach((c) => walk(c, nf));
      }
    })(el, fmt);
    return runs;
  }

  function blockToParagraphs(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return [new Paragraph({ children: [new TextRun(node.nodeValue || '')] })];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const tag = node.tagName.toLowerCase();
    const spacing = { after: (+s.paraGap) * 20, line: Math.round((+s.lineSpacing) * 240) };

    if (tag === 'h1') return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(node), spacing })];
    if (tag === 'h2') return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(node), spacing })];
    if (tag === 'h3') return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(node), spacing })];
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.querySelectorAll(':scope > li'));
      return items.map((li, i) =>
        new Paragraph({
          children: [
            new TextRun({ text: tag === 'ol' ? `${i + 1}. ` : '• ' }),
            ...inlineRuns(li)
          ],
          spacing
        })
      );
    }
    if (tag === 'hr') return [new Paragraph({ text: '─────────' })];
    return [new Paragraph({ children: inlineRuns(node), alignment: alignmentFor(s.alignment), spacing })];
  }

  const children = [];
  Array.from(editor.childNodes).forEach((node) => {
    children.push(...blockToParagraphs(node));
  });
  if (children.length === 0) children.push(new Paragraph(''));

  const sectionProps = {
    page: {
      size: { width: Math.round(wMM * 56.7), height: Math.round(hMM * 56.7) },
      margin: {
        top: Math.round((+s.marginTop) * 56.7),
        right: Math.round((+s.marginRight) * 56.7),
        bottom: Math.round((+s.marginBottom) * 56.7),
        left: Math.round((+s.marginLeft) * 56.7)
      }
    }
  };

  const doc = new Document({ sections: [{ properties: sectionProps, children }] });
  Packer.toBlob(doc)
    .then((blob) => download(blob, safeName() + '.docx'))
    .catch(() => toast('Could not create DOCX.'));
}

function exportHtml() {
  const s = getSettings();
  const [wMM, hMM] = getDims();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml($('docTitle').value)}</title>
<style>
  @page { size: ${wMM}mm ${hMM}mm; margin: 0; }
  body { font-family: ${s.fontFamily}; font-size: ${s.fontSize}pt; line-height: ${s.lineSpacing}; color: ${s.textColor}; background: ${s.pageColor}; text-align: ${s.alignment}; padding: ${s.marginTop}mm ${s.marginRight}mm ${s.marginBottom}mm ${s.marginLeft}mm; }
  p { margin: 0 0 ${s.paraGap}px; }
  img { max-width: 100%; }
  h1,h2,h3 { font-family: inherit; }
</style></head><body>${editor.innerHTML}</body></html>`;
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), safeName() + '.html');
}

function exportMd() {
  function htmlToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(htmlToMd).join('');
    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
    if (tag === 'em' || tag === 'i') return `*${inner}*`;
    if (tag === 'u') return inner;
    if (tag === 'code') return `\`${inner}\``;
    if (tag === 'a') return `[${inner}](${node.getAttribute('href') || ''})`;
    if (tag === 'br') return '\n';
    if (tag === 'img') return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
    if (/^h[1-6]$/.test(tag)) return `\n${'#'.repeat(+tag[1])} ${inner}\n`;
    if (tag === 'li') return `- ${inner}\n`;
    if (tag === 'p' || tag === 'div') return `${inner}\n\n`;
    if (tag === 'blockquote') return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
    return inner;
  }
  const md = Array.from(editor.childNodes).map(htmlToMd).join('').replace(/\n{3,}/g, '\n\n').trim();
  download(new Blob([md || editor.innerText], { type: 'text/markdown;charset=utf-8' }), safeName() + '.md');
}

function exportTxt() {
  download(new Blob([editor.innerText], { type: 'text/plain;charset=utf-8' }), safeName() + '.txt');
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ================================================================
// EDITOR
// ================================================================
const editor = $('editor');

document.querySelectorAll('[data-cmd]').forEach((btn) => {
  btn.addEventListener('click', () => {
    editor.focus();
    document.execCommand(btn.dataset.cmd, false, null);
    scheduleRender();
  });
});

$('blockStyle').addEventListener('change', (e) => {
  editor.focus();
  document.execCommand('formatBlock', false, e.target.value);
  scheduleRender();
});

editor.addEventListener('input', () => {
  updateStats();
  scheduleRender();
});
editor.addEventListener('blur', () => scheduleSave());

// ================================================================
// SETTINGS BINDINGS
// ================================================================
SETTINGS_IDS.forEach((id) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', scheduleRender);
  el.addEventListener('change', scheduleRender);
});

// ================================================================
// INSERT
// ================================================================
function insertHtml(html) {
  editor.focus();
  document.execCommand('insertHTML', false, html);
  scheduleRender();
}

$('insertTable').addEventListener('click', () => {
  insertHtml(
    '<table><tbody>' +
    '<tr><td>Header 1</td><td>Header 2</td></tr>' +
    '<tr><td>Cell 1</td><td>Cell 2</td></tr>' +
    '<tr><td>Cell 3</td><td>Cell 4</td></tr>' +
    '</tbody></table><p><br></p>'
  );
});

$('insertImage').addEventListener('click', () => $('imageInput').click());
$('imageInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) { toast('Please choose an image smaller than 4 MB.'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => insertHtml(`<p><img src="${reader.result}" alt="Inserted image"></p>`);
  reader.readAsDataURL(f);
  e.target.value = '';
});

$('insertLink').addEventListener('click', () => {
  const url = prompt('Enter a URL (https://…)');
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { toast('Only http and https links are allowed.'); return; }
  editor.focus();
  document.execCommand('createLink', false, url);
  scheduleRender();
});

$('insertSignature').addEventListener('click', () => {
  insertHtml('<p><br><br>____________________________<br>Signature</p>');
});

// ================================================================
// FIND & REPLACE
// ================================================================
$('replaceBtn').addEventListener('click', () => {
  const find = $('findText').value;
  if (!find) { toast('Enter text to find.'); return; }
  const replacement = $('replaceText').value;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  let count = 0;
  nodes.forEach((node) => {
    if (node.parentElement && node.parentElement.closest('script,style')) return;
    const v = node.nodeValue;
    if (v && v.includes(find)) {
      const parts = v.split(find);
      count += parts.length - 1;
      node.nodeValue = parts.join(replacement);
    }
  });
  scheduleRender();
  toast(`${count} replacement${count === 1 ? '' : 's'} made.`);
});

// ================================================================
// TEXT TO SPEECH
// ================================================================
$('speakBtn').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) { toast('Text-to-speech is not supported in this browser.'); return; }
  window.speechSynthes
