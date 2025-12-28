const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [] }).write();

const TICK = 24; 
const players = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];

// ==================================================================================
// BESTIARIO COMPLETO: DB, DBZ, DBGT, DBS, DAIMA
// ==================================================================================
const BESTIARY = {
    // --- CENTRO: DRAGON BALL CLÁSSICO ---
    ORIGINS: { 
        mobs: ["RR_SOLDIER", "WOLF_BANDIT", "DINOSAUR", "TAMBOURINE"], 
        bosses: ["TAO_PAI_PAI", "KING_PICCOLO", "PICCOLO_JR", "GENERAL_BLUE"] 
    },

    // --- ANEL 1: DRAGON BALL Z (5k - 15k dist) ---
    SAIYAN_SAGA: { 
        mobs: ["SAIBAMAN", "FRIEZA_SCOUT", "RADITZ_MINION"], 
        bosses: ["RADITZ", "NAPPA", "VEGETA_SCOUTER"] 
    },
    NAMEK_SAGA: { 
        mobs: ["FRIEZA_SOLDIER", "NAMEK_WARRIOR", "DODORIA_ELITE", "ZARBON_MONSTER"], 
        bosses: ["CAPTAIN_GINYU", "FRIEZA_FINAL", "FRIEZA_FULL_POWER"] 
    },
    ANDROID_SAGA: { 
        mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR", "MECHA_GUARD"], 
        bosses: ["ANDROID_17", "ANDROID_18", "ANDROID_16", "PERFECT_CELL"] 
    },
    MAJIN_SAGA: { 
        mobs: ["PUIPUI", "YAKON", "MAJIN_SOLDIER", "BABIDI_GUARD"], 
        bosses: ["DABURA", "MAJIN_VEGETA", "FAT_BUU", "KID_BUU"] 
    },

    // --- ANEL 2: FILMES E GT (15k - 30k dist) ---
    MOVIES_ZONE: {
        mobs: ["COOLER_SQUAD", "TURLES_CRUSHER", "BOJACK_GANG", "BIO_WARRIOR"],
        bosses: ["COOLER_METAL", "LEGENDARY_BROLY", "JANEMBA", "HIRUDEGARN"]
    },
    GT_ZONE: {
        mobs: ["MACHINE_MUTANT", "SIGMA_FORCE", "HELL_FIGHTER_17", "SHADOW_DRAGON_MINION"],
        bosses: ["BABY_VEGETA", "SUPER_17", "NUOVA_SHENRON", "OMEGA_SHENRON"]
    },

    // --- ANEL 3: DRAGON BALL SUPER (30k - 50k dist) ---
    GODS_ZONE: {
        mobs: ["RESURRECTED_SOLDIER", "FROST_DEMON", "U6_BOTAMO", "U6_MAGETTA"],
        bosses: ["GOLDEN_FRIEZA", "HIT_ASSASSIN", "BEERUS", "CHAMPA"]
    },
    FUTURE_ZONE: {
        mobs: ["ZAMASU_CLONE", "RESISTANCE_FIGHTER", "GOKU_BLACK_CLONE"],
        bosses: ["GOKU_BLACK_ROSE", "ZAMASU_FUSED", "VEGITO_BLUE_ECHO"]
    },
    TOP_ZONE: { // Torneio do Poder
        mobs: ["PRIDE_TROOPER", "KAMIKAZE_FIREBALL", "U9_WOLF", "U3_ROBOT"],
        bosses: ["KEFLA", "TOPPO_GOD", "JIREN_FULL_POWER", "ANIRAZA"]
    },
    MORO_GRANOLAH: {
        mobs: ["GALACTIC_PRISONER", "SEVEN_THREE_CLONE", "HEETER_GANG"],
        bosses: ["MORO_YOUNG", "MORO_ANGEL", "GRANOLAH", "GAS_HEETER"]
    },

    // --- BORDA EXTERNA: DAIMA & DIVINO (> 50k dist) ---
    DAIMA_REALM: {
        mobs: ["GOMAH_SOLDIER", "MASKED_MAJIN", "MINI_DEMON", "GLORIO_DRONE"],
        bosses: ["KING_GOMAH", "DEGESU", "DR_ARINSU", "GLORIO"] // Personagens Daima
    },
    ANGEL_VOID: {
        mobs: ["ANGEL_TRAINEE", "GRAND_PRIEST_GUARD", "ZENO_GUARD"],
        bosses: ["WHIS", "VADOS", "GRAND_PRIEST", "ZENO_SAMAS"]
    }
};

// =========================
// AUXILIAR DE COMBATE
// =========================
function findSnapTarget(p) {
    let best = null;
    let bestScore = Infinity;
    const entities = [...Object.values(players), ...npcs];

    entities.forEach(t => {
        if (t.id === p.id || t.isDead || t.isSpirit) return;
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > 320) return;

        const angToT = Math.atan2(t.y - p.y, t.x - p.x);
        let diff = Math.abs(angToT - p.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        if (diff < 2.3) { 
            const score = d + diff * 250;
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        }
    });
    return best;
}

// ==================================================================================
// NOVA LÓGICA DE ZONAS (MAPEAMENTO COMPLETO)
// ==================================================================================
function getZoneInfo(x, y) {
    const dist = Math.hypot(x, y);
    let level = 1 + Math.floor(dist / 1500); 

    // --- ZONA CENTRAL (0 - 5000) ---
    if (dist < 5000) return { id: "ORIGINS", level: Math.max(1, level) };

    // --- ANEL INTERNO: DBZ (5000 - 15000) ---
    if (dist < 15000) {
        if(x > 0 && Math.abs(y) < x) return { id: "NAMEK_SAGA", level }; // Leste
        if(x < 0 && Math.abs(y) < Math.abs(x)) return { id: "ANDROID_SAGA", level }; // Oeste
        if(y > 0) return { id: "MAJIN_SAGA", level }; // Sul
        return { id: "SAIYAN_SAGA", level }; // Norte
    }

    // --- ANEL MÉDIO: GT E FILMES (15000 - 30000) ---
    if (dist < 30000) {
        if(y < 0) return { id: "GT_ZONE", level }; // Norte (GT)
        return { id: "MOVIES_ZONE", level }; // Resto (Filmes)
    }

    // --- ANEL EXTERNO: SUPER (30000 - 50000) ---
    if (dist < 50000) {
        if(x > 0 && Math.abs(y) < x) return { id: "GODS_ZONE", level }; // Battle of Gods / FnF
        if(x < 0 && Math.abs(y) < Math.abs(x)) return { id: "FUTURE_ZONE", level }; // Black Arc
        if(y > 0) return { id: "MORO_GRANOLAH", level }; // Manga Arcs
        return { id: "TOP_ZONE", level }; // Tournament of Power
    }

    // --- VAZIO / BORDA FINAL (> 50000) ---
    if (y < 0) return { id: "ANGEL_VOID", level: level + 50 }; // Norte Distante
    return { id: "DAIMA_REALM", level: level + 20 }; // O Reino dos Demônios (Daima)
}

// =========================
// WORLD INIT
// =========================
function initWorld() {
    // Gerar rochas em todo o mapa gigante
    for(let i=0; i<1200; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 60000; // Mapa expandido
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const zone = getZoneInfo(x, y);

        let type = "rock_earth";
        if(zone.id.includes("NAMEK")) type = "rock_namek";
        if(zone.id.includes("ANDROID") || zone.id.includes("GT")) type = "rock_city";
        if(zone.id.includes("MAJIN") || zone.id.includes("DAIMA")) type = "rock_magic";
        if(zone.id.includes("GOD") || zone.id.includes("TOP") || zone.id.includes("VOID")) type = "rock_god";

        rocks.push({ id: i, x, y, r: 30 + Math.random() * 80, hp: 200 + (dist/100), type });
    }

    for(let i=0; i<350; i++) spawnMobRandomly();

    // Spawnar Bosses Iniciais em pontos cardeais
    spawnBossAt(0, -3000); // Piccolo Daimaoh (Norte Perto)
    spawnBossAt(10000, 0); // Frieza (Leste)
    spawnBossAt(-10000, 0); // Cell (Oeste)
    spawnBossAt(0, 10000); // Buu (Sul)
    spawnBossAt(0, -20000); // Omega Shenron (Norte Longe)
    spawnBossAt(0, 40000); // Jiren (Sul Muito Longe)
}

function spawnMobRandomly() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1000 + Math.random() * 55000; 
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    spawnMobAt(x, y);
}

// =========================
// MOBS / BOSSES (COM CORES NOVAS)
// =========================
function spawnMobAt(x, y) {
    const zone = getZoneInfo(x, y);
    const list = BESTIARY[zone.id].mobs;
    const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);

    let stats = { 
        name: type, hp: 500 * zone.level, bp: 1000 * zone.level,
        level: zone.level, color: "#fff",
        aggro: 700 + (zone.level * 10), aiType: "MELEE"
    };

    // --- CORES E IA POR SAGA ---
    // Clássico
    if(type.includes("RR_")) stats.color = "#555";
    if(type.includes("DINOSAUR")) stats.color = "#484";
    
    // Z
    if(type === "SAIBAMAN") { stats.color = "#4a4"; stats.aiType = "SWARM"; }
    if(type.includes("FRIEZA")) { stats.color = "#848"; stats.aiType = "RANGED"; }
    if(type === "CELL_JR") { stats.color = "#38a"; stats.aiType = "AGGRESSIVE"; }
    if(type.includes("MAJIN")) stats.color = "#fbb";

    // GT
    if(type.includes("MACHINE") || type.includes("SIGMA")) { stats.color = "#aaa"; stats.aiType = "TANK"; } // Metal
    if(type.includes("SHADOW")) stats.color = "#224"; // Shadow Dragons (Azul escuro)

    // Super
    if(type.includes("ZAMASU") || type.includes("BLACK")) stats.color = "#fcc"; // Rose aura hint
    if(type.includes("PRIDE")) stats.color = "#d22"; // Vermelho Jiren
    if(type.includes("HEETER") || type.includes("PRISONER")) stats.color = "#642";

    // Daima
    if(type.includes("GOMAH") || type.includes("DEMON")) stats.color = "#909"; // Roxo Demônio
    if(type.includes("GLORIO")) stats.color = "#00f";

    // Anjos
    if(type.includes("ANGEL")) stats.color = "#aaf";

    npcs.push({
        id, isNPC: true, r: 25, x, y, vx: 0, vy: 0,
        maxHp: stats.hp, hp: stats.hp,
        ki: 200, maxKi: 200,
        level: stats.level, bp: stats.bp,
        state: "IDLE", color: stats.color,
        lastAtk: 0, combo: 0, stun: 0,
        name: stats.name, zoneId: zone.id,
        aiType: stats.aiType
    });
}

function spawnBossAt(x, y) {
    const zone = getZoneInfo(x, y);
    const bosses = BESTIARY[zone.id].bosses;
    const type = bosses[Math.floor(Math.random() * bosses.length)];

    let stats = { name: type, hp: 15000 * zone.level, bp: 60000 * zone.level, color: "#f00", r: 60 };

    // --- CORES DE BOSSES ---
    if(type.includes("VEGETA")) stats.color = "#33f";
    if(type.includes("FRIEZA")) stats.color = "#fff"; // Golden será tratado no game.js pelo nome
    if(type.includes("CELL")) stats.color = "#484";
    if(type.includes("BUU")) stats.color = "#fbb";
    
    // GT
    if(type.includes("BABY")) stats.color = "#ddd";
    if(type.includes("OMEGA")) stats.color = "#fff"; // Branco/Azul
    
    // Super
    if(type.includes("BLACK") || type.includes("ROSE")) stats.color = "#333";
    if(type.includes("JIREN") || type.includes("TOPPO")) stats.color = "#f22";
    if(type.includes("BROLY")) stats.color = "#2f2";
    if(type.includes("MORO")) stats.color = "#346";
    if(type.includes("GAS")) stats.color = "#622";
    
    // Daima
    if(type.includes("GOMAH")) stats.color = "#fdd"; // Pele clara/demoníaca
    if(type.includes("GLORIO")) stats.color = "#22d";

    npcs.push({
        id: "BOSS_" + zone.id + "_" + Date.now(),
        name: type, isNPC: true, isBoss: true,
        x, y, vx: 0, vy: 0,
        maxHp: stats.hp, hp: stats.hp,
        ki: 5000, maxKi: 5000,
        level: zone.level + 10, bp: stats.bp,
        state: "IDLE", color: stats.color,
        lastAtk: 0, combo: 0, stun: 0
    });
}

initWorld();

// =========================
// SERVER HTTP & SOCKET.IO
// =========================
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
    const R = 4500; // Raio aumentado para ver mais coisas
    const inRange = (o) => Math.hypot(o.x - p.x, o.y - p.y) < R;
    const np = npcs.filter(inRange);
    const rk = rocks.filter(inRange);
    const pr = projectiles.filter(inRange);
    return { players, npcs: np, projectiles: pr, rocks: rk, craters };
}

io.on("connection", (socket) => {
    socket.on("login", (data) => {
        let user = db.get('users').find({ name: data.user }).value();
        if(!user) {
            user = { name: data.user, pass: data.pass, level: 1, xp: 0, bp: 500, maxLevelReached: 1 };
            db.get('users').push(user).write();
        } else if(user.pass !== data.pass) return;

        const xpToNext = user.level * 800;
        players[socket.id] = {
            ...user, id: socket.id, r: 20,
            x: 0, y: 0, vx: 0, vy: 0, angle: 0,
            hp: 1000 + (user.level * 200), maxHp: 1000 + (user.level * 200),
            ki: 100, maxKi: 100 + (user.level * 10), form: "BASE",
            xpToNext: xpToNext,
            state: "IDLE", combo: 0, comboTimer: 0, attackLock: 0, counterWindow: 0,
            lastAtk: 0, isDead: false, isSpirit: false, stun: 0,
            color: "#ff9900", chargeStart: 0
        };
        socket.emit("auth_success", players[socket.id]);
    });

    socket.on("input", (input) => {
        const p = players[socket.id];
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
        
        if (p.attackLock <= 0) {
            p.angle = input.angle;
        }

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
    if(!p || p.isSpirit || p.stun > 0) return;

    let target = findSnapTarget(p);

    if (!target) {
        let best = null, bestDist = 220;
        [...Object.values(players), ...npcs].forEach(t => {
            if(t.id === p.id || t.isDead || t.isSpirit) return;
            const d = Math.hypot(t.x - p.x, t.y - p.y);
            if(d < bestDist) {
                bestDist = d;
                best = t;
            }
        });
        target = best;
    }

    if (target) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        p.angle = Math.atan2(dy, dx);
        const ideal = 55;
        const dist = Math.hypot(dx, dy);
        if (dist > ideal) {
            const pull = Math.min(80, dist - ideal);
            p.vx = Math.cos(p.angle) * pull;
            p.vy = Math.sin(p.angle) * pull;
        }
    }

    const charged = (Date.now() - p.chargeStart) > 600;
    p.state = "ATTACKING";
    p.attackLock = 14;
    p.lastAtk = Date.now();

    const hitRadius = charged ? 130 : 100;
    const hitAngle = 2.6; 
    let hitSomeone = false;

    [...Object.values(players), ...npcs].forEach(t => {
        if(t.id === p.id || t.isDead || t.isSpirit) return;

        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > hitRadius) return;

        const ang = Math.atan2(dy, dx);
        let diff = Math.abs(ang - p.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        if (diff > hitAngle) return;

        hitSomeone = true;

        let dmg = Math.floor(
            (50 + p.level * 9) *
            (charged ? 3.2 : (1 + p.combo * 0.3))
        );

        if(t.state === "BLOCKING") {
            dmg *= 0.25;
            t.ki -= 12;
            t.counterWindow = 12;
        }

        t.hp -= dmg;
        t.stun = charged ? 26 : 14;

        const push = charged ? 140 : 65;
        t.vx = Math.cos(p.angle) * push;
        t.vy = Math.sin(p.angle) * push;

        io.emit("fx", {
            type: charged ? "heavy" : "hit",
            x: t.x,
            y: t.y,
            dmg
        });

        if(charged) {
            craters.push({ x: t.x, y: t.y, r: 45, life: 1200 });
        }

        if(t.hp <= 0) handleKill(p, t);
    });

    if (!hitSomeone) {
        p.combo = Math.max(0, p.combo - 1);
    } else {
        p.combo = (p.combo + 1) % 6;
        p.comboTimer = 24;
    }

    setTimeout(() => {
        if(p) p.state = "IDLE";
    }, 220);
});

    socket.on("release_blast", () => {
        const p = players[socket.id];
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
        if(!p || p.isSpirit || p.ki < 20 || p.stun > 0) return;
        p.ki -= 20; p.x += Math.cos(p.angle)*350; p.y += Math.sin(p.angle)*350;
        io.emit("fx", { type: "vanish", x: p.x, y: p.y });
    });

    socket.on("transform", () => {
        const p = players[socket.id];
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
                killer.xpToNext = killer.level * 800; 
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
        victim.isSpirit = true;
        victim.hp = 1; 
        victim.x = 0; victim.y = -2100; 
        victim.vx = 0; victim.vy = 0;
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
    }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    Object.values(players).forEach(p => {
        if(p.stun > 0) p.stun--;
        if(p.attackLock > 0) p.attackLock--;
        if(p.comboTimer > 0) p.comboTimer--;
        if(p.counterWindow > 0) p.counterWindow--;

        p.x += p.vx; p.y += p.vy; 
        p.vx *= 0.82; p.vy *= 0.82; 

        if(p.y < -5000) p.vy += 0.05;

        if(!p.isSpirit) {
            if(p.state === "CHARGING") {
                if(Math.random() > 0.85) { p.xp += 1; p.bp += 1; }
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
    
        if (p.isSpirit && p.y < -7500) { 
            const distToCenter = Math.hypot(p.x - 0, p.y - (-8000));
            if (distToCenter < 100) { 
                p.isSpirit = false;
                p.hp = p.maxHp; p.ki = p.maxKi;
                p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
                io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); 
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
            if(dist > (n.isBoss ? 150 : 60)) { 
                n.vx += Math.cos(ang)*3.5; n.vy += Math.sin(ang)*3.5; n.state = "MOVING";
            } else if(Date.now() - n.lastAtk > 1000) {
                n.lastAtk = Date.now(); n.state = "ATTACKING";
                let dmg = n.level * 10;
                if(target.state === "BLOCKING") { dmg *= 0.2; target.ki -= 10; target.counterWindow = 10; }
                target.hp -= dmg; target.stun = 10;
                target.vx = Math.cos(ang)*40; target.vy = Math.sin(ang)*40;
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
    Object.keys(players).forEach(id=>{ const st = packStateForPlayer(id); if(st) io.to(id).emit('state', st); });
}, TICK);

server.listen(3000, () => console.log("Dragon Bolt Universe Online"));