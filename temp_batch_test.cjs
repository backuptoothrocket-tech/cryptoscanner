const http = require('http');
const data = JSON.stringify({ symbols: ['XAUUSDT', 'TATAMOTORS.NS'] });
const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/market-prices/batch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { console.log(body); });
});

req.on('error', (err) => {
  console.error('ERROR', err);
  process.exit(1);
});

req.write(data);
req.end();
