const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
window.socket = io({ transports: ['websocket'] });

let myId = null;
let players = {}, npcs = [], projectiles = [], rocks = [], craters = [], chats = [];
let dominationZones = [], leaderboard = []; // dominationZones agora contém os PLANETAS do server
let cam = { x: 0, y: 0 }, mouse = { x: 0, y: 0 }, keys = {};
let mouseLeft = false, mouseRight = false;
let particles = [], shockwaves = [], trails = [], texts = [];
let screenShake = 0, flash = 0, hitStop = 0;
let joystickMove = { x: 0, y: 0 };
let scouterActive = false; 
let showMap = true;
let activeWindow = null; 
let announcement = { text: "", life: 0, color: "#f00" };

// ===============================
// SISTEMA DE TUTORIAL (SCOUTER AI)
// ===============================
let tutorialActive = false;
let tutorialStep = 0;
let tutorialText = "";
let tutorialIndex = 0;
let tutorialTimer = 0;
const TUTORIAL_DATA = [
    { text: "INICIANDO SISTEMA... ANALISANDO USUÁRIO...", duration: 200 },
    { text: "BEM-VINDO À GALÁXIA Z. SEU OBJETIVO É DOMINAR.", duration: 250 },
    { text: "PLANETAS PODEM SER CONQUISTADOS POR GUILDAS.", duration: 300 },
    { text: "MATE INIMIGOS DENTRO DA ZONA PARA GANHAR INFLUÊNCIA.", duration: 300 },
    { text: "SE SUA GUILDA DOMINAR, VOCÊ COBRA IMPOSTOS DE XP.", duration: 300 },
    { text: "USE [G] PARA TRANSFORMAR E [P] PARA ATIVAR PVP.", duration: 300 },
    { text: "SISTEMA ONLINE. BOA SORTE.", duration: 200 }
];

function initTutorial() {
    if (!localStorage.getItem("dbz_tutorial_v2_complete")) {
        tutorialActive = true;
    }
}

const ZOOM_SCALE = 0.6; // Zoom out para ver mais
const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

// COORDENADAS PARA DESENHO DO MAPA
const SNAKE_WAY_START = { x: 0, y: -12000 };
const KAIOH_PLANET    = { x: 0, y: -25000 };

if (!document.getElementById("ui-container")) {
    const div = document.createElement("div"); div.id = "ui-container"; document.body.appendChild(div);
}

const textInput = document.createElement("input");
textInput.type = "text"; textInput.style.cssText = "position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:300px; padding:10px; background:rgba(0,0,0,0.8); color:#ffaa00; border:2px solid #ffcc00; display:none; font-family:'Orbitron',sans-serif;";
textInput.placeholder = "Digite...";
document.body.appendChild(textInput);

textInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        toggleChat();
    }
});


const dustParticles = [];
for(let i=0; i<60; i++) { dustParticles.push({ x: Math.random() * 2000, y: Math.random() * 1000, size: Math.random() * 1.5, vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.2, alpha: Math.random() * 0.5 + 0.1 }); }

// NAVGATION WAYPOINTS
const WAYPOINTS = [ 
    { name: "TERRA", x: 0, y: 0 }, 
    { name: "KAIOH", x: 0, y: -25000 }, 
    { name: "INFERNO", x: 0, y: 25000 }, 
    { name: "NAMEK", x: -18000, y: 2000 }, 
    { name: "VEGETA", x: -50000, y: 0 }, 
    { name: "FUTURO", x: 15000, y: 0 }, 
    { name: "BEERUS", x: 0, y: -90000 }
];

function bindBtn(id, onPress, onRelease) { const el = document.getElementById(id); if (!el) return; const press = e => { e.preventDefault(); e.stopPropagation(); onPress && onPress(); }; const release = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(); }; el.addEventListener('touchstart', press, { passive: false }); el.addEventListener('touchend', release, { passive: false }); el.addEventListener('mousedown', press); el.addEventListener('mouseup', release); }

bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
bindBtn('btn-block', () => keys['KeyQ']=true, () => delete keys['KeyQ']);
bindBtn('btn-charge', () => keys['KeyC']=true, () => delete keys['KeyC']);
bindBtn('btn-vanish', () => socket.emit('vanish'));
bindBtn('btn-transform', () => socket.emit('transform'));
bindBtn('btn-scouter', () => { scouterActive = !scouterActive; });
bindBtn('btn-ranking', () => { activeWindow = activeWindow === "ranking" ? null : "ranking"; });
bindBtn('btn-guild', () => { activeWindow = "menu"; onMenuOption("guild"); });
bindBtn('btn-title', () => { activeWindow = "menu"; onMenuOption("title"); });
bindBtn('btn-rebirth', () => { socket.emit("rebirth"); });

const btnMenu = document.getElementById("btn-menu"); if(btnMenu) btnMenu.onclick = () => { activeWindow = activeWindow ? null : 'menu'; }
const btnChat = document.getElementById("btn-chat"); if(btnChat) btnChat.onclick = () => { toggleChat(); }

const btnLogin = document.getElementById("btn-login");
if(btnLogin) btnLogin.onclick = () => { const user = document.getElementById("username").value; const pass = document.getElementById("password").value; if(user && pass) window.socket.emit("login", { user, pass }); };

window.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("mousemove", e => { mouse.x = (e.clientX - window.innerWidth / 2) / ZOOM_SCALE; mouse.y = (e.clientY - window.innerHeight / 2) / ZOOM_SCALE; });
window.addEventListener("mousedown", e => { 
    if(tutorialActive) {
        tutorialStep++; tutorialIndex = 0; tutorialTimer = 0;
        if (tutorialStep >= TUTORIAL_DATA.length) { tutorialActive = false; localStorage.setItem("dbz_tutorial_v2_complete", "true"); }
    }
    if(e.button === 0) mouseLeft = true; if(e.button === 2) mouseRight = true; if(activeWindow && mouse.x > 200 || mouse.x < -200) activeWindow = null; 
});
window.addEventListener("mouseup", e => { if(e.button === 0) { mouseLeft = false; window.socket.emit("release_attack"); } if(e.button === 2) { mouseRight = false; window.socket.emit("release_blast"); } });
canvas.addEventListener("touchstart", e => {
    if (tutorialActive) {
        tutorialStep++; tutorialIndex = 0; tutorialTimer = 0;
        if (tutorialStep >= TUTORIAL_DATA.length) { tutorialActive = false; localStorage.setItem("dbz_tutorial_v2_complete", "true"); }
        return;
    }
    if (!activeWindow) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    handleCanvasUIInteraction(x, y);
    e.preventDefault();
}, { passive: false });

function toggleChat(forceOpen = false) {
    if (textInput.style.display === "block" && !forceOpen) {
        const msg = textInput.value.trim();
        if (msg) { socket.emit("chat", msg); }
        textInput.value = ""; textInput.style.display = "none"; textInput.blur();
        return;
    }
    textInput.style.display = "block"; textInput.placeholder = "Digite sua mensagem..."; textInput.focus();
    Object.keys(keys).forEach(k => keys[k] = false);
}

window.addEventListener("keydown", e => {
    if (textInput.style.display === "block") return;
    if (e.repeat) return;

    keys[e.code] = true;

    switch (e.code) {

        // ======================
        // VANISH (ESPAÇO)
        // ======================
        case "Space":
            socket.emit("vanish");
            break;

        // ======================
        // SISTEMAS CORE
        // ======================
        case "KeyG":
            socket.emit("transform");
            break;

        case "KeyT":
            scouterActive = !scouterActive;
            break;

        case "KeyP":
            socket.emit("toggle_pvp");
            break;

        case "KeyH":
            tutorialActive = !tutorialActive;
            break;

        case "KeyL":
            activeWindow = activeWindow ? null : "menu";
            break;

        case "KeyR":
            activeWindow = "ranking";
            break;

        case "Escape":
            activeWindow = null;
            break;
    }
});



window.addEventListener("keyup", e => keys[e.code] = false);

const btnPvp = document.getElementById("btn-pvp"); if (btnPvp) { btnPvp.addEventListener("touchstart", e => { e.preventDefault(); socket.emit("toggle_pvp"); btnPvp.classList.toggle("active"); }); btnPvp.addEventListener("click", () => { socket.emit("toggle_pvp"); btnPvp.classList.toggle("active"); }); }

window.socket.on("auth_success", (data) => { 
    myId = data.id; 
    document.getElementById("login-screen").style.display = "none"; 
    document.getElementById("ui").style.display = "block"; 
    initTutorial(); 
    if (isMobile) { document.getElementById("mobile-ui").style.display = "block"; requestAnimationFrame(() => { initMobileControls(); }); } 
});

window.socket.on("state", data => {
    if(!myId) return;
    players = data.players; npcs = data.npcs; projectiles = data.projectiles; rocks = data.rocks; craters = data.craters || []; chats = data.chats || []; dominationZones = data.domination || []; leaderboard = data.leaderboard || [];
});

window.socket.on("fx", data => {
    if(data.type === "hit" || data.type === "heavy") { screenShake = data.type === "heavy" ? 30 : 10; shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: data.type === "heavy" ? 150 : 60, a: 1, color: "#fff" }); for(let i=0; i<12; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 }); if(data.dmg) texts.push({ x: data.x, y: data.y - 40, text: data.dmg.toString(), color: "#ffff00", life: 60, vy: -2, isDmg: true }); }
    if(data.type === "xp_gain") texts.push({ x: data.x, y: data.y - 60, text: "+" + data.amount + " XP", color: "#00ff00", life: 50, vy: -1.5 });
    if(data.type === "transform") { screenShake = 50; flash = 15; let c = "#ff0"; if(data.form === "GOD") c = "#f00"; if(data.form === "BLUE") c = "#0ff"; if(data.form === "UI") c = "#fff"; shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: c }); }
    if(data.type === "vanish") shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 80, a: 0.8, color: "#0ff" });
    if(data.type === "levelup") { texts.push({x: data.x, y: data.y - 80, text: "LEVEL UP!", color: "#00ffff", life: 120, vy: -0.5}); shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: "#fff" }); }
    if(data.type === "bp_limit") { texts.push({x: data.x, y: data.y - 100, text: data.text, color: "#ff0000", life: 150, vy: -0.5}); announcement = { text: data.text, life: 300, color: "#ff3300" }; screenShake = 20; }
    if(data.type === "emote") { texts.push({x: data.x, y: data.y - 60, text: data.icon, color: "#fff", life: 100, vy: -1, isEmote: true }); }
});

socket.on("pvp_status", enabled => { const btn = document.getElementById("btn-pvp"); if (btn) btn.classList.toggle("active", enabled); });

let joystick = null;
function initMobileControls() { if (!isMobile || !window.nipplejs) return; if (joystick) return; const zone = document.getElementById('joystick-container'); if (!zone) return; joystick = nipplejs.create({ zone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff9900', size: 120 }); joystick.on('move', (evt, data) => { if (!data || !data.vector) return; joystickMove.x = data.vector.x; joystickMove.y = -data.vector.y; }); joystick.on('end', () => { joystickMove.x = 0; joystickMove.y = 0; }); }
function handleCanvasUIInteraction(x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    if (activeWindow === "menu") {
        const options = [ { name: "ranking", y: cy - 100 }, { name: "guild",   y: cy - 50 }, { name: "title",   y: cy }, { name: "rebirth", y: cy + 50 } ];
        for (const opt of options) { if (Math.abs(y - opt.y) < 20 && Math.abs(x - cx) < 140) { onMenuOption(opt.name); return; } }
    }
    if (activeWindow === "ranking") { activeWindow = null; }
}
function onMenuOption(option) {
    if (option === "ranking") activeWindow = "ranking";
    if (option === "guild") { textInput.placeholder = "Digite: /guild NomeDaGuilda"; toggleChat(); }
    if (option === "title") { textInput.placeholder = "Digite: /title MeuTitulo"; toggleChat(); }
    if (option === "rebirth") { socket.emit("rebirth"); activeWindow = null; }
}

function drawBackground(camX, camY) {
    const viewW = canvas.width / ZOOM_SCALE; const viewH = canvas.height / ZOOM_SCALE; const buffer = 1000; const startX = camX - viewW / 2 - buffer; const startY = camY - viewH / 2 - buffer; const width = viewW + buffer * 2; const height = viewH + buffer * 2; const endX = startX + width; const endY = startY + height;
    let c1 = "#1a3a1a", c2 = "#000500"; 
    if (camY < -80000) { c1 = "#300030"; c2 = "#100010"; } else if (camY < -30000) { c1 = "#002040"; c2 = "#000510"; } else if (camY < -10000) { c1 = "#403000"; c2 = "#100500"; } else if (camY > 30000) { c1 = "#400000"; c2 = "#100000"; } else if (camY > 10000) { c1 = "#200040"; c2 = "#050010"; } else { c1 = "#001020"; c2 = "#000205"; } 
    const grd = ctx.createRadialGradient(camX, camY, viewH * 0.1, camX, camY, viewH * 1.5); grd.addColorStop(0, c1); grd.addColorStop(1, c2); ctx.fillStyle = grd; ctx.fillRect(startX, startY, width, height);
    const gridCell = 1000; const gridOffsetX = Math.floor(startX / gridCell) * gridCell; const gridOffsetY = Math.floor(startY / gridCell) * gridCell; 
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"; ctx.lineWidth = 2; ctx.beginPath(); 
    for(let x = gridOffsetX; x < endX; x += gridCell) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); } 
    for(let y = gridOffsetY; y < endY; y += gridCell) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); } 
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; dustParticles.forEach(p => { p.x += p.vx; p.y += p.vy; if(p.x > 2000) p.x = 0; if(p.x < 0) p.x = 2000; if(p.y > 1000) p.y = 0; if(p.y < 0) p.y = 1000; const screenPx = camX - viewW/2 + ((p.x + camX * 0.2) % viewW); const screenPy = camY - viewH/2 + ((p.y + camY * 0.2) % viewH); ctx.beginPath(); ctx.arc(screenPx, screenPy, p.size, 0, Math.PI*2); ctx.fill(); });
}

function drawSnakeWay() {
    const startY = SNAKE_WAY_START.y; const endY = KAIOH_PLANET.y;
    if (cam.y > endY - 2000 && cam.y < startY + 2000) {
        ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = "#e6b800"; ctx.strokeStyle = "#e6b800"; ctx.lineWidth = 80; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(0, startY);
        for (let y = startY; y > endY; y -= 1000) { const wave = Math.sin(y * 0.002) * 500; ctx.lineTo(wave, y); }
        ctx.stroke();
        ctx.fillStyle = "#4a8"; ctx.beginPath(); ctx.arc(0, endY, 400, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#a33"; ctx.fillRect(-100, endY - 480, 200, 150); ctx.beginPath(); ctx.moveTo(-120, endY - 480); ctx.lineTo(0, endY - 600); ctx.lineTo(120, endY - 480); ctx.fill();
        ctx.restore();
    }
}

function drawOtherWorld(camX, camY) { drawSnakeWay(); }

function drawDominationZones() { 
    dominationZones.forEach(z => { 
        ctx.save(); ctx.translate(z.x, z.y); 
        // Planeta Visual
        ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI*2); 
        ctx.strokeStyle = z.owner ? "#00ff00" : "#aaaaaa"; 
        ctx.lineWidth = 15; ctx.setLineDash([30, 20]); ctx.stroke(); 
        
        ctx.fillStyle = z.owner ? "rgba(0, 255, 0, 0.2)" : "rgba(100, 100, 100, 0.2)";
        ctx.fill();

        ctx.font = "bold 40px Orbitron"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; 
        ctx.fillText(z.name, 0, -z.radius - 40); 
        
        ctx.font = "24px Orbitron"; 
        if(z.owner) { 
            ctx.fillStyle = "#00ff00"; ctx.fillText(`GOVERNADOR: ${z.owner}`, 0, -z.radius + 20); 
            ctx.font = "18px Arial"; ctx.fillStyle = "#ffff00"; ctx.fillText(`IMPOSTO: ${z.taxRate || 0}%`, 0, -z.radius + 50);
        } else { 
            ctx.fillStyle = "#ccc"; ctx.fillText(`NEUTRO - ESTABILIDADE: ${z.stability}%`, 0, -z.radius + 20); 
        } 
        ctx.restore(); 
    }); 
}

function drawEntityHUD(e, sizeMult) {
    if (e.isSpirit) return;
    ctx.save(); ctx.translate(30 * sizeMult, -50 * sizeMult); ctx.transform(1, -0.22, 0, 1, 0, 0); 
    const mainColor = e.isBoss ? "#ff3333" : (e.isNPC ? "#ffaa00" : "#00ffff");
    ctx.shadowBlur = 8; ctx.shadowColor = mainColor; ctx.strokeStyle = "rgba(0,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(110, 0); ctx.stroke();
    ctx.fillStyle = mainColor; ctx.font = "bold 20px Orbitron"; ctx.fillText(e.name?.substring(0, 12) || "???", 5, -8);
    if (!e.isNPC) { ctx.font = "italic 12px Arial"; ctx.fillStyle = "#ffcc00"; let title = `<${e.current_title || "Novato"}>`; if (e.guild) title = `[${e.guild}] ` + title; ctx.fillText(title, 5, -28); }
    const hpPerc = Math.max(0, e.hp / e.maxHp); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 5, 100, 6); ctx.fillStyle = e.isBoss ? "#ff0000" : (e.isNPC ? "#ffaa00" : "#00ff00"); ctx.shadowBlur = 0; ctx.fillRect(0, 5, 100 * hpPerc, 6);
    if (!e.isNPC) { ctx.fillStyle = "#ffffff"; ctx.font = "12px Orbitron"; ctx.fillText(`BP: ${e.bp.toLocaleString()}`, 5, 20); if (e.pvpMode) { ctx.fillStyle = "#ff0000"; ctx.font = "bold 10px Arial"; ctx.fillText("PVP ON", 5, 32); } }
    ctx.restore();
}

function drawMiniWarrior(e, sizeMult) {
    const time = Date.now();
    let skinColor = "#ffdbac"; let giColor = e.color || "#ff6600"; let beltColor = "#0000aa"; let hairColor = "#1a1a1a"; let eyeColor = "#000"; let auraColor = null; let lightning = false;
    const currentForm = (e.form || "BASE").toUpperCase();
    if (currentForm === "SSJ" || currentForm === "SSJ2") { hairColor = "#ffeb3b"; eyeColor = "#00ffff"; auraColor = "rgba(255,235,59,0.5)"; if (currentForm === "SSJ2") lightning = true; } 
    else if (currentForm === "SSJ3") { hairColor = "#ffcc00"; eyeColor = "#00ffff"; auraColor = "rgba(255,170,0,0.6)"; lightning = true; } 
    else if (currentForm === "GOD") { hairColor = "#ff0055"; eyeColor = "#ff0055"; auraColor = "rgba(255,0,80,0.5)"; skinColor = "#ffe0e0"; } 
    else if (currentForm === "BLUE") { hairColor = "#00e5ff"; eyeColor = "#00e5ff"; auraColor = "rgba(0,229,255,0.6)"; } 
    else if (currentForm === "UI") { hairColor = "#e0e0e0"; eyeColor = "#c0c0c0"; auraColor = "rgba(255,255,255,0.8)"; giColor = "#ff4400"; }
    const breathe = Math.sin(time * 0.005) * 1.5; const speed = Math.hypot(e.vx, e.vy); const lean = Math.min(speed * 0.5, 10);
    ctx.rotate(e.angle);
    if ((auraColor || e.state === "CHARGING") && !e.isDead) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const pulse = 1 + Math.sin(time * 0.02) * 0.15; const auraSize = 45 * sizeMult * pulse; const grd = ctx.createRadialGradient(0, 0, 10, 0, 0, auraSize); grd.addColorStop(0, auraColor || "rgba(255,255,255,0.8)"); grd.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill(); if (lightning) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); const lAng = Math.random() * Math.PI * 2; ctx.moveTo(Math.cos(lAng) * 10, Math.sin(lAng) * 10); ctx.lineTo(Math.cos(lAng) * 30, Math.sin(lAng) * 30); ctx.stroke(); } ctx.restore(); }
    ctx.fillStyle = giColor; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14 * sizeMult - lean, -12 * sizeMult); ctx.lineTo(14 * sizeMult - lean, -12 * sizeMult); ctx.lineTo(10 * sizeMult, 12 * sizeMult); ctx.lineTo(-10 * sizeMult, 12 * sizeMult); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = beltColor; ctx.fillRect(-10 * sizeMult, 8 * sizeMult, 20 * sizeMult, 4 * sizeMult);
    ctx.save(); ctx.translate(-lean, breathe);
    ctx.fillStyle = skinColor; ctx.beginPath(); ctx.arc(0, 0, 11 * sizeMult, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = (currentForm && currentForm !== "BASE") ? eyeColor : "#fff"; ctx.beginPath(); ctx.moveTo(2 * sizeMult, -4 * sizeMult); ctx.lineTo(7 * sizeMult, -5 * sizeMult); ctx.lineTo(6 * sizeMult, -1 * sizeMult); ctx.closePath(); ctx.moveTo(2 * sizeMult, 4 * sizeMult); ctx.lineTo(7 * sizeMult, 5 * sizeMult); ctx.lineTo(6 * sizeMult, 1 * sizeMult); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hairColor; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.2; ctx.beginPath();
    if (currentForm === "SSJ3") { ctx.moveTo(-8, -5); ctx.quadraticCurveTo(-25 * sizeMult, 5, -5 * sizeMult, 35 * sizeMult); ctx.lineTo(5 * sizeMult, 35 * sizeMult); ctx.quadraticCurveTo(25 * sizeMult, 5, 8 * sizeMult, -5 * sizeMult); ctx.lineTo(10 * sizeMult, -12 * sizeMult); ctx.lineTo(0, -20 * sizeMult); ctx.lineTo(-10 * sizeMult, -12 * sizeMult); } 
    else if (currentForm && currentForm !== "BASE") { ctx.moveTo(-11 * sizeMult, -2 * sizeMult); ctx.lineTo(-16 * sizeMult, -15 * sizeMult); ctx.lineTo(-8 * sizeMult, -8 * sizeMult); ctx.lineTo(-6 * sizeMult, -25 * sizeMult); ctx.lineTo(0, -12 * sizeMult); ctx.lineTo(6 * sizeMult, -25 * sizeMult); ctx.lineTo(8 * sizeMult, -8 * sizeMult); ctx.lineTo(16 * sizeMult, -15 * sizeMult); ctx.lineTo(11 * sizeMult, -2 * sizeMult); ctx.lineTo(5 * sizeMult, -2 * sizeMult); ctx.lineTo(0, 4 * sizeMult); ctx.lineTo(-5 * sizeMult, -2 * sizeMult); } 
    else { ctx.moveTo(-11 * sizeMult, 2 * sizeMult); ctx.lineTo(-18 * sizeMult, -8 * sizeMult); ctx.lineTo(-9 * sizeMult, -5 * sizeMult); ctx.lineTo(-12 * sizeMult, -22 * sizeMult); ctx.lineTo(-2 * sizeMult, -10 * sizeMult); ctx.lineTo(8 * sizeMult, -20 * sizeMult); ctx.lineTo(6 * sizeMult, -5 * sizeMult); ctx.lineTo(16 * sizeMult, -2 * sizeMult); ctx.lineTo(10 * sizeMult, 6 * sizeMult); ctx.lineTo(3 * sizeMult, 1 * sizeMult); ctx.lineTo(0, 5 * sizeMult); ctx.lineTo(-3 * sizeMult, 1 * sizeMult); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (e.isSpirit) { ctx.strokeStyle = "#ffff00"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -25 * sizeMult, 12 * sizeMult, 4 * sizeMult, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
}

function drawEntity(e) {
    if (!e) return;
    if (e.isDead && e.isNPC) return;
    const sizeMult = e.isBoss ? 4 : 1;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.save(); ctx.rotate(e.angle); drawMiniWarrior(e, sizeMult); ctx.restore();
    ctx.save(); drawEntityHUD(e, sizeMult); ctx.restore();
    if (e.state === "BLOCKING") { ctx.save(); let blockAngle = e.angle; if (e.id === myId && !isMobile) blockAngle = Math.atan2(mouse.y, mouse.x); if (e.id === myId && isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) { blockAngle = Math.atan2(joystickMove.y, joystickMove.x); } ctx.rotate(blockAngle); ctx.strokeStyle = "rgba(100,200,255,0.85)"; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = "#00ffff"; ctx.beginPath(); ctx.arc(0, 0, 30 * sizeMult, -1, 1); ctx.stroke(); ctx.restore(); }
    const speedTrail = Math.hypot(e.vx, e.vy);
    if (hitStop <= 0 && speedTrail > 8 && (!e.lastTrail || performance.now() - e.lastTrail > 80)) { e.lastTrail = performance.now(); if (trails.length < 100) { trails.push({ x: e.x, y: e.y, angle: e.angle, color: getTrailColor(e), alpha: 0.35, sizeMult }); } }
    ctx.restore();
}

function drawScouterHUD(me) {
    if (!me) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const time = Date.now();

    // Overlay verde do scouter
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const grad = ctx.createRadialGradient(cx, cy, H / 2, cx, cy, H);
    grad.addColorStop(0, "rgba(0, 255, 0, 0)");
    grad.addColorStop(1, "rgba(0, 255, 0, 0.3)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Linha de varredura
    const scanY = (time * 0.5) % H;
    ctx.fillStyle = "rgba(0, 255, 0, 0.15)";
    ctx.fillRect(0, scanY, W, 4);

    // Círculo central (estético)
    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Dados laterais (efeito técnico)
    ctx.save();
    ctx.translate(W - 150, 100);
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
    ctx.font = "12px monospace";
    for (let i = 0; i < 15; i++) {
        const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
        ctx.fillText(randomHex, 0, i * 14);
    }
    ctx.restore();

    // ===============================
    // DETECÇÃO DE ENTIDADES
    // ===============================
    [...npcs, ...Object.values(players)].forEach(e => {
        if (e.id === me.id || e.isDead || e.isSpirit) return;

        const screenX = cx + (e.x - me.x) * ZOOM_SCALE;
const screenY = cy + (e.y - me.y) * ZOOM_SCALE;

        const dist = Math.hypot(e.x - me.x, e.y - me.y);

        const onScreen =
            screenX > -50 && screenX < W + 50 &&
            screenY > -50 && screenY < H + 50;

        if (onScreen) {
            const worldDist = dist;

            // Zonas do scouter
            const inScanRange  = worldDist < 2200;
            const inFocusRange = worldDist < 600;

            // Cor dinâmica estilo radar DB
            let color = "#00ff00"; // NPC
            if (!e.isNPC) color = "#00ffff";
            if (inFocusRange) color = "#ff3333";

            // Tamanho reage à ameaça
            const bracketSize = inFocusRange
                ? 42 + Math.sin(time / 120) * 6
                : 28 + Math.sin(time / 200) * 4;

            // Leitura de BP
            const bpDisplay = inScanRange
                ? e.bp.toLocaleString()
                : "???";

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;

            // Brackets
            ctx.beginPath();
            ctx.moveTo(-bracketSize, -bracketSize + 10);
            ctx.lineTo(-bracketSize, -bracketSize);
            ctx.lineTo(-bracketSize + 10, -bracketSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(bracketSize, bracketSize - 10);
            ctx.lineTo(bracketSize, bracketSize);
            ctx.lineTo(bracketSize - 10, bracketSize);
            ctx.stroke();

            // Textos
            ctx.fillStyle = color;
            ctx.font = "bold 12px Orbitron";
            ctx.fillText(`BP: ${bpDisplay}`, bracketSize + 6, -8);

            ctx.font = "10px Orbitron";
            ctx.fillText(e.name, bracketSize + 6, 6);

            if (!e.isNPC) {
                ctx.fillStyle = "#00ffff";
                ctx.fillText("[P]", -bracketSize - 14, 4);
            }

            ctx.restore();
        } 
        // Indicador fora da tela
        else if (dist < 4000) {
            const angle = Math.atan2(screenY - cy, screenX - cx);
            const radius = Math.min(W, H) / 2 - 30;
            const ix = cx + Math.cos(angle) * radius;
            const iy = cy + Math.sin(angle) * radius;

            ctx.save();
            ctx.translate(ix, iy);
            ctx.rotate(angle);

            ctx.fillStyle = e.isBoss
                ? "#ff0000"
                : (!e.isNPC ? "#00ffff" : "#00ff00");

            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-10, 5);
            ctx.lineTo(-10, -5);
            ctx.fill();

            ctx.rotate(-angle);
            ctx.fillStyle = "#ffffff";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${Math.floor(dist)}m`, 0, 20);
            if (!e.isNPC) ctx.fillText("P", 0, 5);

            ctx.restore();
        }
    });

    ctx.restore();
}


function drawNavigationMarkers(me) {
    const cx = canvas.width / 2; const cy = canvas.height / 2; ctx.save(); ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    const targets = me.isSpirit ? [ { name: "KAIOH", x: KAIOH_PLANET.x, y: KAIOH_PLANET.y } ] : WAYPOINTS;
    targets.forEach(wp => { const dx = wp.x - me.x; const dy = wp.y - me.y; const dist = Math.hypot(dx, dy); if(dist > 2000 && dist < 120000) { const angle = Math.atan2(dy, dx); const radius = Math.min(canvas.width, canvas.height) / 2 - 50; const sx = cx + Math.cos(angle) * radius; const sy = cy + Math.sin(angle) * radius; ctx.fillStyle = "rgba(0, 255, 255, 0.6)"; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill(); ctx.shadowColor = "#0ff"; ctx.shadowBlur = 10; ctx.fillStyle = "#0ff"; ctx.fillText(wp.name, sx, sy - 15); ctx.font = "10px Arial"; ctx.fillText(`${Math.floor(dist)}m`, sx, sy - 5); } });
    ctx.restore();
}

function drawSchematicMap(me) {
    if(!showMap) return; const size = isMobile ? 60 : 150; const padding = 20; const mapCX = canvas.width - size - padding; const mapCY = size + padding; const scale = size / 90000; 
    ctx.save(); ctx.translate(mapCX, mapCY); ctx.fillStyle = "rgba(0, 20, 0, 0.7)"; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "rgba(0, 255, 0, 0.5)"; ctx.lineWidth = 2; ctx.stroke(); 
    dominationZones.forEach(z => { const zx = z.x * scale; const zy = z.y * scale; if(Math.hypot(zx, zy) < size) { ctx.fillStyle = z.owner ? (z.owner === me.guild || z.owner === me.name ? "#00ff00" : "#ff0000") : "#aaa"; ctx.beginPath(); ctx.arc(zx, zy, 5, 0, Math.PI*2); ctx.fill(); } });
    const px = me.x * scale; const py = me.y * scale; if (Math.hypot(px, py) < size) { ctx.fillStyle = "#ffaa00"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
}

function drawMenu() {
    if(activeWindow === 'menu') {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 4;
        ctx.fillRect(cx - 150, cy - 200, 300, 400); ctx.strokeRect(cx - 150, cy - 200, 300, 400);
        
        ctx.font = "bold 24px Orbitron"; ctx.fillStyle = "#ffaa00"; ctx.textAlign = "center";
        ctx.fillText("MENU PRINCIPAL", cx, cy - 160);
        
        const options = ["Ranking (K)", "Guilda (Chat /guild)", "Título (Chat /title)", "REBIRTH (R)"];
        ctx.font = "18px Orbitron";
        options.forEach((opt, i) => {
            ctx.fillStyle = "#fff";
            ctx.fillText(opt, cx, cy - 100 + (i * 50));
        });
        
        ctx.fillStyle = "#f00"; ctx.font = "12px Arial";
        ctx.fillText("*Rebirth reseta Nível mas aumenta Força!", cx, cy + 150);
        
        ctx.restore();
    }
}

function drawLeaderboard() {
    if (activeWindow !== "ranking") return;

    const w = 400;
    const h = 300;
    const x = canvas.width / 2 - w / 2;
    const y = canvas.height / 2 - h / 2;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 24px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("TOP GUERREIROS", x + w / 2, y + 35);

    ctx.font = "16px Orbitron";

    leaderboard.forEach((p, i) => {
        // 🔥 BP ROBUSTO (NUNCA undefined)
        const bp =
            p.bp ??
            p.power ??
            p.powerLevel ??
            p.bpTotal ??
            0;

        ctx.fillText(
            `${i + 1}. ${p.name || "???"} - BP ${bp.toLocaleString()}`,
            x + w / 2,
            y + 80 + i * 28
        );
    });

    ctx.restore();
}



function drawChatBubbles() {
    chats.forEach(c => {
        const screenX = canvas.width/2 + (c.x - cam.x) * ZOOM_SCALE; const screenY = canvas.height/2 + (c.y - cam.y) * ZOOM_SCALE;
        ctx.save(); ctx.font = "14px Arial"; const w = ctx.measureText(c.text).width + 20; ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(screenX - w/2, screenY - 90, w, 30, 10); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(screenX, screenY - 60); ctx.lineTo(screenX - 5, screenY - 65); ctx.lineTo(screenX + 5, screenY - 65); ctx.fill(); ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.fillText(c.text, screenX, screenY - 70); ctx.font = "bold 10px Arial"; ctx.fillStyle = "#333"; ctx.fillText(c.owner, screenX, screenY - 95); ctx.restore();
    });
}

function drawAnnouncement() {
    if (announcement.life <= 0) return;

    announcement.life--;

    const cx = canvas.width / 2;

    // ===============================
    // POSICIONAMENTO RESPONSIVO
    // ===============================
    const isPortrait = canvas.height > canvas.width;
    const isMobilePortrait = isMobile && isPortrait;

    // Desktop / landscape: topo
    // Mobile portrait: meio da tela
    const cy = isMobilePortrait
        ? canvas.height * 0.45
        : 100;

    ctx.save();

    ctx.textAlign = "center";
    ctx.font = isMobilePortrait ? "bold 24px Orbitron" : "bold 32px Orbitron";

    const textWidth = ctx.measureText(announcement.text).width;
    const paddingX = isMobilePortrait ? 40 : 100;
    const paddingY = isMobilePortrait ? 22 : 30;

    // Fundo adaptado ao tamanho da tela
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(
        cx - textWidth / 2 - paddingX,
        cy - paddingY,
        textWidth + paddingX * 2,
        paddingY * 2
    );

    // Piscar estilo anime
    if (Math.floor(Date.now() / 200) % 2 === 0) {
        ctx.fillStyle = announcement.color;
    } else {
        ctx.fillStyle = "#ffffff";
    }

    ctx.shadowBlur = 20;
    ctx.shadowColor = announcement.color;

    ctx.fillText(announcement.text, cx, cy + 8);

    ctx.restore();
}

function drawTutorial() {
    if (!tutorialActive || tutorialStep >= TUTORIAL_DATA.length) return;

    const currentData = TUTORIAL_DATA[tutorialStep];
    const cx = canvas.width / 2;
    const cy = canvas.height - 150; // Posição inferior

    // Lógica de "Digitação"
    tutorialTimer++;
    if (tutorialTimer % 2 === 0 && tutorialIndex < currentData.text.length) {
        tutorialIndex++;
        // Efeito sonoro sutil de digitação (opcional, usando o scouter sound existente)
        if(tutorialIndex % 3 === 0) {
            // play('scouter'); // Descomentar se quiser som
        }
    }

    // Se acabou de digitar, espera um pouco e avança
    if (tutorialIndex >= currentData.text.length) {
        if (tutorialTimer > currentData.text.length * 2 + currentData.duration) {
            tutorialStep++;
            tutorialIndex = 0;
            tutorialTimer = 0;
            if (tutorialStep >= TUTORIAL_DATA.length) {
                tutorialActive = false;
                localStorage.setItem("dbz_tutorial_complete", "true");
            }
        }
    }

    const displayText = currentData.text.substring(0, tutorialIndex);

    ctx.save();
    ctx.translate(cx, cy);

    // Fundo Tech Scouter
    ctx.fillStyle = "rgba(0, 20, 0, 0.85)";
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    
    // Caixa principal
    ctx.beginPath();
    ctx.moveTo(-300, -40);
    ctx.lineTo(300, -40);
    ctx.lineTo(320, 0);
    ctx.lineTo(300, 40);
    ctx.lineTo(-300, 40);
    ctx.lineTo(-320, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Texto
    ctx.font = "bold 16px monospace"; // Estilo terminal
    ctx.fillStyle = "#00ff00";
    ctx.textAlign = "center";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#00ff00";
    ctx.fillText(displayText, 0, 5);

    // Cursor piscando
    if (Math.floor(Date.now() / 300) % 2 === 0 && tutorialIndex < currentData.text.length) {
        const w = ctx.measureText(displayText).width;
        ctx.fillRect(w / 2 + 5, -8, 10, 16);
    }

    // Instrução de pular
    ctx.font = "10px Arial";
    ctx.fillStyle = "#00aa00";
    ctx.shadowBlur = 0;
    ctx.fillText("[CLIQUE NA TELA PARA AVANÇAR]", 0, 55);

    ctx.restore();
}


function draw() {
    if(hitStop > 0) hitStop--; if(flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash/10})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash--; } else { ctx.clearRect(0,0,canvas.width,canvas.height); }
    const me = players[myId]; if(!me) return;
    cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1; let sx = (Math.random()-0.5)*screenShake; screenShake *= 0.9;
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(ZOOM_SCALE, ZOOM_SCALE); ctx.translate(-cam.x + sx, -cam.y + sx);
    drawBackground(cam.x, cam.y); drawOtherWorld(cam.x, cam.y); drawDominationZones();
    craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
    rocks.forEach(r => { ctx.fillStyle = r.type === "rock_namek" ? "#446" : "#543"; if(r.type === "rock_magic") ctx.fillStyle = "#636"; if(r.type === "rock_god") ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x-r.r/3, r.y+r.r/3, r.r/2, 0, Math.PI*2); ctx.fill(); });
    trails.forEach((t, i) => { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; ctx.fillRect(-15*t.sizeMult, -12*t.sizeMult, 30*t.sizeMult, 24*t.sizeMult); ctx.restore(); t.alpha -= 0.08; if(t.alpha <= 0) trails.splice(i, 1); });
    shockwaves.forEach((s, i) => { s.r += 12; s.a -= 0.05; ctx.strokeStyle = s.color; ctx.lineWidth = 8; ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); if(s.a <= 0) shockwaves.splice(i, 1); });
    npcs.forEach(drawEntity); Object.values(players).forEach(drawEntity);
    projectiles.forEach(pr => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 15; ctx.shadowColor = pr.color; ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size*0.6, 0, Math.PI*2); ctx.fill(); ctx.restore(); });
    particles.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, p.size, p.size); if(p.life <= 0) particles.splice(i, 1); });
    texts.forEach((t, i) => { t.y += t.vy; t.life--; ctx.save(); ctx.translate(t.x, t.y); ctx.fillStyle = t.color; ctx.font = t.isEmote ? "40px Arial" : "bold 28px Orbitron"; ctx.fillText(t.text, 0, 0); ctx.restore(); if(t.life<=0) texts.splice(i,1); });
    ctx.restore();
    drawChatBubbles(); 
    drawSchematicMap(me); if (scouterActive) { drawNavigationMarkers(me); drawScouterHUD(me); } 
    drawLeaderboard(); drawMenu(); drawAnnouncement();
    drawTutorial(); // DESENHA O TUTORIAL
}
function getTrailColor(e) {
    if (e.form === "SSJ" || e.form === "SSJ2") return "#ffea00";
    if (e.form === "SSJ3") return "#ffcc00";
    if (e.form === "GOD") return "#ff0033";
    if (e.form === "BLUE") return "#00bbff";
    if (e.form === "UI") return "#ffffff";
    return e.color || "#00ffff";
}

let lastInputSent = 0;
function update() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    if(!myId) { requestAnimationFrame(update); return; }
    const me = players[myId];
    if(me) {
        document.getElementById("hp-bar").style.width = (me.hp/me.maxHp)*100 + "%";
        document.getElementById("ki-bar").style.width = (me.ki/me.maxKi)*100 + "%";
        document.getElementById("xp-bar").style.width =
  (me.xp / me.xpToNext) * 100 + "%";

        
        let zoneName = "ESPAÇO SIDERAL";
        if (Math.hypot(me.x, me.y) < 6000) zoneName = "PLANETA TERRA";
        else if (me.y < -80000) zoneName = "PLANETA BILLS";
        else if (me.y < -30000) zoneName = "OUTRO MUNDO";
        else if (me.y > 30000) zoneName = "REINO DEMONÍACO";
        else if (me.x < -40000) zoneName = "PLANETA VAMPA";
        else if (me.x < -10000) zoneName = "SETOR NAMEK";
        
        document.getElementById("stat-bp").innerText =
  `LVL ${me.level} | ${zoneName}`;

        
        if(me.pvpMode) { document.getElementById("stat-bp").innerText += " [PVP]"; document.getElementById("stat-bp").style.color = "#f00"; } else { document.getElementById("stat-bp").style.color = "#ffcc00"; }
        
        let ang = Math.atan2(mouse.y, mouse.x); 
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) ang = Math.atan2(joystickMove.y, joystickMove.x);
        let inputX = (keys["KeyD"]?1:0)-(keys["KeyA"]?1:0); let inputY = (keys["KeyS"]?1:0)-(keys["KeyW"]?1:0);
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) { inputX = joystickMove.x; inputY = joystickMove.y; }
        if(performance.now()-lastInputSent>30){ lastInputSent=performance.now(); window.socket.emit("input", { x: inputX, y: inputY, angle: ang, block: keys["KeyQ"], charge: keys["KeyC"], holdAtk: mouseLeft, holdBlast: mouseRight }); }
    }
    draw(); requestAnimationFrame(update);
}
update();

(function(){
    let audioUnlocked = false;
    const SFX = { hit: [], heavy: [], blast: [], charge: [], teleport: [], transform: [], scouter: [], levelup: [] };
    const SOURCES = { hit: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", heavy: "https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3", blast: "https://assets.mixkit.co/active_storage/sfx/272/272-preview.mp3", charge: "https://assets.mixkit.co/active_storage/sfx/388/388-preview.mp3", teleport: "https://assets.mixkit.co/active_storage/sfx/250/250-preview.mp3", transform: "https://assets.mixkit.co/active_storage/sfx/411/411-preview.mp3", scouter: "https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3", levelup: "https://assets.mixkit.co/active_storage/sfx/201/201-preview.mp3" };
    function buildPool() { Object.keys(SOURCES).forEach(key => { for (let i = 0; i < 6; i++) { const a = new Audio(SOURCES[key]); a.preload = "auto"; a.volume = 0.85; SFX[key].push(a); } }); }
    function unlockAudio() { if (audioUnlocked) return; audioUnlocked = true; buildPool(); }
    function play(key) { if (!audioUnlocked) return; const list = SFX[key]; if (!list) return; const a = list.find(x => x.paused); if (!a) return; a.currentTime = 0; a.play().catch(()=>{}); }
    window.addEventListener("pointerdown", unlockAudio, { once:true });
    if (window.socket) { socket.on("fx", fx => { if (!fx || !fx.type) return; if (fx.type === "hit") play("hit"); if (fx.type === "heavy") play("heavy"); if (fx.type === "vanish") play("teleport"); if (fx.type === "transform") play("transform"); if (fx.type === "levelup") play("levelup"); if (fx.type === "bp_limit") play("scouter"); }); }
    const originalEmit = socket.emit; socket.emit = function(ev, data){ if (ev === "release_attack") play("hit"); if (ev === "release_blast") play("blast"); originalEmit.apply(this, arguments); };
    let lastScouter = false; setInterval(()=>{ if (typeof scouterActive !== "boolean") return; if (scouterActive && !lastScouter) play("scouter"); lastScouter = scouterActive; }, 300);
})();