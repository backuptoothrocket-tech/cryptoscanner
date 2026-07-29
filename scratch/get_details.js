fetch('http://localhost:3000/api/market-scan')
  .then(r => r.json())
  .then(scans => {
    const bnb = scans.find(s => s.symbol === 'BNBUSDT');
    const btc = scans.find(s => s.symbol === 'BTCUSDT');
    console.log("BNB Scan Details:", JSON.stringify(bnb, null, 2));
    console.log("BTC Scan Details:", JSON.stringify(btc, null, 2));
  })
  .catch(err => console.error("Error fetching market scans:", err));
