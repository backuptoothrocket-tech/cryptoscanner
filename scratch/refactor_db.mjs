import fs from "fs";

const filepath = "server.ts";
let content = fs.readFileSync(filepath, "utf8");

// Convert endpoint handlers to async
content = content.replace(/app\.(get|post|put|delete)\("([^"]+)",\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/g, 'app.$1("$2", async (req, res) => {');

// Convert specific functions to async
const functionsToAsync = [
  "backfillTradesFromLogs",
  "autoLogTradeFromAlert",
  "pollBinance",
  "pollCustomBinance",
  "runTelegramPolling",
  "sendTelegramNotification", // might already be async
  "processSignalPayload"
];

for (const fn of functionsToAsync) {
  content = content.replace(new RegExp(`function ${fn}\\(`, 'g'), `async function ${fn}(`);
}

// Convert readDB() to await readDB()
content = content.replace(/readDB\(\)/g, "await readDB()");
// But wait, if readDB() was inside processSignalPayload which is called synchronously, that's a problem. 
// We need to fix those specific call sites.

// Convert writeDB(db) to await writeDB(db)
content = content.replace(/writeDB\(([^)]+)\)/g, "await writeDB($1)");

// Fix some common async issues where we might have double await
content = content.replace(/await\s+await/g, "await");

fs.writeFileSync("server_modified.ts", content);
console.log("Written to server_modified.ts");
