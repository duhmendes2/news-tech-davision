const { Actor } = require('apify');
const axios = require('axios');

const RSS_SOURCES = {
  slashdot:     'https://rss.slashdot.org/Slashdot/slashdotMain',
  venturebeat:  'https://venturebeat.com/category/ai/feed/',
  techcrunch:   'https://techcrunch.com/feed/',
  theverge:     'https://www.theverge.com/rss/index.xml',
  wired:        'https://www.wired.com/feed/tag/artificial-intelligence/latest/rss',
  mit:          'https://www.technologyreview.com/feed/',
  arxiv:        'https://rss.arxiv.org/rss/cs.AI',
};

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

function parseRSS(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    const link  = (get('link') || block.match(/<link>([^<]+)<\/link>/)?.[1] || '').trim();
    const desc  = get('description').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);
    const date  = get('pubDate') || get('published') || '';

    // Tentar extrair imagem do RSS
    let image = '';
    const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["']/i)
      || block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)
      || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) image = mediaMatch[1];

    // Tentar extrair imagem do conteúdo/description HTML
    if (!image) {
      const imgMatch = (get('content:encoded') || get('description')).match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) image = imgMatch[1];
    }

    if (title) items.push({ title, url: link, description: desc, publishedAt: date, source: sourceName, image });
  }
  return items;
}

// Buscar OG image de uma URL
async function fetchOGImage(url) {
  if (!url || url.startsWith('https://news.ycombinator.com')) return '';
  try {
    const { data: html } = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotNewsBot/1.0)' },
      maxContentLength: 200000,
    });
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
           || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return m ? m[1] : '';
  } catch { return ''; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fetch com concorrência limitada
async function fetchImagesParallel(items, concurrency = 5) {
  const results = [...items];
  const queue = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.image && item.url);
  let idx = 0;

  async function worker() {
    while (idx < queue.length) {
      const { item, i } = queue[idx++];
      const img = await fetchOGImage(item.url);
      if (img) results[i].image = img;
      await sleep(100);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchHackerNews(category = 'top', maxItems = 15) {
  console.log(`📡 Hacker News [${category}]...`);
  const catMap = { top: 'topstories', new: 'newstories', best: 'beststories', ask: 'askstories', show: 'showstories' };
  const { data: ids } = await axios.get(`https://hacker-news.firebaseio.com/v0/${catMap[category] || 'topstories'}.json`);
  const items = [];
  for (const id of ids.slice(0, maxItems * 2)) {
    if (items.length >= maxItems) break;
    try {
      const { data: s } = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      if (s?.title && s.type === 'story') {
        items.push({
          title: s.title,
          url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
          description: s.text ? s.text.replace(/<[^>]+>/g, '').substring(0, 250) : '',
          score: s.score || 0, comments: s.descendants || 0, author: s.by || '',
          publishedAt: s.time ? new Date(s.time * 1000).toISOString() : '',
          source: 'Hacker News', image: '',
        });
      }
      await sleep(50);
    } catch {}
  }
  console.log(`   ✅ ${items.length} stories`);
  return items;
}

async function fetchRSS(sourceKey, maxItems = 15) {
  const url = RSS_SOURCES[sourceKey];
  if (!url) return [];
  console.log(`📡 RSS [${sourceKey}]...`);
  try {
    const { data: xml } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const items = parseRSS(xml, sourceKey).slice(0, maxItems);
    console.log(`   ✅ ${items.length} artigos`);
    return items;
  } catch (e) { console.log(`   ❌ ${sourceKey}: ${e.message}`); return []; }
}

Actor.main(async () => {
  const input = await Actor.getInput() || {};
  const { sources = ['hackernews','venturebeat','techcrunch','theverge'], maxItemsPerSource = 15, filterKeywords = [], hnCategory = 'top' } = input;

  console.log('\n🔥 HotNews AI & Tech\n');
  const dataset = await Actor.openDataset();
  let allItems = [];

  for (const source of sources) {
    let items = source === 'hackernews' ? await fetchHackerNews(hnCategory, maxItemsPerSource) : await fetchRSS(source, maxItemsPerSource);
    if (filterKeywords.length) items = items.filter(i => {
      const t = (i.title + ' ' + i.description).toLowerCase();
      return filterKeywords.some(k => t.includes(k.toLowerCase()));
    });
    allItems.push(...items);
  }

  // Buscar OG images em paralelo
  console.log(`\n🖼️  Buscando imagens para ${allItems.length} itens...`);
  allItems = await fetchImagesParallel(allItems, 6);
  const withImage = allItems.filter(i => i.image).length;
  console.log(`   ✅ ${withImage}/${allItems.length} com imagem`);

  for (const item of allItems) {
    await dataset.pushData({ ...item, collectedAt: new Date().toISOString() });
  }

  await Actor.setValue('SUMMARY', { total: allItems.length, sources, collectedAt: new Date().toISOString() });
  console.log(`\n🏁 Finalizado — ${allItems.length} notícias salvas.`);
});
