const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require('pg'); 
const isRender = !!process.env.DATABASE_URL;

// COORDENADAS DO OUTRO MUNDO
const SNAKE_WAY_START = { x: 0, y: -12000 };
const KAIOH_PLANET    = { x: 0, y: -25000 };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BOSS_PHASES = {
    PHASE_1: { hp: 0.65, aggression: 0.6 },
    PHASE_2: { hp: 0.35, aggression: 0.8 },
    PHASE_3: { hp: 0.0,  aggression: 1.0 }
};

// ==========================================
// ESTRUTURA GALÁCTICA EXPANDIDA (7 BIOMAS)
// ==========================================
let PLANETS = [
    // BIOMA 1: TERRA (Central)
    { id: "EARTH_CORE", name: "Capital do Oeste", x: 2000, y: 2000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 1, biome: "EARTH" },
    { id: "KAME_ISLAND", name: "Casa do Kame", x: 6000, y: -4000, radius: 800, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 5, biome: "EARTH" },

    // BIOMA 2: NAMEK (Verde/Azul)
    { id: "NAMEK_VILLAGE", name: "Nova Namek", x: -18000, y: 5000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 20, biome: "NAMEK" },
    { id: "GURU_HOUSE", name: "Casa do Grande Patriarca", x: -22000, y: 8000, radius: 900, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 25, biome: "NAMEK" },

    // BIOMA 3: ESPAÇO FREEZA (Roxo/Tecnológico)
    { id: "FRIEZA_BASE", name: "Planeta Freeza 79", x: -35000, y: -10000, radius: 1500, owner: null, guild: null, stability: 100, taxRate: 10, treasury: 0, level: 40, biome: "FRIEZA" },
    
    // BIOMA 4: FUTURO APOCALÍPTICO (Cinza/Destruído)
    { id: "FUTURE_RUINS", name: "Ruínas do Futuro", x: 15000, y: 0, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 50, biome: "FUTURE" },
    
    // BIOMA 5: REINO DEMONÍACO (Vermelho Escuro)
    { id: "DEMON_GATE", name: "Portão Demoníaco", x: 0, y: 25000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 60, biome: "DEMON" },
    { id: "MAKAI_CORE", name: "Núcleo Makai", x: 5000, y: 35000, radius: 1000, owner: null, guild: null, stability: 100, taxRate: 8, treasury: 0, level: 70, biome: "DEMON" },

    // BIOMA 6: PLANETA VAMPA (Amarelo/Árido)
    { id: "VAMPA_WASTES", name: "Deserto de Vampa", x: -45000, y: 15000, radius: 1400, owner: null, guild: null, stability: 100, taxRate: 2, treasury: 0, level: 80, biome: "VAMPA" },

    // BIOMA 7: REINO DIVINO (Dourado/Místico)
    { id: "BEERUS_PLANET", name: "Planeta de Beerus", x: 0, y: -90000, radius: 2000, owner: null, guild: null, stability: 100, taxRate: 15, treasury: 0, level: 100, biome: "DIVINE" },
    { id: "ZEN_PALACE", name: "Palácio Zen-Oh", x: 0, y: -120000, radius: 3000, owner: null, guild: null, stability: 100, taxRate: 20, treasury: 0, level: 150, biome: "DIVINE" }
];

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                pass VARCHAR(255) NOT NULL,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                bp INTEGER DEFAULT 500,
                guild VARCHAR(50) DEFAULT NULL,
                titles TEXT DEFAULT 'Novato',
                current_title VARCHAR(50) DEFAULT 'Novato',
                achievements TEXT DEFAULT '',
                pvp_score INTEGER DEFAULT 0,
                pvp_kills INTEGER DEFAULT 0
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS planets (
                id VARCHAR(50) PRIMARY KEY,
                owner VARCHAR(255),
                guild VARCHAR(50),
                stability INTEGER,
                tax_rate INTEGER,
                treasury INTEGER
            );
        `);
        
        if (isRender) {
            const res = await pool.query("SELECT * FROM planets");
            res.rows.forEach(row => {
                const p = PLANETS.find(pl => pl.id === row.id);
                if(p) {
                    p.owner = row.owner;
                    p.guild = row.guild;
                    p.stability = row.stability;
                    p.taxRate = row.tax_rate;
                    p.treasury = row.treasury;
                }
            });
        }
        console.log("Galáxia Sincronizada: " + PLANETS.length + " planetas.");
    } catch (err) { console.error("Erro no DB Init:", err); }
};
initDB();

const TICK = 33; 
const players = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];
let chats = []; 

let globalEventTimer = 0;
let eventActive = false;
let eventMobIds = [];
let leaderboard = [];

const TITLES_DATA = {
    "WARRIOR": { req: "level", val: 10, name: "Guerreiro Z" },
    "ELITE": { req: "bp", val: 10000, name: "Elite Saiyajin" },
    "SLAYER": { req: "kills", val: 50, name: "Assassino" },
    "GOD": { req: "form", val: "GOD", name: "Divindade" },
    "CONQUEROR": { req: "domination", val: 1, name: "Imperador" }
};

const FORM_STATS = {
    "BASE": { spd: 5,  dmg: 1.0, hpMult: 1.0, kiMult: 1.0 },
    "SSJ":  { spd: 7,  dmg: 1.5, hpMult: 1.5, kiMult: 1.2 },
    "SSJ2": { spd: 8,  dmg: 1.8, hpMult: 1.8, kiMult: 1.4 },
    "SSJ3": { spd: 9,  dmg: 2.2, hpMult: 2.2, kiMult: 1.5 },
    "GOD":  { spd: 11, dmg: 3.0, hpMult: 3.0, kiMult: 2.0 },
    "BLUE": { spd: 13, dmg: 4.5, hpMult: 4.0, kiMult: 3.0 },
    "UI":   { spd: 16, dmg: 6.0, hpMult: 5.0, kiMult: 5.0 }
};

const FORM_ORDER = ["BASE", "SSJ", "SSJ2", "SSJ3", "GOD", "BLUE", "UI"];
const FORM_REQS = { "BASE": 0, "SSJ": 5, "SSJ2": 20, "SSJ3": 40, "GOD": 60, "BLUE": 80, "UI": 100 };
const BP_TRAIN_CAP = { BASE: 1200, SSJ: 2500, SSJ2: 5000, SSJ3: 9000, GOD: 16000, BLUE: 28000, UI: 45000 };

const BESTIARY = {
    EARTH: { mobs: ["RR_SOLDIER", "WOLF_BANDIT", "DINOSAUR", "SAIBAMAN", "RADITZ_MINION"], bosses: ["TAO_PAI_PAI", "KING_PICCOLO", "RADITZ", "NAPPA", "VEGETA_SCOUTER"] },
    NAMEK: { mobs: ["FRIEZA_SOLDIER", "NAMEK_WARRIOR", "ZARBON_MONSTER"], bosses: ["DODORIA", "ZARBON", "GINYU", "FRIEZA_FINAL"] },
    FRIEZA: { mobs: ["FRIEZA_ELITE", "ROBOT_GUARD", "ALIEN_MERCENARY"], bosses: ["COOLER", "METAL_COOLER", "KING_COLD"] },
    FUTURE: { mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR"], bosses: ["ANDROID_17", "ANDROID_18", "PERFECT_CELL", "GOKU_BLACK_ROSE"] },
    DEMON: { mobs: ["PUIPUI", "YAKON", "DABURA_MINION"], bosses: ["DABURA", "FAT_BUU", "KID_BUU", "JANEMBA"] },
    VAMPA: { mobs: ["GIANT_SPIDER", "VAMPA_BEAST"], bosses: ["PARAGUS", "BROLY_WRATH", "LEGENDARY_BROLY"] },
    DIVINE: { mobs: ["PRIDE_TROOPER", "ANGEL_TRAINEE"], bosses: ["TOPPO_GOD", "JIREN", "JIREN_FULL_POWER", "BEERUS", "WHIS"] }
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
    checkAchievements(p);
}

function findSnapTarget(p) {
    let best = null; let bestScore = Infinity;
    const searchRadius = 450; 
    [...Object.values(players), ...npcs].forEach(t => {
        if (t.id === p.id || t.isDead || t.isSpirit) return;
        if (Math.abs(t.x - p.x) > searchRadius || Math.abs(t.y - p.y) > searchRadius) return;
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > searchRadius) return;
        const angToT = Math.atan2(t.y - p.y, t.x - p.x);
        let diff = Math.abs(angToT - p.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 2.5) { const score = d + diff * 100; if (score < bestScore) { bestScore = score; best = t; } }
    });
    return best;
}

function getZoneInfo(x, y) {
    // FUNÇÃO DE BIOMAS EXPANDIDA
    if (y < -80000) return { id: "DIVINE", level: 100 }; // Reino Divino
    if (x < -40000) return { id: "VAMPA", level: 80 };   // Vampa
    if (x < -10000 && y < 10000) {
        if (x < -30000) return { id: "FRIEZA", level: 40 }; // Império Freeza
        return { id: "NAMEK", level: 20 }; // Namekusei
    }
    if (x > 10000 && y > -5000 && y < 5000) return { id: "FUTURE", level: 50 }; // Futuro
    if (y > 20000) return { id: "DEMON", level: 60 }; // Reino Demoníaco
    
    // Terra (Centro)
    return { id: "EARTH", level: Math.max(1, Math.floor(Math.hypot(x,y)/2000)) };
}

function initWorld() {
    rocks = [];
    // GERAÇÃO PROCEDURAL DE BIOMAS
    for(let i=0; i<1500; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 80000;
        const x = Math.cos(angle) * dist; 
        const y = Math.sin(angle) * dist;
        const zone = getZoneInfo(x, y);
        
        let type = "rock_earth";
        if(zone.id === "NAMEK") type = "rock_namek";
        if(zone.id === "FRIEZA") type = "rock_metal";
        if(zone.id === "FUTURE") type = "rock_ruin";
        if(zone.id === "DEMON") type = "rock_magic";
        if(zone.id === "VAMPA") type = "rock_bone";
        if(zone.id === "DIVINE") type = "rock_god";

        // Densidade variável por bioma
        if (zone.id === "DIVINE" && Math.random() > 0.3) continue; // Menos pedras no reino divino

        rocks.push({ id: i, x: Math.round(x), y: Math.round(y), r: 30 + Math.random() * 80, hp: 300 + (dist/50), maxHp: 300 + (dist/50), type });
    }
    npcs = [];
    for(let i=0; i<600; i++) spawnMobRandomly();
    
    // SPAWN BOSSES NOS BIOMAS CORRETOS
    PLANETS.forEach(p => {
        // Spawna um boss guardião em cada planeta
        const list = BESTIARY[p.biome]?.bosses || BESTIARY.EARTH.bosses;
        const bossType = list[Math.floor(Math.random() * list.length)];
        spawnBossAt(p.x, p.y, bossType);
    });
    
    console.log(`Universo Gerado: ${rocks.length} objetos, ${npcs.length} entidades.`);
}

function spawnMobRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2000 + Math.random() * 70000; 
    const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist;
    spawnMobAt(x, y);
}

function spawnMobAt(x, y, aggressive = false) {
    const zone = getZoneInfo(x, y);
    const list = BESTIARY[zone.id]?.mobs || BESTIARY.EARTH.mobs;
    const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);
    
    let stats = { name: type, hp: 400 * zone.level, bp: 1200 * zone.level, level: zone.level, color: "#fff", aggro: aggressive ? 2000 : (700 + (zone.level * 10)), aiType: "MELEE" };
    
    // Cores por bioma
    if(zone.id === "NAMEK") stats.color = "#8f8";
    if(zone.id === "DEMON") stats.color = "#f0f";
    if(zone.id === "FRIEZA") stats.color = "#a0a";
    if(zone.id === "FUTURE") stats.color = "#888";
    if(zone.id === "VAMPA") stats.color = "#dd4";
    if(zone.id === "DIVINE") stats.color = "#0ff";

    const npc = { id, isNPC: true, r: 25, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200, level: stats.level, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType, aggro: stats.aggro, targetId: null };
    npcs.push(npc);
    return npc;
}

function spawnBossAt(x, y, forcedType = null) {
    const zone = getZoneInfo(x, y);
    let type = forcedType;
    if (!type) {
        const list = BESTIARY[zone.id]?.bosses || BESTIARY.EARTH.bosses;
        type = list[Math.floor(Math.random() * list.length)];
    }
    let stats = { name: type, hp: 30000 * zone.level, bp: 100000 * zone.level, color: "#f00", r: 70 };
    
    if(type.includes("VEGETA")) stats.color = "#33f";
    if(type.includes("FRIEZA")) stats.color = "#fff"; 
    if(type.includes("CELL")) stats.color = "#484";
    if(type.includes("BUU")) stats.color = "#fbb";
    if(type.includes("BLACK")) stats.color = "#333";
    if(type.includes("JIREN")) stats.color = "#f22";
    if(type.includes("BROLY")) { stats.color = "#0f0"; stats.r = 90; }

    const boss = { id: "BOSS_" + type + "_" + Date.now(), name: type, isNPC: true, isBoss: true, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 20000, maxKi: 20000, level: zone.level + 20, cancelWindow: 0, lastInputTime: 0, orbitDir: 1, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, targetId: null };
    npcs.push(boss);
    return boss;
}

function checkAchievements(p) {
    let unlocked = p.titles ? p.titles.split(',') : ["Novato"];
    let changed = false;
    if (p.level >= TITLES_DATA.WARRIOR.val && !unlocked.includes(TITLES_DATA.WARRIOR.name)) { unlocked.push(TITLES_DATA.WARRIOR.name); changed = true; }
    if (p.bp >= TITLES_DATA.ELITE.val && !unlocked.includes(TITLES_DATA.ELITE.name)) { unlocked.push(TITLES_DATA.ELITE.name); changed = true; }
    if (p.form === "GOD" && !unlocked.includes(TITLES_DATA.GOD.name)) { unlocked.push(TITLES_DATA.GOD.name); changed = true; }
    if (p.pvp_kills >= TITLES_DATA.SLAYER.val && !unlocked.includes(TITLES_DATA.SLAYER.name)) { unlocked.push(TITLES_DATA.SLAYER.name); changed = true; }
    if (changed) {
        p.titles = unlocked.join(',');
        io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "NOVO TÍTULO DESBLOQUEADO!" });
        pool.query('UPDATE users SET titles=$1 WHERE name=$2', [p.titles, p.name]).catch(console.error);
    }
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

const io = new Server(server, { transports: ['websocket'], pingInterval: 25000, pingTimeout: 5000 });

function packStateForPlayer(pid) {
    const p = players[pid];
    if (!p) return null;
    const VIEW_DIST = 2500; 
    const filterFunc = (o) => Math.abs(o.x - p.x) < VIEW_DIST && Math.abs(o.y - p.y) < VIEW_DIST;
    const packedPlayers = {};
    for (const pid in players) {
        const pl = players[pid];
        if (pid === p.id || filterFunc(pl)) {
            packedPlayers[pid] = {
                id: pl.id, name: pl.name, x: Math.round(pl.x), y: Math.round(pl.y),
                vx: Math.round(pl.vx), vy: Math.round(pl.vy), hp: pl.hp, maxHp: pl.maxHp,
                ki: pl.ki, maxKi: pl.maxKi, xp: pl.xp, xpToNext: pl.xpToNext,
                level: pl.level, bp: pl.bp, state: pl.state, form: pl.form,
                color: pl.color, stun: pl.stun, isSpirit: pl.isSpirit, pvpMode: pl.pvpMode
            };
        }
    }
    const visibleRocks = rocks.filter(filterFunc);
    const visibleNpcs = npcs.filter(filterFunc).map(n => ({...n, x: Math.round(n.x), y: Math.round(n.y)}));
    const visibleProjs = projectiles.filter(filterFunc).map(pr => ({...pr, x: Math.round(pr.x), y: Math.round(pr.y)}));
    const visibleChats = chats.filter(c => c.life > 0 && Math.abs(c.x - p.x) < VIEW_DIST && Math.abs(c.y - p.y) < VIEW_DIST);

    return { 
        players: packedPlayers, npcs: visibleNpcs, projectiles: visibleProjs, 
        rocks: visibleRocks, craters, chats: visibleChats,
        domination: PLANETS, 
        leaderboard: leaderboard.slice(0, 5)
    };
}
const localUsers = {};

io.on("connection", (socket) => {
    socket.on("login", async (data) => {
    try {
        let user;
        if (isRender) {
            const res = await pool.query('SELECT * FROM users WHERE name = $1', [data.user]);
            user = res.rows[0];
            if (!user) {
                const insert = await pool.query('INSERT INTO users (name, pass, level, xp, bp, guild, titles, current_title, pvp_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [data.user, data.pass, 1, 0, 500, null, 'Novato', 'Novato', 0]);
                user = insert.rows[0];
            } else if (user.pass !== data.pass) return;
        } else {
            user = localUsers[data.user];
            if (!user) { user = { name: data.user, pass: data.pass, level: 1, xp: 0, bp: 500, guild: null, titles: 'Novato', current_title: 'Novato', pvp_score: 0, pvp_kills: 0 }; localUsers[data.user] = user; } else if (user.pass !== data.pass) return;
        }
        const xpToNext = user.level * 800;
        players[socket.id] = {
            ...user, id: socket.id, r: 20, x: 0, y: 0, vx: 0, vy: 0, angle: 0,
            baseMaxHp: 1000 + user.level * 200, baseMaxKi: 100 + user.level * 10,
            hp: 1000 + user.level * 200, maxHp: 1000 + user.level * 200,
            ki: 100, maxKi: 100 + user.level * 10, form: "BASE", xpToNext,
            state: "IDLE", lastHit: 0,
            stunImmune: 0, combo: 0, comboTimer: 0, attackLock: 0, counterWindow: 0, lastAtk: 0,
            isDead: false, isSpirit: false, stun: 0, color: "#ff9900", chargeStart: 0,
            pvpMode: false, lastTransform: 0, bpCapped: false,
            reviveTimer: 0, linkId: null
        };
        socket.emit("auth_success", players[socket.id]);
    } catch (err) { console.error("Erro no Login:", err); }
    });

    socket.on("toggle_pvp", () => {
        const p = players[socket.id];
        if (!p || p.isDead || p.isSpirit) return;
        p.pvpMode = !p.pvpMode;
        socket.emit("pvp_status", p.pvpMode);
    });

    socket.on("set_title", (title) => { const p = players[socket.id]; if(p && p.titles.includes(title)) { p.current_title = title; if(isRender) pool.query('UPDATE users SET current_title=$1 WHERE name=$2', [title, p.name]).catch(console.error); } });
    socket.on("create_guild", (guildName) => { const p = players[socket.id]; if(p && !p.guild && guildName.length < 15) { p.guild = guildName; if(isRender) pool.query('UPDATE users SET guild=$1 WHERE name=$2', [guildName, p.name]).catch(console.error); io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GUILDA CRIADA: " + guildName }); } });

    socket.on("chat", (msg) => {
        const p = players[socket.id];
        if (!p || msg.length > 50) return;
        if (msg.startsWith("/guild ")) { const name = msg.substring(7).trim(); if (name.length >= 3) socket.emit("create_guild", name); return; }
        if (msg.startsWith("/title ")) { const title = msg.substring(7).trim(); socket.emit("set_title", title); return; }
        if (p.lastMsg && Date.now() - p.lastMsg < 1000) return;
        p.lastMsg = Date.now();
        chats.push({ x: p.x, y: p.y, text: msg, owner: p.name, life: 150 });
    });

    socket.on("emote", (type) => { const p = players[socket.id]; if(!p) return; io.emit("fx", { type: "emote", x: p.x, y: p.y, icon: type }); });

    socket.on("input", (input) => {
        const p = players[socket.id];
        if(!p || p.stun > 0 || p.isDead) return; 
        
        // HEAVY SMASH
        const now = Date.now();
        if (input.block && input.holdAtk) { if (!p.heavyChargeStart) p.heavyChargeStart = now; } else { p.heavyChargeStart = 0; }
        if (p.heavyChargeStart && now - p.heavyChargeStart >= 350 && (!p.heavyCooldown || now >= p.heavyCooldown) && p.ki >= p.maxKi * 0.30) {
            io.emit("fx", { type: "heavy", x: p.x, y: p.y });
            craters.push({ x: p.x, y: p.y, r: 80, life: 1000 });
            npcs.forEach(n => { const dist = Math.hypot(n.x - p.x, n.y - p.y); if (dist < 220) { n.vx += (n.x-p.x)/dist * 28; n.vy += (n.y-p.y)/dist * 28; n.hp -= 40; } });
            Object.values(players).forEach(o => { if (o.id !== p.id && o.pvpMode && Math.hypot(o.x - p.x, o.y - p.y) < 220) { o.vx += (o.x-p.x)/220 * 14; o.vy += (o.y-p.y)/220 * 14; o.hp -= 25; } });
            p.ki -= p.maxKi * 0.30; p.heavyCooldown = now + 3500; p.heavyChargeStart = 0;
            return;
        }

        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"];
        let speed = formStats.spd;
        if(p.isSpirit) speed *= 0.8;

		
        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        if(input.x || input.y) { p.vx += input.x * speed * moveMod; p.vy += input.y * speed * moveMod; if(!["ATTACKING"].includes(p.state)) p.state = "MOVING"; }
        if (p.attackLock <= 0) p.angle = input.angle;
        if(input.block) { if(p.ki > 0) { p.state = "BLOCKING"; p.ki -= 0.5; } else { p.state = "IDLE"; } }
        else if(input.charge) { 
            p.state = "CHARGING"; 
            let boost = 1;
            Object.values(players).forEach(other => { if(other.id !== p.id && other.state === "CHARGING" && Math.hypot(other.x - p.x, other.y - p.y) < 200) { boost = 2; p.linkId = other.id; } });
            if(boost === 1) p.linkId = null;
            p.ki = Math.min(p.maxKi, p.ki + (p.level * 0.8 * boost)); 
        } 
        else if(input.holdAtk) { if(p.state !== "CHARGING_ATK") p.chargeStart = Date.now(); p.state = "CHARGING_ATK"; } 
        else if(!["ATTACKING"].includes(p.state)) { p.state = "IDLE"; p.linkId = null; }
    });

    socket.on("release_attack", () => {
        const p = players[socket.id];
        if (!p || p.isSpirit || p.stun > 0) return;
        const now = Date.now();
        const formStats = FORM_STATS[p.form] || FORM_STATS.BASE;
        let target = findSnapTarget(p);
        if (!target) {
            let best = null, bestDist = 380;
            [...Object.values(players), ...npcs].forEach(t => {
                if (t.id === p.id || t.isDead || t.isSpirit) return;
                if (!t.isNPC && !p.pvpMode) return;
                const d = Math.hypot(t.x - p.x, t.y - p.y);
                if (d < bestDist) { bestDist = d; best = t; }
            });
            target = best;
        }
        if (!target) { p.state = "IDLE"; p.combo = 0; p.comboTimer = 0; return; }
        if (p.comboTimer <= 0) p.combo = 0;
        const COMBO_STEPS = [ { type: "RUSH", range: 220, selfSpd: 65, targetPush: 5, stun: 15, dmg: 1.0 }, { type: "HEAVY", range: 130, selfSpd: 30, targetPush: 8, stun: 15, dmg: 1.2 }, { type: "MULTI", range: 130, selfSpd: 40, targetPush: 5, stun: 15, dmg: 0.8 }, { type: "UPPER", range: 130, selfSpd: 20, targetPush: 10, stun: 18, dmg: 1.5 }, { type: "FINISH", range: 160, selfSpd: 10, targetPush: 180, stun: 35, dmg: 2.5 } ];
        if (p.combo >= COMBO_STEPS.length) p.combo = 0;
        const step = COMBO_STEPS[p.combo];
        const isFinisher = step.type === "FINISH";
        if (target) { const dx = target.x - p.x; const dy = target.y - p.y; p.angle = Math.atan2(dy, dx); if (!isFinisher) { target.vx *= 0.1; target.vy *= 0.1; } }
        p.vx = Math.cos(p.angle) * step.selfSpd; p.vy = Math.sin(p.angle) * step.selfSpd;
        p.state = "ATTACKING"; p.attackLock = isFinisher ? 18 : 10; p.cancelWindow = 5; p.lastAtk = now;
        let baseDmg = Math.floor((65 + p.level * 10) * formStats.dmg * step.dmg); 
        for(let idx = rocks.length - 1; idx >= 0; idx--) {
            const r = rocks[idx];
            if(Math.abs(r.x - p.x) > 300 || Math.abs(r.y - p.y) > 300) continue;
            const dist = Math.hypot(r.x - p.x, r.y - p.y);
            if (dist < (r.r + step.range * 0.8)) {
                const angToRock = Math.atan2(r.y - p.y, r.x - p.x); let diff = Math.abs(angToRock - p.angle); if(diff > Math.PI) diff = Math.PI*2 - diff;
                if (diff < 1.5) { r.hp -= baseDmg * 2; io.emit("fx", { type: "hit", x: r.x, y: r.y, dmg: baseDmg }); if(r.hp <= 0) { rocks.splice(idx, 1); io.emit("fx", { type: "heavy", x: r.x, y: r.y }); craters.push({ x: r.x, y: r.y, r: r.r, life: 1000 }); } }
            }
        }
        if (target) {
            const dist = Math.hypot(target.x - p.x, target.y - p.y);
            const angToT = Math.atan2(target.y - p.y, target.x - p.x); let diff = Math.abs(angToT - p.angle); if(diff > Math.PI) diff = Math.PI*2 - diff;
            if (dist <= step.range && diff < 2.5) {
                if(target.isNPC) target.targetId = p.id; 
                let dmg = baseDmg; if (!target.isNPC) dmg *= 0.5;
                if (target.state === "BLOCKING" && !isFinisher) { dmg *= 0.25; target.ki -= 12; target.counterWindow = 12; io.emit("fx", { type: "block_hit", x: target.x, y: target.y }); } 
                else { if(target.state === "BLOCKING" && isFinisher) { target.state = "IDLE"; target.stun = 30; io.emit("fx", { type: "guard_break", x: target.x, y: target.y }); }
                    target.hp -= dmg; target.stun = step.stun; target.vx = Math.cos(p.angle) * step.targetPush; target.vy = Math.sin(p.angle) * step.targetPush;
                    io.emit("fx", { type: isFinisher ? "finisher" : "hit", x: target.x, y: target.y, dmg });
                    if (isFinisher) craters.push({ x: target.x, y: target.y, r: 40, life: 1000 });
                }
                if (target.hp <= 0) handleKill(p, target);
                p.combo++; p.comboTimer = 35; 
            } else { if(p.combo > 0) p.comboTimer = 15; }
        }
    });

    socket.on("release_blast", () => {
        const p = players[socket.id];
        if (!p || p.isSpirit || p.stun > 0) return;
        if (p.state === "ATTACKING" && p.cancelWindow <= 0) return;
        const isSuper = (Date.now() - p.chargeStart) > 800; const cost = isSuper ? 40 : 10;
        if (p.ki < cost) return;
        p.ki -= cost; p.state = "IDLE"; p.attackLock = 0; p.comboTimer = 0; 
        const formStats = FORM_STATS[p.form] || FORM_STATS.BASE;
        projectiles.push({ id: Math.random(), owner: p.id, x: p.x, y: p.y, vx: Math.cos(p.angle) * (isSuper ? 32 : 45), vy: Math.sin(p.angle) * (isSuper ? 32 : 45), dmg: (50 + p.level * 6) * formStats.dmg * (isSuper ? 3 : 1), size: isSuper ? 80 : 12, isSuper, life: 90, color: "#0cf", pvp: p.pvpMode });
    });

    socket.on("vanish", () => { const p = players[socket.id]; if (!p || p.isSpirit || p.ki < 20 || p.stun > 0) return; p.ki -= 20; p.state = "IDLE"; p.attackLock = 0; p.combo = 0; p.x += Math.cos(p.angle) * 350; p.y += Math.sin(p.angle) * 350; io.emit("fx", { type: "vanish", x: p.x, y: p.y }); });
    
    socket.on("transform", () => {
        const p = players[socket.id];
        if (!p || p.isSpirit || p.isDead || p.stun > 0) return;
        if (p.lastTransform && Date.now() - p.lastTransform < 2000) return;
        const currentIdx = FORM_ORDER.indexOf(p.form || "BASE");
        let nextIdx = currentIdx + 1;
        if (nextIdx >= FORM_ORDER.length) nextIdx = 0;
        const nextForm = FORM_ORDER[nextIdx];
        const reqLevel = FORM_REQS[nextForm];
        if (p.level < reqLevel) {
            if (p.form !== "BASE") nextIdx = 0;
            else return;
        }
        const newFormName = FORM_ORDER[nextIdx];
        const stats = FORM_STATS[newFormName];
        if (!stats) return;
        if (newFormName !== "BASE" && p.ki < 50) return;
        if (newFormName !== "BASE") p.ki -= 50;
        p.form = newFormName;
        p.lastTransform = Date.now();
        p.maxHp = Math.floor(p.baseMaxHp * stats.hpMult);
        p.maxKi = Math.floor(p.baseMaxKi * stats.kiMult);
        p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.1));
        io.emit("fx", { type: "transform", x: p.x, y: p.y, form: newFormName });
        [...Object.values(players), ...npcs].forEach(t => {
            if (t.id === p.id || t.isDead || t.isSpirit) return;
            const dist = Math.hypot(t.x - p.x, t.y - p.y);
            if (dist < 300) {
                const ang = Math.atan2(t.y - p.y, t.x - p.x);
                t.vx = Math.cos(ang) * 40; t.vy = Math.sin(ang) * 40; t.stun = 15;
            }
        });
        checkAchievements(p);
        clampBP(p);
    });

    socket.on("set_tax", (val) => {
        const p = players[socket.id];
        if (!p || !p.guild) return;
        const planet = PLANETS.find(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius);
        if (planet && planet.owner === p.guild && val >= 0 && val <= 20) {
            planet.taxRate = val;
            if(isRender) pool.query('INSERT INTO planets (id, tax_rate) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET tax_rate = $2', [planet.id, val]).catch(console.error);
            io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: `IMPOSTO: ${val}%` });
        }
    });

    socket.on("disconnect", () => delete players[socket.id]);
});

function handleKill(killer, victim) {
    const planet = PLANETS.find(pl => Math.hypot(pl.x - victim.x, pl.y - victim.y) < pl.radius);
    if (planet && !killer.isNPC) {
        if (planet.owner && planet.owner !== killer.guild) {
            planet.stability -= 5;
            if (planet.stability <= 0) { planet.owner = null; planet.guild = null; planet.stability = 20; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "PLANETA NEUTRO!" }); }
        } else if (!planet.owner && killer.guild) {
            planet.stability += 5;
            if (planet.stability >= 100) { planet.owner = killer.guild; planet.guild = killer.guild; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "DOMINADO POR " + killer.guild }); }
        }
        if(isRender && planet) { pool.query(`INSERT INTO planets (id, owner, guild, stability, treasury) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET owner=$2, guild=$3, stability=$4, treasury=$5`, [planet.id, planet.owner, planet.guild, planet.stability, planet.treasury]).catch(console.error); }
    }

    if(victim.isNPC) {
        victim.isDead = true;
        if(!killer.isNPC) {
            killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2)); 
            const xpGain = victim.level * 100; const xpReq = killer.level * 800; killer.xp += xpGain; killer.xpToNext = killer.level * 800;
            io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain });
            if (planet && planet.owner && planet.owner !== killer.guild) { const tax = Math.floor(xpGain * (planet.taxRate / 100)); planet.treasury += tax; }
            if(killer.xp >= xpReq) { killer.level++; killer.xp = 0; killer.bp += 5000; clampBP(killer); killer.baseMaxHp += 1000; killer.baseMaxKi += 100; const stats = FORM_STATS[killer.form] || FORM_STATS["BASE"]; killer.maxHp = killer.baseMaxHp * stats.hpMult; killer.maxKi = killer.baseMaxKi * stats.kiMult; killer.hp = killer.maxHp; killer.ki = killer.maxKi; killer.xpToNext = killer.level * 800; io.emit("fx", { type: "levelup", x: killer.x, y: killer.y }); if(isRender) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [killer.level, killer.xp, killer.bp, killer.name]).catch(e => console.error(e)); }
        }
        setTimeout(() => { npcs = npcs.filter(n => n.id !== victim.id); spawnMobRandomly(); }, 5000);
    } else {
        victim.isSpirit = true; victim.hp = 1; victim.ki = 0; victim.state = "SPIRIT"; victim.vx = 0; victim.vy = 0;
        victim.x = SNAKE_WAY_START.x; victim.y = SNAKE_WAY_START.y; victim.angle = -Math.PI / 2;
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
        if(!killer.isNPC) { killer.pvp_score += 10; killer.pvp_kills = (killer.pvp_kills || 0) + 1; checkAchievements(killer); io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: 50 }); if(isRender) pool.query('UPDATE users SET pvp_score=$1 WHERE name=$2', [killer.pvp_score, killer.name]).catch(console.error); }
    }
}

function triggerRandomEvent() {
    if(eventActive) { npcs = npcs.filter(n => !eventMobIds.includes(n.id)); eventMobIds = []; eventActive = false; io.emit("fx", { type: "bp_limit", x: 0, y: 0, text: "AMEAÇA CONTIDA." }); return; }
    let targetPlanet = PLANETS.find(p => p.owner) || PLANETS[Math.floor(Math.random() * PLANETS.length)];
    const events = [ 
        { type: "HORDE_SAIBAMAN", msg: `INVASÃO EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, 
        { type: "INVASION_FRIEZA", msg: `FORÇAS DE FREEZA EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, 
        { type: "BOSS_BROLY", msg: `BROLY ESTÁ DESTRUINDO ${targetPlanet.name}!`, zoneId: targetPlanet.id }
    ];
    const ev = events[Math.floor(Math.random() * events.length)]; 
    io.emit("fx", { type: "bp_limit", x: targetPlanet.x, y: targetPlanet.y, text: ev.msg }); 
    eventActive = true;
    if (targetPlanet.owner) targetPlanet.stability = Math.max(10, targetPlanet.stability - 20);
    if(ev.type.includes("HORDE")) { for(let i=0; i<15; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*1000, targetPlanet.y + (Math.random()-0.5)*1000, true); mob.name = "INVASOR"; mob.color = "#f00"; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("INVASION")) { for(let i=0; i<10; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*800, targetPlanet.y + (Math.random()-0.5)*800, true); mob.name = "ELITE"; mob.color = "#808"; mob.hp *= 2; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("BOSS")) { const boss = spawnBossAt(targetPlanet.x, targetPlanet.y, "LEGENDARY_BROLY"); boss.hp *= 3; boss.bp *= 2; eventMobIds.push(boss.id); }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    chats = chats.filter(c => { c.life--; return c.life > 0; });
    leaderboard = Object.values(players).sort((a,b) => b.pvp_score - a.pvp_score).slice(0,5).map(p => ({name: p.name, score: p.pvp_score, guild: p.guild}));
    globalEventTimer++; if(globalEventTimer > 5000) { triggerRandomEvent(); globalEventTimer = 0; }

    Object.values(players).forEach(p => {
        if(p.stun > 0) p.stun--; if(p.attackLock > 0) p.attackLock--; if(p.comboTimer > 0) p.comboTimer--; if(p.counterWindow > 0) p.counterWindow--;
        p.x += p.vx; p.y += p.vy; p.vx *= 0.82; p.vy *= 0.82; 
        if (!p.isDead && !p.isSpirit) {
            p.bp += 1 + Math.floor(p.level * 0.1); clampBP(p);
            if (p.state === "CHARGING") { 
                if (Math.random() > 0.85) { p.xp += 1; p.xpToNext = p.level * 800; p.bp += 5; clampBP(p); } 
                const xpReq = p.level * 800; 
                if(p.xp >= xpReq) { p.level++; p.xp = 0; p.bp += 5000; clampBP(p); p.baseMaxHp += 1000; p.baseMaxKi += 100; const stats = FORM_STATS[p.form] || FORM_STATS["BASE"]; p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult; p.hp = p.maxHp; p.ki = p.maxKi; p.xpToNext = p.level * 800; io.emit("fx", { type: "levelup", x: p.x, y: p.y }); if(isRender) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [p.level, p.xp, p.bp, p.name]).catch(e => console.error(e)); } 
            } 
            else if(p.ki < p.maxKi && p.state === "IDLE") { p.ki += 0.5; }
            const distToKingKai = Math.hypot(p.x - 0, p.y + 20000); if (distToKingKai < 1500) { p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.05)); p.ki = Math.min(p.maxKi, p.ki + (p.maxKi * 0.05)); }
        }
        if (p.bp >= getMaxBP(p)) { if (!p.bpCapped) { p.bpCapped = true; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "BP NO LIMITE" }); } } else { p.bpCapped = false; }

        if (p.isSpirit) {
            const distToKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y);
            if (distToKai < 600) {
                p.isSpirit = false; p.hp = p.maxHp; p.ki = p.maxKi; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
                io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); io.emit("fx", { type: "levelup", x: 0, y: 0 });
            }
        }
    });

    npcs.forEach(n => {
        if (n.isDead) return;
        if (n.stun > 0) { n.stun--; n.x += n.vx; n.y += n.vy; n.vx *= 0.9; n.vy *= 0.9; n.state = "STUNNED"; return; }
        let target = null; let minDist = n.aggro || 1200;
        if (n.targetId && players[n.targetId] && !players[n.targetId].isDead && !players[n.targetId].isSpirit) { const t = players[n.targetId]; if (Math.hypot(n.x - t.x, n.y - t.y) < 3000) target = t; else n.targetId = null; }
        if (!target) { for (const p of Object.values(players)) { if (p.isDead || p.isSpirit) continue; if (Math.abs(p.x - n.x) > minDist || Math.abs(p.y - n.y) > minDist) continue; const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < minDist) { minDist = d; target = p; } } }
        if (!target) { n.state = "IDLE"; n.vx *= 0.95; n.vy *= 0.95; n.x += n.vx; n.y += n.vy; return; }
        const dx = target.x - n.x; const dy = target.y - n.y; const dist = Math.hypot(dx, dy); const ang = Math.atan2(dy, dx); n.angle = ang;
        const MAX_SPEED = n.isBoss ? 22 : 16; const ATTACK_RANGE = n.isBoss ? 170 : 100; const PRESSURE_RANGE = 55;
        if (n.isBoss) {
            if (!n.phase) n.phase = 1; if (!n.pushStreak) n.pushStreak = 0; if (!n.lastDash) n.lastDash = 0;
            const hpPerc = n.hp / n.maxHp; if (hpPerc <= BOSS_PHASES.PHASE_3.hp) n.phase = 3; else if (hpPerc <= BOSS_PHASES.PHASE_2.hp) n.phase = 2; else n.phase = 1;
            if (n.pushStreak >= 3) { n.vx *= 0.2; n.vy *= 0.2; n.state = "IDLE"; n.pushStreak = 0; n.x += n.vx; n.y += n.vy; return; }
            if (dist > ATTACK_RANGE && dist < 420 && Date.now() - n.lastDash > 800) { const dashSpd = n.phase === 3 ? 28 : 20; n.vx += Math.cos(ang) * dashSpd; n.vy += Math.sin(ang) * dashSpd; n.state = "ATTACKING"; n.lastDash = Date.now(); }
        }
        if (dist > ATTACK_RANGE) { n.state = "CHASE"; const burst = n.isBoss ? 2.8 : 3.6; n.vx += Math.cos(ang) * burst; n.vy += Math.sin(ang) * burst; } 
        else if (dist < PRESSURE_RANGE) { n.state = "PRESSURE"; n.vx -= Math.cos(ang) * 1.4; n.vy -= Math.sin(ang) * 1.4; } 
        else if (Date.now() - n.lastAtk > 650 && (!target.lastHit || Date.now() - target.lastHit > 400)) {
            n.lastAtk = Date.now(); n.state = "ATTACKING"; let dmg = (n.level * 10) + (n.isBoss ? 100 : 30);
            if (target.state === "BLOCKING") { dmg *= 0.3; target.ki -= 14; target.counterWindow = 14; }
            target.hp -= dmg; if (target.hp < 0) target.hp = 0; target.lastHit = Date.now();
            if (!target.stunImmune || Date.now() > target.stunImmune) { target.stun = n.isBoss ? 10 : 4; target.stunImmune = Date.now() + 700; }
            const push = n.isBoss ? (n.phase === 3 ? 45 : 25) : 15; target.vx = Math.cos(ang) * push; target.vy = Math.sin(ang) * push; if (n.isBoss) n.pushStreak++;
            io.emit("fx", { type: n.isBoss ? "heavy" : "hit", x: target.x, y: target.y, dmg: Math.floor(dmg) });
            n.vx *= 0.25; n.vy *= 0.25; if (target.hp <= 0) handleKill(n, target);
        }
        const speed = Math.hypot(n.vx, n.vy); if (speed > MAX_SPEED) { const s = MAX_SPEED / speed; n.vx *= s; n.vy *= s; }
        n.x += n.vx; n.y += n.vy; n.vx *= 0.92; n.vy *= 0.92;
    });

    projectiles.forEach((pr, i) => {
        pr.x += pr.vx; pr.y += pr.vy; pr.life--; let hit = false;
        [...Object.values(players), ...npcs].forEach(t => {
            if (!hit && t.id !== pr.owner && !t.isSpirit && !t.isDead) {
                if(Math.abs(pr.x - t.x) > 150 || Math.abs(pr.y - t.y) > 150) return;
                const dist = Math.hypot(pr.x - t.x, pr.y - t.y);
                if (dist < (45 + pr.size)) { if(!t.isNPC && !pr.pvp) return; if(t.isNPC) t.targetId = pr.owner; let dmg = pr.dmg; if (!t.isNPC) dmg *= 0.5; if (!t.lastHit || Date.now() - t.lastHit > 300) { t.hp -= dmg; if (t.hp < 0) t.hp = 0; t.stun = 6; t.lastHit = Date.now(); } hit = true; io.emit("fx", { type: pr.isSuper ? "heavy" : "hit", x: pr.x, y: pr.y, dmg: Math.floor(dmg) }); const owner = players[pr.owner] || npcs.find(n => n.id === pr.owner) || {}; if (t.hp <= 0) handleKill(owner, t); }
            }
        });
        if(!hit) { for(let rIdx = rocks.length-1; rIdx >= 0; rIdx--) { let r = rocks[rIdx]; if(Math.abs(pr.x - r.x) > 150 || Math.abs(pr.y - r.y) > 150) continue; const dist = Math.hypot(pr.x - r.x, pr.y - r.y); if(dist < (r.r + pr.size)) { hit = true; r.hp -= pr.dmg; io.emit("fx", { type: "hit", x: pr.x, y: pr.y, dmg: Math.floor(pr.dmg) }); if(r.hp <= 0) { rocks.splice(rIdx, 1); io.emit("fx", { type: "heavy", x: r.x, y: r.y }); craters.push({ x: r.x, y: r.y, r: r.r, life: 1000 }); } break; } } }
        if (hit || pr.life <= 0) projectiles.splice(i, 1);
    });

    Object.keys(players).forEach(id => { const st = packStateForPlayer(id); if(st) io.to(id).emit("state", st); });
}, TICK);

server.listen(3000, () => console.log("Dragon Bolt Z - MMO Galaxy Edition Online"));