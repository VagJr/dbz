const fs=require('node:fs');
let engine=fs.readFileSync('src/engine.js','utf8').replace('module.exports = { Engine, cleanName, distance };','require("./sandbox")(Engine);\nmodule.exports = { Engine, cleanName, distance };');fs.writeFileSync('src/engine.js',engine);
let server=fs.readFileSync('server.js','utf8');server=server.replace('    socket.on("input", (data) => {',`    socket.on("sandbox", (data, ack) => {
      if(!token || limited("sandbox", 5)) { if(typeof ack==='function')ack({ok:false,message:'Aguarde antes de enviar outra ação.'}); return; }
      const result=engine.sandboxCommand(socket.id,data);
      // Capture every online profile with the shared economy in one atomic checkpoint.
      for(const [key,id] of sessions){const p=engine.players.get(id);if(p)store.save(key,engine.profile(p));}
      store.flush().then(()=>{if(typeof ack==='function')ack(result);if(socket.connected)socket.emit('snapshot',engine.snapshot(socket.id));}).catch(e=>{
        console.error('Sandbox save failed:',e.message);
        if(typeof ack==='function')ack({ok:false,message:'Falha de salvamento. Aguarde a recuperação do servidor.'});
      });
    });
    socket.on("input", (data) => {`);fs.writeFileSync('server.js',server);
let store=fs.readFileSync('src/store.js','utf8');store=store.replace('    try {\n      this.accounts = JSON.parse(',`    try {
      const checkpoint=JSON.parse(await fs.readFile(path.join(this.directory,'checkpoint.json'),'utf8'));
      if(checkpoint.version!==1 || !checkpoint.accounts || !checkpoint.world)throw new Error('Checkpoint inválido');
      this.accounts=checkpoint.accounts;this.worldMemory=checkpoint.world;this.checkpointLoaded=true;return;
    }catch(e){if(e.code!=='ENOENT')throw e;}
    try {
      this.accounts = JSON.parse(`);
store=store.replace('  async loadWorld() {','  async loadWorld() {\n    if(this.checkpointLoaded)return;');
store=store.replace('        const file = path.join(this.directory, "profiles.json");',`        const checkpoint=path.join(this.directory,'checkpoint.json');
        await fs.writeFile(checkpoint+'.tmp','{"version":1,"accounts":'+snapshot+',"world":'+worldSnapshot+'}',{mode:0o600});
        await fs.rename(checkpoint+'.tmp',checkpoint);
        const file = path.join(this.directory, "profiles.json");`);fs.writeFileSync('src/store.js',store);
let html=fs.readFileSync('public/index.html','utf8');html=html.replace('    <script src="/app.js"></script>','    <script src="/shared/sandbox.js"></script>\n    <script src="/sandbox-ui.js"></script>\n    <script src="/app.js"></script>');html=html.replace('href="/universe-ui.css?v=celestial1" />','href="/universe-ui.css?v=celestial1" />\n    <link rel="stylesheet" href="/sandbox-ui.css" />');fs.writeFileSync('public/index.html',html);
let app=fs.readFileSync('public/app.js','utf8');app=app.replace('  let state = null,','  window.UZSandboxUI?.connect(socket);\n  let state = null,');app=app.replace('    state = next;','    state = next;\n    window.UZSandboxUI?.update(next);');fs.writeFileSync('public/app.js',app);
let sandbox=fs.readFileSync('src/sandbox.js','utf8').replace("focus:'spirit'","focus:['force','spirit','vitality'].includes(saved.focus)?saved.focus:'spirit'");sandbox=sandbox.replace('p.maxHp*.3','p.maxHp*(.3+(w.projects[p.world]?.level||0)*.05)');fs.writeFileSync('src/sandbox.js',sandbox);
