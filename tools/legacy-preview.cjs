// Isolated read-only reference: original client and server, memory-only, localhost-only.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
process.env.DATABASE_URL = '';
const filename = path.resolve(__dirname, '../legacy/server.js');
process.chdir(path.dirname(filename));
const source = fs.readFileSync(filename, 'utf8').replace('server.listen(3000,', "server.listen(3001, '127.0.0.1',");
const preview = new Module(filename, module);
preview.filename = filename;
preview.paths = module.paths;
preview._compile(source, filename);
