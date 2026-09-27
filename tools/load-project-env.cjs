const fs = require('node:fs');
const file = 'server.js';
let s = fs.readFileSync(file, 'utf8');
s = s.replace('const path = require("node:path"),\n  http = require("node:http"),', 'const path = require("node:path"),\n  fs = require("node:fs"),\n  http = require("node:http"),');
const anchor = 'const { Server } = require("socket.io");';
if (!s.includes(anchor)) throw Error('Socket.IO import not found');
s = s.replace(anchor, `${anchor}\n\n// Load this checkout's ignored local settings without replacing explicit environment variables.\ntry {\n  const localEnv = fs.readFileSync(path.join(__dirname, ".env"), "utf8");\n  for (const line of localEnv.split(/\\r?\\n/)) {\n    const match = line.match(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*?)\\s*$/);\n    if (!match || process.env[match[1]] !== undefined) continue;\n    let value = match[2];\n    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);\n    process.env[match[1]] = value;\n  }\n} catch (error) {\n  if (error.code !== "ENOENT") throw error;\n}`);
fs.writeFileSync(file, s);
fs.writeFileSync('.env', 'PORT=25565\nHOST=192.168.15.100\nNODE_ENV=development\nUZ_ALLOWED_ORIGINS=http://192.168.15.100:25565\n');
