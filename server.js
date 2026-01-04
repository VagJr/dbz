const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

// ==========================================
// BANCO DE DADOS (Opcional)
// ==========================================
let pool = null;
try {
    const { Pool } = require('pg');
    if (process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log(">> MODO ONLINE: Banco de Dados Conectado.");
    } else {
        console.log(">> MODO LOCAL: Usando memória RAM.");
    }
} catch (e) {
    console.log(">> AVISO: Módulo 'pg' não instalado. Rodando em memória.");
}

// ==========================================
// CONFIGURAÇÕES GERAIS
// ==========================================
const SNAKE_WAY_START = { x: 0, y: -12000 };
const KAIOH_PLANET    = { x: 0, y: -25000 };
const TICK = 33; // ~30 FPS Server loop

const BOSS_PHASES = {
    PHASE_1: { hp: 0.65, aggression: 0.6 },
    PHASE_2: { hp: 0.35, aggression: 0.8 },
    PHASE_3: { hp: 0.0,  aggression: 1.0 }
};

// ==========================================
// MAPA (PLANETAS)
// ==========================================
let PLANETS = [
    { id: "EARTH_CORE", name: "Capital do Oeste", x: 2000, y: 2000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 1, biome: "EARTH" },
    { id: "KAME_ISLAND", name: "Casa do Kame", x: 6000, y: -4000, radius: 800, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 5, biome: "EARTH" },
    { id: "NAMEK_VILLAGE", name: "Nova Namek", x: -18000, y: 5000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 20, biome: "NAMEK" },
    { id: "GURU_HOUSE", name: "Casa do Patriarca", x: -22000, y: 8000, radius: 900, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 25, biome: "NAMEK" },
    { id: "FRIEZA_BASE", name: "Base Freeza 79", x: -35000, y: -10000, radius: 1500, owner: null, guild: null, stability: 100, taxRate: 10, treasury: 0, level: 40, biome: "FRIEZA" },
    { id: "FUTURE_RUINS", name: "Ruínas do Futuro", x: 15000, y: 0, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 50, biome: "FUTURE" },
    { id: "DEMON_GATE", name: "Portão Demoníaco", x: 0, y: 25000, radius: 1200, owner: null, guild: null, stability: 100, taxRate: 5, treasury: 0, level: 60, biome: "DEMON" },
    { id: "MAKAI_CORE", name: "Reino dos Demônios", x: 5000, y: 35000, radius: 1000, owner: null, guild: null, stability: 100, taxRate: 8, treasury: 0, level: 70, biome: "DEMON" },
    { id: "VAMPA_WASTES", name: "Deserto de Vampa", x: -45000, y: 15000, radius: 1400, owner: null, guild: null, stability: 100, taxRate: 2, treasury: 0, level: 80, biome: "VAMPA" },
    { id: "BEERUS_PLANET", name: "Planeta de Beerus", x: 0, y: -90000, radius: 2000, owner: null, guild: null, stability: 100, taxRate: 15, treasury: 0, level: 100, biome: "DIVINE" },
    { id: "ZEN_PALACE", name: "Palácio Zen-Oh", x: 0, y: -120000, radius: 3000, owner: null, guild: null, stability: 100, taxRate: 20, treasury: 0, level: 150, biome: "DIVINE" }
];

// ==========================================
// SAGAS (PROGRESSÃO & TUTORIAL)
// ATUALIZADO: Foco em Guia
// ==========================================
const SAGA_STEPS = [
    // --- FASE 1: TUTORIAL ---
    { id: 0, title: "CONTROLE DE KI", objective: "Segure 'C' para carregar sua energia ao máximo.", type: "BP", req: 600, targetZone: "EARTH_CORE" },
    { id: 1, title: "COMBATE BÁSICO", objective: "Treine socando Rochas ou um Saibaman.", type: "LEVEL", req: 2, targetZone: "EARTH_CORE" },
    { id: 2, title: "EXPLORAÇÃO", objective: "Voe até a Casa do Kame (Ilha ao Sul).", type: "VISIT", target: "KAME_ISLAND", targetZone: "KAME_ISLAND" },
    
    // --- FASE 2: HISTÓRIA ---
    { id: 3, title: "PRIMEIRA AMEAÇA", objective: "Derrote Raditz na Terra Central.", type: "KILL", target: "RADITZ", targetZone: "EARTH_CORE" },
    { id: 4, title: "TREINO NO ALÉM", objective: "Voe para o Norte (Céu) e encontre o Caminho da Serpente.", type: "VISIT", target: "SNAKE_WAY", targetZone: null }, 
    { id: 5, title: "KAIOH DO NORTE", objective: "Chegue ao Planeta Kaioh e aprenda o Kaioken.", type: "VISIT", target: "KAIOH", targetZone: "KAIOH_PLANET" }, // Lógica especial no loop
    
    { id: 6, title: "INVASÃO SAIYAJIN", objective: "Volte para a Terra e vença Nappa ou Vegeta.", type: "KILL", target: "VEGETA_SCOUTER", targetZone: "EARTH_CORE" },
    { id: 7, title: "A LENDA DO SUPER SAIYAJIN", objective: "Transforme-se em SSJ (Tecla G).", type: "FORM", target: "SSJ", targetZone: "ANY" },
    
    // --- FASE 3: ESPAÇO ---
    { id: 8, title: "RUMO A NAMEKUSEI", objective: "Viaje para o Setor Oeste (Esquerda Total).", type: "VISIT", target: "NAMEK", targetZone: "NAMEK_VILLAGE" },
    { id: 9, title: "FORÇAS ESPECIAIS", objective: "Derrote o Capitão Ginyu em Namek.", type: "KILL", target: "GINYU", targetZone: "NAMEK_VILLAGE" },
    { id: 10, title: "O IMPERADOR", objective: "Derrote Freeza Forma Final.", type: "KILL", target: "FRIEZA_FINAL", targetZone: "NAMEK_VILLAGE" },
    
    // --- FASE 4: ANDROIDES ---
    { id: 11, title: "FUTURO SOMBRIO", objective: "Vá para o Futuro (Leste/Direita).", type: "VISIT", target: "FUTURE", targetZone: "FUTURE_RUINS" },
    { id: 12, title: "PERFEIÇÃO", objective: "Derrote Perfect Cell nas Ruínas.", type: "KILL", target: "PERFECT_CELL", targetZone: "FUTURE_RUINS" },
    { id: 13, title: "SUPERAR LIMITES", objective: "Alcance a forma SSJ2 ou superior.", type: "FORM", target: "SSJ2", targetZone: "ANY" },
    
    // --- FASE 5: MAGIA ---
    { id: 14, title: "REINO INFERIOR", objective: "Vá para o Sul Profundo (Portão Demoníaco).", type: "VISIT", target: "DEMON", targetZone: "DEMON_GATE" },
    { id: 15, title: "MAGIA NEGRA", objective: "Derrote Kid Buu.", type: "KILL", target: "KID_BUU", targetZone: "MAKAI_CORE" },
    
    // --- FASE 6: DEUSES ---
    { id: 16, title: "REINO DIVINO", objective: "Voe extremamente ao Norte (Espaço Profundo).", type: "VISIT", target: "DIVINE", targetZone: "BEERUS_PLANET" },
    { id: 17, title: "O DESTRUIDOR", objective: "Derrote Beerus.", type: "KILL", target: "BEERUS", targetZone: "BEERUS_PLANET" },
    { id: 18, title: "INSTINTO", objective: "Alcance a forma UI (Ultra Instinct).", type: "FORM", target: "UI", targetZone: "ANY" },
    { id: 19, title: "O LENDÁRIO", objective: "Vá para Vampa (Extremo Oeste) e vença Broly.", type: "KILL", target: "LEGENDARY_BROLY", targetZone: "VAMPA_WASTES" },
    
    // --- ENDGAME ---
    { id: 20, title: "DOMINAÇÃO", objective: "Conquiste um Planeta para sua Guilda.", type: "DOMINATION", target: "ANY", targetZone: "ANY" },
    { id: 21, title: "CICLO ETERNO", objective: "Faça um Rebirth (Nível 150 - Tecla R no Menu).", type: "REBIRTH", target: "ANY", targetZone: "ANY" }
];

// ==========================================
// BOTS (IA)
// ==========================================
const BOT_NAMES = ["Kakaroto_BR", "Vegeta_Prince", "xXTrunksXx", "GohanBeast", "PiccoloSensei", "BrolyRage", "FriezaLord", "HitAssassin", "JirenGray", "YamchaGod", "KrillinDestructo", "Android17MVP"];
const BOT_CHATS = ["Alguem BR?", "X1?", "Onde upa?", "Lag", "GG", "Ez", "Bora farmar", "Aff morri", "LOL", "Server top", "Procuro Guild"];

class BotPlayer {
    constructor() {
        this.name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        this.id = "BOT_" + Math.random().toString(36).substr(2, 9);
        this.isNPC = true;
        this.isBotPlayer = true;
        this.level = Math.floor(Math.random() * 60) + 1;
        this.xp = 0;
        this.bp = 1000 * this.level;
        this.maxHp = 1000 + this.level * 300;
        this.hp = this.maxHp;
        this.maxKi = 100 + this.level * 20;
        this.ki = this.maxKi;
        
        const randPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
        this.x = randPlanet.x + (Math.random() - 0.5) * 1000;
        this.y = randPlanet.y + (Math.random() - 0.5) * 1000;
        
        this.vx = 0; this.vy = 0;
        this.angle = 0;
        this.form = "BASE";
        this.color = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"][Math.floor(Math.random() * 5)];
        this.state = "IDLE";
        this.targetId = null;
        this.currentTask = "FARMING"; 
        this.taskTimer = 0;
        this.actionTimer = 0;
        this.chatTimer = Math.random() * 20000 + 10000;
        this.rebirths = Math.random() > 0.9 ? 1 : 0;
        this.skills = ["KAMEHAMEHA"];

        if(this.level > 120) this.form = "UI";
        else if(this.level > 90) this.form = "BLUE";
        else if(this.level > 70) this.form = "GOD";
        else if(this.level > 50) this.form = "SSJ3";
        else if(this.level > 20) this.form = "SSJ";
    }

    update() {
        if(this.hp <= 0) {
            this.hp = this.maxHp;
            this.x = SNAKE_WAY_START.x + (Math.random()-0.5)*200;
            this.y = SNAKE_WAY_START.y;
            this.form = "BASE";
            this.state = "IDLE";
            this.currentTask = "TRAINING"; 
            return;
        }

        if(this.ki < this.maxKi && this.state !== "ATTACKING" && this.state !== "BLOCKING") this.ki += 5;
        this.actionTimer--; this.taskTimer--;

        if (this.taskTimer <= 0) {
            const rand = Math.random();
            if (rand < 0.6) this.currentTask = "FARMING";
            else if (rand < 0.9) this.currentTask = "FIGHTING";
            else this.currentTask = "TRAVELING";
            this.taskTimer = 500 + Math.random() * 1000;
            this.targetId = null;
        }

        if(this.actionTimer <= 0) { this.decideAction(); this.actionTimer = 20; }
        
        this.x += this.vx; this.y += this.vy;
        if(this.state !== "MOVING") { this.vx *= 0.9; this.vy *= 0.9; } else { this.vx *= 0.96; this.vy *= 0.96; }

        if(this.chatTimer-- <= 0) {
            if(Math.random() > 0.8) chats.push({ x: this.x, y: this.y, text: BOT_CHATS[Math.floor(Math.random()*BOT_CHATS.length)], owner: this.name, life: 150 });
            this.chatTimer = 20000 + Math.random() * 30000;
        }

        if(this.ki > this.maxKi * 0.95 && this.form === "BASE" && this.level > 10) {
             io.emit("fx", { type: "transform", x: this.x, y: this.y, form: "SSJ" });
             this.form = "SSJ";
        }
    }

    decideAction() {
        let target = null;
        if (this.currentTask === "FARMING") {
            const rock = rocks.find(r => Math.hypot(r.x - this.x, r.y - this.y) < 1000);
            if (rock) { this.moveToAndAttack(rock, true); return; }
            target = npcs.find(n => n.id !== this.id && !n.isBotPlayer && !n.isDead && Math.hypot(n.x - this.x, n.y - this.y) < 1500);
        } else if (this.currentTask === "FIGHTING") {
            target = npcs.find(n => n.id !== this.id && n.isBotPlayer && !n.isDead && Math.hypot(n.x - this.x, n.y - this.y) < 2000);
            if (!target && Math.random() > 0.99) { target = Object.values(players).find(p => !p.isDead && !p.isSpirit && Math.hypot(p.x - this.x, p.y - this.y) < 500); }
        } else if (this.currentTask === "TRAVELING") {
             if (Math.random() > 0.95) this.angle = Math.random() * Math.PI * 2;
             this.vx += Math.cos(this.angle) * 3; this.vy += Math.sin(this.angle) * 3;
             this.state = "MOVING"; return;
        }

        if (target) { this.targetId = target.id; this.moveToAndAttack(target, false); } 
        else { this.state = "IDLE"; }
    }

    moveToAndAttack(target, isStatic) {
        const dx = target.x - this.x; const dy = target.y - this.y; const dist = Math.hypot(dx, dy);
        this.angle = Math.atan2(dy, dx);
        if (dist > 120) {
            const speed = 4 + (this.level * 0.05);
            this.vx += Math.cos(this.angle) * speed; this.vy += Math.sin(this.angle) * speed;
            this.state = "MOVING";
        } else {
            this.state = "ATTACKING"; target.hp -= this.level * 20; 
            io.emit("fx", { type: "hit", x: target.x, y: target.y, dmg: this.level * 20 });
            if (!isStatic) { target.vx = Math.cos(this.angle) * 15; target.vy = Math.sin(this.angle) * 15; }
            if (target.hp <= 0) { if(isStatic) { const rIdx = rocks.indexOf(target); if(rIdx > -1) { rocks.splice(rIdx, 1); craters.push({ x: target.x, y: target.y, r: target.r, life: 1000 }); } } else { handleKill(this, target); } }
        }
    }
}

// Procedural quests
const QUEST_TEMPLATES = [
    { type: "KILL", template: "Derrote {count} {target}", countBase: 5, rewardXpMult: 2.5 },
    { type: "BP", template: "Treine até {count} de Poder", countBase: 5000, rewardXpMult: 1.5 },
    { type: "VISIT", template: "Patrulhe o setor {target}", countBase: 1, rewardXpMult: 3.0 }
];

const initDB = async () => {
    if (!pool) return;
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
                pvp_kills INTEGER DEFAULT 0,
                rebirths INTEGER DEFAULT 0,
                quest_data TEXT DEFAULT '{}',
                saga_step INTEGER DEFAULT 0
            );
        `);
        await pool.query(`CREATE TABLE IF NOT EXISTS planets (id VARCHAR(50) PRIMARY KEY, owner VARCHAR(255), guild VARCHAR(50), stability INTEGER, tax_rate INTEGER, treasury INTEGER);`);
        const res = await pool.query("SELECT * FROM planets");
        res.rows.forEach(row => {
            const p = PLANETS.find(pl => pl.id === row.id);
            if(p) { p.owner = row.owner; p.guild = row.guild; p.stability = row.stability; p.taxRate = row.tax_rate; p.treasury = row.treasury; }
        });
        console.log(">> DB Sincronizado.");
    } catch (err) { console.error("Erro no DB Init:", err.message); }
};
initDB();

const players = {};
let projectiles = [];
let npcs = [];
let rocks = []; 
let craters = [];
let chats = []; 
let dragonBalls = []; // Global DBs

let globalEventTimer = 0;
let eventActive = false;
let eventMobIds = [];
let leaderboard = [];

const TITLES_DATA = {
    "WARRIOR": { req: "level", val: 10, name: "Guerreiro Z" },
    "ELITE": { req: "bp", val: 10000, name: "Elite Saiyajin" },
    "SLAYER": { req: "kills", val: 50, name: "Assassino" },
    "GOD": { req: "form", val: "GOD", name: "Divindade" },
    "CONQUEROR": { req: "domination", val: 1, name: "Imperador" },
    "LEGEND": { req: "rebirth", val: 1, name: "Lenda Viva" }
};

const FORM_STATS = {
    "BASE": { spd: 6,  dmg: 1.0, hpMult: 1.0, kiMult: 1.0 },
    "SSJ":  { spd: 8,  dmg: 1.5, hpMult: 1.5, kiMult: 1.2 },
    "SSJ2": { spd: 9,  dmg: 1.8, hpMult: 1.8, kiMult: 1.4 },
    "SSJ3": { spd: 11, dmg: 2.2, hpMult: 2.2, kiMult: 1.5 },
    "GOD":  { spd: 14, dmg: 3.0, hpMult: 3.0, kiMult: 2.0 },
    "BLUE": { spd: 17, dmg: 4.5, hpMult: 4.0, kiMult: 3.0 },
    "UI":   { spd: 22, dmg: 6.0, hpMult: 5.0, kiMult: 5.0 }
};

const FORM_ORDER = ["BASE", "SSJ", "SSJ2", "SSJ3", "GOD", "BLUE", "UI"];
const FORM_REQS = { "BASE": 0, "SSJ": 5, "SSJ2": 20, "SSJ3": 40, "GOD": 60, "BLUE": 80, "UI": 100 };
const BP_TRAIN_CAP = { BASE: 2000, SSJ: 8000, SSJ2: 20000, SSJ3: 50000, GOD: 150000, BLUE: 500000, UI: 2000000 };

const BESTIARY = {
    EARTH: { mobs: ["RR_SOLDIER", "WOLF_BANDIT", "DINOSAUR", "SAIBAMAN"], bosses: ["RADITZ", "NAPPA", "VEGETA_SCOUTER"] },
    NAMEK: { mobs: ["FRIEZA_SOLDIER", "NAMEK_WARRIOR", "ZARBON_MONSTER"], bosses: ["GINYU", "FRIEZA_FINAL"] },
    FRIEZA: { mobs: ["FRIEZA_ELITE", "ROBOT_GUARD", "ALIEN_MERCENARY"], bosses: ["COOLER", "METAL_COOLER"] },
    FUTURE: { mobs: ["ANDROID_19", "ANDROID_20", "CELL_JR"], bosses: ["ANDROID_17", "ANDROID_18", "PERFECT_CELL"] },
    DEMON: { mobs: ["PUIPUI", "YAKON", "DABURA_MINION"], bosses: ["DABURA", "FAT_BUU", "KID_BUU"] },
    VAMPA: { mobs: ["GIANT_SPIDER", "VAMPA_BEAST"], bosses: ["PARAGUS", "BROLY_WRATH", "LEGENDARY_BROLY"] },
    DIVINE: { mobs: ["PRIDE_TROOPER", "ANGEL_TRAINEE"], bosses: ["TOPPO_GOD", "JIREN", "JIREN_FULL_POWER", "BEERUS"] }
};

function getMaxBP(p) {
    const form = p.form || "BASE";
    const formCap = BP_TRAIN_CAP[form] || BP_TRAIN_CAP.BASE;
    const rebirthMult = 1 + ((p.rebirths || 0) * 1.0); 
    return Math.floor(formCap * rebirthMult);
}

function clampBP(p) {
    const maxBP = getMaxBP(p);
    if (p.bp > maxBP) p.bp = maxBP;
    checkAchievements(p);
    checkQuest(p, "BP", null);
    checkSaga(p, "BP", null);
}

// ------------------------------------------
// SISTEMA DE ESFERAS DO DRAGÃO
// ------------------------------------------
function initDragonBalls() {
    dragonBalls = [];
    for(let i=1; i<=7; i++) {
        spawnDragonBall(i);
    }
}

function spawnDragonBall(id) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5000 + Math.random() * 35000;
    dragonBalls.push({
        id: id,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        holderId: null,
        groundTimer: 9000 // ~5 minutos
    });
}

function checkDragonBallPickup(p) {
    dragonBalls.forEach(db => {
        if (!db.holderId) {
            const dist = Math.hypot(p.x - db.x, p.y - db.y);
            if (dist < 60) {
                db.holderId = p.id;
                p.dbCount = (p.dbCount || 0) + 1;
                p.pvpMode = true; // MALDIÇÃO: Força PvP
                io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: `PEGOU ESFERA ${db.id}!` });
            }
        }
    });
}

function dropDragonBalls(p) {
    if (!p.dbCount || p.dbCount <= 0) return;
    dragonBalls.forEach(db => {
        if (db.holderId === p.id) {
            db.holderId = null;
            db.x = p.x + (Math.random()-0.5) * 100;
            db.y = p.y + (Math.random()-0.5) * 100;
            db.groundTimer = 9000;
        }
    });
    p.dbCount = 0;
    io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "ESFERAS PERDIDAS!" });
}

// ------------------------------------------
// COMBATE REFINADO (AUTO-AIM)
// ------------------------------------------
function findBestCombatTarget(p, range, inputAngle) {
    let best = null;
    let bestScore = Infinity; 
    
    const possibleTargets = [...Object.values(players), ...npcs];
    
    possibleTargets.forEach(t => {
        if (t.id === p.id || t.isDead || t.isSpirit) return;
        if (!t.isNPC && !p.pvpMode && !t.pvpMode) return; 

        const dist = Math.hypot(t.x - p.x, t.y - p.y);
        if (dist > range) return;

        const angleToEnemy = Math.atan2(t.y - p.y, t.x - p.x);
        let angleDiff = Math.abs(angleToEnemy - inputAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (angleDiff < Math.PI / 2.5) {
            const score = dist + (angleDiff * 100); 
            if (score < bestScore) {
                bestScore = score;
                best = t;
            }
        }
    });
    return best;
}

function applyComboLock(p, target) {
    if (!target) return;
    p.comboTargetId = target.id;
    p.comboLockTimer = 8; 
}

function updateComboLock(p) {
    if (p.comboLockTimer > 0) {
        p.comboLockTimer--;
    } else {
        p.comboTargetId = null;
    }
}


function getZoneInfo(x, y) {
    if (y < -80000) return { id: "DIVINE", level: 100 };
    if (x < -40000) return { id: "VAMPA", level: 80 };
    if (x < -10000 && y < 10000) { if (x < -30000) return { id: "FRIEZA", level: 40 }; return { id: "NAMEK", level: 20 }; }
    if (x > 10000 && y > -5000 && y < 5000) return { id: "FUTURE", level: 50 };
    if (y > 20000) return { id: "DEMON", level: 60 };
    return { id: "EARTH", level: Math.max(1, Math.floor(Math.hypot(x,y)/2000)) };
}

function assignQuest(p) {
    if (p.quest && !p.quest.completed) return; 
    const zone = getZoneInfo(p.x, p.y);
    const typeKey = Object.keys(QUEST_TEMPLATES)[Math.floor(Math.random() * Object.keys(QUEST_TEMPLATES).length)];
    const template = QUEST_TEMPLATES[typeKey];
    
    let target = "", count = 0, desc = "";
    if (template.type === "KILL") {
        const list = BESTIARY[zone.id].mobs;
        target = list[Math.floor(Math.random() * list.length)];
        count = Math.floor(template.countBase + (p.level * 0.3));
        desc = `Derrote ${count} ${target}`;
    } else if (template.type === "BP") {
        target = "POWER"; count = Math.floor(getMaxBP(p) * 0.95); desc = `Treine até ${count} BP`;
    } else {
        const zones = Object.keys(BESTIARY); target = zones[Math.floor(Math.random() * zones.length)];
        count = 1; desc = `Patrulhe o setor ${target}`;
    }
    p.quest = { type: template.type, target, required: count, current: 0, desc, rewardXp: p.level * 2000 * template.rewardXpMult, completed: false };
    if(pool) pool.query('UPDATE users SET quest_data=$1 WHERE name=$2', [JSON.stringify(p.quest), p.name]).catch(console.error);
}

function checkQuest(p, type, data) {
    if (!p.quest || p.quest.completed) return;
    let progress = false;
    if (p.quest.type === "KILL" && type === "KILL" && (p.quest.target === "ANY" || p.quest.target === data.name)) { p.quest.current++; progress = true; }
    if (p.quest.type === "BP" && type === "BP" && p.bp >= p.quest.required) { p.quest.current = p.bp; progress = true; }
    if (p.quest.type === "VISIT" && type === "VISIT" && getZoneInfo(p.x, p.y).id === p.quest.target) { p.quest.current = 1; progress = true; }
    
    if (progress) {
        if (p.quest.current >= p.quest.required) {
            p.quest.completed = true; p.xp += p.quest.rewardXp;
            io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y }); 
            io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "MISSÃO COMPLETA!" });
            setTimeout(() => assignQuest(p), 5000);
        }
        if(pool) pool.query('UPDATE users SET quest_data=$1 WHERE name=$2', [JSON.stringify(p.quest), p.name]).catch(console.error);
    }
}

function checkSaga(p, type, data) {
    const currentStep = SAGA_STEPS[p.sagaStep || 0];
    if(!currentStep) return;

    let completed = false;
    if (type === "BP" && currentStep.type === "BP" && p.bp >= currentStep.req) completed = true;
    if (type === "LEVEL" && currentStep.type === "LEVEL" && p.level >= currentStep.req) completed = true; 
    if (type === "KILL" && currentStep.type === "KILL" && (data.name === currentStep.target || currentStep.target === "ANY")) completed = true;
    if (type === "VISIT" && currentStep.type === "VISIT") {
        if (currentStep.target === "SNAKE_WAY" && p.y < -12000) completed = true; 
        else if (currentStep.target === "KAIOH" && p.y < -24000) completed = true;
        else if (currentStep.targetZone && Math.hypot(p.x - PLANETS.find(pl=>pl.id===currentStep.targetZone)?.x, p.y - PLANETS.find(pl=>pl.id===currentStep.targetZone)?.y) < 2000) completed = true;
        else if (getZoneInfo(p.x, p.y).id === currentStep.target) completed = true;
    }
    if (type === "FORM" && currentStep.type === "FORM") {
        if(currentStep.target === "SSJ2" && (p.form === "SSJ2" || p.form === "SSJ3" || p.form === "GOD")) completed = true;
        else if(p.form === currentStep.target) completed = true;
    }
    if (type === "DOMINATION" && currentStep.type === "DOMINATION" && p.guild && data.owner === p.guild) completed = true;
    if (type === "REBIRTH" && currentStep.type === "REBIRTH") completed = true;

    if (completed) {
        p.sagaStep = (p.sagaStep || 0) + 1;
        p.xp += p.level * 8000;
        io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "SAGA AVANÇADA!" });
        io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y }); 
        if(pool) pool.query('UPDATE users SET saga_step=$1 WHERE name=$2', [p.sagaStep, p.name]).catch(console.error);
    }
}

function initWorld() {
    rocks = [];
    for(let i=0; i<1800; i++) {
        const angle = Math.random() * Math.PI * 2; const dist = Math.random() * 90000; 
        const x = Math.cos(angle) * dist; const y = Math.sin(angle) * dist; 
        const zone = getZoneInfo(x, y);
        let type = "rock_earth";
        if(zone.id === "NAMEK") type = "rock_namek"; if(zone.id === "FRIEZA") type = "rock_metal"; if(zone.id === "FUTURE") type = "rock_ruin";
        if(zone.id === "DEMON") type = "rock_magic"; if(zone.id === "VAMPA") type = "rock_bone"; if(zone.id === "DIVINE") type = "rock_god";
        if (zone.id === "DIVINE" && Math.random() > 0.4) continue; 
        rocks.push({ id: i, x: Math.round(x), y: Math.round(y), r: 35 + Math.random() * 80, hp: 500 + (dist/20), maxHp: 500 + (dist/20), type });
    }
    npcs = [];
    for(let i=0; i<600; i++) spawnMobRandomly();
    PLANETS.forEach(p => { const list = BESTIARY[p.biome]?.bosses || BESTIARY.EARTH.bosses; spawnBossAt(p.x, p.y, list[Math.floor(Math.random() * list.length)]); });
    
    // Spawna apenas 5 Bots
    for(let i=0; i<5; i++) { npcs.push(new BotPlayer()); } 
    initDragonBalls();
    console.log(">> Universo Gerado e Pronto.");
}

function spawnMobRandomly() { const a = Math.random() * Math.PI * 2; const d = 2000 + Math.random() * 80000; spawnMobAt(Math.cos(a)*d, Math.sin(a)*d); }
function spawnMobAt(x, y, aggressive = false) {
    const zone = getZoneInfo(x, y); const list = BESTIARY[zone.id]?.mobs || BESTIARY.EARTH.mobs; const type = list[Math.floor(Math.random() * list.length)];
    const id = "mob_" + Math.random().toString(36).substr(2, 9);
    let stats = { name: type, hp: 500 * zone.level, bp: 1200 * zone.level, level: zone.level, color: "#fff", aggro: aggressive ? 3000 : (1000 + (zone.level * 20)), aiType: "MELEE" };
    if(zone.id === "NAMEK") stats.color = "#8f8"; if(zone.id === "DEMON") stats.color = "#f0f"; if(zone.id === "FRIEZA") stats.color = "#a0a"; if(zone.id === "FUTURE") stats.color = "#888"; if(zone.id === "VAMPA") stats.color = "#dd4"; if(zone.id === "DIVINE") stats.color = "#0ff";
    const npc = { id, isNPC: true, r: 25, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 200, maxKi: 200, level: stats.level, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, name: stats.name, zoneId: zone.id, aiType: stats.aiType, aggro: stats.aggro, targetId: null };
    npcs.push(npc); return npc;
}
function spawnBossAt(x, y, forcedType = null) {
    const zone = getZoneInfo(x, y); let type = forcedType;
    if (!type) { const list = BESTIARY[zone.id]?.bosses || BESTIARY.EARTH.bosses; type = list[Math.floor(Math.random() * list.length)]; }
    let stats = { name: type, hp: 40000 * zone.level, bp: 120000 * zone.level, color: "#f00", r: 70 };
    if(type.includes("VEGETA")) stats.color = "#33f"; if(type.includes("FRIEZA")) stats.color = "#fff"; if(type.includes("CELL")) stats.color = "#484"; if(type.includes("BUU")) stats.color = "#fbb"; if(type.includes("BLACK")) stats.color = "#333"; if(type.includes("JIREN")) stats.color = "#f22"; if(type.includes("BROLY")) { stats.color = "#0f0"; stats.r = 90; }
    const boss = { id: "BOSS_" + type + "_" + Date.now(), name: type, isNPC: true, isBoss: true, x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, maxHp: stats.hp, hp: stats.hp, ki: 20000, maxKi: 20000, level: zone.level + 20, cancelWindow: 0, lastInputTime: 0, orbitDir: 1, bp: stats.bp, state: "IDLE", color: stats.color, lastAtk: 0, combo: 0, stun: 0, targetId: null };
    npcs.push(boss); return boss;
}

function checkAchievements(p) {
    let unlocked = p.titles ? p.titles.split(',') : ["Novato"]; let changed = false;
    if (p.level >= TITLES_DATA.WARRIOR.val && !unlocked.includes(TITLES_DATA.WARRIOR.name)) { unlocked.push(TITLES_DATA.WARRIOR.name); changed = true; }
    if (p.bp >= TITLES_DATA.ELITE.val && !unlocked.includes(TITLES_DATA.ELITE.name)) { unlocked.push(TITLES_DATA.ELITE.name); changed = true; }
    if (p.form === "GOD" && !unlocked.includes(TITLES_DATA.GOD.name)) { unlocked.push(TITLES_DATA.GOD.name); changed = true; }
    if (p.pvp_kills >= TITLES_DATA.SLAYER.val && !unlocked.includes(TITLES_DATA.SLAYER.name)) { unlocked.push(TITLES_DATA.SLAYER.name); changed = true; }
    if ((p.rebirths || 0) >= TITLES_DATA.LEGEND.val && !unlocked.includes(TITLES_DATA.LEGEND.name)) { unlocked.push(TITLES_DATA.LEGEND.name); changed = true; }
    if (changed) { p.titles = unlocked.join(','); io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "NOVO TÍTULO DESBLOQUEADO!" }); if(pool) pool.query('UPDATE users SET titles=$1 WHERE name=$2', [p.titles, p.name]).catch(console.error); }
}

initWorld();

const server = http.createServer((req, res) => {
    let filePath = "." + req.url;
    if (filePath === "./") filePath = "./index.html";
    
    const extname = path.extname(filePath);
    let contentType = "text/html";
    switch (extname) {
        case ".js": contentType = "text/javascript"; break;
        case ".css": contentType = "text/css"; break;
        case ".json": contentType = "application/json"; break;
        case ".png": contentType = "image/png"; break;
        case ".mp3": contentType = "audio/mpeg"; break; // IMPORTANTE: Servir MP3
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT'){
                res.writeHead(404); res.end("Arquivo nao encontrado.");
            } else {
                res.writeHead(500); res.end('Erro no servidor: '+error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const io = new Server(server, { transports: ['websocket'], pingInterval: 25000, pingTimeout: 5000 });

function packStateForPlayer(pid) {
    const p = players[pid]; if (!p) return null;
    const VIEW_DIST = 2500; const filterFunc = (o) => Math.abs(o.x - p.x) < VIEW_DIST && Math.abs(o.y - p.y) < VIEW_DIST;
    
    // Atualiza posição das Esferas com base no dono (Server-side render prep)
    const packedDragonBalls = dragonBalls.map(db => {
        if(db.holderId && players[db.holderId]) {
            return { id: db.id, x: players[db.holderId].x, y: players[db.holderId].y, held: true };
        }
        return { id: db.id, x: db.x, y: db.y, held: false };
    });

    const packedPlayers = {};
    for (const pid in players) { const pl = players[pid]; if (pid === p.id || filterFunc(pl)) { packedPlayers[pid] = { id: pl.id, name: pl.name, x: Math.round(pl.x), y: Math.round(pl.y), vx: Math.round(pl.vx), vy: Math.round(pl.vy), hp: pl.hp, maxHp: pl.maxHp, ki: pl.ki, maxKi: pl.maxKi, xp: pl.xp, xpToNext: pl.xpToNext, level: pl.level, bp: pl.bp, state: pl.state, form: pl.form, color: pl.color, stun: pl.stun, isSpirit: pl.isSpirit, pvpMode: pl.pvpMode, quest: pl.quest, rebirths: pl.rebirths || 0, current_title: pl.current_title, guild: pl.guild, skills: pl.skills || [], dbCount: pl.dbCount || 0 }; } }
    
    const currentSagaStep = SAGA_STEPS[p.sagaStep || 0] || { title: "FIM DO JOGO", objective: "Aguarde updates!", targetZone: null };
    const visibleNpcs = npcs.filter(filterFunc).map(n => ({...n, x: Math.round(n.x), y: Math.round(n.y)}));
    const visibleProjs = projectiles.filter(filterFunc).map(pr => ({...pr, x: Math.round(pr.x), y: Math.round(pr.y)}));
    const visibleChats = chats.filter(c => c.life > 0 && Math.abs(c.x - p.x) < VIEW_DIST && Math.abs(c.y - p.y) < VIEW_DIST);
    
    // Passa o objeto saga completo
    return { 
        players: packedPlayers, npcs: visibleNpcs, projectiles: visibleProjs, rocks: rocks.filter(filterFunc), craters, chats: visibleChats, domination: PLANETS, leaderboard: leaderboard.slice(0, 5), saga: currentSagaStep, dbs: packedDragonBalls
    };
}
const localUsers = {};

io.on("connection", (socket) => {
    socket.on("login", async (data) => {
        try {
            let user;
            if (pool) {
                const res = await pool.query('SELECT * FROM users WHERE name = $1', [data.user]);
                user = res.rows[0];
                if (!user) {
                    // Start at saga_step 0 -> Tutorial
                    const insert = await pool.query('INSERT INTO users (name, pass, level, xp, bp, guild, titles, current_title, pvp_score, rebirths, quest_data, saga_step) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [data.user, data.pass, 1, 0, 500, null, 'Novato', 'Novato', 0, 0, '{}', 0]);
                    user = insert.rows[0];
                } else if (user.pass !== data.pass) return;
            } else {
                user = localUsers[data.user];
                if (!user) { user = { name: data.user, pass: data.pass, level: 1, xp: 0, bp: 500, guild: null, titles: 'Novato', current_title: 'Novato', pvp_score: 0, pvp_kills: 0, rebirths: 0, quest_data: '{}', saga_step: 0 }; localUsers[data.user] = user; } else if (user.pass !== data.pass) return;
            }
            
            const xpToNext = user.level * 800;
            const rebirthMult = 1 + (user.rebirths || 0) * 0.2; 
            const quest = user.quest_data ? (typeof user.quest_data === 'string' ? JSON.parse(user.quest_data) : user.quest_data) : {};
            let skills = quest.skills || [];

            players[socket.id] = {
                ...user, id: socket.id, r: 20, x: 0, y: 0, vx: 0, vy: 0, angle: 0,
                baseMaxHp: (1000 + user.level * 200) * rebirthMult, baseMaxKi: (100 + user.level * 10) * rebirthMult,
                hp: (1000 + user.level * 200) * rebirthMult, maxHp: (1000 + user.level * 200) * rebirthMult,
                ki: 100, maxKi: (100 + user.level * 10) * rebirthMult, form: "BASE", xpToNext,
                state: "IDLE", lastHit: 0, stunImmune: 0, combo: 0, comboTimer: 0, attackLock: 0, counterWindow: 0, lastAtk: 0,
                isDead: false, isSpirit: false, stun: 0, color: "#ff9900", chargeStart: 0, pvpMode: false, lastTransform: 0, bpCapped: false,
                reviveTimer: 0, linkId: null, quest: quest || {}, rebirths: user.rebirths || 0, sagaStep: user.saga_step || 0,
                skills: skills, dbCount: 0, isTutorialDialogActive: false
            };
            
            if(!players[socket.id].quest.type) assignQuest(players[socket.id]);
            socket.emit("auth_success", players[socket.id]);
            console.log(`>> ${data.user} Entrou no jogo.`);
        } catch (err) { console.error("Erro no Login:", err); }
    });

    socket.on("toggle_pvp", () => { 
        const p = players[socket.id]; 
        if (!p || p.isDead || p.isSpirit) return;
        if (p.dbCount > 0) return; // Não pode desligar PvP se tiver esferas
        p.pvpMode = !p.pvpMode; 
        socket.emit("pvp_status", p.pvpMode); 
    });
    
    socket.on("tutorial_dialog_state", (isOpen) => {
         const p = players[socket.id];
         if(p) p.isTutorialDialogActive = isOpen;
    });

    socket.on("set_title", (title) => { const p = players[socket.id]; if(p && p.titles.includes(title)) { p.current_title = title; if(pool) pool.query('UPDATE users SET current_title=$1 WHERE name=$2', [title, p.name]).catch(console.error); } });
    socket.on("create_guild", (guildName) => { const p = players[socket.id]; if(p && !p.guild && guildName.length < 15) { p.guild = guildName; if(pool) pool.query('UPDATE users SET guild=$1 WHERE name=$2', [guildName, p.name]).catch(console.error); io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GUILDA CRIADA: " + guildName }); checkSaga(p, "DOMINATION", {owner: guildName}); } });

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
        if(pool) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3, rebirths=$4 WHERE name=$5', [p.level, p.xp, p.bp, p.rebirths, p.name]).catch(console.error);
        checkAchievements(p);
    });

    socket.on("chat", (msg) => { const p = players[socket.id]; if (!p || msg.length > 50) return; if (msg.startsWith("/guild ")) { const name = msg.substring(7).trim(); if (name.length >= 3) socket.emit("create_guild", name); return; } if (msg.startsWith("/title ")) { const title = msg.substring(7).trim(); socket.emit("set_title", title); return; } if (p.lastMsg && Date.now() - p.lastMsg < 1000) return; p.lastMsg = Date.now(); chats.push({ x: p.x, y: p.y, text: msg, owner: p.name, life: 150 }); });
    socket.on("emote", (type) => { const p = players[socket.id]; if(!p) return; io.emit("fx", { type: "emote", x: p.x, y: p.y, icon: type }); });

    socket.on("input", (input) => {
        const p = players[socket.id]; if(!p || p.stun > 0 || p.isDead) return; 
        
        // Bloqueia movimento se estiver em dialogo de tutorial
        if(p.isTutorialDialogActive) return;

        const now = Date.now();
        const formStats = FORM_STATS[p.form] || FORM_STATS["BASE"]; 
        let speed = formStats.spd; if(p.isSpirit) speed *= 0.8;
        const moveMod = (p.state === "BLOCKING" || p.state === "CHARGING_ATK") ? 0.3 : 1.0;
        
        if(input.x || input.y) { 
            p.vx += input.x * speed * moveMod; 
            p.vy += input.y * speed * moveMod; 
            if(!["ATTACKING", "BLOCKING", "CHARGING"].includes(p.state)) p.state = "MOVING"; 
        }

        if (p.attackLock <= 0 && input.angle !== undefined) p.angle = input.angle;

        if(input.block) { 
            if(p.state !== "BLOCKING") { p.blockStart = now; p.state = "BLOCKING"; }
            if(p.ki > 0) { p.ki -= 0.2; } else { p.state = "IDLE"; }
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
        if (now % 100 === 0) { checkQuest(p, "VISIT", null); checkSaga(p, "VISIT", null); checkSaga(p, "LEVEL", null); }
    });

    socket.on("release_attack", () => {
        const p = players[socket.id]; if (!p || p.isSpirit || p.stun > 0) return;
        if(p.isTutorialDialogActive) return; // Não ataca no tutorial

        const now = Date.now(); const formStats = FORM_STATS[p.form] || FORM_STATS.BASE;
        
        // ============================
        // COMBATE INTELIGENTE (SMART SNAP)
        // ============================
        const range = 220;
        let target = findBestCombatTarget(p, range, p.angle);
        
        if (!target) {
             // Fallback: Procura qualquer coisa quebrável ou muito perto
            let best = null, bestDist = 200;
            [...Object.values(players), ...npcs].forEach(t => {
                if (t.id === p.id || t.isDead || t.isSpirit) return; if (!t.isNPC && !p.pvpMode) return;
                const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bestDist) { bestDist = d; best = t; }
            });
            target = best;
        }

        // Se encontrou alvo válido, ajusta ângulo automaticamente (Snap)
        if (target) {
            const dx = target.x - p.x; const dy = target.y - p.y;
            p.angle = Math.atan2(dy, dx);
        }

        // Clash Logic
        if (target && target.state === "ATTACKING" && !target.isDead) {
            const angToTarget = Math.atan2(target.y - p.y, target.x - p.x); const angToPlayer = Math.atan2(p.y - target.y, p.x - target.x);
            let diffP = Math.abs(angToTarget - p.angle); if (diffP > Math.PI) diffP = Math.PI*2 - diffP;
            if (diffP < 1.0 && Math.hypot(target.x - p.x, target.y - p.y) < 180) {
                const midX = (p.x + target.x) / 2; const midY = (p.y + target.y) / 2;
                io.emit("fx", { type: "clash", x: midX, y: midY });
                const push = 20; p.vx = -Math.cos(angToTarget) * push; p.vy = -Math.sin(angToTarget) * push;
                target.vx = -Math.cos(angToPlayer) * push; target.vy = -Math.sin(angToPlayer) * push;
                p.combo = 0; p.attackLock = 15; target.combo = 0; target.attackLock = 15; 
                return;
            }
        }
        
        if (p.comboTimer <= 0) p.combo = 0;
        const COMBO_STEPS = [ { type: "RUSH", range: 220, selfSpd: 65, targetPush: 5, stun: 15, dmg: 1.0 }, { type: "HEAVY", range: 130, selfSpd: 30, targetPush: 8, stun: 15, dmg: 1.2 }, { type: "MULTI", range: 130, selfSpd: 40, targetPush: 5, stun: 15, dmg: 0.8 }, { type: "UPPER", range: 130, selfSpd: 20, targetPush: 10, stun: 18, dmg: 1.5 }, { type: "FINISH", range: 160, selfSpd: 10, targetPush: 180, stun: 35, dmg: 2.5 } ];
        if (p.combo >= COMBO_STEPS.length) p.combo = 0;
        const step = COMBO_STEPS[p.combo]; const isFinisher = step.type === "FINISH";
        
        if (target && !isFinisher) { target.vx *= 0.1; target.vy *= 0.1; }
        
        p.vx = Math.cos(p.angle) * step.selfSpd; p.vy = Math.sin(p.angle) * step.selfSpd;
        p.state = "ATTACKING"; p.attackLock = isFinisher ? 18 : 10; p.cancelWindow = 5; p.lastAtk = now;
        let baseDmg = Math.floor((65 + p.level * 10) * formStats.dmg * step.dmg); 
        
       // ============================
// DANO
// ============================
if (target) {
    const dist = Math.hypot(target.x - p.x, target.y - p.y); 
    if (dist <= step.range) {
        if (target.isNPC) target.targetId = p.id; 

        let dmg = baseDmg;
        if (!target.isNPC) dmg *= 0.5;

        // Sempre trava o alvo no combo
        applyComboLock(p, target);

        // BLOQUEIO NORMAL
        if (target.state === "BLOCKING" && !isFinisher) {
            dmg *= 0.25;
            target.ki -= 12;
            target.counterWindow = 12;
            io.emit("fx", { type: "block_hit", x: target.x, y: target.y });

        } else {
            // QUEBRA DE GUARDA NO FINISHER
            if (target.state === "BLOCKING" && isFinisher) {
                target.state = "IDLE";
                target.stun = 30;
                io.emit("fx", { type: "guard_break", x: target.x, y: target.y });
            }

            // DANO NORMAL
            target.hp -= dmg;
            target.stun = step.stun;
            target.vx = Math.cos(p.angle) * step.targetPush;
            target.vy = Math.sin(p.angle) * step.targetPush;

            io.emit("fx", {
                type: isFinisher ? "finisher" : "hit",
                x: target.x,
                y: target.y,
                dmg
            });
        }

        if (target.hp <= 0) handleKill(p, target);

        p.combo++;
        p.comboTimer = 35;

    } else if (p.combo > 0) {
        p.comboTimer = 15;
    }
} else if (p.combo > 0) {
    p.comboTimer = 15;
}
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
                 p.ki = 0; 
                 p.state = "ATTACKING"; p.attackLock = 60;
                 projectiles.push({ id: Math.random(), owner: p.id, x: p.x, y: p.y - 100, vx: Math.cos(p.angle) * 8, vy: Math.sin(p.angle) * 8, dmg: (500 + p.level * 50) * formStats.dmg, size: 250, isSuper: true, life: 300, color: "#00aaff", pvp: p.pvpMode });
                 io.emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "GENKI DAMA!" });
                 return;
            }

            if (unlocked.includes("KAMEHAMEHA") && p.ki > 80) {
                 p.ki -= 80;
                 p.state = "ATTACKING"; p.attackLock = 30;
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
        const p = players[socket.id]; if (!p || p.isSpirit || p.isDead || p.stun > 0) return; if (p.lastTransform && Date.now() - p.lastTransform < 2000) return;
        const currentIdx = FORM_ORDER.indexOf(p.form || "BASE"); let nextIdx = currentIdx + 1; if (nextIdx >= FORM_ORDER.length) nextIdx = 0;
        const nextForm = FORM_ORDER[nextIdx]; if (p.level < FORM_REQS[nextForm]) { if (p.form !== "BASE") nextIdx = 0; else return; }
        const newFormName = FORM_ORDER[nextIdx]; const stats = FORM_STATS[newFormName]; if (!stats) return;
        if (newFormName !== "BASE" && p.ki < 50) return; if (newFormName !== "BASE") p.ki -= 50;
        p.form = newFormName; p.lastTransform = Date.now();
        const rebirthMult = 1 + ((p.rebirths||0) * 0.2);
        p.maxHp = Math.floor(p.baseMaxHp * stats.hpMult); p.maxKi = Math.floor(p.baseMaxKi * stats.kiMult); p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.1));
        io.emit("fx", { type: "transform", x: p.x, y: p.y, form: newFormName });
        [...Object.values(players), ...npcs].forEach(t => { if (t.id === p.id || t.isDead || t.isSpirit) return; const dist = Math.hypot(t.x - p.x, t.y - p.y); if (dist < 300) { const ang = Math.atan2(t.y - p.y, t.x - p.x); t.vx = Math.cos(ang) * 40; t.vy = Math.sin(ang) * 40; t.stun = 15; } });
        checkAchievements(p); clampBP(p); checkSaga(p, "FORM", null);
    });
    socket.on("set_tax", (val) => { const p = players[socket.id]; if (!p || !p.guild) return; const planet = PLANETS.find(pl => Math.hypot(pl.x - p.x, pl.y - p.y) < pl.radius); if (planet && planet.owner === p.guild && val >= 0 && val <= 20) { planet.taxRate = val; if(pool) pool.query('INSERT INTO planets (id, tax_rate) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET tax_rate = $2', [planet.id, val]).catch(console.error); io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: `IMPOSTO: ${val}%` }); } });
    socket.on("disconnect", () => delete players[socket.id]);
});

function handleKill(killer, victim) {
    const planet = PLANETS.find(pl => Math.hypot(pl.x - victim.x, pl.y - victim.y) < pl.radius);
    if (planet && !killer.isNPC) {
        if (planet.owner && planet.owner !== killer.guild) { planet.stability -= 5; if (planet.stability <= 0) { planet.owner = null; planet.guild = null; planet.stability = 20; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "PLANETA NEUTRO!" }); } } 
        else if (!planet.owner && killer.guild) { planet.stability += 5; if (planet.stability >= 100) { planet.owner = killer.guild; planet.guild = killer.guild; io.emit("fx", { type: "bp_limit", x: planet.x, y: planet.y, text: "DOMINADO POR " + killer.guild }); } }
        if(pool && planet) { pool.query(`INSERT INTO planets (id, owner, guild, stability, treasury) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET owner=$2, guild=$3, stability=$4, treasury=$5`, [planet.id, planet.owner, planet.guild, planet.stability, planet.treasury]).catch(console.error); }
    }
    
    // DROP DE ESFERAS AO MORRER
    if(!victim.isNPC) {
        dropDragonBalls(victim);
    }

    if(victim.isNPC) {
        victim.isDead = true;
        if(!killer.isNPC) {
            checkQuest(killer, "KILL", victim); 
            checkSaga(killer, "KILL", victim); 
            killer.hp = Math.min(killer.maxHp, killer.hp + (killer.maxHp * 0.2)); 
            const levelDiff = victim.level - killer.level;
            let xpMultiplier = 1.0;
            if(levelDiff < -10) xpMultiplier = 0.1;
            if(levelDiff > 5) xpMultiplier = 1.5;
            const xpGain = Math.floor(victim.level * 100 * xpMultiplier);
            const xpReq = killer.level * 800; 
            killer.xp += xpGain; 
            killer.xpToNext = xpReq;
            if(xpGain > 0) io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: xpGain });
            if (planet && planet.owner && planet.owner !== killer.guild) { const tax = Math.floor(xpGain * (planet.taxRate / 100)); planet.treasury += tax; }
            
            if(killer.xp >= xpReq) { 
                killer.level++; killer.xp = 0; killer.bp += 5000; clampBP(killer); 
                const rebirthMult = 1 + ((killer.rebirths||0) * 0.2);
                killer.baseMaxHp += 1000 * rebirthMult; killer.baseMaxKi += 100 * rebirthMult; 
                const stats = FORM_STATS[killer.form] || FORM_STATS["BASE"]; killer.maxHp = killer.baseMaxHp * stats.hpMult; killer.maxKi = killer.baseMaxKi * stats.kiMult; killer.hp = killer.maxHp; killer.ki = killer.maxKi; killer.xpToNext = killer.level * 800; 
                io.emit("fx", { type: "levelup", x: killer.x, y: killer.y }); 
                if(pool) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [killer.level, killer.xp, killer.bp, killer.name]).catch(e => console.error(e)); 
            }
        }
        if(victim.isBotPlayer) {
             setTimeout(() => { victim.isDead = false; victim.hp = victim.maxHp; victim.x = SNAKE_WAY_START.x + (Math.random()-0.5)*1000; victim.y = SNAKE_WAY_START.y; }, 8000);
        } else {
             setTimeout(() => { npcs = npcs.filter(n => n.id !== victim.id); spawnMobRandomly(); }, 5000);
        }
    } else {
        victim.isSpirit = true; victim.hp = 1; victim.ki = 0; victim.state = "SPIRIT"; victim.vx = 0; victim.vy = 0; victim.x = SNAKE_WAY_START.x; victim.y = SNAKE_WAY_START.y; victim.angle = -Math.PI / 2;
        io.emit("fx", { type: "vanish", x: victim.x, y: victim.y });
        if(!killer.isNPC) { killer.pvp_score += 10; killer.pvp_kills = (killer.pvp_kills || 0) + 1; checkAchievements(killer); io.emit("fx", { type: "xp_gain", x: killer.x, y: killer.y, amount: 50 }); if(pool) pool.query('UPDATE users SET pvp_score=$1 WHERE name=$2', [killer.pvp_score, killer.name]).catch(console.error); }
    }
}

function triggerRandomEvent() {
    if(eventActive) { npcs = npcs.filter(n => !eventMobIds.includes(n.id)); eventMobIds = []; eventActive = false; io.emit("fx", { type: "bp_limit", x: 0, y: 0, text: "AMEAÇA CONTIDA." }); return; }
    let targetPlanet = PLANETS.find(p => p.owner) || PLANETS[Math.floor(Math.random() * PLANETS.length)];
    const events = [ { type: "HORDE_SAIBAMAN", msg: `INVASÃO EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, { type: "INVASION_FRIEZA", msg: `FORÇAS DE FREEZA EM ${targetPlanet.name}!`, zoneId: targetPlanet.id }, { type: "BOSS_BROLY", msg: `BROLY ESTÁ DESTRUINDO ${targetPlanet.name}!`, zoneId: targetPlanet.id }];
    const ev = events[Math.floor(Math.random() * events.length)]; 
    io.emit("fx", { type: "bp_limit", x: targetPlanet.x, y: targetPlanet.y, text: ev.msg }); eventActive = true;
    if (targetPlanet.owner) targetPlanet.stability = Math.max(10, targetPlanet.stability - 20);
    if(ev.type.includes("HORDE")) { for(let i=0; i<15; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*1000, targetPlanet.y + (Math.random()-0.5)*1000, true); mob.name = "INVASOR"; mob.color = "#f00"; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("INVASION")) { for(let i=0; i<10; i++) { const mob = spawnMobAt(targetPlanet.x + (Math.random()-0.5)*800, targetPlanet.y + (Math.random()-0.5)*800, true); mob.name = "ELITE"; mob.color = "#808"; mob.hp *= 2; eventMobIds.push(mob.id); } } 
    else if(ev.type.includes("BOSS")) { const boss = spawnBossAt(targetPlanet.x, targetPlanet.y, "LEGENDARY_BROLY"); boss.hp *= 3; boss.bp *= 2; eventMobIds.push(boss.id); }
}

setInterval(() => {
    craters = craters.filter(c => { c.life--; return c.life > 0; });
    chats = chats.filter(c => { c.life--; return c.life > 0; });
    leaderboard = Object.values(players).sort((a,b) => b.pvp_score - a.pvp_score).slice(0,5).map(p => ({name: p.name, score: p.pvp_score, guild: p.guild}));
    globalEventTimer++; if(globalEventTimer > 6000) { triggerRandomEvent(); globalEventTimer = 0; }

    // Atualiza esferas (respawn se ficar mto tempo no chão)
    dragonBalls.forEach(db => {
        if (!db.holderId) {
            db.groundTimer--;
            if(db.groundTimer <= 0) {
                // Respawn em outro lugar
                const angle = Math.random() * Math.PI * 2;
                const dist = 5000 + Math.random() * 35000;
                db.x = Math.cos(angle) * dist;
                db.y = Math.sin(angle) * dist;
                db.groundTimer = 9000;
            }
        }
    });

    Object.values(players).forEach(p => {
		// ==========================================
// AJUSTE DE DIREÇÃO DURANTE COMBO (PLAYER)
// ==========================================
updateComboLock(p);

if (p.comboTargetId) {
    const t = players[p.comboTargetId] || npcs.find(n => n.id === p.comboTargetId);
    if (t && !t.isDead) {
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.hypot(dx, dy);

        // Correção suave de posição (cola sem teleportar)
        if (dist > 30 && dist < 180) {
            const pull = 0.18;
            p.vx += dx * pull * 0.01;
            p.vy += dy * pull * 0.01;
        }

        // Micro-dash só enquanto ataca
        if (p.state === "ATTACKING" && dist > 60) {
            const dash = 0.6;
            p.vx += Math.cos(Math.atan2(dy, dx)) * dash;
            p.vy += Math.sin(Math.atan2(dy, dx)) * dash;
        }
    }
}

        if(p.stun > 0) p.stun--; if(p.attackLock > 0) p.attackLock--; if(p.comboTimer > 0) p.comboTimer--; if(p.counterWindow > 0) p.counterWindow--;
        p.x += p.vx; p.y += p.vy; 
        
        if (p.state === "MOVING") { p.vx *= 0.96; p.vy *= 0.96; } 
        else { p.vx *= 0.85; p.vy *= 0.85; }
        
        if (!p.isDead && !p.isSpirit) {
            p.bp += 1 + Math.floor(p.level * 0.1); 
            clampBP(p);
            
            checkDragonBallPickup(p);

            // MISSÃO DE APRENDER SKILLS (Kamehameha / Genki Dama)
            if (!p.skills) p.skills = [];
            // Kame House Check
            if (!p.skills.includes("KAMEHAMEHA")) {
                const distKame = Math.hypot(p.x - 6000, p.y - (-4000));
                if (distKame < 400 && p.level >= 5) {
                    p.skills.push("KAMEHAMEHA");
                    io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "APRENDEU: KAMEHAMEHA!" });
                    io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y });
                    if(pool) pool.query('UPDATE users SET quest_data=$1 WHERE name=$2', [JSON.stringify({skills: p.skills}), p.name]).catch(console.error);
                }
            }
            // King Kai Check
            if (!p.skills.includes("GENKI_DAMA")) {
                const distKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y);
                if (distKai < 400 && p.level >= 50) {
                     p.skills.push("GENKI_DAMA");
                     io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "APRENDEU: GENKI DAMA!" });
                     io.to(p.id).emit("fx", { type: "levelup", x: p.x, y: p.y });
                }
            }

            if (p.state === "CHARGING") { 
                checkSaga(p, "BP", null); // Verifica missão de Tutorial de Carga
                if (Math.random() > 0.85) { p.xp += 1; p.xpToNext = p.level * 800; p.bp += 10; clampBP(p); } 
                const xpReq = p.level * 800; 
                if(p.xp >= xpReq) { 
                    p.level++; p.xp = 0; p.bp += 5000; clampBP(p); 
                    const rebirthMult = 1 + ((p.rebirths||0) * 0.2);
                    p.baseMaxHp += 1000 * rebirthMult; p.baseMaxKi += 100 * rebirthMult; 
                    const stats = FORM_STATS[p.form] || FORM_STATS["BASE"]; p.maxHp = p.baseMaxHp * stats.hpMult; p.maxKi = p.baseMaxKi * stats.kiMult; p.hp = p.maxHp; p.ki = p.maxKi; p.xpToNext = p.level * 800; 
                    io.emit("fx", { type: "levelup", x: p.x, y: p.y }); 
                    if(pool) pool.query('UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4', [p.level, p.xp, p.bp, p.name]).catch(e => console.error(e)); 
                } 
            } 
            else if(p.ki < p.maxKi && p.state === "IDLE") { p.ki += 0.5; }
            const distToKingKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y);
            const distToDende = Math.hypot(p.x - (-22000), p.y - 8000);
            if (distToKingKai < 1500 || distToDende < 1500) { p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.05)); p.ki = Math.min(p.maxKi, p.ki + (p.maxKi * 0.05)); }
        }
        if (p.bp >= getMaxBP(p)) { if (!p.bpCapped) { p.bpCapped = true; io.to(p.id).emit("fx", { type: "bp_limit", x: p.x, y: p.y, text: "TREINO MÁXIMO (TRANSFORME-SE)" }); } } else { p.bpCapped = false; }
        if (p.isSpirit) { const distToKai = Math.hypot(p.x - KAIOH_PLANET.x, p.y - KAIOH_PLANET.y); if (distToKai < 600) { p.isSpirit = false; p.hp = p.maxHp; p.ki = p.maxKi; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; io.emit("fx", { type: "transform", x: 0, y: 0, form: "BASE" }); io.emit("fx", { type: "levelup", x: 0, y: 0 }); } }
    });

    npcs.forEach(n => {
        if (n.isDead) return;
        if (n.isBotPlayer) { n.update(); return; }
        if (n.stun > 0) { n.stun--; n.x += n.vx; n.y += n.vy; n.vx *= 0.9; n.vy *= 0.9; n.state = "STUNNED"; return; }
        let target = null; let minDist = n.aggro || 1200;
        if (n.targetId && players[n.targetId] && !players[n.targetId].isDead && !players[n.targetId].isSpirit) { const t = players[n.targetId]; if (Math.hypot(n.x - t.x, n.y - t.y) < 3000) target = t; else n.targetId = null; }
        if (!target) { for (const p of Object.values(players)) { if (p.isDead || p.isSpirit) continue; if (Math.abs(p.x - n.x) > minDist || Math.abs(p.y - n.y) > minDist) continue; const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < minDist) { minDist = d; target = p; } } }
        if (!target) { const botTarget = npcs.find(other => other.isBotPlayer && !other.isDead && Math.hypot(n.x - other.x, n.y - other.y) < minDist); if(botTarget) target = botTarget; }

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
	
	// ==========================================
// AJUSTE DE DIREÇÃO DURANTE COMBO
// ==========================================



    Object.keys(players).forEach(id => { const st = packStateForPlayer(id); if(st) io.to(id).emit("state", st); });
}, TICK);

server.listen(3000, () => console.log(">> SERVER ONLINE EM: http://localhost:3000"));


/* =========================
   CLOUD STABLE LOOP (DELTA TIME)
   ========================= */
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const NET_FPS = 12;

let lastTick = Date.now();
let netAccum = 0;

function serverLoop() {
  const now = Date.now();
  let delta = now - lastTick;
  if (delta > 200) delta = 200;

  while (delta >= TICK_MS) {
    updateWorld(TICK_MS / 1000);
    delta -= TICK_MS;
    lastTick += TICK_MS;
  }
  setImmediate(serverLoop);
}

function updateWorld(dt) {
  Object.values(players).forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });

  netAccum += dt;
  if (netAccum >= 1 / NET_FPS) {
    io.emit("state", {
      players, npcs, projectiles, rocks, craters, chats,
      domination: PLANETS, leaderboard, saga: null, dbs: dragonBalls
    });
    netAccum = 0;
  }
}

serverLoop();
