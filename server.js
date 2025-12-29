const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require('pg'); // Cliente PostgreSQL
const isRender = !!process.env.DATABASE_URL;


// ==================================================================================
// CONFIGURAÇÃO DO BANCO DE DADOS (POSTGRESQL NO RENDER)
// ==================================================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    pass VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    bp INTEGER DEFAULT 500
  );
`).catch(err => console.error("Erro ao criar tabela:", err));

const TICK = 24; 
const players = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];

// ==================================================================================
// ESTATÍSTICAS RPG E BESTIÁRIO EXPANDIDO (OBRA PRIMA)
// ==================================================================================
const FORM_STATS = {
    "BASE": { spd: 5,  dmg: 1.0, hpMult: 1.0, kiMult: 1.0 },
    "SSJ":  { spd: 7,  dmg: 1.5, hpMult: 1.5, kiMult: 1.2 },
    "SSJ2": { spd: 8,  dmg: 1.8, hpMult: 1.8, kiMult: 1.4 },
    "SSJ3": { spd: 9,  dmg: 2.2, hpMult: 2.2, kiMult: 1.5 },
    "GOD":  { spd: 11, dmg: 3.0, hpMult: 3.0, kiMult: 2.0 },
    "BLUE": { spd: 13, dmg: 4.5, hpMult: 4.0, kiMult: 3.0 },
    "UI":   { spd: 16, dmg: 6.0, hpMult: 5.0, kiMult: 5.0 }
};

const BP_TRAIN_CAP = {
    BASE:  1200, SSJ: 2500, SSJ2: 5000, SSJ3: 9000,
    GOD: 16000, BLUE: 28000, UI: 45000
};

const BESTIARY = {
    // CENTRO: TERRA (Clássico + Z Início)
    EARTH: { 
        mobs: ["RR_SOLDIER", "WOLF_BANDIT", "DINOSAUR", "SAIBAMAN", "RADITZ_MINION"], 
        bosses: ["TAO_PAI_PAI", "KING_PICCOLO", "RADITZ", "NAPPA", "VEGETA_SCOUTER"] 
    },
    // OESTE: ESPAÇO (Namek, Yardrat, Planeta Vegeta)
    DEEP_SPACE: { 
        mobs: ["FRIEZA_SOLDIER", "ZARBON_MONSTER", "DODORIA_ELITE", "NAMEK_WARRIOR", "GINYU_FORCE_MEMBER"], 
        bosses: ["CAPTAIN_GINYU", "FRIEZA_FINAL", "COOLER_METAL", "LEGENDARY_BROLY"] 
    },
    // LESTE: FUTURO/TECH (Androids, Cell, Black)
    FUTURE_TIMELINE: { 
        mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR", "MACHINE_MUTANT", "ZAMASU_CLONE"], 
        bosses: ["ANDROID_18", "PERFECT_CELL", "GOKU_BLACK_ROSE", "SUPER_17", "OMEGA_SHENRON"] 
    },
    // SUL: REINO DEMONÍACO (Buu, Janemba, Daima)
    DEMON_REALM: { 
        mobs: ["PUIPUI", "YAKON", "DABURA_MINION", "JANEMBA_MINI", "GOMAH_SOLDIER"], 
        bosses: ["DABURA", "FAT_BUU", "KID_BUU", "JANEMBA", "KING_GOMAH"] 
    },
    // NORTE: DOMÍNIO DIVINO (Super, Bills, Zeno)
    DIVINE_REALM: { 
        mobs: ["PRIDE_TROOPER", "U6_BOTAMO", "ANGEL_TRAINEE", "HAKAISHIN_GUARD"], 
        bosses: ["GOLDEN_FRIEZA", "HIT_ASSASSIN", "TOPPO_GOD", "JIREN_FULL_POWER", "BEERUS"] 
    }
};

function getMaxBP(p) {
    const form = p.form || "BASE";
    const formCap = BP_TRAIN_CAP[form] || BP_TRAIN_CAP.BASE;
    return p.level * formCap;
}

function clampBP(p) {
    const maxBP = getMaxBP(p);
    if (p.bp > maxBP) p.bp = maxBP;
    if (p.bp < 0) p.bp = 0;
}

function findSnapTarget(p) {
    let best = null; let bestScore = Infinity;
    [...Object.values(players), ...npcs].forEach(t => {
        if (t.id === p.id || t.isDead || t.isSpirit) return;
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > 320) return;
        const angToT = Math.atan2(t.y - p.y, t.x - p.x);
        let diff = Math.abs(angToT - p.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 2.3) { const score = d + diff * 250; if (score < bestScore) { bestScore = score; best = t; } }
    });
    return best;
}

function getZoneInfo(x, y) {
    const dist = Math.hypot(x, y);
    let level = 1 + Math.floor(dist / 2000); 
    if (dist < 6000) return { id: "EARTH", level: Math.max(1, level) };
    const angle = Math.atan2(y, x);
    if (Math.abs(angle) > 2.35) return { id: "DEEP_SPACE", level };
    if (Math.abs(angle) < 0.78) return { id: "FUTURE_TIMELINE", level };
    if (angle >= 0.78 && angle <= 2.35) return { id: "DEMON_REALM", level };
    return { id: "DIVINE_REALM", level };
}

function initWorld() {
    // Rochas e Decoração
    for(let i=0; i<1500; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 70000;
        const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist;
        const zone = getZoneInfo(x, y);
        let type = "rock_earth";
        if(zone.id === "DEEP_SPACE") type = "rock_namek";
        if(zone.id === "FUTURE_TIMELINE") type = "rock_city";
        if(zone.id === "DEMON_REALM") type = "rock_magic";
        if(zone.id === "DIVINE_REALM") type = "rock_god";
        rocks.push({ id: i, x, y, r: 30 + Math.random() * 80, hp: 200 + (dist/100), type });
    }

    // Mobs Aleatórios
    for(let i=0; i<500; i++) spawnMobRandomly();

    // === PONTOS DE INTERESSE (PLANETAS E BOSSES) ===
    // Terra (Centro)
    spawnBossAt(2000, 2000, "VEGETA_SCOUTER");

    // Oeste: Espaço (Namek & Planeta Vegeta Antigo)
    spawnBossAt(-15000, 2000, "FRIEZA_FINAL"); // Namek
    spawnBossAt(-25000, -5000, "LEGENDARY_BROLY"); // Vampa/Vegeta
    spawnBossAt(-40000, 0, "MORO_YOUNG"); // Espaço Profundo

    // Leste: Futuro (Ruínas e GT)
    spawnBossAt(15000, 0, "PERFECT_CELL"); 
    spawnBossAt(25000, 5000, "GOKU_BLACK_ROSE");
    spawnBossAt(40000, 0, "OMEGA_SHENRON");

    // Sul: Reino Demoníaco (Magia e Buu)
    spawnBossAt(0, 15000, "FAT_BUU");
    spawnBossAt(5000, 25000, "JANEMBA");
    spawnBossAt(0, 40000, "KING_GOMAH"); // Daima

    // Norte: Divino (Kaioh, Bills, Zeno)
    // Kaioh fica em 0, -20000 (Local Seguro)
    spawnBossAt(0, -30000, "BEERUS");
    spawnBossAt(10000, -35000, "JIREN_FULL_POWER");
    spawnBossAt(0, -50000, "WHIS"); // Treino Final
}

function spawnMobRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2000 + Math.random() * 60000; 
    const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist;
    spawnMobAt(x, y);
}

function spawnMobAt(x, y) {
    const zone = getZoneInfo(x, y);
    const list = BESTIARY[zone.id].mobs;
    const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);
    
    let stats = { name: type, hp: 600 * zone.level, bp: 1200 * zone.level, level: zone.level, color: "#fff", aggro: 700 + (zone.level * 10), aiType: "MELEE" };
    
    if(type.includes("RR_")) stats.color = "#555";
    if(type.includes("FRIEZA")) stats.color = "#848";
    if(type.includes("MAJIN") || type.includes("DEMON")) stats.color = "#909";
    if(type.includes("PRIDE") || type.includes("ANGEL")) stats.color = "#aaf";
    if(type.includes("CELL") || type.includes("SAIBAMAN")) stats.color = "#484";
    
    npcs.push({ id, isNPC: true, r: 25, x, y, vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200, level: stats.level, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType });
}

function spawnBossAt(x, y, forcedType = null) {
    const zone = getZoneInfo(x, y);
    let type = forcedType;
    if (!type) {
        const bosses = BESTIARY[zone.id].bosses;
        type = bosses[Math.floor(Math.random() * bosses.length)];
    }
    
    let stats = { name: type, hp: 20000 * zone.level, bp: 80000 * zone.level, color: "#f00", r: 60 };
    
    if(type.includes("VEGETA")) stats.color = "#33f";
    if(type.includes("FRIEZA")) stats.color = "#fff"; 
    if(type.includes("CELL")) stats.color = "#484";
    if(type.includes("BUU")) stats.color = "#fbb";
    if(type.includes("BLACK") || type.includes("ROSE")) stats.color = "#333";
    if(type.includes("JIREN") || type.includes("TOPPO")) stats.color = "#f22";
    
    npcs.push({ id: "BOSS_" + type + "_" + Date.now(), name: type, isNPC: true, isBoss: true, x, y, vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 10000, maxKi: 10000, level: zone.level + 15, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0 });
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

function packStateForPlayer(pid) {
    const p = players[pid];
    if (!p) return null;
    const R = 4500; 
    const inRange = (o) => Math.hypot(o.x - p.x, o.y - p.y) < R;
    const playersInRange = Object.values(players).filter(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < 15000); 
    const playersObj = {};
    playersInRange.forEach(pl => playersObj[pl.id] = pl);

    return { players: playersObj, npcs: npcs.filter(inRange), projectiles: projectiles.filter(inRange), rocks: rocks.filter(inRange), craters };
}
const localUsers = {};
io.on("connection", (socket) => {
    socket.on("login", async (data) => {
    try {
        let user;

        if (isRender) {
            // ===== POSTGRES (RENDER) =====
            const res = await pool.query(
                'SELECT * FROM users WHERE name = $1',
                [data.user]
            );

            user = res.rows[0];

            if (!user) {
                const insert = await pool.query(
                    'INSERT INTO users (name, pass, level, xp, bp) VALUES ($1,$2,$3,$4,$5) RETURNING *',
                    [data.user, data.pass, 1, 0, 500]
                );
                user = insert.rows[0];
            } else if (user.pass !== data.pass) {
                return;
            }

        } else {
            // ===== LOCAL (SEM BANCO) =====
            user = localUsers[data.user];

            if (!user) {
                user = {
                    name: data.user,
                    pass: data.pass,
                    level: 1,
                    xp: 0,
                    bp: 500
                };
                localUsers[data.user] = user;
            } else if (user.pass !== data.pass) {
                return;
            }
        }

        const xpToNext = user.level * 800;

        players[socket.id] = {
            ...user,
            id: socket.id,
            r: 20,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            angle: 0,
            baseMaxHp: 1000 + user.level * 200,
            baseMaxKi: 100 + user.level * 10,
            hp: 1000 + user.level * 200,
            maxHp: 1000 + user.level * 200,
            ki: 100,
            maxKi: 100 + user.level * 10,
            form: "BASE",
            xpToNext,
            state: "IDLE",
            combo: 0,
            comboTimer: 0,
            attackLock: 0,
            counterWindow: 0,
            lastAtk: 0,
            isDead: false,
            isSpirit: false,
            stun: 0,
            color: "#ff9900",
            chargeStart: 0,
            pvpMode: false,
            lastTransform: 0,
            bpCapped: false
        };

        socket.emit("auth_success", players[socket.id]);

    } catch (err) {
        console.error("Erro no Login:", err);
    }
});


    socket.on("toggle_pvp", () => { const p = players[socket.id]; if(p) p.pvpMode = !p.pvpMode; });

    socket.on("input", (input) => {
        const p = players[socket.id];
        if(!p || p.stun > 0 || p.isDead) return; 
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"];
        let speed = formStats.spd;
        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        if(input.x || input.y) { p.vx += input.x * speed * moveMod; p.vy += input.y * speed * moveMod; if(!["ATTACKING"].includes(p.state)) p.state = "MOVING"; }
        if (p.attackLock <= 0) p.angle = input.angle;
        if(input.block) { if(p.ki > 0) { p.state = "BLOCKING"; p.ki -= 0.5; } else { p.state = "IDLE"; } }
        else if(input.charge) { p.state = "CHARGING"; p.ki = Math.min(p.maxKi, p.ki + (p.level * 0.8)); } 
        else if(input.holdAtk) { if(p.state !== "CHARGING_ATK") p.chargeStart = Date.now(); p.state = "CHARGING_ATK"; } 
        else if(!["ATTACKING"].includes(p.state)) p.state = "IDLE";
    });

    socket.on("release_attack", () => {
        const p = players[socket.id];
        if(!p || p.isSpirit || p.stun > 0) return;
        let target = findSnapTarget(p);
        if (!target) {
            let best = null, bestDist = 220;
            [...Object.values(players), ...npcs].forEach(t => { 
                if(t.id === p.id || t.isDead || t.isSpirit) return; 
                if(!t.isNPC && !p.pvpMode) return; 
                const d = Math.hypot(t.x - p.x, t.y - p.y); 
                if(d < bestDist) { bestDist = d; best = t; } 
            });
            target = best;
        }
        if (target) {
            const dx = target.x - p.x; const dy = target.y - p.y;
            p.angle = Math.atan2(dy, dx);
            const dist = Math.hypot(dx, dy);
            if (dist > 55) { const pull = Math.min(80, dist - 55); p.vx = Math.cos(p.angle) * pull; p.vy = Math.sin(p.angle) * pull; }
        }
        const charged = (Date.now() - p.chargeStart) > 600;
        p.state = "ATTACKING"; p.attackLock = 14; p.lastAtk = Date.now();
        const hitRadius = charged ? 130 : 100;
        let hitSomeone = false;
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"];
        const damageMult = formStats.dmg;

        [...Object.values(players), ...npcs].forEach(t => {
            if(t.id === p.id || t.isDead || t.isSpirit) return;
            // REGRA PVP: Só acerta jogador se PVP estiver ON
            if(!t.isNPC && !p.pvpMode) return;

            const dx = t.x - p.x; const dy = t.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist > hitRadius) return;
            const ang = Math.atan2(dy, dx);
            let diff = Math.abs(ang - p.angle); if(diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff > 2.6) return;
            hitSomeone = true;
            let baseDmg = (50 + p.level * 9);
            let dmg = Math.floor(baseDmg * damageMult * (charged ? 3.2 : (1 + p.combo * 0.3)));
            
            if (!t.isNPC) dmg *= 0.5;
            if(t.state === "BLOCKING") { dmg *= 0.25; t.ki -= 12; t.counterWindow = 12; }
            t.hp -= dmg; t.stun = charged ? 26 : 14;
            const push = charged ? 140 : 65;
            t.vx = Math.cos(p.angle) * push; t.vy = Math.sin(p.angle) * push;
            io.emit("fx", { type: charged ? "heavy" : "hit", x: t.x, y: t.y, dmg });
            if(charged) craters.push({ x: t.x, y: t.y, r: 45, life: 1200 });
            if(t.hp <= 0) handleKill(p, t);
        });
        if (!hitSomeone) p.combo = Math.max(0, p.combo - 1);
        else { p.combo = (p.combo + 1) % 6; p.comboTimer = 24; }
        setTimeout(() => { if(p) p.state = "IDLE"; }, 220);
    });

    socket.on("release_blast", () => {
        const p = players[socket.id];
        if(!p || p.isSpirit || p.ki < 10) return;
        const isSuper = (Date.now() - p.chargeStart) > 800;
        const cost = isSuper ? 40 : 10;
        if(p.ki < cost) return;
        p.ki -= cost;
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"];
        const damageMult = formStats.dmg;
        let color = "#0cf"; if(p.form === "SSJ") color = "#ff0"; if(p.form === "GOD") color = "#f00";
        projectiles.push({ 
            id: Math.random(), owner: p.id, x: p.x, y: p.y, 
            vx: Math.cos(p.angle) * (isSuper ? 30 : 45), vy: Math.sin(p.angle) * (isSuper ? 30 : 45), 
            dmg: (50 + p.level*6) * damageMult * (isSuper ? 3 : 1), 
            size: isSuper ? 80 : 12, isSuper, life: 90, color, pvp: p.pvpMode 
        });
    });

    socket.on("vanish", () => {
        const p = players[socket.id];
        if(!p || p.isSpirit || p.ki < 20 || p.stun > 0) return;
        p.ki -= 20; p.x += Math.cos(p.angle)*350; p.y += Math.sin(p.angle)*350;
        io.emit("fx", { type: "vanish", x: p.x, y: p.y });
    });

    socket.on("transform", () => {
        const p = players[socket.id];
        if(!p || p.isSpirit) return;
        if(p.lastTransform && Date.now() - p.lastTransform < 10000) return;

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
            p.lastTransform = Date.now();
            const stats = FORM_STATS[nextForm];
            p.maxHp = p.baseMaxHp * stats.hpMult;
            p.maxKi = p.baseMaxKi * stats.kiMult;
            // REMOVIDO CURA AO TRANSFORMAR PARA EVITAR EXPLOIT
            // p.hp += p.maxHp * 0.1; 

            const knockbackRadius = 350; const pushForce = 150;
            [...Object.values(players), ...npcs].forEach(t => {
                if (t.id === p.id || t.isDead || t.isSpirit) return;
                const dist = Math.hypot(t.x - p.x, t.y - p.y);
                if (dist < knockbackRadius) {
                    const ang = Math.atan2(t.y - p.y, t.x - p.x);
                    t.vx = Math.cos(ang) * pushForce; t.vy = Math.sin(ang) * pushForce; t.stun = 15; 
                }
            });
            io.emit("fx", { type: "transform", x: p.x, y: p.y, form: nextForm });
            clampBP(p);
        }
    });

    socket.on("disconnect", () => delete players[socket.id]);
});

function handleKill(killer, victim) {
    if(victim.isNPC) {
        victim.isDead = true;
        if(!killer.isNPC) {
            killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2));
            const xpGain = victim.level * 100; const xpReq = killer.level * 800;
            killer.xp += xpGain;
            io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain });
            if(killer.xp >= xpReq) {
                killer.level++; killer.xp = 0; killer.bp += 5000; 
                clampBP(killer); 
                killer.baseMaxHp += 1000; killer.baseMaxKi += 100;
                const stats = FORM_STATS[killer.form] || FORM_STATS["BASE"];
                killer.maxHp = killer.baseMaxHp * stats.hpMult; killer.maxKi = killer.baseMaxKi * stats.kiMult;
                killer.hp = killer.maxHp; killer.ki = killer.maxKi; killer.xpToNext = killer.level * 800; 
                io.emit("fx", { type: "levelup", x: killer.x, y: killer.y });
                pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [killer.level, killer.xp, killer.bp, killer.name]).catch(e => console.error(e));
            }
        }
        setTimeout(() => { npcs = npcs.filter(n => n.id !== victim.id); spawnMobRandomly(); }, 5000);
    } else {
        victim.isSpirit = true; victim.hp = 1; victim.ki = victim.maxKi; victim.x = 0; victim.y = -6000; victim.vx = 0; victim.vy = 0;
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
        if(!killer.isNPC) io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: 50 });
    }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });

    Object.values(players).forEach(p => {
        if(p.stun > 0) p.stun--;
        if(p.attackLock > 0) p.attackLock--;
        if(p.comboTimer > 0) p.comboTimer--;
        if(p.counterWindow > 0) p.counterWindow--;
        p.x += p.vx; p.y += p.vy; p.vx *= 0.82; p.vy *= 0.82; 
        
        if (!p.isDead && !p.isSpirit) {
            p.bp += 1 + Math.floor(p.level * 0.1);
            clampBP(p);

            if (p.state === "CHARGING") {
                if (Math.random() > 0.85) { p.xp += 1; p.bp += 5; clampBP(p); }
                const xpReq = p.level * 800;
                if(p.xp >= xpReq) {
                   p.level++; p.xp = 0; p.bp += 5000; clampBP(p);
                   p.baseMaxHp += 1000; p.baseMaxKi += 100;
                   const stats = FORM_STATS[p.form] || FORM_STATS["BASE"];
                   p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult;
                   p.hp = p.maxHp; p.ki = p.maxKi; p.xpToNext = p.level * 800;
                   io.emit("fx", { type: "levelup", x: p.x, y: p.y });
                   pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [p.level, p.xp, p.bp, p.name]).catch(e => console.error(e));
                }
            } else if(p.ki < p.maxKi && p.state === "IDLE") { p.ki += 0.5; }

            // LÓGICA DE CURA NO PLANETA KAIOH (Se estiver vivo, voe lá para curar)
            // Localização Sr. Kaioh: 0, -20000
            const distToKingKai = Math.hypot(p.x - 0, p.y + 20000); 
            if (distToKingKai < 1500) {
                // Regeneração rápida
                p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.05));
                p.ki = Math.min(p.maxKi, p.ki + (p.maxKi * 0.05));
            }
        }
        
        if (p.bp >= getMaxBP(p)) {
            if (!p.bpCapped) { p.bpCapped = true; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "BP NO LIMITE" }); }
        } else { p.bpCapped = false; }

        if (p.isSpirit) {
            const distToKingKai = Math.hypot(p.x - 0, p.y + 20000); 
            if (distToKingKai < 1000) {
                p.hp = Math.min(p.maxHp, p.hp + 20); p.ki = Math.min(p.maxKi, p.ki + 5);
                if (distToKingKai < 300) {
                    p.isSpirit = false; p.hp = p.maxHp; p.ki = p.maxKi; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
                    io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); 
                    io.emit("fx", { type: "levelup", x: 0, y: 0 });
                }
            }
        }
    });

    npcs.forEach(n => {
        if(n.isDead) return;
        if(n.stun > 0) { n.stun--; n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85; return; }
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
            if(dist > (n.isBoss ? 150 : 60)) { n.vx += Math.cos(ang)*3.5; n.vy += Math.sin(ang)*3.5; n.state = "MOVING"; } 
            else if(Date.now() - n.lastAtk > 1000) {
                n.lastAtk = Date.now(); n.state = "ATTACKING";
                let dmg = n.level * 10;
                if(target.state === "BLOCKING") { dmg *= 0.2; target.ki -= 10; target.counterWindow = 10; }
                target.hp -= dmg; target.stun = 10;
                target.vx = Math.cos(ang)*40; target.vy = Math.sin(ang)*40;
                io.emit("fx", { type: "hit", x: target.x, y: target.y, dmg }); 
                if(target.hp <= 0) handleKill(n, target);
            }
        } else { n.state = "IDLE"; }
        n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85;
    });

    projectiles.forEach((pr, i) => {
        pr.x += pr.vx; pr.y += pr.vy; pr.life--;
        let hit = false;
        [...Object.values(players), ...npcs].forEach(t => {
            if (!hit && t.id !== pr.owner && !t.isSpirit && !t.isDead) {
                const dist = Math.hypot(pr.x - t.x, pr.y - t.y);
                if (dist < (45 + pr.size)) { // Hitbox corrigida
                    if(!t.isNPC && !pr.pvp) return;
                    let dmg = pr.dmg;
                    if (!t.isNPC) dmg *= 0.5;
                    t.hp -= dmg; t.stun = 8; hit = true;
                    io.emit("fx", { type: pr.isSuper ? "heavy" : "hit", x: pr.x, y: pr.y, dmg: Math.floor(dmg) });
                    const owner = players[pr.owner] || npcs.find(n => n.id === pr.owner) || {};
                    if (t.hp <= 0) handleKill(owner, t);
                }
            }
        });
        if (hit || pr.life <= 0) projectiles.splice(i, 1);
    });

    Object.keys(players).forEach(id => {
        const st = packStateForPlayer(id);
        if(st) io.to(id).emit("state", st);
    });

}, TICK);

server.listen(3000, () => console.log("Dragon Bolt Universe Online"));
// ============================================================================
// PATCH FINAL — ESFERAS DO DRAGÃO + PvP FORÇADO (SAFE)
// ============================================================================

global.DRAGON_BALLS = global.DRAGON_BALLS || Array.from({ length: 7 }).map((_, i) => ({
    id: i + 1,
    x: (Math.random() * 60000) - 30000,
    y: (Math.random() * 60000) - 30000,
    holder: null
}));

function playerHasDragonBall(player){
    return global.DRAGON_BALLS.some(b => b.holder === player.id);
}

function dropDragonBalls(player){
    global.DRAGON_BALLS.forEach(b => {
        if (b.holder === player.id) {
            b.holder = null;
            b.x = player.x;
            b.y = player.y;
        }
    });
}
