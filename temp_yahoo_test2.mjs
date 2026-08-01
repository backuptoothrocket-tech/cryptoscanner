const symbols = ['XAUUSDT', 'TATAMOTORS.NS'];
const map = new Map();
const YAHOO_SYMBOL_MAP = { XAUUSDT: 'XAUUSD=X', XAGUSDT: 'XAGUSD=X' };
const toYahooSymbol = (sym) => {
  const clean = (sym || '').toUpperCase().trim();
  if (YAHOO_SYMBOL_MAP[clean]) return YAHOO_SYMBOL_MAP[clean];
  if (clean.endsWith('.NS') || clean.endsWith('=X') || clean.endsWith('=F') || clean.startsWith('^')) return clean;
  if (/^[A-Z]{6}$/.test(clean)) return `${clean}=X`;
  return `${clean}.NS`;
};
for (const sym of symbols) map.set(sym, toYahooSymbol(sym));
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com'
};
const quoteUrls = [
  `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(Array.from(map.values()).join(','))}`,
  `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(Array.from(map.values()).join(','))}`
];
for (const url of quoteUrls) {
  console.log('QUOTE URL', url);
  const res = await fetch(url, { headers });
  console.log('status', res.status);
  console.log('headers', Object.fromEntries(res.headers.entries()));
  const json = await res.text();
  console.log('body', json.slice(0, 1200));
}
for (const [sym, yf] of map) {
  for (const base of ['https://query1.finance.yahoo.com/v8/finance/chart/', 'https://query2.finance.yahoo.com/v8/finance/chart/']) {
    const url = `${base}${encodeURIComponent(yf)}?interval=1d&range=2d`;
    console.log('CHART URL', url);
    const res = await fetch(url, { headers });
    console.log('status', res.status);
    const json = await res.text();
    console.log('body', json.slice(0, 1200));
    if (res.status === 200) break;
  }
}
