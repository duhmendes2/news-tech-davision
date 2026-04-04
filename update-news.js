const https = require('https');
const fs = require('fs');
const path = require('path');

function loadToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  if (process.env.APIFY_API_KEY) return process.env.APIFY_API_KEY;
  try {
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    return (env.match(/APIFY_API_KEY=(.+)/) || env.match(/APIFY_TOKEN=(.+)/))?.[1]?.trim() || '';
  } catch { return ''; }
}
const TOKEN = loadToken();

const SOURCE_LOGOS = {
  slashdot:    'https://slashdot.org/favicon.ico',
  venturebeat: 'https://venturebeat.com/favicon.ico',
  techcrunch:  'https://techcrunch.com/favicon.ico',
  theverge:    'https://www.theverge.com/favicon.ico',
  wired:       'https://www.wired.com/favicon.ico',
  mit:         'https://www.technologyreview.com/favicon.ico',
  arxiv:       'https://arxiv.org/favicon.ico',
  'Hacker News': 'https://news.ycombinator.com/favicon.ico',
};

const CATEGORY_KEYWORDS = {
  'IA': ['ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'machine learning', 'deep learning', 'neural', 'chatbot', 'language model', 'copilot', 'mistral', 'llama', 'transformer', 'generative', 'foundation model', 'alignment', 'rag', 'agent'],
  'Robótica': ['robot', 'robotic', 'humanoid', 'boston dynamics', 'tesla bot', 'optimus', 'figure', 'spot', 'drone', 'autonomous vehicle', 'self-driving', 'waymo', 'tesla autopilot'],
  'Produção de Conteúdo': ['creator', 'content creator', 'youtube', 'instagram', 'tiktok', 'influencer', 'social media', 'video', 'podcast', 'newsletter', 'substack', 'monetize', 'audience'],
  'Tecnologia': [],
};

function categorize(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'Tecnologia') continue;
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return 'Tecnologia';
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.apify.com', path, method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function filterRecent(items) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  return items.filter(item => {
    const raw = item.publishedAt || item.date || item.time || '';
    if (!raw) return true; // sem data: mantém
    const d = new Date(raw);
    return !isNaN(d) && d >= yesterday;
  });
}

function generateHTML(items) {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const recent = filterRecent(items);
  const categories = { 'IA': [], 'Robótica': [], 'Produção de Conteúdo': [], 'Tecnologia': [] };

  recent.forEach(item => {
    const cat = categorize(item);
    categories[cat].push(item);
  });

  const categoryIcons  = { 'IA': '🤖', 'Robótica': '⚙️', 'Produção de Conteúdo': '🎬', 'Tecnologia': '💻' };
  const categoryColors = { 'IA': '#6366f1', 'Robótica': '#f59e0b', 'Produção de Conteúdo': '#ec4899', 'Tecnologia': '#10b981' };

  // Serializa os itens para embed no HTML (para busca/filtro client-side)
  const allItemsJson = JSON.stringify(recent.map(item => ({
    title:       item.title || '',
    url:         item.url   || '',
    description: (item.description || '').substring(0, 200),
    source:      item.source || '',
    publishedAt: item.publishedAt || '',
    image:       item.image || '',
    score:       item.score || 0,
    comments:    item.comments || 0,
    category:    categorize(item),
  })));

  const sectionId = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const navButtons = Object.entries(categories)
    .filter(([, v]) => v.length)
    .map(([name]) => `<button class="nav-btn" data-cat="${name}" onclick="filterByCategory('${name}')">${categoryIcons[name]} ${name}</button>`)
    .join('') +
    `<button class="nav-btn" data-cat="saved" onclick="filterByCategory('saved')">⭐ Salvos <span class="saved-count" id="savedCount">0</span></button>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HotNews — IA & Tecnologia</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; }

    /* ── Header ── */
    header {
      background: linear-gradient(135deg, #1a1d27 0%, #12151e 100%);
      border-bottom: 1px solid #1e2230;
      padding: 20px 40px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      position: sticky; top: 0; z-index: 100;
      backdrop-filter: blur(10px);
    }
    .logo { font-size: 1.4rem; font-weight: 700; background: linear-gradient(135deg, #818cf8, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; white-space: nowrap; }
    .header-meta { font-size: 0.75rem; color: #64748b; text-align: right; white-space: nowrap; }
    .header-meta strong { color: #94a3b8; }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .refresh-btn { background: #1e2230; border: 1px solid #2d3348; color: #94a3b8; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; transition: all .2s; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .refresh-btn:hover { background: #2d3348; color: #e2e8f0; }

    /* ── Toolbar (nav + search + filters) ── */
    .toolbar {
      background: #12151e;
      border-bottom: 1px solid #1e2230;
      padding: 10px 40px;
      display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
    }
    .nav-btn {
      background: #1a1d27; border: 1px solid #1e2230; color: #94a3b8;
      padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 500;
      cursor: pointer; transition: all .2s; white-space: nowrap;
    }
    .nav-btn:hover, .nav-btn.active { background: #2d3348; color: #e2e8f0; border-color: #3d4460; }
    .nav-btn.active { border-color: #818cf8; color: #818cf8; }
    .nav-btn[data-cat="saved"].active { border-color: #f59e0b; color: #f59e0b; }
    .nav-btn[data-cat="saved"] .saved-count { display: none; background: #f59e0b30; color: #f59e0b; border-radius: 20px; padding: 1px 7px; font-size: 0.7rem; font-weight: 700; }
    .nav-btn[data-cat="saved"].has-saved .saved-count { display: inline; }

    .toolbar-sep { width: 1px; height: 20px; background: #1e2230; flex-shrink: 0; }

    .date-filter-group { display: flex; gap: 6px; }
    .date-btn {
      background: #1a1d27; border: 1px solid #1e2230; color: #94a3b8;
      padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
      cursor: pointer; transition: all .2s; white-space: nowrap;
    }
    .date-btn:hover { background: #2d3348; color: #e2e8f0; }
    .date-btn.active { background: #6366f120; border-color: #6366f1; color: #818cf8; }

    .search-wrap { margin-left: auto; position: relative; }
    .search-input {
      background: #1a1d27; border: 1px solid #1e2230; color: #e2e8f0;
      padding: 6px 12px 6px 34px; border-radius: 20px; font-size: 0.8rem;
      width: 220px; outline: none; transition: border-color .2s, width .2s;
      font-family: inherit;
    }
    .search-input::placeholder { color: #475569; }
    .search-input:focus { border-color: #3d4460; width: 280px; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #475569; font-size: 0.85rem; pointer-events: none; }
    .clear-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #475569; font-size: 0.8rem; cursor: pointer; display: none; background: none; border: none; }
    .clear-btn.visible { display: block; }

    /* ── Main ── */
    main { max-width: 1400px; margin: 0 auto; padding: 36px 40px; }

    .stats { display: flex; gap: 12px; margin-bottom: 36px; flex-wrap: wrap; }
    .stat { background: #1a1d27; border: 1px solid #1e2230; border-radius: 12px; padding: 14px 22px; }
    .stat-value { font-size: 1.6rem; font-weight: 700; color: #818cf8; }
    .stat-label { font-size: 0.72rem; color: #64748b; margin-top: 2px; }

    /* ── Empty state ── */
    .empty-state { text-align: center; padding: 80px 20px; color: #475569; }
    .empty-state .icon { font-size: 3rem; margin-bottom: 12px; }
    .empty-state p { font-size: 0.9rem; }

    /* ── Sections ── */
    .category { margin-bottom: 48px; }
    .category[hidden] { display: none; }
    .category-title {
      font-size: 1.15rem; font-weight: 700; margin-bottom: 20px;
      display: flex; align-items: center; gap: 10px;
    }
    .category-title::after { content: ''; flex: 1; height: 1px; background: color-mix(in srgb, var(--cat-color) 25%, transparent); }
    .count { background: color-mix(in srgb, var(--cat-color) 15%, transparent); color: var(--cat-color); border-radius: 20px; padding: 2px 10px; font-size: 0.72rem; font-weight: 600; }

    /* ── Cards ── */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }

    .card {
      background: #1a1d27; border: 1px solid #1e2230; border-radius: 14px;
      overflow: hidden; text-decoration: none; color: inherit;
      display: flex; flex-direction: column;
      transition: transform .2s, border-color .2s, box-shadow .2s;
      position: relative;
    }
    .card:hover { transform: translateY(-3px); border-color: #2d3348; box-shadow: 0 10px 36px rgba(0,0,0,.45); }
    .card[hidden] { display: none; }

    .card-img { width: 100%; height: 170px; background-size: cover; background-position: center; background-color: #12151e; flex-shrink: 0; }
    .card-img--placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e2230, #12151e); }
    .card-img--placeholder span { font-size: 2.5rem; color: #2d3348; }

    .card-body { padding: 14px 16px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .card-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .source-logo { width: 14px; height: 14px; border-radius: 3px; }
    .source-name { font-size: 0.72rem; font-weight: 600; color: #818cf8; text-transform: uppercase; letter-spacing: .06em; }
    .date { font-size: 0.68rem; color: #64748b; margin-left: auto; }
    .badge { font-size: 0.68rem; color: #94a3b8; background: #12151e; border-radius: 6px; padding: 2px 6px; }

    .card-title { font-size: 0.92rem; font-weight: 600; line-height: 1.45; color: #e2e8f0; }
    .card-desc { font-size: 0.78rem; color: #94a3b8; line-height: 1.55; margin-top: auto; padding-top: 4px; }

    /* ── Botão salvar ── */
    .save-btn {
      position: absolute; top: 10px; right: 10px;
      background: rgba(15,17,23,.7); border: 1px solid #2d3348;
      color: #64748b; width: 30px; height: 30px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; cursor: pointer; backdrop-filter: blur(4px);
      transition: all .2s; z-index: 2; flex-shrink: 0;
    }
    .save-btn:hover { background: rgba(30,34,48,.9); color: #f59e0b; border-color: #f59e0b; transform: scale(1.1); }
    .save-btn.saved { background: #f59e0b20; border-color: #f59e0b; color: #f59e0b; }

    /* ── Seção Salvos ── */
    #sec-saved .category-title { --cat-color: #f59e0b; }
    .saved-empty { text-align: center; padding: 48px 20px; color: #475569; font-size: 0.85rem; }
    .saved-empty .icon { font-size: 2.5rem; margin-bottom: 10px; }

    /* ── Search highlight ── */
    mark { background: #6366f130; color: #a5b4fc; border-radius: 2px; }

    /* ── Result count ── */
    .result-info { font-size: 0.8rem; color: #64748b; margin-bottom: 24px; }
    .result-info strong { color: #94a3b8; }

    footer { text-align: center; padding: 36px; color: #475569; font-size: 0.78rem; border-top: 1px solid #1e2230; }

    @media (max-width: 768px) {
      header { padding: 14px 16px; flex-wrap: wrap; }
      .toolbar { padding: 10px 16px; }
      main { padding: 20px 16px; }
      .cards-grid { grid-template-columns: 1fr; }
      .search-wrap { margin-left: 0; width: 100%; }
      .search-input { width: 100% !important; }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">🔥 HotNews</div>
    <div class="header-meta">
      <strong>IA & Tecnologia</strong><br>
      Atualizado: ${now}
    </div>
    <div class="header-actions">
      <button class="refresh-btn" id="refreshBtn" onclick="triggerUpdate()">↻ Atualizar</button>
    </div>
  </header>

  <nav class="toolbar">
    <button class="nav-btn active" data-cat="all" onclick="filterByCategory('all')">✦ Todas</button>
    ${navButtons}
    <div class="toolbar-sep"></div>
    <div class="date-filter-group">
      <button class="date-btn active" data-date="all"   onclick="filterByDate('all')">Todos os dias</button>
      <button class="date-btn"        data-date="today" onclick="filterByDate('today')">Hoje</button>
      <button class="date-btn"        data-date="yesterday" onclick="filterByDate('yesterday')">Ontem</button>
    </div>
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input class="search-input" id="searchInput" type="text" placeholder="Buscar notícias..." oninput="onSearch(this.value)">
      <button class="clear-btn" id="clearBtn" onclick="clearSearch()">✕</button>
    </div>
  </nav>

  <main>
    <div class="stats" id="statsBar">
      <div class="stat"><div class="stat-value" id="statTotal">${recent.length}</div><div class="stat-label">notícias (hoje + ontem)</div></div>
      ${Object.entries(categories).filter(([,v]) => v.length).map(([k,v]) => `<div class="stat"><div class="stat-value" style="color:${categoryColors[k]}" id="stat-${sectionId(k)}">${v.length}</div><div class="stat-label">${k}</div></div>`).join('')}
    </div>

    <div class="result-info" id="resultInfo" style="display:none"></div>

    <div id="sections">
      ${Object.entries(categories).map(([name, itms]) => {
        if (!itms.length) return '';
        const color = categoryColors[name];
        const icon  = categoryIcons[name];
        const id    = sectionId(name);
        const cards = itms.map(item => {
          const logo  = SOURCE_LOGOS[item.source] || '';
          const date  = formatDate(item.publishedAt);
          const imgHtml = item.image
            ? `<div class="card-img" style="background-image:url('${item.image}')"></div>`
            : `<div class="card-img card-img--placeholder"><span>${(item.source || '?')[0].toUpperCase()}</span></div>`;
          const scoreHtml    = item.score    ? `<span class="badge">⬆ ${item.score}</span>`    : '';
          const commentsHtml = item.comments ? `<span class="badge">💬 ${item.comments}</span>` : '';
          const isoDate = item.publishedAt || '';
          const safeTitle = (item.title || '').replace(/"/g, '&quot;');
          const safeSrc   = (item.source || '').replace(/"/g, '&quot;');
          const safeUrl = (item.url || '').replace(/"/g, '&quot;');
          const safeImg = (item.image || '').replace(/"/g, '&quot;');
          return `
      <div class="card"
           data-title="${safeTitle.toLowerCase()}"
           data-desc="${(item.description || '').substring(0,200).toLowerCase()}"
           data-source="${safeSrc.toLowerCase()}"
           data-cat="${name}"
           data-date="${isoDate}"
           data-url="${safeUrl}">
        <button class="save-btn" title="Salvar notícia" onclick="toggleSave(event, this, {url:'${safeUrl}',title:'${safeTitle.replace(/'/g,"\\'")}',source:'${safeSrc.replace(/'/g,"\\'")}',date:'${isoDate}',image:'${safeImg.replace(/'/g,"\\'")}',description:'${(item.description||'').substring(0,150).replace(/'/g,"\\'").replace(/\n/g,' ')}',cat:'${name}'})">⭐</button>
        <a class="card-link" href="${item.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;flex:1;">
          ${imgHtml}
          <div class="card-body">
            <div class="card-meta">
              ${logo ? `<img class="source-logo" src="${logo}" alt="${item.source}" onerror="this.style.display='none'">` : ''}
              <span class="source-name">${item.source || ''}</span>
              ${date ? `<span class="date">${date}</span>` : ''}
              ${scoreHtml}${commentsHtml}
            </div>
            <h3 class="card-title">${item.title}</h3>
            ${item.description ? `<p class="card-desc">${item.description.substring(0, 150)}${item.description.length > 150 ? '…' : ''}</p>` : ''}
          </div>
        </a>
      </div>`;
        }).join('');
        return `
    <section class="category" id="sec-${id}" data-cat="${name}">
      <h2 class="category-title" style="--cat-color:${color}">${icon} ${name} <span class="count" id="cnt-${id}">${itms.length}</span></h2>
      <div class="cards-grid" id="grid-${id}">${cards}</div>
    </section>`;
      }).join('')}
    </div>

    <section class="category" id="sec-saved" data-cat="saved" hidden>
      <h2 class="category-title">⭐ Salvos <span class="count" id="cnt-saved">0</span></h2>
      <div class="cards-grid" id="grid-saved">
        <div class="saved-empty">
          <div class="icon">⭐</div>
          <p>Nenhuma notícia salva ainda.<br>Clique no ⭐ de qualquer card para guardar aqui.</p>
        </div>
      </div>
    </section>

    <div class="empty-state" id="emptyState" style="display:none">
      <div class="icon">🔍</div>
      <p>Nenhuma notícia encontrada para <strong id="emptyTerm"></strong></p>
    </div>
  </main>

  <footer>
    Dados via Hacker News API + RSS (Slashdot · VentureBeat · TechCrunch · The Verge · Wired · MIT Tech Review · arXiv) · Apify Actor <code>duhmendes~hotnews-ai-tech</code>
  </footer>

  <script>
  // ── Curadoria — localStorage ──
  const SAVED_KEY = 'hotnews_saved';

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  }

  function setSaved(list) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }

  function updateSavedBadge() {
    const saved = getSaved();
    const n = saved.length;
    const btn = document.querySelector('.nav-btn[data-cat="saved"]');
    const countEl = document.getElementById('savedCount');
    if (countEl) countEl.textContent = n;
    if (btn) btn.classList.toggle('has-saved', n > 0);
    const cntEl = document.getElementById('cnt-saved');
    if (cntEl) cntEl.textContent = n;
  }

  function renderSavedCards() {
    const saved = getSaved();
    const grid = document.getElementById('grid-saved');
    if (!grid) return;
    if (!saved.length) {
      grid.innerHTML = '<div class="saved-empty"><div class="icon">⭐</div><p>Nenhuma notícia salva ainda.<br>Clique no ⭐ de qualquer card para guardar aqui.</p></div>';
      return;
    }
    grid.innerHTML = saved.map(item => {
      const date = item.date ? (() => { try { return new Date(item.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return ''; } })() : '';
      const imgHtml = item.image
        ? \`<div class="card-img" style="background-image:url('\${item.image}')"></div>\`
        : \`<div class="card-img card-img--placeholder"><span>\${(item.source||'?')[0].toUpperCase()}</span></div>\`;
      return \`
      <div class="card saved-card" data-url="\${(item.url||'').replace(/"/g,'&quot;')}" data-cat="\${item.cat||''}">
        <button class="save-btn saved" title="Remover dos salvos" onclick="toggleSave(event, this, \${JSON.stringify(item).replace(/"/g,'&quot;')})">⭐</button>
        <a class="card-link" href="\${item.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;flex:1;">
          \${imgHtml}
          <div class="card-body">
            <div class="card-meta">
              <span class="source-name">\${item.source||''}</span>
              \${date ? \`<span class="date">\${date}</span>\` : ''}
            </div>
            <h3 class="card-title">\${item.title||''}</h3>
            \${item.description ? \`<p class="card-desc">\${item.description.substring(0,150)}\${item.description.length>150?'…':''}</p>\` : ''}
          </div>
        </a>
      </div>\`;
    }).join('');
  }

  function toggleSave(event, btn, item) {
    event.preventDefault();
    event.stopPropagation();
    const saved = getSaved();
    const idx = saved.findIndex(s => s.url === item.url);
    if (idx >= 0) {
      saved.splice(idx, 1);
      btn.classList.remove('saved');
      btn.title = 'Salvar notícia';
      // remove também da seção de salvos se estiver visível
      const savedCard = document.querySelector(\`#grid-saved .saved-card[data-url="\${CSS.escape(item.url)}"]\`);
      if (savedCard) savedCard.remove();
      // se grid ficou vazio, mostra empty
      const grid = document.getElementById('grid-saved');
      if (grid && !grid.querySelector('.saved-card')) {
        grid.innerHTML = '<div class="saved-empty"><div class="icon">⭐</div><p>Nenhuma notícia salva ainda.<br>Clique no ⭐ de qualquer card para guardar aqui.</p></div>';
      }
    } else {
      saved.unshift(item); // mais recente primeiro
      btn.classList.add('saved');
      btn.title = 'Remover dos salvos';
      renderSavedCards();
    }
    setSaved(saved);
    updateSavedBadge();
  }

  // ── Init curadoria ──
  function initSaved() {
    updateSavedBadge();
    renderSavedCards();
    // marca botões dos cards que já estão salvos
    const saved = getSaved();
    const urls = new Set(saved.map(s => s.url));
    document.querySelectorAll('.card[data-url]').forEach(card => {
      if (urls.has(card.dataset.url)) {
        const btn = card.querySelector('.save-btn');
        if (btn) { btn.classList.add('saved'); btn.title = 'Remover dos salvos'; }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initSaved);

  // ── Estado do filtro ──
  let activeCategory = 'all';
  let activeDateFilter = 'all';
  let activeSearch = '';

  // ── Trigger atualização via GitHub Actions ──
  async function triggerUpdate() {
    const btn = document.getElementById('refreshBtn');
    let token = localStorage.getItem('gh_dispatch_token');
    if (!token) {
      token = prompt('Cole seu GitHub Personal Access Token (escopo: workflow):');
      if (!token) return;
      localStorage.setItem('gh_dispatch_token', token);
    }
    btn.disabled = true;
    btn.textContent = '⏳ Buscando...';
    try {
      const res = await fetch('https://api.github.com/repos/duhmendes2/news-tech-davision/actions/workflows/update-news.yml/dispatches', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'master' })
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('gh_dispatch_token');
        btn.disabled = false;
        btn.textContent = '❌ Token inválido — tente novamente';
        return;
      }
      btn.textContent = '🔄 Atualizando...';
      let t = 80;
      const iv = setInterval(() => {
        t--;
        btn.textContent = '🔄 Aguardando... ' + t + 's';
        if (t <= 0) { clearInterval(iv); location.reload(); }
      }, 1000);
    } catch(e) {
      btn.disabled = false;
      btn.textContent = '↻ Atualizar';
    }
  }

  // ── Filtro por categoria ──
  function filterByCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));

    // A seção de salvos só aparece quando a aba "saved" está ativa
    const savedSec = document.getElementById('sec-saved');
    if (savedSec) savedSec.hidden = cat !== 'saved';

    // Oculta seções normais quando a aba "saved" está ativa
    document.querySelectorAll('.category[data-cat]:not(#sec-saved)').forEach(sec => {
      if (cat === 'saved') sec.hidden = true;
    });

    if (cat !== 'saved') applyFilters();
  }

  // ── Filtro por data ──
  function filterByDate(range) {
    activeDateFilter = range;
    document.querySelectorAll('.date-btn').forEach(b => b.classList.toggle('active', b.dataset.date === range));
    applyFilters();
  }

  // ── Busca ──
  function onSearch(val) {
    activeSearch = val.trim().toLowerCase();
    document.getElementById('clearBtn').classList.toggle('visible', activeSearch.length > 0);
    applyFilters();
  }

  function clearSearch() {
    document.getElementById('searchInput').value = '';
    onSearch('');
  }

  // ── Aplica todos os filtros ──
  function applyFilters() {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const sections = document.querySelectorAll('.category[data-cat]');
    let totalVisible = 0;

    sections.forEach(sec => {
      const secCat = sec.dataset.cat;
      const catMatch = activeCategory === 'all' || activeCategory === secCat;
      if (!catMatch) { sec.hidden = true; return; }

      const cards = sec.querySelectorAll('.card');
      let visibleInSection = 0;

      cards.forEach(card => {
        const dateStr = card.dataset.date;
        let dateOk = true;
        if (activeDateFilter !== 'all' && dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d)) {
            if (activeDateFilter === 'today')     dateOk = d >= todayStart;
            if (activeDateFilter === 'yesterday') dateOk = d >= yesterdayStart && d < todayStart;
          }
        }

        const searchOk = !activeSearch ||
          card.dataset.title.includes(activeSearch) ||
          card.dataset.desc.includes(activeSearch) ||
          card.dataset.source.includes(activeSearch);

        const visible = dateOk && searchOk;
        card.hidden = !visible;
        if (visible) visibleInSection++;
      });

      sec.hidden = visibleInSection === 0;
      totalVisible += visibleInSection;

      // atualiza contador da seção
      const countEl = sec.querySelector('.count');
      if (countEl) countEl.textContent = visibleInSection;
    });

    // empty state
    const empty = document.getElementById('emptyState');
    empty.style.display = totalVisible === 0 ? 'block' : 'none';
    if (activeSearch) document.getElementById('emptyTerm').textContent = '"' + activeSearch + '"';

    // result info
    const info = document.getElementById('resultInfo');
    const hasFilter = activeCategory !== 'all' || activeDateFilter !== 'all' || activeSearch;
    if (hasFilter) {
      info.style.display = 'block';
      let parts = [];
      if (activeSearch) parts.push('busca: <strong>"' + activeSearch + '"</strong>');
      if (activeCategory !== 'all') parts.push('categoria: <strong>' + activeCategory + '</strong>');
      if (activeDateFilter !== 'all') parts.push('data: <strong>' + (activeDateFilter === 'today' ? 'hoje' : 'ontem') + '</strong>');
      info.innerHTML = totalVisible + ' resultado' + (totalVisible !== 1 ? 's' : '') + ' — ' + parts.join(' · ');
    } else {
      info.style.display = 'none';
    }
  }
  </script>
</body>
</html>`;
}

async function main() {
  if (!TOKEN) { console.error('❌ APIFY_TOKEN não encontrado'); process.exit(1); }
  console.log('🔥 Buscando notícias do dia...\n');

  const run = await post('/v2/acts/duhmendes~hotnews-ai-tech/runs?memory=512', {
    sources: ['slashdot', 'hackernews', 'venturebeat', 'techcrunch', 'theverge', 'wired', 'mit', 'arxiv'],
    maxItemsPerSource: 20,
    filterKeywords: [],
    hnCategory: 'top',
  });

  if (run.error) { console.error('❌ Erro ao iniciar actor:', run.error.message); process.exit(1); }
  const runId = run.data.id;
  console.log(`Run ID: ${runId}\n⏳ Aguardando conclusão...`);

  let finished = null;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const r = await get(`https://api.apify.com/v2/actor-runs/${runId}`);
    const status = r.data?.status;
    process.stdout.write(`\r   ${status} (${(i+1)*5}s)`);
    if (['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status)) {
      console.log('');
      finished = r.data;
      break;
    }
  }

  if (!finished || finished.status !== 'SUCCEEDED') {
    console.error('\n❌ Run não concluiu com sucesso:', finished?.status);
    process.exit(1);
  }

  const dsId = finished.defaultDatasetId;
  const res = await get(`https://api.apify.com/v2/datasets/${dsId}/items?limit=100`);
  const items = Array.isArray(res) ? res : (res?.data?.items || res?.items || []);

  if (!items.length) { console.error('❌ Nenhum item no dataset'); process.exit(1); }

  console.log(`\n✅ ${items.length} notícias coletadas`);
  console.log('🖼️  Gerando dashboard...');

  const html = generateHTML(items);
  const outPath = path.join(__dirname, 'news-dashboard.html');
  fs.writeFileSync(outPath, html, 'utf8');

  // Salvar também o JSON bruto
  fs.writeFileSync(path.join(__dirname, 'news-latest.json'), JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2));

  console.log(`\n🏁 Dashboard salvo em: news-dashboard.html`);
  console.log(`   Total: ${items.length} notícias`);
}

main().catch(console.error);
