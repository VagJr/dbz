const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/engine.js',s=>{const a=s.indexOf('    for (const w of WORLDS)\n      for'),b=s.indexOf('\n  }\n  spawn(',a);if(a<0||b<0)throw Error('spawn anchor');return s.slice(0,a)+`    // Stream encounters from world compositions; story encounters own the protected arrival area.
`+s.slice(b);});
edit('src/engine.js',s=>s.replace('!e.chapterId && !e.event && !e.storyEncounter','!e.chapterId && !e.event && !e.storyEncounter && !e.nonRespawn').replace('require("./sandbox")(Engine);','require("./sandbox")(Engine);\nrequire("./beta")(Engine);'));
edit('server.js',s=>{s=s.replace('const { Store } = require("./src/store");','const { Store } = require("./src/store");\nconst Security=require("./src/security"),Beta=require("./shared/beta");').replace('  const store = new Store(',`  const cfg=Security.config(options),gate=new Security.Limiter(),connections=new Map();
  let paused=false,closing=false,lastTickMs=0,maxTickMs=0;
  const store = new Store(`).replace('new Server(server, { maxHttpBufferSize: 4096, serveClient: true })',`new Server(server, { maxHttpBufferSize:4096,serveClient:true,allowRequest:(req,cb)=>cb(null,Security.originAllowed(req.headers.origin,req.headers.host,cfg)) })`).replace('  app.use((req, res, next) => {\n    res.setHeader("X-Content-Type-Options", "nosniff");\n    res.setHeader("Referrer-Policy", "same-origin");\n    next();\n  });',`  app.use(Security.headers);
  app.use((req,res,next)=>{if(cfg.production)res.setHeader('Strict-Transport-Security','max-age=31536000');next();});`).replace('res.json({ ok: true, version: "3.0.0", players: engine.players.size })',"res.status(paused||closing?503:200).json({ok:!paused&&!closing,version:Beta.version,players:engine.players.size,payments:false})").replace('  app.use("/shared",',`  app.get('/api/status',(_,res)=>res.json({version:Beta.version,mode:cfg.production?'beta restrita':'desenvolvimento local',saving:paused?'indisponível':'disponível',lastSavedAt:store.lastSavedAt,players:engine.players.size,capacity:cfg.maxPlayers,payments:false}));
  app.use("/shared",`).replace('  io.on("connection", (socket) => {',`  const capture=()=>{for(const[key,id]of sessions){const p=engine.players.get(id);if(p&&store.get(key))store.save(key,engine.profile(p));}};
  const persist=async()=>{capture();try{await store.flush();paused=false;}catch(e){paused=true;io.emit('notice','Mundo pausado: o salvamento falhou. Suas ações serão retomadas após recuperação.');throw e;}};
  const audit=(p,action,result)=>{const entries=engine.worldMemory.audit||=[];entries.push({at:Date.now(),citizen:p?.citizenId||null,action,ok:!!result.ok});if(entries.length>2000)entries.splice(0,entries.length-2000);};
  io.on("connection", (socket) => {
    const ip=socket.handshake.address;
    if(closing||io.engine.clientsCount>cfg.maxConnections||(connections.get(ip)||0)>=cfg.maxPerIP||!gate.allow('connect:'+ip,30,60000)){socket.disconnect(true);return;}
    connections.set(ip,(connections.get(ip)||0)+1);
    const authTimer=setTimeout(()=>{if(!engine.players.has(socket.id))socket.disconnect(true);},60000);authTimer.unref();
    socket.use(([event],next)=>{if(paused||closing){socket.emit('notice','Mundo em manutenção. Aguarde antes de agir.');return;}if(!gate.allow('packets:'+socket.id,160,1000)){socket.disconnect(true);return;}next();});`).replace('if (joining || token || limited("join", 3, 10000)) return;','if (joining || token || limited("join", 3, 10000)||!gate.allow("join:"+ip,12,60000)) return;').replace('let profile = store.get(data.token);',`if(cfg.invite&&data.invite!==cfg.invite){socket.emit('notice','Esta beta exige um convite válido.');return;}
        if(engine.players.size>=cfg.maxPlayers){socket.emit('notice','Servidor cheio. Tente novamente em instantes.');return;}
        let profile=store.get(data.token);
        if(data.token&&!profile){socket.emit('notice','A chave de acesso expirou ou é inválida. Use a recuperação de conta.');return;}
        if(profile?._account?.bannedUntil>Date.now()){socket.emit('notice','Acesso suspenso. Consulte o operador da beta.');return;}`).replace('        const p = engine.addPlayer(socket.id, profile);','        if(!socket.connected)return;\n        const p = engine.addPlayer(socket.id, profile);\n        clearTimeout(authTimer);').replace('await store.flush();\n        if (socket.connected)', 'await persist();\n        if (socket.connected)');
const a=s.indexOf('    socket.on("sandbox",'),b=s.indexOf('    socket.on("input",',a);
s=s.slice(0,a)+`    socket.on('sandbox',async(data,ack)=>{
      if(!token||limited('sandbox',5))return typeof ack==='function'&&ack({ok:false,message:'Aguarde antes de enviar outra ação.'});
      const result=engine.sandboxCommand(socket.id,data);audit(engine.players.get(socket.id),'sandbox:'+String(data?.action).slice(0,24),result);
      try{await persist();if(typeof ack==='function')ack(result);if(socket.connected)socket.emit('snapshot',engine.snapshot(socket.id));}catch{if(typeof ack==='function')ack({ok:false,message:'Salvamento indisponível. Mundo pausado.'});}
    });
    socket.on('beta',async(data,ack)=>{if(!token||limited('beta',3))return;const result=engine.betaCommand(socket.id,data);audit(engine.players.get(socket.id),'beta:'+String(data?.action).slice(0,24),result);try{await persist();if(typeof ack==='function')ack(result);}catch{if(typeof ack==='function')ack({ok:false,message:'Salvamento indisponível.'});}});
    socket.on('account',async(data,ack)=>{if(typeof ack!=='function'||!data||typeof data!=='object'||!gate.allow('account:'+ip,5,60000))return;const p=engine.players.get(socket.id);
      try{
        if(data.action==='recovery'&&p&&token){capture();const code=store.recovery(token);await persist();ack({ok:true,code,message:'Guarde este código em local privado. Substitui o anterior e só pode ser usado uma vez.'});return;}
        if(data.action==='export'&&p){ack({ok:true,profile:engine.profile(p)});return;}
        if(data.action==='restore'&&!token){const recovered=store.recover(data.code);if(!recovered){ack({ok:false,message:'Código inválido ou já utilizado.'});return;}
          for(const[key,id]of sessions)if(store.key(key)===recovered.oldKey){sessions.delete(key);io.sockets.sockets.get(id)?.disconnect(true);}
          await persist();ack({ok:true,token:recovered.token,message:'Acesso recuperado. Entre novamente e gere outro código de recuperação.'});return;
        }
        ack({ok:false,message:'Ação de conta indisponível.'});
      }catch{paused=true;ack({ok:false,message:'Não foi possível salvar. O servidor foi pausado.'});}
    });
    socket.on('community',async(data,ack)=>{if(!token||typeof ack!=='function'||!data||typeof data!=='object'||limited('community',2,10000))return;const p=engine.players.get(socket.id),target=engine.players.get(data.target);if(!p)return;
      if(data.action==='block'&&target&&target.id!==p.id){p.beta.blocked=[...new Set([...p.beta.blocked,target.citizenId])].slice(-100);}
      else if(data.action==='report'&&typeof data.text==='string'&&data.text.trim().length>=10){const reports=engine.worldMemory.reports||=[];if(reports.length>=1000)return ack({ok:false,message:'Fila de relatos cheia. Contate o operador.'});reports.push({id:require('node:crypto').randomUUID(),at:Date.now(),from:p.citizenId,target:target?.citizenId||null,text:data.text.replace(/[<>\\u0000-\\u001f]/g,'').slice(0,1000),status:'open'});}
      else return ack({ok:false,message:'Preencha um relato com pelo menos dez caracteres.'});
      try{await persist();ack({ok:true,message:data.action==='block'?'Mensagens deste jogador silenciadas.':'Relato registrado para revisão do operador.'});}catch{ack({ok:false,message:'Salvamento indisponível.'});}
    });
`+s.slice(b);
s=s.replace('if (q.world === p.world)','if (q.world === p.world&&!q.beta?.blocked.includes(p.citizenId))').replace('name: p.name,\n            text:','id:p.id,name: p.name,\n            text:');
s=s.replace('      const p = engine.players.get(socket.id);\n      if (p && token)',"      clearTimeout(authTimer);connections.set(ip,Math.max(0,(connections.get(ip)||1)-1));gate.entries.delete('packets:'+socket.id);\n      const p = engine.players.get(socket.id);\n      if (p && token&&store.get(token))");
s=s.replace('    const now = performance.now();\n    accumulator',"    const now = performance.now();\n    if(paused||closing){last=now;accumulator=0;return;}\n    const tickStart=now;\n    accumulator").replace('  }, 1000 / 60);','    lastTickMs=performance.now()-tickStart;maxTickMs=Math.max(maxTickMs,lastTickMs);\n  }, 1000 / 60);');
const c=s.indexOf('  const save = setInterval('),d=s.indexOf('  await new Promise((resolve)',c);s=s.slice(0,c)+`  const save=setInterval(()=>persist().catch(e=>console.error('Falha no checkpoint:',e.code||e.message)),15000);
`+s.slice(d);
s=s.replace('    clearInterval(loop);','    closing=true;\n    clearInterval(loop);').replace('return { server, io, engine, store, close };','return { server, io, engine, store, close,metrics:()=>({lastTickMs,maxTickMs,paused}) };');return s;});
console.log('Beta server systems installed.');

