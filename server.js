const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

// ==========================================
// BANCO DE DADOS (PostgreSQL + Fallback RAM)
// ==========================================
let pool = null;
let Pool = null;

try {
    ({ Pool } = require("pg"));
} catch (e) {
    console.log(">> MÓDULO 'pg' NÃO ENCONTRADO. Rodando 100% em memória (RAM).");
}

async function initDB() {
    if (!Pool || !process.env.DATABASE_URL) {
        console.log(">> AVISO: DATABASE_URL ausente. Usando RAM.");
        pool = null;
        return;
    }

    try {
        console.log(">> Conectando ao PostgreSQL...");
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, 
            connectionTimeoutMillis: 5000
        });

        await pool.query("SELECT 1"); // Teste de conexão

        // ==========================================================
        // MIGRATION: Garante que a tabela tenha todas as colunas novas
        // ==========================================================
        let tableCheck;
        try {
            tableCheck = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='titles';
            `);
        } catch (e) { tableCheck = { rowCount: 0 }; }

        if (tableCheck.rowCount === 0) {
            console.log(">> SCHEMA ANTIGO DETECTADO. ATUALIZANDO DB...");
            await pool.query("DROP TABLE IF EXISTS users CASCADE");
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                name TEXT,
                password TEXT NOT NULL,
                x INT DEFAULT 0,
                y INT DEFAULT 0,
                level INT DEFAULT 1,
                xp INT DEFAULT 0,
                bp BIGINT DEFAULT 500,
                saga_step INT DEFAULT 0,
                form TEXT DEFAULT 'BASE',
                hp INT DEFAULT 1000,
                max_hp INT DEFAULT 1000,
                ki INT DEFAULT 300,
                max_ki INT DEFAULT 300,
                pvp_score INT DEFAULT 0,
                pvp_kills INT DEFAULT 0,
                rebirths INT DEFAULT 0,
                quest_data JSONB DEFAULT '{}',
                guild TEXT,
                titles TEXT DEFAULT 'Novato',
                current_title TEXT DEFAULT 'Novato',
                skills JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS planets (
                id TEXT PRIMARY KEY,
                owner TEXT,
                guild TEXT,
                stability INT DEFAULT 100,
                tax_rate INT DEFAULT 5,
                treasury INT DEFAULT 0
            );
        `);

        console.log(">> MODO ONLINE REAL: Postgres conectado e tabelas verificadas.");

    } catch (err) {
        console.error(">> ERRO FATAL NO DB:", err.message);
        pool = null;
    }
}

// ==========================================
// SISTEMA DE SALVAMENTO (THROTTLED)
// ==========================================
const SAVE_THROTTLE = 15000; // Salva a cada 15s para não travar o server

async function saveAccount(p, force = false) {
    if (!pool || !p) return;
    
    const now = Date.now();
    // Só salva se for forçado (ex: sair, level up) ou se passou o tempo
    if (!force && p.lastSave && (now - p.lastSave < SAVE_THROTTLE)) return; 

    try {
        const questJson = JSON.stringify(p.quest || {});
        const skillsJson = JSON.stringify(p.skills || []);
        
        await pool.query(`
            INSERT INTO users (
                username, name, password,
                x, y, level, xp, bp,
                hp, ki, max_hp, max_ki,
                form, saga_step, quest_data,
                titles, current_title,
                pvp_score, pvp_kills, rebirths,
                guild, skills
            ) VALUES (
                $1, $2, $3,
                $4, $5, $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15,
                $16, $17,
                $18, $19, $20,
                $21, $22
            )
            ON CONFLICT (username) DO UPDATE SET
                x=$4, y=$5, level=$6, xp=$7, bp=$8,
                hp=$9, ki=$10, max_hp=$11, max_ki=$12,
                form=$13, saga_step=$14, quest_data=$15,
                titles=$16, current_title=$17,
                pvp_score=$18, pvp_kills=$19, rebirths=$20,
                guild=$21, skills=$22
        `, [
            p.username || p.name, p.name, p.password || "123",
            Math.round(p.x), Math.round(p.y), p.level, p.xp, p.bp,
            Math.floor(p.hp), Math.floor(p.ki), p.maxHp, p.maxKi,
            p.form, p.sagaStep, questJson,
            p.titles || "Novato", p.current_title || "Novato",
            p.pvp_score || 0, p.pvp_kills || 0, p.rebirths || 0,
            p.guild || null, skillsJson
        ]);
        
        p.lastSave = now;
    } catch (err) {
        console.error(`>> ERRO AO SALVAR ${p.name}:`, err.message);
    }
}

// ==========================================
// CONFIGURAÇÕES GERAIS E LORE (CANÔNICA)
// ==========================================
const SNAKE_WAY_START = { x: 0, y: -12000 };
const KAIOH_PLANET    = { x: 0, y: -25000 };
const TICK = 16; // 60hz SERVER SIDE (1000ms / 60 = ~16ms) - Fluidez total

const BOSS_PHASES = {
    PHASE_1: { hp: 0.65, aggression: 0.6 },
    PHASE_2: { hp: 0.35, aggression: 0.8 },
    PHASE_3: { hp: 0.0,  aggression: 1.0 }
};

let PLANETS = [
    { id: "EARTH_CORE", name: "Capital do Oeste", x: 2000, y: 2000, radius: 1200, owner: null, guild: null, faction: "EARTH_DEFENSE", stability: 100, taxRate: 5, treasury: 0, level: 1, biome: "EARTH" },
    { id: "KAME_ISLAND", name: "Casa do Kame", x: 6000, y: -4000, radius: 800, owner: null, guild: null, faction: "EARTH_DEFENSE", stability: 100, taxRate: 5, treasury: 0, level: 5, biome: "EARTH" },
    { id: "NAMEK_VILLAGE", name: "Nova Namek", x: -18000, y: 5000, radius: 1200, owner: null, guild: null, faction: "FRIEZA_FORCE", stability: 40, taxRate: 5, treasury: 0, level: 20, biome: "NAMEK" },
    { id: "GURU_HOUSE", name: "Casa do Patriarca", x: -22000, y: 8000, radius: 900, owner: null, guild: null, faction: "FRIEZA_FORCE", stability: 50, taxRate: 5, treasury: 0, level: 25, biome: "NAMEK" },
    { id: "FRIEZA_BASE", name: "Base Freeza 79", x: -35000, y: -10000, radius: 1500, owner: null, guild: null, faction: "FRIEZA_FORCE", stability: 100, taxRate: 10, treasury: 0, level: 40, biome: "FRIEZA" },
    { id: "FUTURE_RUINS", name: "Ruínas do Futuro", x: 15000, y: 0, radius: 1200, owner: null, guild: null, faction: "RED_RIBBON", stability: 20, taxRate: 5, treasury: 0, level: 50, biome: "FUTURE" },
    { id: "DEMON_GATE", name: "Portão Demoníaco", x: 0, y: 25000, radius: 1200, owner: null, guild: null, faction: "DEMONS", stability: 100, taxRate: 5, treasury: 0, level: 60, biome: "DEMON" },
    { id: "MAKAI_CORE", name: "Reino dos Demônios", x: 5000, y: 35000, radius: 1000, owner: null, guild: null, faction: "DEMONS", stability: 100, taxRate: 8, treasury: 0, level: 70, biome: "DEMON" },
    { id: "VAMPA_WASTES", name: "Deserto de Vampa", x: -45000, y: 15000, radius: 1400, owner: null, guild: null, faction: "SAIYAN_REBELS", stability: 60, taxRate: 2, treasury: 0, level: 80, biome: "VAMPA" },
    { id: "BEERUS_PLANET", name: "Planeta Bills", x: 0, y: -90000, radius: 2000, owner: null, guild: null, faction: "GODS", stability: 100, taxRate: 15, treasury: 0, level: 100, biome: "DIVINE" },
    { id: "ZEN_PALACE", name: "Palácio Zen-Oh", x: 0, y: -120000, radius: 3000, owner: null, guild: null, faction: "GODS", stability: 100, taxRate: 20, treasury: 0, level: 150, biome: "DIVINE" },
    { id: "KAIOH_PLANET", name: "Planeta Kaioh", x: 0, y: -25000, radius: 500, biome: "DIVINE", level: 1 }
];

// LORE OFICIAL (DBZ -> DBS)
const SAGA_STEPS = [
    { id: 0, title: "SAGA SAIYAJIN: A CHEGADA", objective: "LUMIA: 'Um guerreiro chamado Raditz ameaça a Terra. Ele está na Capital do Oeste.'", type: "KILL", target: "RADITZ", targetZone: "EARTH_CORE", hint: "Derrote Raditz na Terra." },
    { id: 1, title: "SAGA SAIYAJIN: O OUTRO MUNDO", objective: "LUMIA: 'Seu poder é baixo. Voe para o NORTE (Cima) até o Planeta do Sr. Kaioh.'", type: "VISIT", target: "KAIOH_PLANET", targetZone: "KAIOH_PLANET", hint: "Voe para o Norte além das nuvens." },
    { id: 2, title: "SAGA SAIYAJIN: TREINO GRAVITACIONAL", objective: "LUMIA: 'Kaioh vai te ensinar o Kaioken. Alcance 5.000 de BP treinando aqui.'", type: "BP", req: 5000, targetZone: "KAIOH_PLANET", hint: "Treine (C) até 5k BP." },
    { id: 3, title: "SAGA SAIYAJIN: O PRÍNCIPE", objective: "LUMIA: 'Vegeta e Nappa chegaram! Salve a Capital do Oeste!'", type: "KILL", target: "VEGETA_SCOUTER", targetZone: "EARTH_CORE", hint: "Volte para a Terra e vença Vegeta." },
    { id: 4, title: "SAGA NAMEKUSEI: VIAGEM", objective: "LUMIA: 'Precisamos das Esferas de Namek. Voe para o OESTE (Esquerda) profundo.'", type: "VISIT", target: "NAMEK_VILLAGE", targetZone: "NAMEK_VILLAGE", hint: "Voe para Esquerda (Oeste)." },
    { id: 5, title: "SAGA NAMEKUSEI: FORÇAS GINYU", objective: "LUMIA: 'Ginyu roubou as esferas para Freeza. Recupere-as.'", type: "KILL", target: "GINYU", targetZone: "NAMEK_VILLAGE", hint: "Derrote Ginyu em Namek." },
    { id: 6, title: "SAGA FREEZA: O IMPERADOR", objective: "LUMIA: 'Freeza está na Base 79 (Oeste). Vingue sua raça!'", type: "KILL", target: "FRIEZA_FINAL", targetZone: "FRIEZA_BASE", hint: "Voe mais a Oeste e mate Freeza." },
    { id: 7, title: "LENDÁRIO SUPER SAIYAJIN", objective: "LUMIA: 'A fúria é a chave. Atinja Nível 20 e aperte [G] para transformar.'", type: "FORM", target: "SSJ", targetZone: "ANY", hint: "Nvl 20 + Tecla G." },
    { id: 8, title: "SAGA ANDROIDES: O FUTURO", objective: "LUMIA: 'Trunks do Futuro alertou sobre ciborgues. Vá para as Ruínas a LESTE (Direita).'", type: "VISIT", target: "FUTURE_RUINS", targetZone: "FUTURE_RUINS", hint: "Voe para a Direita (Leste)." },
    { id: 9, title: "SAGA ANDROIDES: Nº 18", objective: "LUMIA: 'A Androide 18 está destruindo a cidade. Pare-a.'", type: "KILL", target: "ANDROID_18", targetZone: "FUTURE_RUINS", hint: "Derrote a Androide 18." },
    { id: 10, title: "SAGA CELL: PERFEIÇÃO", objective: "LUMIA: 'Cell alcançou a forma perfeita. Você precisa do SSJ2 (Nível 40) para vencer.'", type: "KILL", target: "PERFECT_CELL", targetZone: "FUTURE_RUINS", hint: "Vença Cell Perfeito." },
    { id: 11, title: "SAGA BUU: O MAGO", objective: "LUMIA: 'Babidi está tramando algo no SUL (Baixo). O Portão Demoníaco abriu.'", type: "VISIT", target: "DEMON_GATE", targetZone: "DEMON_GATE", hint: "Voe para Baixo (Sul)." },
    { id: 12, title: "SAGA BUU: O TERROR", objective: "LUMIA: 'Majin Buu acordou. Destrua-o antes que ele coma o universo.'", type: "KILL", target: "FAT_BUU", targetZone: "MAKAI_CORE", hint: "Vença Buu Gordo." },
    { id: 13, title: "SAGA BUU: FINAL", objective: "LUMIA: 'Kid Buu é puro mal. Use o SSJ3 (Nível 60) para desintegrá-lo.'", type: "KILL", target: "KID_BUU", targetZone: "MAKAI_CORE", hint: "Mate Kid Buu." },
    { id: 14, title: "SAGA SUPER: O DEUS", objective: "LUMIA: 'Bills, o Destruidor, acordou. Vá ao Extremo Norte cumprimentá-lo.'", type: "VISIT", target: "BEERUS_PLANET", targetZone: "BEERUS_PLANET", hint: "Voe MUITO para Norte." },
    { id: 15, title: "SAGA SUPER: TREINO WHIS", objective: "LUMIA: 'Whis vai te ensinar o Ki Divino. Atinja 1.000.000 de BP.'", type: "BP", req: 1000000, targetZone: "BEERUS_PLANET", hint: "Treine até 1 Milhão de BP." },
    { id: 16, title: "SAGA SUPER: GOLDEN FREEZA", objective: "LUMIA: 'Freeza ressuscitou e está Dourado na Base 79. Mande-o de volta pro inferno.'", type: "KILL", target: "GOLDEN_FRIEZA", targetZone: "FRIEZA_BASE", hint: "Vença Golden Freeza." },
    { id: 17, title: "SAGA SUPER: GOKU BLACK", objective: "LUMIA: 'Uma entidade parecida com você está atacando o Futuro. Vá para as Ruínas.'", type: "KILL", target: "GOKU_BLACK", targetZone: "FUTURE_RUINS", hint: "Vença Goku Black Rose." },
    { id: 18, title: "SAGA SUPER: JIREN", objective: "LUMIA: 'Torneio do Poder no Palácio Zen-Oh (Acima de Bills). Jiren é o alvo.'", type: "KILL", target: "JIREN_FULL_POWER", targetZone: "ZEN_PALACE", hint: "Vença Jiren." },
    { id: 19, title: "SAGA SUPER: BROLY", objective: "LUMIA: 'Um Saiyajin lendário apareceu em Vampa (Oeste Distante). Cuidado.'", type: "KILL", target: "LEGENDARY_BROLY", targetZone: "VAMPA_WASTES", hint: "Vença Broly Full Power." },
    { id: 20, title: "INSTINTO SUPERIOR", objective: "LUMIA: 'Atingiu o ápice. Alcance Nível 100 para o Ultra Instinct [UI].'", type: "FORM", target: "UI", targetZone: "ANY", hint: "Domine o UI." }
];

class LumiaAI {
    constructor(player) {
        this.player = player;
        this.lastMessageTime = 0;
    }
    evaluate(io) {
        const now = Date.now();
        if (now - this.lastMessageTime < 15000) return; // Menos spam

        const p = this.player;
        const currentSaga = SAGA_STEPS[p.sagaStep] || SAGA_STEPS[SAGA_STEPS.length - 1];
        
        let msg = null;
        let type = "INFO"; 

        const dist = this.getDistanceToTarget(p, currentSaga);
        
        if (dist !== null && dist > 4000) {
            const dir = this.getDirectionText(p, currentSaga);
            msg = `LUMIA: "Guerreiro, seu objetivo está longe. Siga para ${dir}."`;
            type = "WARN";
        } else if (dist !== null && dist < 3000) {
             msg = `LUMIA: "Zona alvo alcançada. ${currentSaga.hint}"`;
             type = "SUCCESS";
        }

        if (!msg && p.hp < p.maxHp * 0.25) {
            msg = "LUMIA: 'ALERTA DE VIDA! Recue e recarregue!'";
            type = "DANGER";
        }

        if (msg) {
            this.sendMessage(io, msg, type);
        }
    }
    getDistanceToTarget(p, saga) {
        if (!saga.targetZone || saga.targetZone === "ANY") return null;
        const target = PLANETS.find(pl => pl.id === saga.targetZone);
        if (!target) return null;
        return Math.hypot(target.x - p.x, target.y - p.y);
    }
    getDirectionText(p, saga) {
        if (!saga.targetZone || saga.targetZone === "ANY") return "Qualquer lugar";
        const target = PLANETS.find(pl => pl.id === saga.targetZone);
        if (!target) return "Desconhecido";
        const dx = target.x - p.x; const dy = target.y - p.y;
        let dir = "";
        if (Math.abs(dy) > Math.abs(dx)) { dir = dy < 0 ? "NORTE" : "SUL"; } 
        else { dir = dx < 0 ? "OESTE" : "LESTE"; }
        return `${target.name} [${dir}]`;
    }
    sendMessage(io, text, type) {
        io.to(this.player.id).emit("aris_msg", { text, type });
        this.lastMessageTime = Date.now();
    }
}

const players = {};
const arisInstances = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];
let chats = []; 
let dragonBalls = []; 

let globalEventTimer = 0;
let eventActive = false;
let eventMobIds = [];
let leaderboard = [];

const TITLES_DATA = { "WARRIOR": { req: "level", val: 10, name: "Guerreiro Z" }, "ELITE": { req: "bp", val: 10000, name: "Elite Saiyajin" }, "SLAYER": { req: "kills", val: 50, name: "Assassino" }, "GOD": { req: "form", val: "GOD", name: "Divindade" }, "CONQUEROR": { req: "domination", val: 1, name: "Imperador" }, "LEGEND": { req: "rebirth", val: 1, name: "Lenda Viva" } };
const FORM_STATS = { "BASE": { spd: 8, dmg: 1.0, hpMult: 1.0, kiMult: 1.0 }, "SSJ": { spd: 11, dmg: 1.5, hpMult: 1.5, kiMult: 1.2 }, "SSJ2": { spd: 13, dmg: 1.8, hpMult: 1.8, kiMult: 1.4 }, "SSJ3": { spd: 15, dmg: 2.3, hpMult: 2.2, kiMult: 1.5 }, "GOD": { spd: 18, dmg: 3.5, hpMult: 3.0, kiMult: 2.0 }, "BLUE": { spd: 22, dmg: 5.0, hpMult: 4.5, kiMult: 3.0 }, "UI": { spd: 28, dmg: 7.0, hpMult: 6.0, kiMult: 5.0 } };
const FORM_ORDER = ["BASE", "SSJ", "SSJ2", "SSJ3", "GOD", "BLUE", "UI"];
const FORM_REQS = { "BASE": 0, "SSJ": 20, "SSJ2": 40, "SSJ3": 60, "GOD": 80, "BLUE": 90, "UI": 100 };
const BP_TRAIN_CAP = { BASE: 5000, SSJ: 25000, SSJ2: 80000, SSJ3: 200000, GOD: 1000000, BLUE: 5000000, UI: 100000000 };
const BESTIARY = { EARTH: { mobs: ["RR_SOLDIER", "SAIBAMAN", "WOLF_BANDIT"], bosses: ["RADITZ", "NAPPA", "VEGETA_SCOUTER"] }, NAMEK: { mobs: ["FRIEZA_SOLDIER", "NAMEK_WARRIOR"], bosses: ["GINYU", "FRIEZA_FINAL", "GOLDEN_FRIEZA"] }, FRIEZA: { mobs: ["FRIEZA_ELITE", "ROBOT_GUARD"], bosses: ["COOLER", "METAL_COOLER"] }, FUTURE: { mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR"], bosses: ["ANDROID_18", "PERFECT_CELL", "GOKU_BLACK"] }, DEMON: { mobs: ["PUIPUI", "YAKON", "DABURA_MINION"], bosses: ["DABURA", "FAT_BUU", "KID_BUU"] }, VAMPA: { mobs: ["GIANT_SPIDER", "VAMPA_BEAST"], bosses: ["PARAGUS", "BROLY_WRATH", "LEGENDARY_BROLY"] }, DIVINE: { mobs: ["PRIDE_TROOPER", "ANGEL_TRAINEE"], bosses: ["TOPPO_GOD", "JIREN", "JIREN_FULL_POWER", "BEERUS"] } };

// FUNÇÕES AUXILIARES
function getMaxBP(p) { const form = p.form || "BASE"; const formCap = BP_TRAIN_CAP[form] || BP_TRAIN_CAP.BASE; const rebirthMult = 1 + ((p.rebirths || 0) * 1.5); return Math.floor(formCap * rebirthMult); }
function clampBP(p) { const maxBP = getMaxBP(p); if (p.bp > maxBP) p.bp = maxBP; checkAchievements(p); checkQuest(p, "BP", null); checkSaga(p, "BP", null); }

function initDragonBalls() { dragonBalls = []; for(let i=1; i<=7; i++) { spawnDragonBall(i); } }
function spawnDragonBall(id) { const angle = Math.random() * Math.PI * 2; const dist = 5000 + Math.random() * 35000; dragonBalls.push({ id: id, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, holderId: null, groundTimer: 9000 }); }
function checkDragonBallPickup(p) { dragonBalls.forEach(db => { if (!db.holderId) { const dist = Math.hypot(p.x - db.x, p.y - db.y); if (dist < 60) { db.holderId = p.id; p.dbCount = (p.dbCount || 0) + 1; p.pvpMode = true; io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: `PEGOU ESFERA ${db.id}!` }); saveAccount(p, true); } } }); }
function dropDragonBalls(p) { if (!p.dbCount || p.dbCount <= 0) return; dragonBalls.forEach(db => { if (db.holderId === p.id) { db.holderId = null; db.x = p.x + (Math.random()-0.5) * 100; db.y = p.y + (Math.random()-0.5) * 100; db.groundTimer = 9000; } }); p.dbCount = 0; io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "ESFERAS PERDIDAS!" }); }

// NOVO: SISTEMA DE MIRA MAGNÉTICA
function findBestCombatTarget(p, range, inputAngle) {
    let best = null; let bestScore = Infinity; const possibleTargets = [...Object.values(players), ...npcs];
    
    // Angulo de tolerância aumentado para "auto-aim" (180 graus na frente)
    const TOLERANCE = Math.PI * 0.8; 

    possibleTargets.forEach(t => { 
        if (t.id === p.id || t.isDead || t.isSpirit) return; 
        if (!t.isNPC && !p.pvpMode && !t.pvpMode) return; 
        
        const dist = Math.hypot(t.x - p.x, t.y - p.y); 
        if (dist > range) return; 
        
        const angleToEnemy = Math.atan2(t.y - p.y, t.x - p.x); 
        let angleDiff = Math.abs(angleToEnemy - inputAngle); 
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff; 
        
        if (angleDiff < TOLERANCE) { 
            // Score prefere inimigos perto e no centro da visão
            const score = dist + (angleDiff * 200); 
            if (score < bestScore) { bestScore = score; best = t; } 
        } 
    });
    return best;
}

function getZoneInfo(x, y) { if (y < -80000) return { id: "DIVINE", level: 100 }; if (x < -40000) return { id: "VAMPA", level: 80 }; if (x < -10000 && y < 10000) { if (x < -30000) return { id: "FRIEZA", level: 40 }; return { id: "NAMEK", level: 20 }; } if (x > 10000 && y > -5000 && y < 5000) return { id: "FUTURE", level: 50 }; if (y > 20000) return { id: "DEMON", level: 60 }; return { id: "EARTH", level: Math.max(1, Math.floor(Math.hypot(x,y)/2000)) }; }

function assignQuest(p) { if (p.quest && !p.quest.completed) return; const zone = getZoneInfo(p.x, p.y); const types = ["KILL", "BP", "VISIT"]; const type = types[Math.floor(Math.random() * types.length)]; let target = "", count = 0, desc = ""; if (type === "KILL") { const list = BESTIARY[zone.id].mobs; target = list[Math.floor(Math.random() * list.length)]; count = 3 + Math.floor(p.level * 0.1); desc = `Derrote ${count} ${target}`; } else if (type === "BP") { target = "POWER"; count = Math.floor(getMaxBP(p) * 0.95); desc = `Treine até ${count} BP`; } else { const zones = Object.keys(BESTIARY); target = zones[Math.floor(Math.random() * zones.length)]; count = 1; desc = `Explore o setor ${target}`; } p.quest = { type: type, target, required: count, current: 0, desc, rewardXp: p.level * 2500, completed: false }; saveAccount(p); }
function checkQuest(p, type, data) { if (!p.quest || p.quest.completed) return; let progress = false; if (p.quest.type === "KILL" && type === "KILL" && (p.quest.target === "ANY" || p.quest.target === data.name)) { p.quest.current++; progress = true; } if (p.quest.type === "BP" && type === "BP" && p.bp >= p.quest.required) { p.quest.current = p.bp; progress = true; } if (p.quest.type === "VISIT" && type === "VISIT" && getZoneInfo(p.x, p.y).id === p.quest.target) { p.quest.current = 1; progress = true; } if (progress) { if (p.quest.current >= p.quest.required) { p.quest.completed = true; p.xp += p.quest.rewardXp; io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y }); io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "MISSÃO DIÁRIA COMPLETA!" }); setTimeout(() => assignQuest(p), 10000); } saveAccount(p); } }
function checkSaga(p, type, data) { const currentStep = SAGA_STEPS[p.sagaStep || 0]; if(!currentStep) return; let completed = false; if (type === "BP" && currentStep.type === "BP" && p.bp >= currentStep.req) completed = true; if (type === "KILL" && currentStep.type === "KILL" && (data.name === currentStep.target || currentStep.target === "ANY")) completed = true; if (type === "VISIT" && currentStep.type === "VISIT") { if (currentStep.target === "KAIOH_PLANET" && p.y < -24000) completed = true; else if (currentStep.targetZone && Math.hypot(p.x - PLANETS.find(pl=>pl.id===currentStep.targetZone)?.x, p.y - PLANETS.find(pl=>pl.id===currentStep.targetZone)?.y) < 2000) completed = true; else if (getZoneInfo(p.x, p.y).id === currentStep.target) completed = true; } if (type === "FORM" && currentStep.type === "FORM" && p.form === currentStep.target) completed = true; if (type === "DOMINATION" && currentStep.type === "DOMINATION" && p.guild) completed = true; if (completed) { p.sagaStep = (p.sagaStep || 0) + 1; p.xp += p.level * 10000; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "CAPÍTULO CONCLUÍDO!" }); io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y }); const nextStep = SAGA_STEPS[p.sagaStep]; const msg = nextStep ? `NOVA SAGA: ${nextStep.title}` : "VOCÊ ZEROU A HISTÓRIA! AGORA CONQUISTE A GALÁXIA!"; io.to(p.id).emit("aris_msg", { text: msg, type: "SUCCESS" }); saveAccount(p, true); } }

function initWorld() { rocks = []; for(let i=0; i<1800; i++) { const angle = Math.random() * Math.PI * 2; const dist = Math.random() * 90000; const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist; const zone = getZoneInfo(x, y); let type = "rock_earth"; if(zone.id === "NAMEK") type = "rock_namek"; if(zone.id === "FRIEZA") type = "rock_metal"; if(zone.id === "FUTURE") type = "rock_ruin"; if(zone.id === "DEMON") type = "rock_magic"; if(zone.id === "VAMPA") type = "rock_bone"; if(zone.id === "DIVINE") type = "rock_god"; rocks.push({ id: i, x: Math.round(x), y: Math.round(y), r: 35 + Math.random() * 80, hp: 500 + (dist/20), maxHp: 500 + (dist/20), type }); } npcs = []; for(let i=0; i<600; i++) spawnMobRandomly(); PLANETS.forEach(p => { if(p.id === "KAIOH_PLANET") return; const list = BESTIARY[p.biome]?.bosses || BESTIARY.EARTH.bosses; list.forEach(bossType => { spawnBossAt(p.x + (Math.random()-0.5)*1000, p.y + (Math.random()-0.5)*1000, bossType); }); }); initDragonBalls(); console.log(">> Universo Gerado e Pronto."); }
function spawnMobRandomly() { const a = Math.random() * Math.PI * 2; const d = 2000 + Math.random() * 80000; spawnMobAt(Math.cos(a)*d, Math.sin(a)*d); }
function spawnMobAt(x, y, aggressive = false) { const zone = getZoneInfo(x, y); const list = BESTIARY[zone.id]?.mobs || BESTIARY.EARTH.mobs; const type = list[Math.floor(Math.random() * list.length)]; const id = "mob_" + Math.random().toString(36).substr(2, 9); let stats = { name: type, hp: 600 * zone.level, bp: 1500 * zone.level, level: zone.level, color: "#fff", aggro: aggressive ? 3000 : (1000 + (zone.level * 20)), aiType: "MELEE" }; if(zone.id === "NAMEK") stats.color = "#8f8"; if(zone.id === "DEMON") stats.color = "#f0f"; if(zone.id === "FRIEZA") stats.color = "#a0a"; if(zone.id === "FUTURE") stats.color = "#888"; if(zone.id === "VAMPA") stats.color = "#dd4"; if(zone.id === "DIVINE") stats.color = "#0ff"; const npc = { id, isNPC: true, r: 25, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200, level: stats.level, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType, aggro: stats.aggro, targetId: null }; npcs.push(npc); return npc; }
function spawnBossAt(x, y, forcedType = null) { const zone = getZoneInfo(x, y); let type = forcedType; if (!type) { const list = BESTIARY[zone.id]?.bosses || BESTIARY.EARTH.bosses; type = list[Math.floor(Math.random() * list.length)]; } let stats = { name: type, hp: 50000 * zone.level, bp: 150000 * zone.level, color: "#f00", r: 70 }; if(type.includes("VEGETA")) stats.color = "#33f"; if(type.includes("FRIEZA")) stats.color = "#fff"; if(type.includes("CELL")) stats.color = "#484"; if(type.includes("BUU")) { stats.color = "#fbb"; stats.hp *= 1.5; } if(type.includes("JIREN")) { stats.color = "#f22"; stats.hp *= 3; } if(type.includes("BROLY")) { stats.color = "#0f0"; stats.r = 90; stats.hp *= 2; } const boss = { id: "BOSS_" + type + "_" + Date.now(), name: type, isNPC: true, isBoss: true, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 20000, maxKi: 20000, level: zone.level + 15, cancelWindow: 0, lastInputTime: 0, orbitDir: 1, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, targetId: null }; npcs.push(boss); return boss; }
function checkAchievements(p) { let unlocked = p.titles ? p.titles.split(',') : ["Novato"]; let changed = false; if (p.level >= TITLES_DATA.WARRIOR.val && !unlocked.includes(TITLES_DATA.WARRIOR.name)) { unlocked.push(TITLES_DATA.WARRIOR.name); changed = true; } if (p.bp >= TITLES_DATA.ELITE.val && !unlocked.includes(TITLES_DATA.ELITE.name)) { unlocked.push(TITLES_DATA.ELITE.name); changed = true; } if (p.form === "GOD" && !unlocked.includes(TITLES_DATA.GOD.name)) { unlocked.push(TITLES_DATA.GOD.name); changed = true; } if (p.pvp_kills >= TITLES_DATA.SLAYER.val && !unlocked.includes(TITLES_DATA.SLAYER.name)) { unlocked.push(TITLES_DATA.SLAYER.name); changed = true; } if ((p.rebirths || 0) >= TITLES_DATA.LEGEND.val && !unlocked.includes(TITLES_DATA.LEGEND.name)) { unlocked.push(TITLES_DATA.LEGEND.name); changed = true; } if (changed) { p.titles = unlocked.join(','); io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "NOVO TÍTULO DESBLOQUEADO!" }); saveAccount(p, true); } }
function handleKill(killer, victim) { const planet = PLANETS.find(pl => Math.hypot(pl.x - victim.x, pl.y - victim.y) < pl.radius); if (planet && !killer.isNPC) { if (planet.owner && planet.owner !== killer.guild) { planet.stability -= 5; if (planet.stability <= 0) { planet.owner = null; planet.guild = null; planet.stability = 20; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "PLANETA NEUTRO!" }); } } else if (!planet.owner && killer.guild) { planet.stability += 5; if (planet.stability >= 100) { planet.owner = killer.guild; planet.guild = killer.guild; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "DOMINADO POR " + killer.guild }); } } if(pool && planet) { pool.query(`INSERT INTO planets (id, owner, guild, stability, treasury) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET owner=$2, guild=$3, stability=$4, treasury=$5`, [planet.id, planet.owner, planet.guild, planet.stability, planet.treasury]).catch(console.error); } } if(!victim.isNPC) { dropDragonBalls(victim); } if(victim.isNPC) { victim.isDead = true; if(!killer.isNPC) { checkQuest(killer, "KILL", victim); checkSaga(killer, "KILL", victim); killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2)); const levelDiff = victim.level - killer.level; let xpMultiplier = 1.0; if(levelDiff < -10) xpMultiplier = 0.1; if(levelDiff > 5) xpMultiplier = 1.5; const xpGain = Math.floor(victim.level * 100 * xpMultiplier); const xpReq = killer.level * 800; killer.xp += xpGain; killer.xpToNext = xpReq; if(xpGain > 0) io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain }); if (planet && planet.owner && planet.owner !== killer.guild) { const tax = Math.floor(xpGain * (planet.taxRate / 100)); planet.treasury += tax; } if(killer.xp >= xpReq) { killer.level++; killer.xp = 0; killer.bp += 5000; clampBP(killer); const rebirthMult = 1 + ((killer.rebirths||0) * 0.2); killer.baseMaxHp += 1000 * rebirthMult; killer.baseMaxKi += 100 * rebirthMult; const stats = FORM_STATS[killer.form] || FORM_STATS["BASE"]; killer.maxHp = killer.baseMaxHp * stats.hpMult; killer.maxKi = killer.baseMaxKi * stats.kiMult; killer.hp = killer.maxHp; killer.ki = killer.maxKi; killer.xpToNext = killer.level * 800; io.emit("fx", { type: "levelup", x: killer.x, y: killer.y }); saveAccount(killer, true); } } setTimeout(() => { npcs = npcs.filter(n => n.id !== victim.id); spawnMobRandomly(); }, 5000); } else { victim.isSpirit = true; victim.hp = 1; victim.ki = 0; victim.state = "SPIRIT"; victim.vx = 0; victim.vy = 0; victim.x = SNAKE_WAY_START.x; victim.y = SNAKE_WAY_START.y; victim.angle = -Math.PI / 2; io.emit("fx", { type: "vanish", x: victim.x, y: victim.y }); if(!killer.isNPC) { killer.pvp_score += 10; killer.pvp_kills = (killer.pvp_kills || 0) + 1; checkAchievements(killer); io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: 50 }); saveAccount(killer, true); } } }
function triggerRandomEvent() { if(eventActive) { npcs = npcs.filter(n => !eventMobIds.includes(n.id)); eventMobIds = []; eventActive = false; io.emit("fx", { type: "bp_limit", x: 0, y: 0, text: "AMEAÇA CONTIDA." }); return; } let targetPlanet = PLANETS.find(p => p.owner) || PLANETS[Math.floor(Math.random() * PLANETS.length)]; const events = [ { type: "HORDE_SAIBAMAN", msg: `INVASÃO EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, { type: "INVASION_FRIEZA", msg: `FORÇAS DE FREEZA EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, { type: "BOSS_BROLY", msg: `BROLY ESTÁ DESTRUINDO ${targetPlanet.name}!`, zoneId: targetPlanet.id }]; const ev = events[Math.floor(Math.random() * events.length)]; io.emit("fx", { type: "bp_limit", x: targetPlanet.x, y: targetPlanet.y, text: ev.msg }); eventActive = true; if (targetPlanet.owner) targetPlanet.stability = Math.max(10, targetPlanet.stability - 20); if(ev.type.includes("HORDE")) { for(let i=0; i<15; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*1000, targetPlanet.y + (Math.random()-0.5)*1000, true); mob.name = "INVASOR"; mob.color = "#f00"; eventMobIds.push(mob.id); } } else if(ev.type.includes("INVASION")) { for(let i=0; i<10; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*800, targetPlanet.y + (Math.random()-0.5)*800, true); mob.name = "ELITE"; mob.color = "#808"; mob.hp *= 2; eventMobIds.push(mob.id); } } else if(ev.type.includes("BOSS")) { const boss = spawnBossAt(targetPlanet.x, targetPlanet.y, "LEGENDARY_BROLY"); boss.hp *= 3; boss.bp *= 2; eventMobIds.push(boss.id); } }

// ==========================================
// SERVER LOGIC (HTTP/SOCKETS)
// ==========================================
const server = http.createServer((req, res) => {
    let filePath = "." + req.url; if (filePath === "./") filePath = "./index.html";
    const extname = path.extname(filePath);
    let contentType = "text/html";
    switch (extname) { case ".js": contentType = "text/javascript"; break; case ".css": contentType = "text/css"; break; case ".json": contentType = "application/json"; break; case ".png": contentType = "image/png"; break; case ".mp3": contentType = "audio/mpeg"; break; }
    fs.readFile(filePath, (error, content) => { if (error) { if(error.code == 'ENOENT'){ res.writeHead(404); res.end("Arquivo nao encontrado."); } else { res.writeHead(500); res.end('Erro no servidor: '+error.code); } } else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content, 'utf-8'); } });
});

const io = new Server(server, { transports: ['websocket'], pingInterval: 25000, pingTimeout: 5000 });

// PACKER DE ESTADO (VISIBILIDADE)
function packStateForPlayer(pid) {
    const p = players[pid]; if (!p) return null;
    const VIEW_DIST = 2500; const filterFunc = (o) => Math.abs(o.x - p.x) < VIEW_DIST && Math.abs(o.y - p.y) < VIEW_DIST;
    
    const packedDragonBalls = dragonBalls.map(db => { if(db.holderId && players[db.holderId]) { return { id: db.id, x: players[db.holderId].x, y: players[db.holderId].y, held: true }; } return { id: db.id, x: db.x, y: db.y, held: false }; });
    const packedPlayers = {};
    for (const pid in players) { const pl = players[pid]; if (pid === p.id || filterFunc(pl)) { packedPlayers[pid] = { id: pl.id, name: pl.name, x: Math.round(pl.x), y: Math.round(pl.y), vx: Math.round(pl.vx), vy: Math.round(pl.vy), hp: pl.hp, maxHp: pl.maxHp, ki: pl.ki, maxKi: pl.maxKi, xp: pl.xp, xpToNext: pl.xpToNext, level: pl.level, bp: pl.bp, state: pl.state, form: pl.form, color: pl.color, stun: pl.stun, isSpirit: pl.isSpirit, pvpMode: pl.pvpMode, quest: pl.quest, rebirths: pl.rebirths || 0, current_title: pl.current_title, guild: pl.guild, skills: pl.skills || [], dbCount: pl.dbCount || 0, angle: pl.angle }; } }
    const currentSagaStep = SAGA_STEPS[p.sagaStep || 0] || SAGA_STEPS[SAGA_STEPS.length-1];
    const visibleNpcs = npcs.filter(filterFunc).map(n => ({...n, x: Math.round(n.x), y: Math.round(n.y)}));
    const visibleProjs = projectiles.filter(filterFunc).map(pr => ({...pr, x: Math.round(pr.x), y: Math.round(pr.y)}));
    const visibleChats = chats.filter(c => c.life > 0 && Math.abs(c.x - p.x) < VIEW_DIST && Math.abs(c.y - p.y) < VIEW_DIST);
    
    return { players: packedPlayers, npcs: visibleNpcs, projectiles: visibleProjs, rocks: rocks.filter(filterFunc), craters, chats: visibleChats, domination: PLANETS, leaderboard: leaderboard.slice(0, 5), saga: currentSagaStep, dbs: packedDragonBalls };
}
const localUsers = {};

io.on("connection", (socket) => {
    socket.on("login", async (data) => {
        try {
            let user;
            if (pool) {
                // TENTA DB
                try {
                    const res = await pool.query('SELECT * FROM users WHERE username = $1', [data.user]);
                    user = res.rows[0];
                    if (!user) {
                        const insert = await pool.query('INSERT INTO users (username, name, password) VALUES ($1,$1,$2) RETURNING *', [data.user, data.pass]);
                        user = insert.rows[0];
                    } else if (user.password !== data.pass) return; // Senha errada
                } catch(dbErr) {
                     console.error("ERRO LOGIN DB, usando RAM temp:", dbErr);
                     // Fallback imediato se query falhar
                     user = localUsers[data.user];
                     if (!user) { user = { username: data.user, name: data.user, password: data.pass, level: 1, xp: 0, bp: 500, guild: null, titles: 'Novato', current_title: 'Novato', pvp_score: 0, pvp_kills: 0, rebirths: 0, quest_data: '{}', saga_step: 0, skills: '[]' }; localUsers[data.user] = user; } else if (user.password !== data.pass) return;
                }
            } else {
                // MODO RAM
                user = localUsers[data.user];
                if (!user) { user = { username: data.user, name: data.user, password: data.pass, level: 1, xp: 0, bp: 500, guild: null, titles: 'Novato', current_title: 'Novato', pvp_score: 0, pvp_kills: 0, rebirths: 0, quest_data: '{}', saga_step: 0, skills: '[]' }; localUsers[data.user] = user; } else if (user.password !== data.pass) return;
            }
            
            const xpToNext = user.level * 800;
            const rebirthMult = 1 + (user.rebirths || 0) * 0.2; 
            const quest = user.quest_data ? (typeof user.quest_data === 'string' ? JSON.parse(user.quest_data) : user.quest_data) : {};
            const skills = user.skills ? (typeof user.skills === 'string' ? JSON.parse(user.skills) : user.skills) : [];

            players[socket.id] = {
                ...user, id: socket.id, r: 20, 
                x: user.x || 0, y: user.y || 0, vx: 0, vy: 0, angle: 0,
                baseMaxHp: (1000 + user.level * 200) * rebirthMult, baseMaxKi: (100 + user.level * 10) * rebirthMult,
                hp: user.hp > 0 ? user.hp : (1000 + user.level * 200) * rebirthMult, 
                maxHp: (1000 + user.level * 200) * rebirthMult,
                ki: user.ki > 0 ? user.ki : (100 + user.level * 10) * rebirthMult, 
                maxKi: (100 + user.level * 10) * rebirthMult, 
                form: user.form || "BASE", xpToNext,
                state: "IDLE", lastHit: 0, stunImmune: 0, combo: 0, comboTimer: 0, attackLock: 0, counterWindow: 0, lastAtk: 0,
                isDead: false, isSpirit: false, stun: 0, color: "#ff9900", chargeStart: 0, pvpMode: false, lastTransform: 0, bpCapped: false,
                reviveTimer: 0, linkId: null, quest: quest || {}, rebirths: user.rebirths || 0, sagaStep: user.saga_step || 0,
                skills: skills, dbCount: 0, isTutorialDialogActive: false,
                lastSave: Date.now() // Start save timer
            };
            
            arisInstances[socket.id] = new LumiaAI(players[socket.id]);
            socket.emit("aris_msg", { text: `LUMIA: Conectado. Assinatura: ${data.user}. Sincronizando Missão...`, type: "INFO" });
            
            if(!players[socket.id].quest.type) assignQuest(players[socket.id]);
            socket.emit("auth_success", players[socket.id]);
            console.log(`>> ${data.user} Entrou no jogo.`);
        } catch (err) { console.error("Erro no Login:", err); }
    });

    socket.on("toggle_pvp", () => { const p = players[socket.id]; if (!p || p.isDead || p.isSpirit) return; if (p.dbCount > 0) return; p.pvpMode = !p.pvpMode; socket.emit("pvp_status", p.pvpMode); });
    socket.on("tutorial_dialog_state", (isOpen) => { const p = players[socket.id]; if(p) p.isTutorialDialogActive = isOpen; });
    socket.on("set_title", (title) => { const p = players[socket.id]; if(p && p.titles.includes(title)) { p.current_title = title; saveAccount(p, true); } });
    socket.on("create_guild", (guildName) => { const p = players[socket.id]; if(p && !p.guild && guildName.length < 15) { p.guild = guildName; saveAccount(p, true); io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GUILDA CRIADA: " + guildName }); checkSaga(p, "DOMINATION", {owner: guildName}); } });

    socket.on("rebirth", () => {
        const p = players[socket.id];
        if (!p || p.level < 150) { io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "REQUER NIVEL 150!" }); return; }
        p.level = 1; p.xp = 0; p.bp = 500; p.form = "BASE"; p.rebirths = (p.rebirths || 0) + 1; p.sagaStep = 0;
        const rebirthMult = 1 + (p.rebirths * 0.2);
        p.baseMaxHp = (1000 + p.level * 200) * rebirthMult; p.baseMaxKi = (100 + p.level * 10) * rebirthMult;
        p.maxHp = p.baseMaxHp; p.maxKi = p.baseMaxKi; p.hp = p.maxHp; p.ki = p.maxKi;
        io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: `${p.name} RENASCEU! (${p.rebirths}x)` });
        io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y });
        checkSaga(p, "REBIRTH", null);
        saveAccount(p, true);
        checkAchievements(p);
    });

    socket.on("chat", (msg) => { const p = players[socket.id]; if (!p || msg.length > 50) return; if (msg.startsWith("/guild ")) { const name = msg.substring(7).trim(); if (name.length >= 3) socket.emit("create_guild", name); return; } if (msg.startsWith("/title ")) { const title = msg.substring(7).trim(); socket.emit("set_title", title); return; } if (p.lastMsg && Date.now() - p.lastMsg < 1000) return; p.lastMsg = Date.now(); chats.push({ x: p.x, y: p.y, text: msg, owner: p.name, life: 150 }); });

    socket.on("input", (input) => {
        const p = players[socket.id]; 
        if(!p || p.stun > 0 || p.isDead) return; 
        if(p.isTutorialDialogActive) return;

        const now = Date.now();
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"]; 
        let speed = formStats.spd; if(p.isSpirit) speed *= 0.8;
        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        
        // MOVEMENT LOGIC (60Hz Normalized)
        if(input.x || input.y) { 
            let len = Math.hypot(input.x, input.y);
            if (len > 1) { input.x /= len; input.y /= len; }
            
            p.vx += input.x * speed * moveMod; 
            p.vy += input.y * speed * moveMod; 
            
            if(!["ATTACKING", "BLOCKING", "CHARGING"].includes(p.state)) p.state = "MOVING"; 
        }

        // 360 BLOCKING
        if (p.attackLock <= 0 && input.angle !== undefined) {
             p.angle = input.angle;
        }

        if(input.block) { 
            if(p.state !== "BLOCKING") { p.blockStart = now; p.state = "BLOCKING"; }
            // KI DRAIN FOR BLOCKING
            if(p.ki > 0) { p.ki -= 0.5; } else { p.state = "IDLE"; p.stun = 30; io.emit("fx", { type: "guard_break", x: p.x, y: p.y }); } 
        }
        else if(input.charge) { 
            p.state = "CHARGING"; 
            let boost = 1; Object.values(players).forEach(other => { if(other.id !== p.id && other.state === "CHARGING" && Math.hypot(other.x - p.x, other.y - p.y) < 200) { boost = 2; } });
            p.ki = Math.min(p.maxKi, p.ki + (p.level * 0.8 * boost)); 
        } 
        else if(input.holdAtk) { 
            if(p.state !== "CHARGING_ATK") p.chargeStart = Date.now(); 
            p.state = "CHARGING_ATK"; 
        } 
        else if(!["ATTACKING", "STUNNED"].includes(p.state)) { 
            p.state = "IDLE"; p.blockStart = 0;
        }
        if (now % 200 === 0) { checkQuest(p, "VISIT", null); checkSaga(p, "VISIT", null); }
    });

    socket.on("release_attack", () => {
        const p = players[socket.id]; if (!p || p.isSpirit || p.stun > 0) return;
        if(p.isTutorialDialogActive) return; 

        // 🛑 SPAM PREVENTION: Só ataca se não estiver travado ou se estiver na janela de cancelamento
        if (p.attackLock > 0 && p.cancelWindow <= 0) return;

        const now = Date.now(); const formStats = FORM_STATS[p.form] || FORM_STATS.BASE;
        const range = 240; 
        
        // --- 1. MAGNETISMO (AUTO-AIM) ---
        let target = findBestCombatTarget(p, range, p.angle);
        
        // Fallback para alvos muito próximos (mesmo fora do ângulo)
        if (!target) {
            let best = null, bestDist = 180;
            [...Object.values(players), ...npcs].forEach(t => {
                if (t.id === p.id || t.isDead || t.isSpirit) return; if (!t.isNPC && !p.pvpMode) return;
                const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bestDist) { bestDist = d; best = t; }
            });
            target = best;
        }

        // SNAP: Vira o jogador para o alvo instantaneamente
        if (target) {
            const dx = target.x - p.x; const dy = target.y - p.y;
            p.angle = Math.atan2(dy, dx); 
        }

        // CLASH (Colisão de Ataques)
        if (target && target.state === "ATTACKING" && !target.isDead) {
            const angToTarget = Math.atan2(target.y - p.y, target.x - p.x); const angToPlayer = Math.atan2(p.y - target.y, p.x - target.x);
            let diffP = Math.abs(angToTarget - p.angle); if (diffP > Math.PI) diffP = Math.PI*2 - diffP;
            if (diffP < 1.0 && Math.hypot(target.x - p.x, target.y - p.y) < 180) {
                const midX = (p.x + target.x) / 2; const midY = (p.y + target.y) / 2;
                io.emit("fx", { type: "clash", x: midX, y: midY });
                const push = 30; 
                p.vx = -Math.cos(angToTarget) * push; p.vy = -Math.sin(angToTarget) * push;
                target.vx = -Math.cos(angToPlayer) * push; target.vy = -Math.sin(angToPlayer) * push;
                p.combo = 0; p.attackLock = 20; target.combo = 0; target.attackLock = 20; 
                return;
            }
        }
        
        // LÓGICA DE COMBO (60Hz TIMING)
        if (p.comboTimer <= 0) p.combo = 0;
        const COMBO_STEPS = [ 
            { type: "RUSH", range: 240, selfSpd: 55, targetPush: 5, stun: 18, dmg: 1.0 }, 
            { type: "HEAVY", range: 150, selfSpd: 25, targetPush: 8, stun: 18, dmg: 1.2 }, 
            { type: "MULTI", range: 150, selfSpd: 35, targetPush: 5, stun: 18, dmg: 0.8 }, 
            { type: "UPPER", range: 150, selfSpd: 15, targetPush: 10, stun: 22, dmg: 1.5 }, 
            { type: "FINISH", range: 180, selfSpd: 10, targetPush: 150, stun: 40, dmg: 2.5 } 
        ];
        if (p.combo >= COMBO_STEPS.length) p.combo = 0;
        const step = COMBO_STEPS[p.combo]; const isFinisher = step.type === "FINISH";
        
        if (target && !isFinisher) { target.vx *= 0.1; target.vy *= 0.1; } // Freia alvo para "grudar"
        
        // IMPULSO FÍSICO DO ATAQUE
        p.vx = Math.cos(p.angle) * step.selfSpd; p.vy = Math.sin(p.angle) * step.selfSpd;
        p.state = "ATTACKING"; 
        
        // ⚡ TIMINGS DE AÇÃO RÁPIDA (TAP TAP)
        p.attackLock = isFinisher ? 25 : 12; // Trava curta
        p.cancelWindow = 5; // Janela para proximo input
        p.lastAtk = now;
        
        let baseDmg = Math.floor((65 + p.level * 10) * formStats.dmg * step.dmg); 
        
        if (target) {
            const dist = Math.hypot(target.x - p.x, target.y - p.y); 
            if (dist <= step.range) {
                if (target.isNPC) target.targetId = p.id; 
                let dmg = baseDmg; if (!target.isNPC) dmg *= 0.5;

                const isBlocked = isAttackBlocked(p, target);

                if (isBlocked && !isFinisher) {
                    dmg *= 0.1; target.ki -= 20; 
                    target.counterWindow = 12; 
                    io.emit("fx", { type: "block_hit", x: target.x, y: target.y });
                    if(target.ki <= 0) { target.state = "IDLE"; target.stun = 40; io.emit("fx", { type: "guard_break", x: target.x, y: target.y }); }
                } else {
                    if (isBlocked && isFinisher) { target.state = "IDLE"; target.stun = 50; io.emit("fx", { type: "guard_break", x: target.x, y: target.y }); }
                    
                    target.hp -= dmg; target.stun = step.stun; 
                    target.vx = Math.cos(p.angle) * step.targetPush; 
                    target.vy = Math.sin(p.angle) * step.targetPush;
                    
                    io.emit("fx", { type: isFinisher ? "finisher" : "hit", x: target.x, y: target.y, dmg });
                }
                if (target.hp <= 0) handleKill(p, target);
                p.combo++; p.comboTimer = 30; // Tempo tolerante para proximo tap
            } else if (p.combo > 0) { p.comboTimer = 15; }
        } else if (p.combo > 0) { p.comboTimer = 15; }
    });

    socket.on("release_blast", () => {
        const p = players[socket.id]; 
        if (!p || p.isSpirit || p.stun > 0) return; 
        if(p.isTutorialDialogActive) return;

        if (p.state === "ATTACKING" && p.cancelWindow <= 0) return;

        const formStats = FORM_STATS[p.form] || FORM_STATS.BASE;
        const now = Date.now();
        const chargedTime = now - p.chargeStart;

        if (p.state === "CHARGING") {
            const unlocked = p.skills || [];
            if (unlocked.includes("GENKI_DAMA") && p.ki > 300) {
                 p.ki = 0; p.state = "ATTACKING"; p.attackLock = 80;
                 projectiles.push({ id: Math.random(), owner: p.id, x: p.x, y: p.y - 100, vx: Math.cos(p.angle) * 8, vy: Math.sin(p.angle) * 8, dmg: (500 + p.level * 50) * formStats.dmg, size: 250, isSuper: true, life: 300, color: "#00aaff", pvp: p.pvpMode });
                 io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GENKI DAMA!" });
                 return;
            }
            if (unlocked.includes("KAMEHAMEHA") && p.ki > 80) {
                 p.ki -= 80; p.state = "ATTACKING"; p.attackLock = 40;
                 projectiles.push({ id: Math.random(), owner: p.id, x: p.x, y: p.y, vx: Math.cos(p.angle) * 55, vy: Math.sin(p.angle) * 55, dmg: (150 + p.level * 15) * formStats.dmg, size: 60, isSuper: true, life: 120, color: "#3366ff", pvp: p.pvpMode });
                 io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "KAMEHAMEHA!" });
                 return;
            }
        }

        const isSuper = chargedTime > 800; 
        const cost = isSuper ? 40 : 10; if (p.ki < cost) return;
        p.ki -= cost; p.state = "IDLE"; p.attackLock = 0; p.comboTimer = 0;
        
        projectiles.push({ id: Math.random(), owner: p.id, x: p.x, y: p.y, vx: Math.cos(p.angle) * (isSuper ? 32 : 45), vy: Math.sin(p.angle) * (isSuper ? 32 : 45), dmg: (50 + p.level * 6) * formStats.dmg * (isSuper ? 3 : 1), size: isSuper ? 80 : 12, isSuper, life: 90, color: "#0cf", pvp: p.pvpMode });
    });

    socket.on("vanish", () => { const p = players[socket.id]; if (!p || p.isSpirit || p.ki < 20 || p.stun > 0) return; p.ki -= 20; p.state = "IDLE"; p.attackLock = 0; p.combo = 0; p.x += Math.cos(p.angle) * 450; p.y += Math.sin(p.angle) * 450; io.emit("fx", { type: "vanish", x: p.x, y: p.y }); });
    socket.on("transform", () => {
    const p = players[socket.id];
    if (!p || p.isSpirit || p.isDead || p.stun > 0) return;

    if (p.lastTransform && Date.now() - p.lastTransform < 2000) return;

    const currentIdx = FORM_ORDER.indexOf(p.form || "BASE");
    let nextIdx = currentIdx + 1;
    if (nextIdx >= FORM_ORDER.length) nextIdx = 0;

    const nextForm = FORM_ORDER[nextIdx];
    const newFormName = nextForm;

    if (p.level < FORM_REQS[nextForm]) {
        io.to(p.id).emit("fx", {
            type: "bp_limit",
            x: p.x,
            y: p.y,
            text: `REQUER NÍVEL ${FORM_REQS[nextForm]}`
        });
        return;
    }

    if (newFormName !== "BASE" && p.ki < 50) {
        io.to(p.id).emit("fx", {
            type: "bp_limit",
            x: p.x,
            y: p.y,
            text: "KI INSUFICIENTE"
        });
        return;
    }

    if (newFormName !== "BASE") p.ki -= 50;

    p.form = newFormName;
    p.lastTransform = Date.now();

    const stats = FORM_STATS[newFormName];
    p.maxHp = Math.floor(p.baseMaxHp * stats.hpMult);
    p.maxKi = Math.floor(p.baseMaxKi * stats.kiMult);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);

    io.emit("fx", { type: "transform", x: p.x, y: p.y, form: newFormName });

    checkSaga(p, "FORM", null);
    clampBP(p);
    saveAccount(p, true);
});

    socket.on("set_tax", (val) => {
    const p = players[socket.id];
    if (!p || !p.guild) return;

    const planet = PLANETS.find(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius);
    if (!planet || planet.owner !== p.guild) return;

    if (val < 0 || val > 20) return;

    planet.taxRate = val;
    io.emit("fx", {
        type: "bp_limit",
        x: planet.x,
        y: planet.y,
        text: `IMPOSTO: ${val}%`
    });

    if (pool) {
        pool.query(
            `INSERT INTO planets (id, tax_rate)
             VALUES ($1, $2)
             ON CONFLICT (id) DO UPDATE SET tax_rate=$2`,
            [planet.id, val]
        ).catch(console.error);
    }
});

    // ==========================================
    // CRÍTICO: SALVAR AO DESCONECTAR
    // ==========================================
    socket.on("disconnect", () => { 
        if(players[socket.id]) {
            saveAccount(players[socket.id], true);
            console.log(`>> Jogador desconectado e salvo: ${players[socket.id].name}`);
        }
        delete players[socket.id]; 
        delete arisInstances[socket.id]; 
    });
});

initWorld();
initDB();

// ==========================================
// LOOP DO JOGO (60Hz = 16ms)
// ==========================================

setInterval(() => {
    Object.values(players).forEach(p => saveAccount(p));
}, 5000); 

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    chats = chats.filter(c => { c.life--; return c.life > 0; });
    leaderboard = Object.values(players).sort((a,b) => b.pvp_score - a.pvp_score).slice(0,5).map(p => ({name: p.name, score: p.pvp_score, guild: p.guild}));
    globalEventTimer++; if(globalEventTimer > 12000) { triggerRandomEvent(); globalEventTimer = 0; }

    dragonBalls.forEach(db => {
        if (!db.holderId) {
            db.groundTimer--;
            if(db.groundTimer <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 5000 + Math.random() * 35000;
                db.x = Math.cos(angle) * dist;
                db.y = Math.sin(angle) * dist;
                db.groundTimer = 18000;
            }
        }
    });

    Object.values(players).forEach(p => {
        // COMBO MAGNET: Puxa o jogador levemente para o alvo
        if (p.comboTargetId) {
            const t = players[p.comboTargetId] || npcs.find(n => n.id === p.comboTargetId);
            if (t && !t.isDead) {
                const dx = t.x - p.x; const dy = t.y - p.y; const dist = Math.hypot(dx, dy);
                if (dist > 30 && dist < 180) { const pull = 0.3; p.vx += dx * pull * 0.02; p.vy += dy * pull * 0.02; }
                if (p.state === "ATTACKING" && dist > 60) { const dash = 0.8; p.vx += Math.cos(Math.atan2(dy, dx)) * dash; p.vy += Math.sin(Math.atan2(dy, dx)) * dash; }
            }
        }
        if (p.comboTimer <= 0) p.comboTargetId = null;

        // FÍSICA E STATUS (60Hz Tuned)
        if(p.stun > 0) { 
            p.stun--; p.vx *= 0.8; p.vy *= 0.8; // Fricção alta se estunado
            n.state = "STUNNED";
        } else {
            if (p.state === "MOVING") { p.vx *= 0.96; p.vy *= 0.96; } 
            else { p.vx *= 0.88; p.vy *= 0.88; } // Para mais rápido quando solta o dedo
        }

        if(p.attackLock > 0) p.attackLock--; 
        if(p.comboTimer > 0) p.comboTimer--; 
        if(p.counterWindow > 0) p.counterWindow--;
        
        p.x += p.vx; p.y += p.vy; 
        
        if (!p.isDead && !p.isSpirit) {
            p.bp += 1 + Math.floor(p.level * 0.05); 
            clampBP(p);
            checkDragonBallPickup(p);

            if (arisInstances[p.id]) arisInstances[p.id].evaluate(io);

            if (!p.skills) p.skills = [];
            if (!p.skills.includes("KAMEHAMEHA")) {
                const distKame = Math.hypot(p.x - 6000, p.y - (-4000));
                if (distKame < 400 && p.level >= 5) {
                    p.skills.push("KAMEHAMEHA");
                    io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "APRENDEU: KAMEHAMEHA!" });
                    io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y });
                    saveAccount(p, true);
                }
            }
            if (!p.skills.includes("GENKI_DAMA")) {
                const distKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y);
                if (distKai < 400 && p.level >= 50) {
                     p.skills.push("GENKI_DAMA");
                     io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "APRENDEU: GENKI DAMA!" });
                     io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y });
                     saveAccount(p, true);
                }
            }

            if (p.state === "CHARGING") { 
                checkSaga(p, "BP", null); 
                if (Math.random() > 0.9) { p.xp += 1; p.xpToNext = p.level * 800; p.bp += 10; clampBP(p); } 
                const xpReq = p.level * 800; 
                if(p.xp >= xpReq) { 
                    p.level++; p.xp = 0; p.bp += 5000; clampBP(p); 
                    const rebirthMult = 1 + ((p.rebirths||0) * 0.2);
                    p.baseMaxHp += 1000 * rebirthMult; p.baseMaxKi += 100 * rebirthMult; 
                    const stats = FORM_STATS[p.form] || FORM_STATS["BASE"]; p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult; p.hp = p.maxHp; p.ki = p.maxKi; p.xpToNext = p.level * 800; 
                    io.emit("fx", { type: "levelup", x: p.x, y: p.y }); 
                    saveAccount(p, true);
                } 
            } 
            else if(p.ki < p.maxKi && p.state === "IDLE") { p.ki += 0.25; }
            const distToKingKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y);
            const distToDende = Math.hypot(p.x - (-22000), p.y - 8000);
            if (distToKingKai < 1500 || distToDende < 1500) { p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.02)); p.ki = Math.min(p.maxKi, p.ki + (p.maxKi * 0.02)); }
        }
        if (p.bp >= getMaxBP(p)) { if (!p.bpCapped) { p.bpCapped = true; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "TREINO MÁXIMO (TRANSFORME-SE)" }); } } else { p.bpCapped = false; }
        if (p.isSpirit) { const distToKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y); if (distToKai < 600) { p.isSpirit = false; p.hp = p.maxHp; p.ki = p.maxKi; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); io.emit("fx", { type: "levelup", x: 0, y: 0 }); saveAccount(p, true); } }
    });

    npcs.forEach(n => {
        if (n.isDead) return;
        if (n.stun > 0) { n.stun--; n.x += n.vx; n.y += n.vy; n.vx *= 0.8; n.vy *= 0.8; n.state = "STUNNED"; return; }
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
             if (target.state === "ATTACKING") {
                const angToMob = Math.atan2(n.y - target.y, n.x - target.x);
                let diff = Math.abs(angToMob - target.angle); if (diff > Math.PI) diff = Math.PI*2 - diff;
                if (diff < 1.0) {
                     const midX = (n.x + target.x) / 2; const midY = (n.y + target.y) / 2;
                     io.emit("fx", { type: "clash", x: midX, y: midY });
                     const push = 20; n.vx = -Math.cos(ang) * push; n.vy = -Math.sin(ang) * push;
                     target.vx = Math.cos(ang) * push; target.vy = Math.sin(ang) * push;
                     n.lastAtk = Date.now() + 500;
                     return;
                }
            }
            n.lastAtk = Date.now(); n.state = "ATTACKING"; let dmg = (n.level * 10) + (n.isBoss ? 100 : 30);
            
            const blocked = isAttackBlocked(n, target);
            if (blocked) { dmg *= 0.3; target.ki -= 14; target.counterWindow = 14; io.emit("fx", { type: "block_hit", x: target.x, y: target.y }); }
            else {
                 target.hp -= dmg; if (target.hp < 0) target.hp = 0; target.lastHit = Date.now();
                 if (!target.stunImmune || Date.now() > target.stunImmune) { target.stun = n.isBoss ? 15 : 8; target.stunImmune = Date.now() + 700; }
                 const push = n.isBoss ? (n.phase === 3 ? 45 : 25) : 15; target.vx = Math.cos(ang) * push; target.vy = Math.sin(ang) * push; if (n.isBoss) n.pushStreak++;
                 io.emit("fx", { type: n.isBoss ? "heavy" : "hit", x: target.x, y: target.y, dmg: Math.floor(dmg) });
            }
            
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
                if (dist < (45 + pr.size)) { if(!t.isNPC && !pr.pvp) return; if(t.isNPC) t.targetId = pr.owner; let dmg = pr.dmg; if (!t.isNPC) dmg *= 0.5; if (!t.lastHit || Date.now() - t.lastHit > 300) { t.hp -= dmg; if (t.hp < 0) t.hp = 0; t.stun = 10; t.lastHit = Date.now(); } hit = true; io.emit("fx", { type: pr.isSuper ? "heavy" : "hit", x: pr.x, y: pr.y, dmg: Math.floor(dmg) }); const owner = players[pr.owner] || npcs.find(n => n.id === pr.owner) || {}; if (t.hp <= 0) handleKill(owner, t); }
            }
        });
        if(!hit) { 
            for(let rIdx = rocks.length-1; rIdx >= 0; rIdx--) { 
                let r = rocks[rIdx]; 
                if(Math.abs(pr.x - r.x) > 150 || Math.abs(pr.y - r.y) > 150) continue; 
                const dist = Math.hypot(pr.x - r.x, pr.y - r.y); 
                if(dist < (r.r + pr.size)) { 
                    hit = true; r.hp -= pr.dmg; io.emit("fx", { type: "hit", x: pr.x, y: pr.y, dmg: Math.floor(pr.dmg) }); 
                    if(r.hp <= 0) { rocks.splice(rIdx, 1); io.emit("fx", { type: "heavy", x: r.x, y: r.y }); craters.push({ x: r.x, y: r.y, r: r.r, life: 1000 }); } 
                    break; 
                } 
            } 
        }
        if (hit || pr.life <= 0) projectiles.splice(i, 1);
    });

    Object.keys(players).forEach(id => { const st = packStateForPlayer(id); if(st) io.to(id).emit("state", st); });
}, TICK);

server.listen(3000, () => console.log(">> UNIVERSE Z EVOLUTION EDITION ONLINE: http://localhost:3000"));

function isAttackBlocked(attacker, defender){
    if(defender.state !== "BLOCKING") return false;
    if(defender.ki <= 0) return false;
    const angleToAttacker = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
    let diff = Math.abs(angleToAttacker - defender.angle);
    if(diff > Math.PI) diff = Math.PI*2 - diff;
    return diff < 1.0; 
}