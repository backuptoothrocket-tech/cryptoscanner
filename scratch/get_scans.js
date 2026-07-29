fetch('http://localhost:3000/api/market-scan')
  .then(r => r.json())
  .then(scans => {
    scans.forEach(s => {
      console.log(`Symbol: ${s.symbol}, Price: ${s.price}, UTBot: ${s.utbot}, RSI: ${s.rsi}, MACD: ${s.macd}, Source: ${s.source}`);
    });
  })
  .catch(err => console.error("Error fetching market scans:", err));
