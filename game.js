const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
window.socket = io({ transports: ['websocket'] });

let myId = null;
let players = {}, npcs = [], projectiles = [], rocks = [], craters = [];
let cam = { x: 0, y: 0 }, mouse = { x: 0, y: 0 }, keys = {};
let mouseLeft = false, mouseRight = false;
let particles = [], shockwaves = [], trails = [], texts = [];
let screenShake = 0, flash = 0, hitStop = 0;
let joystickMove = { x: 0, y: 0 };

// ESTADO DO SCOUTER
let scouterActive = false; 

// ==========================================
// CONFIGURAÇÃO DE ZOOM E CÂMERA
// ==========================================
const ZOOM_SCALE = 0.7; // Zoom ajustado para o mapa gigante

const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

// =====================================================
// CONTROLES E INPUTS
// =====================================================
function bindBtn(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = e => { e.preventDefault(); e.stopPropagation(); onPress && onPress(); };
    const release = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false }); 
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release); 
}

bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
bindBtn('btn-block', () => keys['KeyQ']=true, () => delete keys['KeyQ']);
bindBtn('btn-charge', () => keys['KeyC']=true, () => delete keys['KeyC']);
bindBtn('btn-vanish', () => socket.emit('vanish'));
bindBtn('btn-transform', () => socket.emit('transform'));

// TOGGLE SCOUTER
bindBtn('btn-scouter', () => { scouterActive = !scouterActive; });

const btnLogin = document.getElementById("btn-login");
if(btnLogin) btnLogin.onclick = () => {
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;
    if(user && pass) window.socket.emit("login", { user, pass });
};

window.addEventListener("contextmenu", e => e.preventDefault());

window.addEventListener("mousemove", e => { 
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    mouse.x = (e.clientX - centerX) / ZOOM_SCALE;
    mouse.y = (e.clientY - centerY) / ZOOM_SCALE;
});

window.addEventListener("mousedown", e => { if(e.button === 0) mouseLeft = true; if(e.button === 2) mouseRight = true; });
window.addEventListener("mouseup", e => { 
    if(e.button === 0) { mouseLeft = false; window.socket.emit("release_attack"); } 
    if(e.button === 2) { mouseRight = false; window.socket.emit("release_blast"); } 
});
window.addEventListener("keydown", e => { 
    keys[e.code] = true; 
    if(e.code === "Space") window.socket.emit("vanish"); 
    if(e.code === "KeyG") window.socket.emit("transform"); 
    if(e.code === "KeyT") scouterActive = !scouterActive; 
});
window.addEventListener("keyup", e => keys[e.code] = false);

window.socket.on("auth_success", () => { 
    myId = window.socket.id; 
    document.getElementById("login-screen").style.display = "none"; 
    document.getElementById("ui").style.display = "block"; 
    if (isMobile) {
        document.getElementById("mobile-ui").style.display = "block";
        requestAnimationFrame(() => { requestAnimationFrame(() => { initMobileControls(); }); });
    }
});

window.socket.on("state", data => {
    if(!myId) return;
    players = data.players; npcs = data.npcs; projectiles = data.projectiles; 
    rocks = data.rocks; craters = data.craters || [];
});

window.socket.on("fx", data => {
    if(data.type === "hit" || data.type === "heavy") {
        hitStop = data.type === "heavy" ? 8 : 3; 
        screenShake = data.type === "heavy" ? 30 : 10;
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: data.type === "heavy" ? 150 : 60, a: 1, color: "#fff" });
        for(let i=0; i<12; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 });
        if(data.dmg) {
            texts.push({
                x: data.x, y: data.y - 40, text: data.dmg.toString(), 
                color: data.type === "heavy" ? "#ff3333" : "#ffff00", life: 60, vy: -2, isDmg: true
            });
        }
    }
    if(data.type === "xp_gain") texts.push({ x: data.x, y: data.y - 60, text: "+" + data.amount + " XP", color: "#00ff00", life: 50, vy: -1.5 });
    if(data.type === "transform") { 
        screenShake = 50; flash = 15; 
        let c = "#ff0";
        if(data.form === "GOD") c = "#f00"; if(data.form === "BLUE") c = "#0ff"; if(data.form === "UI") c = "#fff";
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: c }); 
    }
    if(data.type === "vanish") shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 80, a: 0.8, color: "#0ff" });
    if(data.type === "levelup") {
        texts.push({x: data.x, y: data.y - 80, text: "LEVEL UP!", color: "#00ffff", life: 120, vy: -0.5});
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: "#fff" });
    }
});

let joystick = null;
function initMobileControls() {
    if (!isMobile || !window.nipplejs) return;
    if (joystick) return;
    const zone = document.getElementById('joystick-container');
    if (!zone) return;
    joystick = nipplejs.create({
        zone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff9900', size: 120
    });
    joystick.on('move', (evt, data) => {
        if (!data || !data.vector) return;
        joystickMove.x = data.vector.x; joystickMove.y = -data.vector.y;
    });
    joystick.on('end', () => { joystickMove.x = 0; joystickMove.y = 0; });
}

// =========================================================
// BACKGROUND INTELIGENTE OMNIDIRECIONAL
// =========================================================
function drawBackground(camX, camY) {
    const viewW = canvas.width / ZOOM_SCALE;
    const viewH = canvas.height / ZOOM_SCALE;
    const startX = camX - (viewW / 2);
    const startY = camY - (viewH / 2);
    const endX = camX + (viewW / 2);
    const endY = camY + (viewH / 2);

    const dist = Math.hypot(camX, camY);
    const angle = Math.atan2(camY, camX);
    
    let bgColor = "#122a12"; // Padrão Terra (Centro)
    let gridColor = "rgba(100,255,100,0.1)";

    // Se estiver fora do centro (Terra)
    if (dist >= 5000) {
        // OESTE: Espaço / Namek (Azul Escuro / Estrelado)
        if (Math.abs(angle) > 2.35) {
            bgColor = "#001122"; gridColor = "rgba(100,200,255,0.1)";
        }
        // LESTE: Futuro / GT (Cinza Metálico / Tecnológico)
        else if (Math.abs(angle) < 0.78) {
            bgColor = "#1a1a2e"; gridColor = "rgba(200,200,200,0.15)";
        }
        // SUL: Reino Demônio (Roxo Escuro / Mágico)
        else if (angle >= 0.78 && angle <= 2.35) {
            bgColor = "#220022"; gridColor = "rgba(255,100,255,0.1)";
        }
        // NORTE: Divino (Azul Noite / Dourado)
        else {
            bgColor = "#001a33"; gridColor = "rgba(255,215,0,0.1)";
        }
    }

    ctx.fillStyle = bgColor; 
    ctx.fillRect(startX - 200, startY - 200, viewW + 400, viewH + 400);

    // DETALHES DE FUNDO (PLANETAS/LUAS)
    if(dist > 5000) {
        // Exemplo: Estrelas no Espaço (Oeste)
        if (Math.abs(angle) > 2.35) {
            ctx.fillStyle = "rgba(255,255,255, 0.5)";
            // Apenas um exemplo visual simples para estrelas
             // (Poderia ser expandido, mas mantendo simples por performance)
        }
    }

    // GRID
    const gridSize = 200;
    const firstLineX = Math.floor(startX / gridSize) * gridSize;
    const firstLineY = Math.floor(startY / gridSize) * gridSize;

    ctx.strokeStyle = gridColor; ctx.lineWidth = 4; ctx.beginPath();
    for(let x = firstLineX; x < endX + gridSize; x += gridSize) { ctx.moveTo(x, startY - 100); ctx.lineTo(x, endY + 100); }
    for(let y = firstLineY; y < endY + gridSize; y += gridSize) { ctx.moveTo(startX - 100, y); ctx.lineTo(endX + 100, y); }
    ctx.stroke();
}

// ==========================================
// DESENHO DO OUTRO MUNDO (SERPENTE E KAIOH)
// ==========================================
function drawOtherWorld(camX, camY) {
    const viewW = canvas.width / ZOOM_SCALE;
    const viewH = canvas.height / ZOOM_SCALE;
    
    // Verifica se a câmera está perto da região Norte (onde fica o caminho)
    // O Caminho vai de Y: -5000 até Y: -20000
    if (camY > -4000 && camY < 20000) return; // Otimização: não desenha se estiver longe

    // 1. O CAMINHO DA SERPENTE (Curvas Senoidais)
    ctx.save();
    ctx.strokeStyle = "#e6b800"; // Amarelo/Laranja clássico
    ctx.lineWidth = 60;
    ctx.lineCap = "round";
    ctx.beginPath();
    
    // Desenha o caminho do Enma (-6000) até o Kaioh (-20000)
    const startY = -6000;
    const endY = -20000;
    
    // Desenha segmentos para fazer a curva
    for (let y = startY; y >= endY; y -= 200) {
        // A serpente ondula no eixo X conforme sobe o eixo Y
        const x = Math.sin(y * 0.0015) * 600; 
        if (y === startY) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Detalhe: Espinhos/Escamas da Serpente (Opcional, linha interna)
    ctx.strokeStyle = "#b38f00";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let y = startY; y >= endY; y -= 200) {
        const x = Math.sin(y * 0.0015) * 600;
        if (y === startY) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 2. POSTO DO ENMA DAIOH (Início)
    ctx.save();
    ctx.translate(0, -6000);
    ctx.fillStyle = "#8B4513"; // Madeira/Telhado
    ctx.fillRect(-150, -50, 300, 100); // Base
    ctx.fillStyle = "#d22"; // Telhado Vermelho
    ctx.beginPath(); ctx.moveTo(-180, -50); ctx.lineTo(0, -150); ctx.lineTo(180, -50); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center";
    ctx.fillText("ENMA", 0, 20);
    ctx.restore();

    // 3. PLANETA DO SR. KAIOH (Fim)
    ctx.save();
    ctx.translate(0, -20000); // Localização Final
    
    // Atmosfera/Gravidade
    ctx.shadowBlur = 40; ctx.shadowColor = "rgba(100, 255, 100, 0.5)";
    
    // O Planeta Pequeno
    ctx.fillStyle = "#4a4"; // Verde Grama
    ctx.beginPath(); ctx.arc(0, 0, 350, 0, Math.PI * 2); ctx.fill();
    
    // Estrada do Carro
    ctx.strokeStyle = "#dcb"; ctx.lineWidth = 40; 
    ctx.beginPath(); ctx.arc(0, 0, 280, 0, Math.PI * 2); ctx.stroke();

    // A Árvore
    ctx.fillStyle = "#532"; ctx.fillRect(-30, -350, 60, 100); // Tronco
    ctx.fillStyle = "#282"; ctx.beginPath(); ctx.arc(0, -400, 120, 0, Math.PI*2); ctx.fill(); // Copa

    // A Casa (Cúpula)
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(100, -100, 80, 0, Math.PI, true); ctx.fill();
    ctx.fillStyle = "#d22"; ctx.beginPath(); ctx.moveTo(20, -100); ctx.lineTo(100, -180); ctx.lineTo(180, -100); ctx.fill(); // Telhado

    // Texto flutuante
    ctx.fillStyle = "#ff0"; ctx.font = "bold 50px Orbitron"; ctx.textAlign = "center";
    ctx.shadowBlur = 0;
    ctx.fillText("PLANETA KAIOH", 0, 500);
    
    ctx.restore();
}

function drawEntity(e) {
    if(e.isDead && e.isNPC) return;
    const isSpirit = e.isSpirit;
    const sizeMult = e.isBoss ? 4.0 : 1; // Bosses maiores
    const time = Date.now();
    
    // ==========================================
    // LÓGICA DE CORES E AURAS
    // ==========================================
    let auraColor = "#00ffff"; 
    if(e.color) auraColor = e.color; 
    
    // Formas Clássicas
    if(e.form === "SSJ" || e.form === "SSJ2") auraColor = "#ffea00";
    if(e.form === "SSJ3") auraColor = "#ffcc00";
    if(e.form === "GOD") auraColor = "#ff0000";
    if(e.form === "BLUE") auraColor = "#00bbff";
    if(e.form === "UI") auraColor = "#ffffff";
    
    // Detecção por Nome (Sagas)
    if(e.name) {
        if(e.name.includes("BLACK") || e.name.includes("ROSE")) auraColor = "#ff0088"; 
        if(e.name.includes("BROLY") || e.name.includes("KEFLA")) auraColor = "#00ff00"; 
        if(e.name.includes("GOMAH") || e.name.includes("DEMON")) auraColor = "#9900ff"; 
        if(e.name.includes("TOPPO") || e.name.includes("EGO")) auraColor = "#8800ff"; 
        if(e.name.includes("ANGEL")) auraColor = "#aaaaff"; 
    }

    if(hitStop <= 0 && (Math.hypot(e.vx, e.vy) > 10)) {
        trails.push({ x: e.x, y: e.y, angle: e.angle, color: auraColor, alpha: 0.4, sizeMult });
    }

    ctx.save(); 
    ctx.translate(e.x, e.y); 
    
    // ==========================================
    // TRECHO: AURÉOLA DE ESPÍRITO (MORTO)
    // ==========================================
    if (isSpirit) {
        ctx.save();
        ctx.translate(0, -50 * sizeMult); 
        ctx.shadowBlur = 10; ctx.shadowColor = "#fff";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * sizeMult, 5 * sizeMult, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.3; ctx.fillStyle = "#fff"; ctx.fill();
        ctx.restore();
    }
    // ==========================================

    // EFEITOS DE CARREGAMENTO
    if (e.state === "CHARGING") {
        ctx.save();
        const pulse = Math.sin(time / 50) * 0.1 + 1; const auraSize = 45 * sizeMult * pulse;
        const grd = ctx.createRadialGradient(0, 0, 15 * sizeMult, 0, 0, auraSize);
        grd.addColorStop(0, "rgba(255, 255, 255, 0)"); grd.addColorStop(0.5, auraColor); grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grd; ctx.globalAlpha = 0.6; ctx.scale(1, 1.3); 
        ctx.beginPath(); ctx.arc(0, -10, auraSize, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Raios
        ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.beginPath();
        for(let i=0; i<2; i++) {
            const px = (Math.random() - 0.5) * 50 * sizeMult; const py = (Math.random() - 0.5) * 50 * sizeMult;
            const h = Math.random() * 40 * sizeMult; ctx.moveTo(px, py); ctx.lineTo(px, py - h);
        }
        ctx.stroke(); ctx.restore();

        if(e.id === myId && Math.random() > 0.8) screenShake = 2;
    }
    else if (e.state === "CHARGING_ATK") {
        ctx.save();
        const ringSize = (time % 500) / 500 * 60 * sizeMult; const invertRing = (60 * sizeMult) - ringSize;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, invertRing, 0, Math.PI*2); ctx.stroke();
        const shakeX = (Math.random() - 0.5) * 4; ctx.translate(shakeX, 0); ctx.restore();
    }
    else if (e.state === "CHARGING_BLAST") {
        ctx.save();
        ctx.rotate(e.angle); ctx.translate(20 * sizeMult, 0); 
        ctx.fillStyle = auraColor; ctx.shadowBlur = 20; ctx.shadowColor = auraColor;
        ctx.beginPath(); ctx.arc(0, 0, 12 * sizeMult, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // HOLOGRAMA PADRÃO (SE SCOUTER OFF)
    if (!scouterActive && !e.isSpirit && e.id !== myId) {
        ctx.save();
        ctx.translate(30 * sizeMult, -50 * sizeMult);
        ctx.transform(1, -0.2, 0, 1, 0, 0); 
        ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(100, 0); ctx.stroke();
        ctx.fillStyle = e.isBoss ? "#ff3333" : "#00ffff";
        ctx.font = "bold 20px Orbitron";
        ctx.shadowBlur = 4; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(`${e.name.substring(0,12)}`, 5, -8);
        const hpPerc = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 5, 100, 6);
        ctx.fillStyle = e.isBoss ? "#f00" : "#0f0"; ctx.fillRect(0, 5, 100 * hpPerc, 6);
        ctx.restore();
    }

    ctx.globalAlpha = isSpirit ? 0.5 : 1.0;
    ctx.rotate(e.angle);

    ctx.shadowBlur = 0;
    if(e.form !== "BASE" || e.state === "CHARGING") { ctx.shadowBlur = 15; ctx.shadowColor = auraColor; }
    
    ctx.fillStyle = e.color; 
    ctx.fillRect(-15*sizeMult, -12*sizeMult, 30*sizeMult, 24*sizeMult);
    
    // CABEÇA
    ctx.fillStyle = e.isNPC ? (e.isBoss ? "#311" : "#2d2") : "#ffdbac"; 
    if(e.name && (e.name.includes("FRIEZA") || e.name.includes("METAL") || e.name.includes("WHITE"))) ctx.fillStyle = "#fff";
    if(e.name && e.name.includes("BUU")) ctx.fillStyle = "#fbb";
    if(e.name && e.name.includes("CELL")) ctx.fillStyle = "#dfd";
    if(e.name && e.name.includes("JIREN")) ctx.fillStyle = "#eee";

    ctx.beginPath(); ctx.arc(0, -5*sizeMult, 12*sizeMult, 0, Math.PI*2); ctx.fill();

    // CABELO
    if(!e.isNPC) { 
        let hColor = "#111"; 
        if(e.form === "SSJ" || e.form === "SSJ2") hColor = "#ffea00";
        if(e.form === "SSJ3") hColor = "#ffcc00";
        if(e.form === "GOD") hColor = "#aa0000"; if(e.form === "BLUE") hColor = "#00bbff"; if(e.form === "UI") hColor = "#dddddd";
        ctx.fillStyle = hColor; 
        const hairSize = e.form === "SSJ3" ? 2.5 : 1; 
        for(let i=0; i<3; i++) { 
            ctx.beginPath(); ctx.moveTo(-10*sizeMult, -10*sizeMult); 
            ctx.lineTo((-15+i*15)*sizeMult, -35*sizeMult * hairSize); 
            ctx.lineTo((10)*sizeMult, -10*sizeMult); ctx.fill(); 
        } 
    }

    if(e.state === "BLOCKING") { 
        ctx.strokeStyle = "rgba(100,200,255,0.7)"; 
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0,0, 40*sizeMult, -1, 1); ctx.stroke(); 
    }
    ctx.restore();
}

function drawScouterHUD(me) {
    if (!me) return;
    const time = Date.now();
    const scouterColor = "#00ff00"; 
    const dangerColor = "#ff0000";
    const W = canvas.width; const H = canvas.height;

    ctx.save();
    
    // Filtro Verde
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 255, 0, 0.03)"; ctx.fillRect(0,0,W,H);
    const scanY = (time / 5) % H;
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)"; ctx.fillRect(0, scanY, W, 5);

    // Mira
    const cx = W / 2; const cy = H / 2;
    ctx.strokeStyle = "rgba(0, 255, 0, 0.4)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0.5, 2.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 30, 3.5, 5.5); ctx.stroke();
    ctx.fillStyle = scouterColor; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();

    let bossNearby = false; let highPowerNearby = false;
    const allEntities = [...npcs, ...Object.values(players)];

    allEntities.forEach(e => {
        if (e.id === me.id || e.isDead || e.isSpirit) return;
        const screenX = cx + (e.x - cam.x) * ZOOM_SCALE;
        const screenY = cy + (e.y - cam.y) * ZOOM_SCALE;
        const dist = Math.hypot(e.x - me.x, e.y - me.y);
        const isBoss = e.isBoss || e.level > me.level + 10;
        if(isBoss && dist < 3000) bossNearby = true;
        if(e.bp > me.bp * 1.5 && dist < 3000) highPowerNearby = true;
        const onScreen = screenX > -50 && screenX < W + 50 && screenY > -50 && screenY < H + 50;

        if (onScreen) {
            ctx.save(); ctx.translate(screenX, screenY);
            const boxSize = (e.r || 20) * ZOOM_SCALE * 2.5;
            const bracketCol = isBoss ? dangerColor : scouterColor;
            
            ctx.strokeStyle = bracketCol; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
            const b = boxSize / 2;
            ctx.beginPath();
            ctx.moveTo(-b, -b + 10); ctx.lineTo(-b, -b); ctx.lineTo(-b + 10, -b); 
            ctx.moveTo(b, -b + 10); ctx.lineTo(b, -b); ctx.lineTo(b - 10, -b);   
            ctx.moveTo(-b, b - 10); ctx.lineTo(-b, b); ctx.lineTo(-b + 10, b);   
            ctx.moveTo(b, b - 10); ctx.lineTo(b, b); ctx.lineTo(b - 10, b);      
            ctx.stroke();

            ctx.beginPath(); ctx.moveTo(b, -b); ctx.lineTo(b + 20, -b - 20); ctx.lineTo(b + 80, -b - 20); ctx.stroke();

            ctx.fillStyle = bracketCol; ctx.font = "bold 12px Orbitron";
            ctx.shadowBlur = 4; ctx.shadowColor = bracketCol;
            ctx.fillText(e.name.substring(0, 10), b + 25, -b - 25);
            ctx.fillText(`BP: ${e.bp.toLocaleString()}`, b + 25, -b - 10);
            ctx.fillText(`DST: ${Math.floor(dist)}m`, b + 25, -b + 5);
            ctx.restore();
        } else {
            const angle = Math.atan2(screenY - cy, screenX - cx);
            const edgeDistX = (W / 2) - 40; const edgeDistY = (H / 2) - 40;
            let indX = Math.cos(angle) * 1000; let indY = Math.sin(angle) * 1000;
            if (indX > edgeDistX) indX = edgeDistX; if (indX < -edgeDistX) indX = -edgeDistX;
            if (indY > edgeDistY) indY = edgeDistY; if (indY < -edgeDistY) indY = -edgeDistY;

            if (dist < 4000 || isBoss) {
                ctx.save(); ctx.translate(cx + indX, cy + indY); ctx.rotate(angle);
                ctx.fillStyle = isBoss ? dangerColor : scouterColor;
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.fill();
                if (isBoss && (Math.floor(time / 200) % 2 === 0)) {
                    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0, 15, 0, Math.PI*2); ctx.stroke();
                }
                ctx.restore();
            }
        }
    });

    ctx.save(); ctx.translate(W - 120, 100); ctx.fillStyle = scouterColor; ctx.font = "10px Orbitron"; ctx.globalAlpha = 0.5;
    for(let i=0; i<10; i++) {
        const val = Math.floor(Math.random() * 999999);
        ctx.fillText(`${val}`, 0, i * 15); ctx.fillRect(-10, i * 15 - 8, -(Math.random()*30), 2);
    }
    ctx.restore();

    if (bossNearby || highPowerNearby) {
        if (Math.floor(time / 300) % 2 === 0) { 
            ctx.save(); ctx.translate(cx, cy - 100);
            ctx.fillStyle = dangerColor; ctx.font = "bold 20px Orbitron"; ctx.textAlign = "center";
            ctx.shadowBlur = 10; ctx.shadowColor = dangerColor;
            ctx.fillText("HIGH ENERGY DETECTED", 0, 0);
            ctx.strokeStyle = dangerColor; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(130, 10); ctx.lineTo(-130, 10); ctx.lineTo(0, -30); ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}

function draw() {
    if(hitStop > 0) hitStop--; 
    if(flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash/10})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash--; } 
    else { ctx.clearRect(0,0,canvas.width,canvas.height); }

    const me = players[myId]; if(!me) return;

    cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1;
    let sx = 0, sy = 0;
    if(screenShake > 0) { sx = (Math.random()-0.5)*screenShake; sy = (Math.random()-0.5)*screenShake; screenShake *= 0.9; }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(ZOOM_SCALE, ZOOM_SCALE);
    ctx.translate(-cam.x + sx, -cam.y + sy);

    drawBackground(cam.x, cam.y);
	drawOtherWorld(cam.x, cam.y);

    craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
    rocks.forEach(r => { 
        ctx.fillStyle = r.type === "rock_namek" ? "#446" : "#543";
        // Variação de cor de pedra por zona (Simples visual)
        if(r.type === "rock_magic") ctx.fillStyle = "#636";
        if(r.type === "rock_god") ctx.fillStyle = "#333";
        if(r.type === "rock_city") ctx.fillStyle = "#556";

        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x-r.r/3, r.y+r.r/3, r.r/2, 0, Math.PI*2); ctx.fill();
    });

    trails.forEach((t, i) => { 
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); 
        ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; 
        ctx.fillRect(-15*t.sizeMult, -12*t.sizeMult, 30*t.sizeMult, 24*t.sizeMult); 
        ctx.restore(); t.alpha -= 0.08; if(t.alpha <= 0) trails.splice(i, 1); 
    });

    shockwaves.forEach((s, i) => { 
        s.r += 12; s.a -= 0.05; ctx.strokeStyle = s.color; ctx.lineWidth = 8; ctx.globalAlpha = s.a; 
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); 
        if(s.a <= 0) shockwaves.splice(i, 1); 
    });

    npcs.forEach(drawEntity);
    Object.values(players).forEach(drawEntity);

    projectiles.forEach(pr => { 
        ctx.fillStyle = pr.color; ctx.shadowBlur=20; ctx.shadowColor=pr.color; 
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI*2); ctx.fill(); 
        ctx.shadowBlur=0; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size*0.5, 0, Math.PI*2); ctx.fill(); 
    });

    particles.forEach((p, i) => { 
        p.x += p.vx; p.y += p.vy; p.life -= 0.05; ctx.fillStyle = p.color; ctx.globalAlpha = p.life; 
        ctx.fillRect(p.x, p.y, p.size, p.size); if(p.life <= 0) particles.splice(i, 1); 
    });

    texts.forEach((t, i) => { 
        t.y += (t.vy || -0.5); t.life--; 
        ctx.save(); ctx.translate(t.x, t.y);
        if(t.isDmg) ctx.scale(1 + Math.sin(Date.now()/50)*0.2, 1 + Math.sin(Date.now()/50)*0.2); 
        ctx.fillStyle = t.color; ctx.globalAlpha = t.life/60; ctx.font = "bold 28px Orbitron"; 
        ctx.strokeStyle = "black"; ctx.lineWidth = 4; ctx.strokeText(t.text, 0, 0); ctx.fillText(t.text, 0, 0); 
        ctx.restore(); if(t.life<=0) texts.splice(i,1); 
    });

    ctx.restore();

    if (scouterActive) {
        drawScouterHUD(me);
    }
}

let lastInputSent = 0;
function update() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    if(!myId) { requestAnimationFrame(update); return; }
    
    const me = players[myId];
    if(me) {
        // ===============================
// HP BAR COM NÚMERO + ANIMAÇÃO
// ===============================
const hpPerc = Math.max(0, me.hp / me.maxHp) * 100;
const hpBar = document.getElementById("hp-bar");
hpBar.style.width = hpPerc + "%";

let hpText = hpBar.querySelector(".value-text");
if (!hpText) {
    hpText = document.createElement("div");
    hpText.className = "value-text";
    hpBar.parentElement.appendChild(hpText);
}
hpText.innerText = `${Math.floor(me.hp)} / ${me.maxHp}`;

hpBar.parentElement.classList.remove("power-pulse");
if (me.hp < me.maxHp) {
    // HP pode pulsar
hpBar.parentElement.classList.remove("hp-pulse");
hpBar.parentElement.classList.add("hp-pulse");

// KI NÃO escala texto (só brilho visual)
kiBar.parentElement.classList.remove("hp-pulse");
}
// ===============================
// KI BAR COM NÚMERO + ANIMAÇÃO
// ===============================
const kiPerc = Math.max(0, me.ki / me.maxKi) * 100;
const kiBar = document.getElementById("ki-bar");
kiBar.style.width = kiPerc + "%";

let kiText = kiBar.querySelector(".value-text");
if (!kiText) {
    kiText = document.createElement("div");
    kiText.className = "value-text ki-bar-text";
    kiBar.parentElement.appendChild(kiText);
}

kiText.innerText = `${Math.floor(me.ki)} / ${me.maxKi}`;

kiBar.parentElement.classList.remove("power-pulse");
if (me.state === "CHARGING") {
    kiBar.parentElement.classList.add("power-pulse");
}
        const xpPerc = (me.xp / (me.level*800)) * 100;
        document.getElementById("xp-bar").style.width = xpPerc + "%";
        
        // Atualiza HUD com Zona Geográfica (Omnidirecional)
        const dist = Math.hypot(me.x, me.y);
        const angle = Math.atan2(me.y, me.x);
        let zoneName = "PLANETA TERRA";
        
        if(dist >= 5000) {
            if (Math.abs(angle) > 2.35) zoneName = "ESPAÇO PROFUNDO"; // Oeste
            else if (Math.abs(angle) < 0.78) zoneName = "LINHA DO TEMPO FUTURA"; // Leste
            else if (angle >= 0.78 && angle <= 2.35) zoneName = "REINO DEMONÍACO"; // Sul
            else zoneName = "DOMÍNIO DIVINO"; // Norte
        }
        
        document.getElementById("stat-bp").innerText =
    `LVL ${me.level} | PB ${me.bp.toLocaleString()}`;
const bpEl = document.getElementById("stat-bp");
if (me.bp > 50000) bpEl.style.color = "#ff9900";
if (me.bp > 150000) bpEl.style.color = "#ff3333";

        
        let ang = Math.atan2(mouse.y, mouse.x); 
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) {
            ang = Math.atan2(joystickMove.y, joystickMove.x);
        }

        let inputX = (keys["KeyD"]?1:0)-(keys["KeyA"]?1:0);
        let inputY = (keys["KeyS"]?1:0)-(keys["KeyW"]?1:0);
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) {
            inputX = joystickMove.x; inputY = joystickMove.y;
        }

        const now = performance.now(); 
        if(now-lastInputSent>45){ 
            lastInputSent=now; 
            window.socket.emit("input", { 
                x: inputX, y: inputY, angle: ang, 
                block: keys["KeyQ"], charge: keys["KeyC"], 
                holdAtk: mouseLeft, holdBlast: mouseRight 
            }); 
        }
    }
    draw(); requestAnimationFrame(update);
}
update();