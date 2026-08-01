import fs from "fs";

let content = fs.readFileSync("server_old.ts", "utf-8");

// 1. Add Mongoose imports
content = content.replace(
  /import { OpenAI } from "openai";/,
  `import { OpenAI } from "openai";\nimport { Config, Log, Trade, connectDatabase } from "./src/models/Database.js";`
);

// 2. Add connectDatabase to startup
content = content.replace(
  /const PORT = parseInt\(process\.env\.PORT \|\| "5000", 10\);/,
  `const PORT = parseInt(process.env.PORT || "5000", 10);\nawait connectDatabase();`
);

// 3. Replace readDB implementation
const readDBRegex = /function readDB\(\): DB \{[\s\S]*?return \{ config: DEFAULT_CONFIG, logs: \[\], trades: \[\] \};\n\}/;
const readDBNew = `async function readDB(): Promise<DB> {
  try {
    const configDoc = await Config.getSingleton();
    const logs = await Log.find().lean();
    const trades = await Trade.find().lean();
    return {
      config: { ...DEFAULT_CONFIG, ...configDoc.toObject() },
      logs: logs as any[],
      trades: trades as any[]
    };
  } catch (e) {
    console.error("Error reading from MongoDB", e);
    return { config: DEFAULT_CONFIG, logs: [], trades: [] };
  }
}`;
content = content.replace(readDBRegex, readDBNew);

// 4. Replace writeDB implementation
const writeDBRegex = /function writeDB\(db: DB\) \{[\s\S]*?console\.error\("Error writing database file", e\);\n\s*\}\n\}/;
const writeDBNew = `async function writeDB(db: DB) {
  try {
    const configDoc = await Config.getSingleton();
    Object.assign(configDoc, db.config);
    await configDoc.save();

    if (db.logs && db.logs.length > 0) {
      const bulkOps = db.logs.map(log => ({
        updateOne: { filter: { id: log.id }, update: { $set: log }, upsert: true }
      }));
      await Log.bulkWrite(bulkOps);
    }
    
    if (db.trades && db.trades.length > 0) {
      const bulkOps = db.trades.map(trade => ({
        updateOne: { filter: { id: trade.id }, update: { $set: trade }, upsert: true }
      }));
      await Trade.bulkWrite(bulkOps);
    }
  } catch (e) {
    console.error("Error writing to MongoDB", e);
  }
}`;
content = content.replace(writeDBRegex, writeDBNew);

// 5. Convert app.METHOD to async
content = content.replace(/app\.(get|post|put|delete)\("([^"]+)",\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/g, 'app.$1("$2", async (req, res) => {');

// 6. Convert functions to async
const functionsToAsync = [
  "backfillTradesFromLogs",
  "autoLogTradeFromAlert",
  "pollBinance",
  "pollCustomBinance",
  "runTelegramPolling",
  "sendTelegramNotification", 
  "processSignalPayload"
];
for (const fn of functionsToAsync) {
  content = content.replace(new RegExp(`function ${fn}\\(`, 'g'), `async function ${fn}(`);
}

// 7. Convert readDB() to await readDB()
content = content.replace(/readDB\(\)/g, "await readDB()");

// 8. Convert writeDB(db) to await writeDB(db)
content = content.replace(/writeDB\(([^)]+)\)/g, "await writeDB($1)");

// Fix some edge cases where we put 'await await' or missed something
content = content.replace(/await\s+await/g, "await");
content = content.replace(/async\s+async/g, "async");

fs.writeFileSync("server.ts", content);
console.log("Done refactoring server.ts");
