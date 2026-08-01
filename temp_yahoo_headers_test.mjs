const symbols = ['XAUUSDT', 'TATAMOTORS.NS'];
const YAHOO_SYMBOL_MAP = { XAUUSDT: 'XAUUSD=X', XAGUSDT: 'XAGUSD=X' };
const toYahooSymbol = (sym) => {
  const clean = (sym || '').toUpperCase().trim();
  if (YAHOO_SYMBOL_MAP[clean]) return YAHOO_SYMBOL_MAP[clean];
  if (clean.endsWith('.NS') || clean.endsWith('=X') || clean.endsWith('=F') || clean.startsWith('^')) return clean;
  if (/^[A-Z]{6}$/.test(clean)) return `${clean}=X`;
  return `${clean}.NS`;
};

const map = new Map();
for (const sym of symbols) map.set(sym, toYahooSymbol(sym));
const yfList = Array.from(map.values()).join(',');
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com',
  Origin: 'https://finance.yahoo.com',
  'Sec-Fetch-Site': 'same-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty'
};
const quoteUrls = [
  `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yfList)}`,
  `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yfList)}`
];
for (const url of quoteUrls) {
  console.log('QUOTE URL', url);
  const res = await fetch(url, { headers });
  console.log('status', res.status);
  const text = await res.text();
  console.log(text.slice(0, 1200));
}
