const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};
const nseBase = 'https://www.nseindia.com';
const getSession = async () => {
  const res = await fetch(`${nseBase}/market-data/live-equity-market`, { headers });
  console.log('session status', res.status);
  const cookie = res.headers.get('set-cookie');
  console.log('cookie', cookie?.slice(0, 200));
  return cookie;
};
const cookie = await getSession();
const apiHeaders = {
  ...headers,
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.nseindia.com/market-data/live-equity-market',
  'X-Requested-With': 'XMLHttpRequest',
  ...(cookie ? { Cookie: cookie } : {})
};
const paths = [
  '/api/quote-equity?symbol=TATAMOTORS',
  '/api/quote-equity?symbol=RELIANCE',
  '/api/quote-equity?symbol=TATAMOTORS\&section=tradeinfo'
];
for (const path of paths) {
  const url = `${nseBase}${path}`;
  try {
    const res = await fetch(url, { headers: apiHeaders });
    console.log(path, 'status', res.status);
    const text = await res.text();
    console.log(text.slice(0, 800));
  } catch (err) {
    console.error(path, 'error', err.toString());
  }
}
