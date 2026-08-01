const symbols = ['XAUUSD=X', 'TATAMOTORS.NS'];
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com'
};
for (const sym of symbols) {
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
  console.log('URL', url);
  const res = await fetch(url, { headers });
  console.log('status', res.status);
  const text = await res.text();
  console.log('text starts', text.slice(0, 1000));
  const match = text.match(/root.App.main\s*=\s*(\{.*\});/s);
  console.log('match', match ? 'yes' : 'no');
}
