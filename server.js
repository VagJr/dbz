const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [] }).write();

const TICK = 30;
const players = {};
const MAX_CLIENT_SPEED = 18; // clamp for reconciliation

let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];

// --- CONFIGURAÇÃO DO UNIVERSO OMNI-DIRECIONAL ---
const BESTIARY = {
    EARTH:   { mobs: ["SAIBAMAN", "RR_ROBOT", "RR_COMMANDER", "WOLF_BANDIT"], bosses: ["RADITZ", "NAPPA", "VEGETA_SCOUTER"] },
    NAMEK:   { mobs: ["FRIEZA_SOLDIER", "NAMEK_WARRIOR", "DODORIA_ELITE", "ZARBON_MONSTER"], bosses: ["GINYU_FORCE", "FRIEZA_FINAL", "FRIEZA_FULL_POWER"] },
    ANDROID: { mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR", "ANDROID_17_ROGUE"], bosses: ["ANDROID_16", "ANDROID_18", "PERFECT_CELL"] },
    MAJIN:   { mobs: ["PUIPUI", "YAKON", "DABURA_DEMON", "MAJIN_SOLDIER"], bosses: ["MAJIN_VEGETA", "FAT_BUU", "KID_BUU"] },
    GODS:    { mobs: ["PRIDE_TROOPER", "HEELES_SOLDIER", "RESURRECTED_SOLDIER", "FROST_DEMON"], bosses: ["GOLDEN_FRIEZA", "GOKU_BLACK", "BEERUS"] },
    VOID:    { mobs: ["UNI_6_WARRIOR", "UNI_9_WOLF", "ANIRAZA_MINI", "TOPPO_BASE"], bosses: ["KEFLA", "TOPPO_GOD", "JIREN"] }
};

function getZoneInfo(x, y) {
    const dist = Math.hypot(x, y);
    let level = 1 + Math.floor(dist / 2000); 

    if(y < -5000 && Math.abs(x) < Math.abs(y)) return { id: "GODS", level };
    if(y > 5000 && Math.abs(x) < Math.abs(y)) return { id: "MAJIN", level };
    if(x > 5000 && Math.abs(y) < x) return { id: "NAMEK", level };
    if(x < -5000 && Math.abs(y) < Math.abs(x)) return { id: "ANDROID", level };
    
    if(dist > 50000) return { id: "VOID", level: level + 50 };

    return { id: "EARTH", level };
}

function initWorld() {
    for(let i=0; i<800; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 40000; 
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        
        const zone = getZoneInfo(x, y);
        let type = "rock_earth";
        if(zone.id === "NAMEK") type = "rock_namek";
        if(zone.id === "ANDROID") type = "rock_city";
        if(zone.id === "MAJIN") type = "rock_magic";
        if(zone.id === "GODS") type = "rock_god";
        if(zone.id === "VOID") type = "rock_void";

        rocks.push({ id: i, x, y, r: 30 + Math.random() * 80, hp: 200 + (dist/100), type: type });
    }
    for(let i=0; i<200; i++) spawnMobRandomly();
    
    spawnBossAt(10000, 0);  
    spawnBossAt(-10000, 0); 
    spawnBossAt(0, 10000);  
    spawnBossAt(0, -8000);  
}

function spawnMobRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * 35000; 
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    spawnMobAt(x, y);
}

function spawnMobAt(x, y) {
    const zone = getZoneInfo(x, y);
    const list = BESTIARY[zone.id].mobs;
    const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);
    
    let stats = { 
        name: type, hp: 500 * zone.level, bp: 1000 * zone.level, level: zone.level,
        color: "#fff", aggro: 700 + (zone.level * 10), aiType: "MELEE"
    };

    if(type === "SAIBAMAN") { stats.color = "#4a4"; stats.aiType = "SWARM"; }
    if(type === "RR_ROBOT") { stats.color = "#777"; stats.hp *= 1.2; }
    if(type.includes("FRIEZA")) { stats.color = "#848"; stats.aiType = "RANGED"; }
    if(type === "CELL_JR") { stats.color = "#38a"; stats.speed = 1.3; stats.aiType = "AGGRESSIVE"; }
    if(type.includes("MAJIN")) { stats.color = "#fbb"; stats.aiType = "TANK"; }
    if(type.includes("PRIDE")) { stats.color = "#d22"; stats.aiType = "TACTICAL"; }

    if(zone.level >= 50) stats.canBlast = true;
    if(zone.level >= 80) stats.canVanish = true;

    npcs.push({
        id, isNPC: true, r: stats.r || 25, x, y, vx: 0, vy: 0, 
        maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200,
        level: stats.level, bp: stats.bp, state: "IDLE", 
        color: stats.color, lastAtk: 0, lastBlast: 0, lastVanish: 0,
        combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType,
        canBlast: stats.canBlast || false, canVanish: stats.canVanish || false
    });
}

function spawnBossAt(x, y) {
    const zone = getZoneInfo(x, y);
    const bosses = BESTIARY[zone.id].bosses;
    const type = bosses[Math.floor(Math.random() * bosses.length)];
    let stats = { name: type, hp: 15000 * zone.level, bp: 60000 * zone.level, color: "#f00", r: 60 };
    
    if(type.includes("VEGETA")) stats.color = "#33f";
    if(type.includes("FRIEZA")) stats.color = "#fff";
    if(type.includes("CELL")) stats.color = "#484";
    if(type.includes("BUU")) stats.color = "#fbb";
    if(type.includes("BLACK")) stats.color = "#333";
    if(type.includes("JIREN")) { stats.color = "#f22"; stats.r = 55; }

    npcs.push({
        id: "BOSS_" + zone.id + "_" + Date.now(), name: type, isNPC: true, isBoss: true,
        x, y, vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 5000, maxKi: 5000,
        level: zone.level + 10, bp: stats.bp, state: "IDLE", 
        color: stats.color, lastAtk: 0, lastBlast: 0, lastVanish: 0,
        combo: 0, stun: 0, canBlast: true, canVanish: true, aiType: "BOSS"
    });
}

initWorld();

const server = http.createServer((req, res) => {
    const safeUrl = req.url === "/" ? "/index.html" : req.url;
    const p = path.join(__dirname, safeUrl);
    if(fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(p);
        const mime = ext === ".js" ? "application/javascript" : ext === ".html" ? "text/html" : "text/plain";
        res.writeHead(200, {"Content-Type": mime});
        fs.createReadStream(p).pipe(res);
    } else { res.writeHead(404); res.end(); }
});

const io = new Server(server, { transports: ['websocket'] });

io.on("connection", (socket) => {
    socket.on("login", (data) => {
        let user = db.get('users').find({ name: data.user }).value();
        if(!user) {
            user = { name: data.user, pass: data.pass, level: 1, xp: 0, bp: 500, maxLevelReached: 1 };
            db.get('users').push(user).write();
        } else if(user.pass !== data.pass) return;

        // Calcula XP para o próximo nivel
        const xpToNext = user.level * 800;

        players[socket.id] = {
            ...user, id: socket.id, r: 20,
            x: 0, y: 0, vx: 0, vy: 0, angle: 0,
            hp: 1000 + (user.level * 200), maxHp: 1000 + (user.level * 200),
            ki: 100, maxKi: 100 + (user.level * 10), form: "BASE",
            xpToNext: xpToNext, // Envia quanto falta
            state: "IDLE", combo: 0, lastAtk: 0, isDead: false, isSpirit: false, stun: 0,
            color: "#ff9900", chargeStart: 0
        };
        socket.emit("auth_success", players[socket.id]);
    });

    socket.on("input", (input) => {
        // client-side prediction reconciliation

        const p = players[socket.id];
        if(input.cx !== undefined && input.cy !== undefined){
            const dx = input.cx - p.x;
            const dy = input.cy - p.y;
            const dist = Math.hypot(dx, dy);
            if(dist < MAX_CLIENT_SPEED * 3){ // allow small prediction drift
                p.x = input.cx;
                p.y = input.cy;
            }
        }

        if(!p || p.stun > 0 || p.isDead) return; 
        
        let speed = 5;
        if(p.form === "SSJ") speed = 7;
        if(p.form === "GOD") speed = 9;
        if(p.form === "UI") speed = 12;

        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        
        if(input.x || input.y) {
            p.vx += input.x * speed * moveMod;
            p.vy += input.y * speed * moveMod;
            if(!["ATTACKING"].includes(p.state)) p.state = "MOVING";
        }
        
        p.angle = input.angle;

        if(input.block) {
            if(p.ki > 0) { p.state = "BLOCKING"; p.ki -= 0.5; } 
            else { p.state = "IDLE"; }
        }
        else if(input.charge) { 
            p.state = "CHARGING"; 
            p.ki = Math.min(p.maxKi, p.ki + (p.level * 0.8)); 
        } 
        else if(input.holdAtk) {
            if(p.state !== "CHARGING_ATK") p.chargeStart = Date.now();
            p.state = "CHARGING_ATK";
        } 
        else if(!["ATTACKING"].includes(p.state)) p.state = "IDLE";
    });

    socket.on("release_attack", () => {
        const p = players[socket.id];
        if(input.cx !== undefined && input.cy !== undefined){
            const dx = input.cx - p.x;
            const dy = input.cy - p.y;
            const dist = Math.hypot(dx, dy);
            if(dist < MAX_CLIENT_SPEED * 3){ // allow small prediction drift
                p.x = input.cx;
                p.y = input.cy;
            }
        }

        if(!p || p.isSpirit || p.stun > 0) return; 
        const isCharged = (Date.now() - p.chargeStart) > 600;
        p.state = "ATTACKING";
        p.lastAtk = Date.now();
        
        const lunge = isCharged ? 60 : 30;
        p.vx += Math.cos(p.angle) * lunge;
        p.vy += Math.sin(p.angle) * lunge;

        const targets = [...Object.values(players), ...npcs, ...rocks];
        let hit = false;
        targets.forEach(t => {
            if(t.id === p.id || t.isDead || t.isSpirit) return;
            const dist = Math.hypot(p.x - t.x, p.y - t.y);
            const range = (t.r || 25) + 65;
            const angToT = Math.atan2(t.y - p.y, t.x - p.x);
            let angDiff = Math.abs(angToT - p.angle);
            if(angDiff > Math.PI) angDiff = Math.PI*2 - angDiff;

            if(dist < range && angDiff < 1.6) {
                hit = true;
                let dmgMult = 1;
                if(p.form === "SSJ") dmgMult = 1.5;
                if(p.form === "GOD") dmgMult = 5.0;
                if(p.form === "UI") dmgMult = 15.0;

                let dmg = Math.floor((45 + p.level * 8) * dmgMult * (isCharged ? 3.5 : (1 + p.combo*0.2)));
                
                if(rocks.includes(t)) {
                   t.hp -= dmg;
                   io.emit("fx", { type: "hit", x: t.x, y: t.y, dmg: dmg });
                   if(t.hp <= 0) {
                       rocks = rocks.filter(r => r !== t);
                       io.emit("fx", { type: "rock_break", x: t.x, y: t.y });
                   }
                   return;
                }

                if(t.state === "BLOCKING") { dmg = Math.floor(dmg * 0.15); t.ki -= 15; }
                t.hp -= dmg;
                t.stun = isCharged ? 20 : 8;
                
                const pushForce = isCharged ? 90 : 35;
                t.vx = Math.cos(p.angle) * pushForce; 
                t.vy = Math.sin(p.angle) * pushForce;
                
                io.emit("fx", { type: isCharged ? "heavy" : "hit", x: t.x, y: t.y, angle: p.angle, dmg: dmg });
                if(isCharged) craters.push({ x: t.x, y: t.y, r: 45, life: 1200 }); 
                if(t.hp <= 0) handleKill(p, t);
            }
        });
        p.combo = hit ? (p.combo + 1) % 5 : 0;
        setTimeout(() => { if(p) p.state = "IDLE"; }, 200);
    });

    socket.on("release_blast", () => {
        const p = players[socket.id];
        if(input.cx !== undefined && input.cy !== undefined){
            const dx = input.cx - p.x;
            const dy = input.cy - p.y;
            const dist = Math.hypot(dx, dy);
            if(dist < MAX_CLIENT_SPEED * 3){ // allow small prediction drift
                p.x = input.cx;
                p.y = input.cy;
            }
        }

        if(!p || p.isSpirit || p.ki < 10) return;
        const isSuper = (Date.now() - p.chargeStart) > 800;
        const cost = isSuper ? 40 : 10;
        if(p.ki < cost) return;
        p.ki -= cost;

        let size = 12; let color = "#0cf";
        if(p.form === "SSJ") color = "#ff0";
        if(p.form === "GOD") color = "#f00";

        projectiles.push({
            id: Math.random(), owner: p.id, x: p.x, y: p.y,
            vx: Math.cos(p.angle) * (isSuper ? 30 : 45), vy: Math.sin(p.angle) * (isSuper ? 30 : 45),
            dmg: (50 + p.level*6) * (isSuper ? 3 : 1), size: isSuper ? 80 : size, isSuper, life: 90,
            color: color
        });
    });

    socket.on("vanish", () => {
        const p = players[socket.id];
        if(input.cx !== undefined && input.cy !== undefined){
            const dx = input.cx - p.x;
            const dy = input.cy - p.y;
            const dist = Math.hypot(dx, dy);
            if(dist < MAX_CLIENT_SPEED * 3){ // allow small prediction drift
                p.x = input.cx;
                p.y = input.cy;
            }
        }

        if(!p || p.isSpirit || p.ki < 20 || p.stun > 0) return;
        p.ki -= 20; p.x += Math.cos(p.angle)*350; p.y += Math.sin(p.angle)*350;
        io.emit("fx", { type: "vanish", x: p.x, y: p.y });
    });

    socket.on("transform", () => {
        const p = players[socket.id];
        if(input.cx !== undefined && input.cy !== undefined){
            const dx = input.cx - p.x;
            const dy = input.cy - p.y;
            const dist = Math.hypot(dx, dy);
            if(dist < MAX_CLIENT_SPEED * 3){ // allow small prediction drift
                p.x = input.cx;
                p.y = input.cy;
            }
        }

        if(!p || p.isSpirit) return;
        
        let nextForm = "BASE";
        if(p.form === "BASE" && p.level >= 5) nextForm = "SSJ";
        else if(p.form === "SSJ" && p.level >= 20) nextForm = "SSJ2";
        else if(p.form === "SSJ2" && p.level >= 40) nextForm = "SSJ3";
        else if(p.form === "SSJ3" && p.level >= 60) nextForm = "GOD";
        else if(p.form === "GOD" && p.level >= 80) nextForm = "BLUE";
        else if(p.form === "BLUE" && p.level >= 100) nextForm = "UI";
        else if(p.form !== "BASE") nextForm = "BASE"; 

        if(nextForm !== p.form && p.ki >= 50) {
            p.form = nextForm; p.ki -= 50;
            io.emit("fx", { type: "transform", x: p.x, y: p.y, form: nextForm });
            
            [...Object.values(players), ...npcs].forEach(t => {
                if(t.id === p.id) return;
                const d = Math.hypot(t.x - p.x, t.y - p.y);
                if(d < 300) {
                    const ang = Math.atan2(t.y - p.y, t.x - p.x);
                    t.vx = Math.cos(ang) * 60; t.vy = Math.sin(ang) * 60; t.stun = 15;
                    t.hp -= p.level * 2;
                    io.emit("fx", { type: "hit", x: t.x, y: t.y, dmg: p.level*2 });
                }
            });
        }
    });

    socket.on("disconnect", () => delete players[socket.id]);
});

function handleKill(killer, victim) {
    if(victim.isNPC) {
        victim.isDead = true;
        if(!killer.isNPC) {
            killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2));
            const xpGain = victim.level * 50;
            const xpReq = killer.level * 800;
            
            killer.xp += xpGain;
            io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain });

            if(killer.xp >= xpReq) {
                killer.level++; killer.xp = 0; 
                killer.bp += 5000; 
                killer.maxHp += 1000; killer.hp = killer.maxHp;
                killer.maxKi += 100; killer.ki = killer.maxKi;
                killer.xpToNext = killer.level * 800; // Atualiza meta

                io.emit("fx", { type: "levelup", x: killer.x, y: killer.y });
                
                const user = db.get('users').find({ name: killer.name }).value();
                if(user) { user.level = killer.level; user.bp = killer.bp; db.write(); }
            }
        }
        setTimeout(() => { 
            npcs = npcs.filter(n => n.id !== victim.id); 
            if(Math.random() > 0.5) spawnMobRandomly(); 
        }, 5000);
} else {
        // CORREÇÃO: Posiciona a alma no início do Snake Way e anula a inércia do golpe
        victim.isSpirit = true;
        victim.hp = 1; 
        victim.x = 0;      // Alinha com o centro do Snake Way
        victim.y = -2100;  // Posiciona logo abaixo do início da serpente no Outro Mundo
        victim.vx = 0;     // Para o movimento horizontal imediatamente
        victim.vy = 0;     // Para o movimento vertical imediatamente
        
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
    }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    
    Object.values(players).forEach(p => {
        if(p.stun > 0) p.stun--;
        p.x += p.vx; p.y += p.vy; 
        p.vx *= 0.85; p.vy *= 0.85;

        if(p.y < -5000) p.vy += 0.05;

        // REGEN E TREINO (CARREGAR KI = TREINO)
        if(!p.isSpirit) {
            if(p.state === "CHARGING") {
                // Treino: Ganha um pouquinho de XP e BP enquanto carrega
                if(Math.random() > 0.85) { 
                    p.xp += 1; 
                    p.bp += 1;
                    if(Math.random() > 0.8) io.emit("fx", { type: "xp_gain", x: p.x, y: p.y, amount: 1, silent: true });
                }
                // Level UP por treino
                const xpReq = p.level * 800;
                if(p.xp >= xpReq) {
                   p.level++; p.xp = 0; p.bp += 5000; p.maxHp += 1000; p.hp = p.maxHp; p.xpToNext = p.level*800;
                   io.emit("fx", { type: "levelup", x: p.x, y: p.y });
                   const user = db.get('users').find({ name: p.name }).value();
                   if(user) { user.level = p.level; user.bp = p.bp; db.write(); }
                }
            } else if(p.ki < p.maxKi && p.state === "IDLE") {
                p.ki += 0.5;
            }
        }
	
	// --- LÓGICA DE RENASCIMENTO NO PLANETA KAIO ---
    if (p.isSpirit && p.y < -7500) { // Se o espírito chegar ao topo do Planeta Kaio
        const distToCenter = Math.hypot(p.x - 0, p.y - (-8000));
        if (distToCenter < 100) { // Se tocar o centro do Planeta
            p.isSpirit = false;
            p.hp = p.maxHp;
            p.ki = p.maxKi;
            p.x = 0;  // Teleporta de volta para o centro da Terra
            p.y = 0;
            p.vx = 0;
            p.vy = 0;
            io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); // Efeito visual de retorno
        }
    }
});

    npcs.forEach(n => {
        if(n.isDead) return;
        if(n.stun > 0) { n.stun--; n.x += n.vx; n.y += n.vy; n.vx *= 0.9; n.vy *= 0.9; return; }
        
        let target = null, minDist = n.aggro || 700;
        Object.values(players).forEach(p => {
            if(!p.isSpirit) { 
                const d = Math.hypot(n.x-p.x, n.y-p.y); 
                if(d < minDist) { minDist=d; target=p; } 
            }
        });

        if(target) {
            const dx = target.x - n.x; const dy = target.y - n.y;
            const ang = Math.atan2(dy, dx); n.angle = ang;
            const dist = Math.hypot(dx, dy);

            if(dist > (n.isBoss ? 150 : 60)) { 
                n.vx += Math.cos(ang)*3.5; n.vy += Math.sin(ang)*3.5; n.state = "MOVING";
            } else if(Date.now() - n.lastAtk > 1000) {
                n.lastAtk = Date.now(); n.state = "ATTACKING";
                let dmg = n.level * 10;
                if(target.state === "BLOCKING") { dmg *= 0.2; target.ki -= 10; }
                target.hp -= dmg; target.stun = 10;
                target.vx += Math.cos(ang)*40; target.vy += Math.sin(ang)*40;
                io.emit("fx", { type: "hit", x: target.x, y: target.y, dmg: dmg }); 
                if(target.hp <= 0) handleKill(n, target);
            }
        } else { n.state = "IDLE"; }
        n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85;
    });

    projectiles.forEach((pr, i) => {
        pr.x += pr.vx; pr.y += pr.vy; pr.life--;
        let hit = false;
        [...Object.values(players), ...npcs].forEach(t => { 
            if(!hit && t.id !== pr.owner && !t.isSpirit && !t.isDead && Math.hypot(pr.x-t.x, pr.y-t.y) < 30+pr.size) { 
                t.hp -= pr.dmg; t.stun = 8; hit = true; 
                io.emit("fx", { type: pr.isSuper?"heavy":"hit", x: pr.x, y: pr.y, dmg: Math.floor(pr.dmg) }); 
                const owner = players[pr.owner] || npcs.find(n => n.id === pr.owner) || {};
                if(t.hp<=0) handleKill(owner, t); 
            } 
        });
        if(hit || pr.life <= 0) projectiles.splice(i, 1);
    });

    io.emit("state", { players, npcs, projectiles, rocks, craters });
}, TICK);

server.listen(3000, () => console.log("Dragon Bolt OMNI ONLINE"));