fetch('https://api.binance.com/api/v3/klines?symbol=DOTUSDT&interval=4h&limit=200')
  .then(r => r.json())
  .then(data => {
    const last = data[data.length - 1];
    console.log("Last Kline Close:", last[4]);
    console.log("Last Kline Open Time:", new Date(last[0]).toISOString());
  })
  .catch(err => console.error(err));
