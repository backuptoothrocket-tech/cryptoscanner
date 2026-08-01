import fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// 1. Replace readDB / writeDB definitions
const readDBRegex = /function readDB\(\): DB \{[\s\S]*?return \{ config: DEFAULT_CONFIG, logs: \[\], trades: \[\] \};\n\}/;
const writeDBRegex = /function writeDB\(db: DB\) \{[\s\S]*?console\.error\("Error writing database file", e\);\n\s*\}\n\}/;

content = content.replace(readDBRegex, "");
content = content.replace(writeDBRegex, "");

// 2. Add imports at the top
content = content.replace(
  /import { OpenAI } from "openai";/,
  `import { OpenAI } from "openai";\nimport { Config, Log, Trade, connectDatabase } from "./src/models/Database.js";`
);

// 3. Connect to DB at startup
content = content.replace(
  /const PORT = parseInt\(process\.env\.PORT \|\| "5000", 10\);/,
  `const PORT = parseInt(process.env.PORT || "5000", 10);\n\n// Initialize MongoDB\nawait connectDatabase();`
);

// Now I will run this replacement script and then manually use `multi_replace_file_content` for endpoints.
fs.writeFileSync("server_modified.ts", content);
console.log("Written to server_modified.ts");
