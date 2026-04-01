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

  const categoryIcons = { 'IA': '🤖', 'Robótica': '⚙️', 'Produção de Conteúdo': '🎬', 'Tecnologia': '💻' };
  const categoryColors = { 'IA': '#6366f1', 'Robótica': '#f59e0b', 'Produção de Conteúdo': '#ec4899', 'Tecnologia': '#10b981' };

  const renderCard = (item) => {
    const logo = SOURCE_LOGOS[item.source] || '';
    const date = formatDate(item.publishedAt);
    const imgHtml = item.image
      ? `<div class="card-img" style="background-image:url('${item.image}')"></div>`
      : `<div class="card-img card-img--placeholder"><span>${(item.source || '?')[0].toUpperCase()}</span></div>`;
    const scoreHtml = item.score ? `<span class="badge">⬆ ${item.score}</span>` : '';
    const commentsHtml = item.comments ? `<span class="badge">💬 ${item.comments}</span>` : '';

    return `
      <a class="card" href="${item.url}" target="_blank" rel="noopener">
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
      </a>`;
  };

  const sectionId = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const renderSection = (name, items) => {
    if (!items.length) return '';
    const color = categoryColors[name];
    const icon = categoryIcons[name];
    const cards = items.map(renderCard).join('');
    return `
      <section class="category" id="${sectionId(name)}">
        <h2 class="category-title" style="--cat-color:${color}">${icon} ${name} <span class="count">${items.length}</span></h2>
        <div class="cards-grid">${cards}</div>
      </section>`;
  };

  const sections = Object.entries(categories).map(([name, itms]) => renderSection(name, itms)).join('');
  const navButtons = Object.entries(categories)
    .filter(([, v]) => v.length)
    .map(([name]) => `<a class="nav-btn" href="#${sectionId(name)}">${categoryIcons[name]} ${name}</a>`)
    .join('');

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

    header { background: linear-gradient(135deg, #1a1d27 0%, #12151e 100%); border-bottom: 1px solid #1e2230; padding: 24px 40px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px); }
    .logo { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #818cf8, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header-meta { font-size: 0.8rem; color: #64748b; text-align: right; }
    .header-meta strong { color: #94a3b8; }
    .refresh-btn { background: #1e2230; border: 1px solid #2d3348; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; transition: all .2s; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .refresh-btn:hover { background: #2d3348; color: #e2e8f0; }

    .nav-bar { background: #12151e; border-bottom: 1px solid #1e2230; padding: 10px 40px; display: flex; gap: 8px; flex-wrap: wrap; }
    .nav-btn { background: #1a1d27; border: 1px solid #1e2230; color: #94a3b8; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; text-decoration: none; transition: all .2s; white-space: nowrap; }
    .nav-btn:hover { background: #2d3348; color: #e2e8f0; border-color: #3d4460; }

    main { max-width: 1400px; margin: 0 auto; padding: 40px; }

    .stats { display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }
    .stat { background: #1a1d27; border: 1px solid #1e2230; border-radius: 12px; padding: 16px 24px; }
    .stat-value { font-size: 1.8rem; font-weight: 700; color: #818cf8; }
    .stat-label { font-size: 0.75rem; color: #64748b; margin-top: 2px; }

    .category { margin-bottom: 48px; }
    .category-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
    .category-title::after { content: ''; flex: 1; height: 1px; background: color-mix(in srgb, var(--cat-color) 30%, transparent); }
    .count { background: color-mix(in srgb, var(--cat-color) 20%, transparent); color: var(--cat-color); border-radius: 20px; padding: 2px 10px; font-size: 0.75rem; font-weight: 600; }

    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }

    .card { background: #1a1d27; border: 1px solid #1e2230; border-radius: 16px; overflow: hidden; text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: transform .2s, border-color .2s, box-shadow .2s; }
    .card:hover { transform: translateY(-4px); border-color: #2d3348; box-shadow: 0 12px 40px rgba(0,0,0,.4); }

    .card-img { width: 100%; height: 180px; background-size: cover; background-position: center; background-color: #12151e; }
    .card-img--placeholder { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e2230, #12151e); }
    .card-img--placeholder span { font-size: 3rem; color: #2d3348; }

    .card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .source-logo { width: 16px; height: 16px; border-radius: 4px; }
    .source-name { font-size: 0.75rem; font-weight: 600; color: #818cf8; text-transform: uppercase; letter-spacing: .05em; }
    .date { font-size: 0.7rem; color: #64748b; margin-left: auto; }
    .badge { font-size: 0.7rem; color: #94a3b8; background: #12151e; border-radius: 6px; padding: 2px 6px; }

    .card-title { font-size: 0.95rem; font-weight: 600; line-height: 1.4; color: #e2e8f0; }
    .card-desc { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; margin-top: auto; }

    footer { text-align: center; padding: 40px; color: #475569; font-size: 0.8rem; border-top: 1px solid #1e2230; }

    @media (max-width: 768px) {
      header { padding: 16px 20px; }
      main { padding: 20px; }
      .cards-grid { grid-template-columns: 1fr; }
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
    <a class="refresh-btn" href="javascript:location.reload()">↻ Atualizar</a>
  </header>

  <nav class="nav-bar">
    ${navButtons}
  </nav>

  <main>
    <div class="stats">
      <div class="stat"><div class="stat-value">${recent.length}</div><div class="stat-label">notícias (hoje + ontem)</div></div>
      ${Object.entries(categories).filter(([,v]) => v.length).map(([k,v]) => `<div class="stat"><div class="stat-value" style="color:${categoryColors[k]}">${v.length}</div><div class="stat-label">${k}</div></div>`).join('')}
    </div>

    ${sections}
  </main>

  <footer>
    Dados coletados via Hacker News API + RSS feeds públicos · Apify Actor <code>duhmendes~hotnews-ai-tech</code>
  </footer>
</body>
</html>`;
}

async function main() {
  if (!TOKEN) { console.error('❌ APIFY_TOKEN não encontrado'); process.exit(1); }
  console.log('🔥 Buscando notícias do dia...\n');

  const run = await post('/v2/acts/duhmendes~hotnews-ai-tech/runs?memory=512', {
    sources: ['hackernews', 'venturebeat', 'techcrunch', 'theverge', 'wired'],
    maxItemsPerSource: 15,
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
