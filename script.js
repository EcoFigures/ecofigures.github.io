// NOTE: the "Suggest a figure" / "Report an error" links live directly in
// index.html as <a href="FORM_URL_..."> placeholders - swap those two href
// values for your real Google Form URLs (see corner-menu-item in index.html).

let ALL_FIGURES = [];
let QUESTIONS_BY_ID = {}; // { 'FIG-001': [{question, answer}, ...] }

const grid = document.getElementById('grid');
const searchInput = document.getElementById('searchInput');
const topicFilter = document.getElementById('topicFilter');
const taxaFilter = document.getElementById('taxaFilter');
const typeFilter = document.getElementById('typeFilter');
const conceptFilter = document.getElementById('conceptFilter');
const difficultyFilter = document.getElementById('difficultyFilter');
const openAccessFilter = document.getElementById('openAccessFilter');
const resultsCount = document.getElementById('resultsCount');

// ---- Helpers ----
function splitTags(value) {
  if (!value) return [];
  return value.split(';').map(s => s.trim()).filter(Boolean);
}

function escapeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str = '') {
  return escapeHTML(str).replace(/"/g, '&quot;');
}

// Lightweight markup support for free-text fields (citation, methods,
// notes, questions, answers). Escapes HTML first for safety, then converts
// a small set of plain-text markers into real formatting:
//   **bold text**      -> <strong>bold text</strong>
//   *italic text*       -> <em>italic text</em>
//   _underlined text_   -> <u>underlined text</u>
// Type these markers directly into the spreadsheet cell around the text
// you want formatted - CSV itself can't store rich text, so this is the
// workaround. Order matters: bold (**) is applied before italic (*) so
// "**bold**" isn't partially matched by the italic pattern first.
function formatText(str = '') {
  let out = escapeHTML(str);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/_(.+?)_/g, '<u>$1</u>');
  return out;
}

function parseCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => resolve(results.data),
      error: reject
    });
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Load both CSVs, then render ----
Promise.all([parseCSV('data.csv'), parseCSV('questions.csv')])
  .then(([figures, questions]) => {
    ALL_FIGURES = figures.map(row => ({
      ...row,
      difficulty: parseInt(row.difficulty, 10) || 0,
      taxaList: splitTags(row.taxa),
      topicList: splitTags(row.topic),
      typeList: splitTags(row.figure_type),
      isOpenAccess: (row.open_source || '').trim().toLowerCase() === 'yes'
    }));

    // Shuffle once per page load so the same handful of entries aren't
    // always the first thing people see. Order then stays stable while
    // someone is actively searching/filtering.
    shuffle(ALL_FIGURES);

    QUESTIONS_BY_ID = {};
    questions.forEach(q => {
      if (!q.entry_id) return;
      if (!QUESTIONS_BY_ID[q.entry_id]) QUESTIONS_BY_ID[q.entry_id] = [];
      const question = (q.question || '').trim();
      const answer = (q.answer || '').trim();
      if (question) {
        QUESTIONS_BY_ID[q.entry_id].push({ question, answer });
      }
    });

    populateFilterOptions();
    render();
  })
  .catch(err => {
    grid.innerHTML = `<div class="empty-state">Couldn't load the data files. If you're testing locally, make sure you're running a local server (e.g. VS Code's "Live Server" extension) rather than opening index.html directly.</div>`;
    console.error(err);
  });

function populateFilterOptions() {
  fillSelect(topicFilter, uniqueTagValues('topicList'));
  fillSelect(taxaFilter, uniqueTagValues('taxaList'));
  fillSelect(typeFilter, uniqueTagValues('typeList'));
  fillSelect(conceptFilter, uniqueValues('4DEE_concept'));
}

function uniqueValues(key) {
  return [...new Set(ALL_FIGURES.map(f => f[key]).filter(Boolean))].sort();
}

function uniqueTagValues(key) {
  const all = ALL_FIGURES.flatMap(f => f[key] || []);
  return [...new Set(all)].sort();
}

function fillSelect(select, values) {
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
}

// ---- Filtering ----
function getFiltered() {
  const q = searchInput.value.trim().toLowerCase();
  const topic = topicFilter.value;
  const taxa = taxaFilter.value;
  const type = typeFilter.value;
  const concept = conceptFilter.value;
  const difficulty = difficultyFilter.value;
  const openOnly = openAccessFilter.checked;

  return ALL_FIGURES.filter(f => {
    if (topic && !f.topicList.includes(topic)) return false;
    if (taxa && !f.taxaList.includes(taxa)) return false;
    if (type && !f.typeList.includes(type)) return false;
    if (concept && f['4DEE_concept'] !== concept) return false;
    if (difficulty && String(f.difficulty) !== difficulty) return false;
    if (openOnly && !f.isOpenAccess) return false;
    if (q) {
      const haystack = `${f.title} ${f.citation} ${f.topic} ${f.taxa} ${f['4DEE_concept']}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ---- Rendering: grid ----
function render() {
  const items = getFiltered();
  resultsCount.innerHTML = `<strong>${items.length}</strong> of ${ALL_FIGURES.length} figures`;

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No figures match those filters. Try broadening your search.</div>`;
    return;
  }

  grid.innerHTML = items.map(cardHTML).join('');

  grid.querySelectorAll('.card').forEach(card => {
    const openIt = () => {
      const f = ALL_FIGURES.find(x => x.id === card.dataset.id);
      if (f) openModal(f);
    };
    card.addEventListener('click', openIt);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); }
    });
  });
}

function dotsHTML(difficulty) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="dot ${i < difficulty ? 'filled' : ''}"></span>`
  ).join('');
}

const FALLBACK_STYLES = ['fallback-forest', 'fallback-water', 'fallback-amber'];

function fallbackClassFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length];
}

function fallbackDivHTML(f) {
  const cls = fallbackClassFor(f.id || f.title || 'x');
  return `<div class="thumb-fallback ${cls}">
    <span class="thumb-fallback-journal">${escapeHTML(f.journal || '')}</span>
    <span class="thumb-fallback-note">Preview not available — see publisher link</span>
  </div>`;
}

function thumbUrlFor(f) {
  if (f.thumbnail_url && f.thumbnail_url.trim()) return f.thumbnail_url.trim();
  if (!f.publisher_url) return null;
  // Microlink returns a live screenshot of the publisher page - no need to host any image ourselves.
  return `https://api.microlink.io/?url=${encodeURIComponent(f.publisher_url)}&screenshot=true&meta=false&embed=screenshot.url`;
}

function thumbHTML(f) {
  const skip = (f.skip_thumbnail || '').trim().toLowerCase();
  if (skip === 'yes' || skip === 'true') return fallbackDivHTML(f);

  const url = thumbUrlFor(f);
  if (!url) return fallbackDivHTML(f);

  // data-fallback-id lets the onerror handler rebuild the exact same fallback markup on load failure.
  return `<img src="${escapeAttr(url)}" alt="Preview of ${escapeAttr(f.title)}" loading="lazy"
            data-fallback-id="${escapeAttr(f.id)}"
            onerror="window.__thumbFallback(this)">`;
}

// Exposed globally so inline onerror handlers (set via innerHTML) can call it.
window.__thumbFallback = function (imgEl) {
  const id = imgEl.getAttribute('data-fallback-id');
  const f = ALL_FIGURES.find(x => x.id === id);
  if (!f) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = fallbackDivHTML(f);
  imgEl.replaceWith(wrapper.firstElementChild);
};

function pillsHTML(f) {
  const topicPills = f.topicList.map(t => `<span class="pill topic">${escapeHTML(t)}</span>`).join('');
  const taxaPills = f.taxaList.map(t => `<span class="pill taxa">${escapeHTML(t)}</span>`).join('');
  const typePills = f.typeList.map(t => `<span class="pill type">${escapeHTML(t)}</span>`).join('');
  return `
    ${topicPills}
    ${taxaPills}
    ${typePills}
    ${f['4DEE_concept'] ? `<span class="pill concept">${escapeHTML(f['4DEE_concept'])}</span>` : ''}
  `;
}

function cardHTML(f) {
  return `
  <article class="card" data-id="${escapeAttr(f.id)}" tabindex="0" role="button" aria-label="View entry: ${escapeAttr(f.title)}">
    <div class="card-thumb">${thumbHTML(f)}</div>
    <div class="card-body">
      <div class="card-top">
        <span class="catalog-tag">${escapeHTML(f.id)}</span>
        ${f.isOpenAccess ? `<span class="badge-open-access">Open access</span>` : ''}
      </div>
      <h3>${escapeHTML(f.title)}</h3>
      <div class="citation">${formatText(f.citation)}</div>
      <div class="pills">${pillsHTML(f)}</div>
      <div class="difficulty-row">
        <span class="difficulty-label">Difficulty</span>
        <span class="dots">${dotsHTML(f.difficulty)}</span>
      </div>
      <span class="view-link">View details</span>
    </div>
  </article>`;
}

// ---- Modal (full detail) ----
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

function questionsHTML(f) {
  const qs = QUESTIONS_BY_ID[f.id] || [];
  if (qs.length === 0) {
    return `<div class="no-questions">Practice questions for this figure are still in progress — check back soon.</div>`;
  }
  return qs.map((q, i) => `
    <div class="qa-block">
      <div class="q-number">Question ${i + 1} of ${qs.length}</div>
      <div class="q-text">${formatText(q.question)}</div>
      <button class="reveal-btn qa-reveal-btn">Show answer</button>
      <div class="modal-answer qa-answer">${formatText(q.answer)}</div>
    </div>
  `).join('');
}

function openModal(f) {
  const figLabel = f.figure_num ? ` · Figure ${escapeHTML(f.figure_num)}` : '';

  modalBody.innerHTML = `
    <div class="modal-eyebrow">${escapeHTML(f.id)} · ${escapeHTML(f.journal)} · ${escapeHTML(f.year)}${figLabel}</div>
    <h2>${escapeHTML(f.title)}</h2>
    <div class="citation">${formatText(f.citation)}</div>

    <div class="modal-thumb">${thumbHTML(f)}</div>

    ${f.publisher_url ? `<a class="publisher-link" href="${escapeAttr(f.publisher_url)}" target="_blank" rel="noopener noreferrer">View at publisher ↗</a>` : ''}

    <div class="pills">
      ${pillsHTML(f)}
      ${f.isOpenAccess ? `<span class="badge-open-access">Open access</span>` : ''}
    </div>

    ${f.methods_summary && !f.methods_summary.startsWith('[') ? `
      <div class="modal-section-label">Methods</div>
      <div class="modal-notes-text">${formatText(f.methods_summary)}</div>
    ` : ''}

    ${f.interpretation_notes && !f.interpretation_notes.startsWith('[') ? `
      <div class="modal-section-label">Notes for interpreting this figure</div>
      <div class="modal-notes-text">${formatText(f.interpretation_notes)}</div>
    ` : ''}

    <div class="modal-section-label">Practice questions</div>
    ${questionsHTML(f)}

    <div class="difficulty-row" style="margin-top:18px;">
      <span class="difficulty-label">Difficulty</span>
      <span class="dots">${dotsHTML(f.difficulty)}</span>
    </div>
  `;

  modalBody.querySelectorAll('.qa-reveal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ans = btn.nextElementSibling;
      ans.classList.toggle('shown');
      btn.textContent = ans.classList.contains('shown') ? 'Hide answer' : 'Show answer';
    });
  });

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---- Filter events ----
[searchInput, topicFilter, taxaFilter, typeFilter, conceptFilter, difficultyFilter, openAccessFilter].forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

// Corner menu logic lives in corner-menu.js, shared across all pages.
