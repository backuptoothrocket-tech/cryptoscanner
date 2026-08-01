const YAHOO_SYMBOL_MAP = {
  XAUUSDT: 'XAUUSD=X',
  XAGUSDT: 'XAGUSD=X'
};
function toYahooSymbol(sym) {
  const clean = (sym || '').toUpperCase().trim();
  if (YAHOO_SYMBOL_MAP[clean]) return YAHOO_SYMBOL_MAP[clean];
  if (clean.endsWith('.NS') || clean.endsWith('=X') || clean.endsWith('=F') || clean.startsWith('^')) return clean;
  if (/^[A-Z]{6}$/.test(clean)) return `${clean}=X`;
  return `${clean}.NS`;
}

(async () => {
  const otherSyms = ['XAUUSDT', 'TATAMOTORS.NS'];
  const yahooSymMap = new Map();
  for (const sym of otherSyms) yahooSymMap.set(toYahooSymbol(sym), sym);
  const yfList = Array.from(yahooSymMap.keys());
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yfList.join(','))}`;
  console.log('query url', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
      Referer: 'https://finance.yahoo.com'
    }
  });
  console.log('status', res.status);
  const json = await res.json();
  console.log('json keys', Object.keys(json));
  console.log('quoteResponse count', json?.quoteResponse?.result?.length);
  console.log(JSON.stringify(json?.quoteResponse?.result, null, 2));
})();
