const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require('pg'); 
const isRender = !!process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BOSS_PHASES = {
    PHASE_1: { hp: 0.65, aggression: 0.6 },
    PHASE_2: { hp: 0.35, aggression: 0.8 },
    PHASE_3: { hp: 0.0,  aggression: 1.0 }
};

const BOSS_COOLDOWNS = {
    DASH: 900,
    COMBO: 700,
    KI: 1200,
    REPOSITION: 800
};


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
                pvp_score INTEGER DEFAULT 0
            );
        `);
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS guild VARCHAR(50) DEFAULT NULL").catch(()=>{});
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS titles TEXT DEFAULT 'Novato'").catch(()=>{});
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_title VARCHAR(50) DEFAULT 'Novato'").catch(()=>{});
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements TEXT DEFAULT ''").catch(()=>{});
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS pvp_score INTEGER DEFAULT 0").catch(()=>{});
        console.log("Banco de Dados Sincronizado.");
    } catch (err) { console.error("Erro no DB Init:", err); }
};
initDB();

const TICK = 33; 
const players = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];
let chats = []; // Armazena mensagens temporárias

const DOMINATION_ZONES = [
    { id: "EARTH_CORE", name: "Capital do Oeste", x: 2000, y: 2000, radius: 800, owner: null, guild: null, progress: 0, state: "PEACE" },
    { id: "NAMEK_VILLAGE", name: "Vila Namek", x: -15000, y: 2000, radius: 800, owner: null, guild: null, progress: 0, state: "PEACE" },
    { id: "FUTURE_RUINS", name: "Ruínas do Futuro", x: 15000, y: 0, radius: 800, owner: null, guild: null, progress: 0, state: "PEACE" },
    { id: "DEMON_GATE", name: "Portão Demoníaco", x: 0, y: 15000, radius: 800, owner: null, guild: null, progress: 0, state: "PEACE" }
];

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

const BP_TRAIN_CAP = { BASE: 1200, SSJ: 2500, SSJ2: 5000, SSJ3: 9000, GOD: 16000, BLUE: 28000, UI: 45000 };

const BESTIARY = {
    EARTH: { mobs: ["RR_SOLDIER", "WOLF_BANDIT", "DINOSAUR", "SAIBAMAN", "RADITZ_MINION"], bosses: ["TAO_PAI_PAI", "KING_PICCOLO", "RADITZ", "NAPPA", "VEGETA_SCOUTER"] },
    DEEP_SPACE: { mobs: ["FRIEZA_SOLDIER", "ZARBON_MONSTER", "DODORIA_ELITE", "NAMEK_WARRIOR", "GINYU_FORCE_MEMBER"], bosses: ["CAPTAIN_GINYU", "FRIEZA_FINAL", "COOLER_METAL", "LEGENDARY_BROLY"] },
    FUTURE_TIMELINE: { mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR", "MACHINE_MUTANT", "ZAMASU_CLONE"], bosses: ["ANDROID_18", "PERFECT_CELL", "GOKU_BLACK_ROSE", "SUPER_17", "OMEGA_SHENRON"] },
    DEMON_REALM: { mobs: ["PUIPUI", "YAKON", "DABURA_MINION", "JANEMBA_MINI", "GOMAH_SOLDIER"], bosses: ["DABURA", "FAT_BUU", "KID_BUU", "JANEMBA", "KING_GOMAH"] },
    DIVINE_REALM: { mobs: ["PRIDE_TROOPER", "U6_BOTAMO", "ANGEL_TRAINEE", "HAKAISHIN_GUARD"], bosses: ["GOLDEN_FRIEZA", "HIT_ASSASSIN", "TOPPO_GOD", "JIREN_FULL_POWER", "BEERUS"] }
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
    rocks = [];
    for(let i=0; i<1000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 70000;
        const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist;
        const zone = getZoneInfo(x, y);
        let type = "rock_earth";
        if(zone.id === "DEEP_SPACE") type = "rock_namek";
        if(zone.id === "FUTURE_TIMELINE") type = "rock_city";
        if(zone.id === "DEMON_REALM") type = "rock_magic";
        if(zone.id === "DIVINE_REALM") type = "rock_god";
        rocks.push({ id: i, x: Math.round(x), y: Math.round(y), r: 30 + Math.random() * 80, hp: 300 + (dist/50), maxHp: 300 + (dist/50), type });
    }
    npcs = [];
    for(let i=0; i<450; i++) spawnMobRandomly();
    spawnBossAt(2000, 2000, "VEGETA_SCOUTER");
    spawnBossAt(-15000, 2000, "FRIEZA_FINAL"); 
    spawnBossAt(-25000, -5000, "LEGENDARY_BROLY");
    spawnBossAt(15000, 0, "PERFECT_CELL"); 
    spawnBossAt(25000, 5000, "GOKU_BLACK_ROSE");
    spawnBossAt(0, 15000, "FAT_BUU");
    spawnBossAt(0, 40000, "KING_GOMAH");
    spawnBossAt(10000, -35000, "JIREN_FULL_POWER");
    console.log(`Mundo Online: ${rocks.length} rochas, ${npcs.length} NPCs.`);
}

function spawnMobRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2000 + Math.random() * 60000; 
    const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist;
    spawnMobAt(x, y);
}

function spawnMobAt(x, y, aggressive = false) {
    const zone = getZoneInfo(x, y);
    const list = BESTIARY[zone.id].mobs;
    const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);
    let stats = { name: type, hp: 400 * zone.level, bp: 1200 * zone.level, level: zone.level, color: "#fff", aggro: aggressive ? 2000 : (700 + (zone.level * 10)), aiType: "MELEE" };
    if(type.includes("RR_")) stats.color = "#555";
    if(type.includes("FRIEZA")) stats.color = "#848";
    if(type.includes("MAJIN") || type.includes("DEMON")) stats.color = "#909";
    if(type.includes("PRIDE") || type.includes("ANGEL")) stats.color = "#aaf";
    if(type.includes("CELL") || type.includes("SAIBAMAN")) stats.color = "#484";
    const npc = { id, isNPC: true, r: 25, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200, level: stats.level, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType, aggro: stats.aggro, targetId: null };
    npcs.push(npc);
    return npc;
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
    const boss = { id: "BOSS_" + type + "_" + Date.now(), name: type, isNPC: true, isBoss: true, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 10000, maxKi: 10000, level: zone.level + 15, cancelWindow: 0, lastInputTime: 0, orbitDir: 1, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, targetId: null };
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
    const VIEW_DIST = 2200; 
    const filterFunc = (o) => Math.abs(o.x - p.x) < VIEW_DIST && Math.abs(o.y - p.y) < VIEW_DIST;
    const packedPlayers = {};
    for (const pid in players) {
        const pl = players[pid];
        if (pid === p.id || filterFunc(pl)) {
            packedPlayers[pid] = {
    id: pl.id,
    name: pl.name,
    x: Math.round(pl.x),
    y: Math.round(pl.y),
    vx: Math.round(pl.vx),
    vy: Math.round(pl.vy),
    hp: pl.hp,
    maxHp: pl.maxHp,
    ki: pl.ki,
    maxKi: pl.maxKi,
    xp: pl.xp,
    xpToNext: pl.xpToNext,
    level: pl.level,
    bp: pl.bp,
    state: pl.state,
    form: pl.form,
    color: pl.color,
    stun: pl.stun
};

        }
    }
    const visibleRocks = rocks.filter(filterFunc);
    const visibleNpcs = npcs.filter(filterFunc).map(n => ({...n, x: Math.round(n.x), y: Math.round(n.y)}));
    const visibleProjs = projectiles.filter(filterFunc).map(pr => ({...pr, x: Math.round(pr.x), y: Math.round(pr.y)}));
    
    // Filtra chats próximos
    const visibleChats = chats.filter(c => c.life > 0 && Math.abs(c.x - p.x) < VIEW_DIST && Math.abs(c.y - p.y) < VIEW_DIST);

    return { 
        players: packedPlayers,
        npcs: visibleNpcs, 
        projectiles: visibleProjs, 
        rocks: visibleRocks, 
        craters,
        chats: visibleChats, // Módulo Social: Envia chats
        domination: DOMINATION_ZONES,
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
            if (!user) { user = { name: data.user, pass: data.pass, level: 1, xp: 0, bp: 500, guild: null, titles: 'Novato', current_title: 'Novato', pvp_score: 0 }; localUsers[data.user] = user; } else if (user.pass !== data.pass) return;
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
            pvpMode: false, lastTransform: 0, bpCapped: false, pvp_kills: 0,
            reviveTimer: 0, linkId: null // Módulos Sociais
        };
        socket.emit("auth_success", players[socket.id]);
    } catch (err) { console.error("Erro no Login:", err); }
    });

    socket.on("toggle_pvp", () => { const p = players[socket.id]; if(p) p.pvpMode = !p.pvpMode; });
    socket.on("set_title", (title) => { const p = players[socket.id]; if(p && p.titles.includes(title)) { p.current_title = title; if(isRender) pool.query('UPDATE users SET current_title=$1 WHERE name=$2', [title, p.name]).catch(console.error); } });
    socket.on("create_guild", (guildName) => { const p = players[socket.id]; if(p && !p.guild && guildName.length < 15) { p.guild = guildName; if(isRender) pool.query('UPDATE users SET guild=$1 WHERE name=$2', [guildName, p.name]).catch(console.error); io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GUILDA CRIADA: " + guildName }); } });

    // MÓDULO SOCIAL: Chat
    socket.on("chat", (msg) => {
        const p = players[socket.id];
        if(!p || msg.length > 50 || (p.lastMsg && Date.now() - p.lastMsg < 1000)) return;
        p.lastMsg = Date.now();
        chats.push({ x: p.x, y: p.y, text: msg, owner: p.name, life: 150 });
    });

    // MÓDULO SOCIAL: Emotes
    socket.on("emote", (type) => {
        const p = players[socket.id];
        if(!p) return;
        io.emit("fx", { type: "emote", x: p.x, y: p.y, icon: type });
    });

    socket.on("input", (input) => {
        const p = players[socket.id];
        if(!p || p.stun > 0 || p.isDead) return; 
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"];
        let speed = formStats.spd;
        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        if(input.x || input.y) { p.vx += input.x * speed * moveMod; p.vy += input.y * speed * moveMod; if(!["ATTACKING"].includes(p.state)) p.state = "MOVING"; }
        if (p.attackLock <= 0) p.angle = input.angle;
        if(input.block) { if(p.ki > 0) { p.state = "BLOCKING"; p.ki -= 0.5; } else { p.state = "IDLE"; } }
        else if(input.charge) { 
            p.state = "CHARGING"; 
            
            // MÓDULO SOCIAL: Co-op Charging (Elo de Ki)
            let boost = 1;
            Object.values(players).forEach(other => {
                if(other.id !== p.id && other.state === "CHARGING" && Math.hypot(other.x - p.x, other.y - p.y) < 200) {
                    boost = 2; // Dobra a velocidade se tiver amigo perto
                    p.linkId = other.id; // Visual Link
                }
            });
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
        if (p.comboTimer <= 0) p.combo = 0;
        const COMBO_STEPS = [ { type: "RUSH", range: 220, selfSpd: 65, targetPush: 5, stun: 15, dmg: 1.0 }, { type: "HEAVY", range: 130, selfSpd: 30, targetPush: 8, stun: 15, dmg: 1.2 }, { type: "MULTI", range: 130, selfSpd: 40, targetPush: 5, stun: 15, dmg: 0.8 }, { type: "UPPER", range: 130, selfSpd: 20, targetPush: 10, stun: 18, dmg: 1.5 }, { type: "FINISH", range: 160, selfSpd: 10, targetPush: 180, stun: 35, dmg: 2.5 } ];
        if (p.combo >= COMBO_STEPS.length) p.combo = 0;
        const step = COMBO_STEPS[p.combo];
        const isFinisher = step.type === "FINISH";
        if (target) {
            const dx = target.x - p.x; const dy = target.y - p.y;
            p.angle = Math.atan2(dy, dx);
            if (!isFinisher) { target.vx *= 0.1; target.vy *= 0.1; } 
        }
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
        const p = players[socket.id]; if(!p || p.isSpirit) return;
        if(p.lastTransform && Date.now() - p.lastTransform < 5000) return;
        let nextForm = "BASE";
        if(p.form === "BASE" && p.level >= 5) nextForm = "SSJ"; else if(p.form === "SSJ" && p.level >= 20) nextForm = "SSJ2"; else if(p.form === "SSJ2" && p.level >= 40) nextForm = "SSJ3"; else if(p.form === "SSJ3" && p.level >= 60) nextForm = "GOD"; else if(p.form === "GOD" && p.level >= 80) nextForm = "BLUE"; else if(p.form === "BLUE" && p.level >= 100) nextForm = "UI"; else if(p.form !== "BASE") nextForm = "BASE"; 
        if(nextForm !== p.form && p.ki >= 50) {
            p.form = nextForm; p.ki -= 50; p.lastTransform = Date.now();
            const stats = FORM_STATS[nextForm]; p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult; checkAchievements(p);
            [...Object.values(players), ...npcs].forEach(t => { if (t.id === p.id || t.isDead || t.isSpirit) return; const dist = Math.hypot(t.x - p.x, t.y - p.y); if (dist < 400) { const ang = Math.atan2(t.y - p.y, t.x - p.x); t.vx = Math.cos(ang) * 150; t.vy = Math.sin(ang) * 150; t.stun = 20; } });
            io.emit("fx", { type: "transform", x: p.x, y: p.y, form: nextForm }); clampBP(p);
        }
    });
    socket.on("disconnect", () => delete players[socket.id]);
});

function handleKill(killer, victim) {
    if(victim.isNPC) {
        victim.isDead = true;
        if(!killer.isNPC) {
            killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2)); const xpGain = victim.level * 100; const xpReq = killer.level * 800; killer.xp += xpGain;
killer.xpToNext = killer.level * 800;
 io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain });
            if(killer.xp >= xpReq) { killer.level++; killer.xp = 0; killer.bp += 5000; clampBP(killer); killer.baseMaxHp += 1000; killer.baseMaxKi += 100; const stats = FORM_STATS[killer.form] || FORM_STATS["BASE"]; killer.maxHp = killer.baseMaxHp * stats.hpMult; killer.maxKi = killer.baseMaxKi * stats.kiMult; killer.hp = killer.maxHp; killer.ki = killer.maxKi; killer.xpToNext = killer.level * 800; io.emit("fx", { type: "levelup", x: killer.x, y: killer.y }); if(isRender) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [killer.level, killer.xp, killer.bp, killer.name]).catch(e => console.error(e)); }
        }
        setTimeout(() => { npcs = npcs.filter(n => n.id !== victim.id); spawnMobRandomly(); }, 5000);
    } else {
        // MÓDULO SOCIAL: Reanimação (Spirit Revive)
        victim.isSpirit = true; victim.hp = 1; victim.reviveTimer = 450; // 15 segundos para ser salvo
        // Não reseta posição imediatamente!
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
        if(!killer.isNPC) { killer.pvp_score += 10; killer.pvp_kills = (killer.pvp_kills || 0) + 1; checkAchievements(killer); io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: 50 }); if(isRender) pool.query('UPDATE users SET pvp_score=$1 WHERE name=$2', [killer.pvp_score, killer.name]).catch(console.error); }
    }
}

function triggerRandomEvent() {
    if(eventActive) { npcs = npcs.filter(n => !eventMobIds.includes(n.id)); eventMobIds = []; eventActive = false; io.emit("fx", { type: "bp_limit", x: 0, y: 0, text: "O EVENTO ACABOU." }); return; }
    const events = [ { type: "HORDE_SAIBAMAN", msg: "INVASÃO DE SAIBAMEN NA TERRA!", zone: "EARTH_CORE" }, { type: "INVASION_FRIEZA", msg: "FORÇAS DE FREEZA EM NAMEK!", zone: "NAMEK_VILLAGE" }, { type: "BOSS_BROLY", msg: "LENDA DO SUPER SAIYAJIN BROLY!", zone: "FUTURE_RUINS" }, { type: "BOSS_KID_BUU", msg: "MAJIN BUU ACORDOU NO INFERNO!", zone: "DEMON_GATE" } ];
    const ev = events[Math.floor(Math.random() * events.length)]; const zone = DOMINATION_ZONES.find(z => z.id === ev.zone) || DOMINATION_ZONES[0]; io.emit("fx", { type: "bp_limit", x: zone.x, y: zone.y, text: ev.msg }); eventActive = true;
    if(ev.type.includes("HORDE")) { for(let i=0; i<15; i++) { const mob = spawnMobAt(zone.x + (Math.random()-0.5)*1000, zone.y + (Math.random()-0.5)*1000, true); mob.name = "SAIBAMAN FURIOSO"; mob.color = "#0f0"; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("INVASION")) { for(let i=0; i<10; i++) { const mob = spawnMobAt(zone.x + (Math.random()-0.5)*800, zone.y + (Math.random()-0.5)*800, true); mob.name = "ELITE FREEZA"; mob.color = "#808"; mob.hp *= 2; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("BOSS")) { let bossType = ev.type === "BOSS_BROLY" ? "LEGENDARY_BROLY" : "KID_BUU"; const boss = spawnBossAt(zone.x, zone.y, bossType); boss.hp *= 3; boss.bp *= 2; eventMobIds.push(boss.id); }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    chats = chats.filter(c => { c.life--; return c.life > 0; });
    leaderboard = Object.values(players).sort((a,b) => b.pvp_score - a.pvp_score).slice(0,5).map(p => ({name: p.name, score: p.pvp_score, guild: p.guild}));
    globalEventTimer++; if(globalEventTimer > 5000) { triggerRandomEvent(); globalEventTimer = 0; }

    DOMINATION_ZONES.forEach(zone => {
        let contesting = []; Object.values(players).forEach(p => { if(!p.isDead && !p.isSpirit && Math.hypot(p.x - zone.x, p.y - zone.y) < zone.radius) contesting.push(p); });
        if(contesting.length > 0) { let dominant = contesting[0]; let sameSide = contesting.every(c => (c.guild && c.guild === dominant.guild) || c.id === dominant.id); if(sameSide) { if(zone.owner === (dominant.guild || dominant.name)) { dominant.xp += 1; } else { zone.progress += 1; if(zone.progress >= 100) { zone.owner = dominant.guild || dominant.name; zone.guild = dominant.guild; zone.progress = 0; io.emit("fx", { type: "bp_limit", x: zone.x, y: zone.y, text: "DOMINADO POR " + zone.owner }); if(!dominant.guild) { let unlocked = dominant.titles.split(','); if(!unlocked.includes("Conquistador")) { dominant.titles += ",Conquistador"; io.to(dominant.id).emit("fx", { type: "bp_limit", x: dominant.x, y: dominant.y, text: "TÍTULO: CONQUISTADOR" }); } } } } } else { zone.state = "WAR"; } } else { if(zone.progress > 0) zone.progress--; zone.state = "PEACE"; }
    });

    Object.values(players).forEach(p => {
        if(p.stun > 0) p.stun--; if(p.attackLock > 0) p.attackLock--; if(p.comboTimer > 0) p.comboTimer--; if(p.counterWindow > 0) p.counterWindow--;
        p.x += p.vx; p.y += p.vy; p.vx *= 0.82; p.vy *= 0.82; 
        if (!p.isDead && !p.isSpirit) {
            p.bp += 1 + Math.floor(p.level * 0.1); clampBP(p);
            if (p.state === "CHARGING") { if (Math.random() > 0.85) { p.xp += 1;
p.xpToNext = p.level * 800;
 p.bp += 5; clampBP(p); } const xpReq = p.level * 800; if(p.xp >= xpReq) { p.level++; p.xp = 0; p.bp += 5000; clampBP(p); p.baseMaxHp += 1000; p.baseMaxKi += 100; const stats = FORM_STATS[p.form] || FORM_STATS["BASE"]; p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult; p.hp = p.maxHp; p.ki = p.maxKi; p.xpToNext = p.level * 800; io.emit("fx", { type: "levelup", x: p.x, y: p.y }); if(isRender) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [p.level, p.xp, p.bp, p.name]).catch(e => console.error(e)); } } 
            else if(p.ki < p.maxKi && p.state === "IDLE") { p.ki += 0.5; }
            const distToKingKai = Math.hypot(p.x - 0, p.y + 20000); if (distToKingKai < 1500) { p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.05)); p.ki = Math.min(p.maxKi, p.ki + (p.maxKi * 0.05)); }
        }
        if (p.bp >= getMaxBP(p)) { if (!p.bpCapped) { p.bpCapped = true; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "BP NO LIMITE" }); } } else { p.bpCapped = false; }

        // MÓDULO SOCIAL: Lógica de Espírito e Reanimação
        if (p.isSpirit) {
            if(p.reviveTimer > 0) {
                p.reviveTimer--;
                // Se algum jogador vivo tocar nele, revive
                Object.values(players).forEach(hero => {
                    if(hero.id !== p.id && !hero.isSpirit && !hero.isDead && Math.hypot(hero.x - p.x, hero.y - p.y) < 50) {
                        p.isSpirit = false; p.hp = p.maxHp * 0.3; p.reviveTimer = 0; // Revive
                        io.emit("fx", { type: "transform", x: p.x, y: p.y, form: "BASE" });
                        io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: hero.name + " RESGATOU " + p.name + "!" });
                    }
                });
            } else {
                // Tempo acabou, vai pro Kaioh
                p.ki = p.maxKi; p.x = 0; p.y = -6000; p.vx = 0; p.vy = 0;
                const distToKingKai = Math.hypot(p.x - 0, p.y + 20000); 
                if (distToKingKai < 1000) { p.hp = Math.min(p.maxHp, p.hp + 20); p.ki = Math.min(p.maxKi, p.ki + 5); if (distToKingKai < 300) { p.isSpirit = false; p.hp = p.maxHp; p.ki = p.maxKi; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); io.emit("fx", { type: "levelup", x: 0, y: 0 }); } }
            }
        }
    });

    npcs.forEach(n => {
    if (n.isDead) return;

    // ======================
    // STUN
    // ======================
    if (n.stun > 0) {
        n.stun--;
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.state = "STUNNED";
        return;
    }

    // ======================
    // AQUISIÇÃO DE ALVO
    // ======================
    let target = null;
    let minDist = n.aggro || 1200;

    if (
        n.targetId &&
        players[n.targetId] &&
        !players[n.targetId].isDead &&
        !players[n.targetId].isSpirit
    ) {
        const t = players[n.targetId];
        if (Math.hypot(n.x - t.x, n.y - t.y) < 3000) {
            target = t;
        } else {
            n.targetId = null;
        }
    }

    if (!target) {
        for (const p of Object.values(players)) {
            if (p.isDead || p.isSpirit) continue;
            if (Math.abs(p.x - n.x) > minDist || Math.abs(p.y - n.y) > minDist) continue;
            const d = Math.hypot(n.x - p.x, n.y - p.y);
            if (d < minDist) {
                minDist = d;
                target = p;
            }
        }
    }

    if (!target) {
        n.state = "IDLE";
        n.vx *= 0.95;
        n.vy *= 0.95;
        n.x += n.vx;
        n.y += n.vy;
        return;
    }

    // ======================
    // BASE DE MOVIMENTO
    // ======================
    const dx = target.x - n.x;
    const dy = target.y - n.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    n.angle = ang;

    const MAX_SPEED = n.isBoss ? 22 : 16;
    const ATTACK_RANGE = n.isBoss ? 170 : 100;
    const PRESSURE_RANGE = 55;

    // ======================
    // IA ESPECIAL DE BOSS
    // ======================
    if (n.isBoss) {

        // init seguro
        if (!n.phase) n.phase = 1;
        if (!n.pushStreak) n.pushStreak = 0;
        if (!n.lastDash) n.lastDash = 0;

        // fases por vida
        const hpPerc = n.hp / n.maxHp;
        if (hpPerc <= BOSS_PHASES.PHASE_3.hp) n.phase = 3;
else if (hpPerc <= BOSS_PHASES.PHASE_2.hp) n.phase = 2;

        else n.phase = 1;

        // ANTI LOCK: força pausa após empurrões seguidos
        if (n.pushStreak >= 3) {
            n.vx *= 0.2;
            n.vy *= 0.2;
            n.state = "IDLE";
            n.pushStreak = 0;
            n.x += n.vx;
            n.y += n.vy;
            return;
        }

        // DASH CONTROLADO (não infinito)
        if (
            dist > ATTACK_RANGE &&
            dist < 420 &&
            Date.now() - n.lastDash > 800
        ) {
            const dashSpd = n.phase === 3 ? 28 : 20;
            n.vx += Math.cos(ang) * dashSpd;
            n.vy += Math.sin(ang) * dashSpd;
            n.state = "ATTACKING";
            n.lastDash = Date.now();
        }
    }

    // ======================
    // COMPORTAMENTO PADRÃO
    // ======================
    if (dist > ATTACK_RANGE) {
        n.state = "CHASE";
        const burst = n.isBoss ? 2.8 : 3.6; // boss menos acelerado
        n.vx += Math.cos(ang) * burst;
        n.vy += Math.sin(ang) * burst;

    } else if (dist < PRESSURE_RANGE) {
        n.state = "PRESSURE";
        n.vx -= Math.cos(ang) * 1.4;
        n.vy -= Math.sin(ang) * 1.4;

    } else if (
    Date.now() - n.lastAtk > 650 &&
    (!target.lastHit || Date.now() - target.lastHit > 400)
) {


        n.lastAtk = Date.now();
        n.state = "ATTACKING";

        let dmg = (n.level * 10) + (n.isBoss ? 100 : 30);

        if (target.state === "BLOCKING") {
    dmg *= 0.3;
    target.ki -= 14;
    target.counterWindow = 14;
}

target.hp -= dmg;
if (target.hp < 0) target.hp = 0;

target.lastHit = Date.now();

if (!target.stunImmune || Date.now() > target.stunImmune) {
    target.stun = n.isBoss ? 10 : 4;
    target.stunImmune = Date.now() + 700;
}



        // PUSH CONTROLADO (SEM LOCK)
        const push = n.isBoss
            ? (n.phase === 3 ? 45 : 25)
            : 15;

        target.vx = Math.cos(ang) * push;
        target.vy = Math.sin(ang) * push;

        if (n.isBoss) n.pushStreak++;

        io.emit("fx", {
            type: n.isBoss ? "heavy" : "hit",
            x: target.x,
            y: target.y,
            dmg: Math.floor(dmg)
        });

        n.vx *= 0.25;
        n.vy *= 0.25;

        if (target.hp <= 0) handleKill(n, target);
    }

    // ======================
    // LIMITES FÍSICOS
    // ======================
    const speed = Math.hypot(n.vx, n.vy);
    if (speed > MAX_SPEED) {
        const s = MAX_SPEED / speed;
        n.vx *= s;
        n.vy *= s;
    }

    n.x += n.vx;
    n.y += n.vy;
    n.vx *= 0.92;
    n.vy *= 0.92;
});


    projectiles.forEach((pr, i) => {
        pr.x += pr.vx; pr.y += pr.vy; pr.life--; let hit = false;
        [...Object.values(players), ...npcs].forEach(t => {
            if (!hit && t.id !== pr.owner && !t.isSpirit && !t.isDead) {
                if(Math.abs(pr.x - t.x) > 150 || Math.abs(pr.y - t.y) > 150) return;
                const dist = Math.hypot(pr.x - t.x, pr.y - t.y);
                if (dist < (45 + pr.size)) { if(!t.isNPC && !pr.pvp) return; if(t.isNPC) t.targetId = pr.owner; let dmg = pr.dmg; if (!t.isNPC) dmg *= 0.5; if (!t.lastHit || Date.now() - t.lastHit > 300) {
    t.hp -= dmg; if (t.hp < 0) t.hp = 0;
    t.stun = 6;
    t.lastHit = Date.now();
} hit = true; io.emit("fx", { type: pr.isSuper ? "heavy" : "hit", x: pr.x, y: pr.y, dmg: Math.floor(dmg) }); const owner = players[pr.owner] || npcs.find(n => n.id === pr.owner) || {}; if (t.hp <= 0) handleKill(owner, t); }
            }
        });
        if(!hit) { for(let rIdx = rocks.length-1; rIdx >= 0; rIdx--) { let r = rocks[rIdx]; if(Math.abs(pr.x - r.x) > 150 || Math.abs(pr.y - r.y) > 150) continue; const dist = Math.hypot(pr.x - r.x, pr.y - r.y); if(dist < (r.r + pr.size)) { hit = true; r.hp -= pr.dmg; io.emit("fx", { type: "hit", x: pr.x, y: pr.y, dmg: Math.floor(pr.dmg) }); if(r.hp <= 0) { rocks.splice(rIdx, 1); io.emit("fx", { type: "heavy", x: r.x, y: r.y }); craters.push({ x: r.x, y: r.y, r: r.r, life: 1000 }); } break; } } }
        if (hit || pr.life <= 0) projectiles.splice(i, 1);
    });

    Object.keys(players).forEach(id => { const st = packStateForPlayer(id); if(st) io.to(id).emit("state", st); });
}, TICK);

server.listen(3000, () => console.log("Dragon Bolt Z - MMO Edition Online"));