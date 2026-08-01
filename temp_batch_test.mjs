const url = 'http://127.0.0.1:5000/api/market-prices/batch';
const body = JSON.stringify({ symbols: ['XAUUSDT', 'TATAMOTORS.NS'] });
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
});
console.log('status', res.status);
console.log(await res.text());
