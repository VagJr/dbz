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

// ==========================================
// CONFIGURAÇÃO DE ZOOM E CÂMERA
// ==========================================
const ZOOM_SCALE = 0.7; // 2.5x Zoom Out (Visão ampla)

const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

// =====================================================
// CONTROLES E INPUTS
// =====================================================

function bindBtn(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;

    const press = e => {
        e.preventDefault();
        e.stopPropagation();
        onPress && onPress();
    };

    const release = e => {
        e.preventDefault();
        e.stopPropagation();
        onRelease && onRelease();
    };

    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false }); // ✅ CRÍTICO

    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release); // mouse desktop
}


bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
bindBtn('btn-block', () => keys['KeyQ']=true, () => delete keys['KeyQ']);
bindBtn('btn-charge', () => keys['KeyC']=true, () => delete keys['KeyC']);
bindBtn('btn-vanish', () => socket.emit('vanish'));
bindBtn('btn-transform', () => socket.emit('transform'));

const btnLogin = document.getElementById("btn-login");
if(btnLogin) btnLogin.onclick = () => {
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;
    if(user && pass) window.socket.emit("login", { user, pass });
};

window.addEventListener("contextmenu", e => e.preventDefault());

// MOUSE CORRIGIDO PARA O ZOOM
window.addEventListener("mousemove", e => { 
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    // O mouse agora representa a direção relativa ao centro da tela
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
});
window.addEventListener("keyup", e => keys[e.code] = false);

window.socket.on("auth_success", () => { 
    myId = window.socket.id; 
    document.getElementById("login-screen").style.display = "none"; 
    document.getElementById("ui").style.display = "block"; 

    if (isMobile) {
        const mui = document.getElementById("mobile-ui");
        mui.style.display = "block";

        // força layout antes do nipple
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                initMobileControls(); // ✅ AGORA APARECE
            });
        });
    }
});


window.socket.on("state", data => {
    if(!myId) return;

    players = data.players;
    npcs = data.npcs;
    projectiles = data.projectiles;
    rocks = data.rocks;
    craters = data.craters || [];
});


window.socket.on("fx", data => {
    if(data.type === "hit" || data.type === "heavy") {
        hitStop = data.type === "heavy" ? 8 : 3; 
        screenShake = data.type === "heavy" ? 30 : 10;
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: data.type === "heavy" ? 150 : 60, a: 1, color: "#fff" });
        for(let i=0; i<12; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 });
        if(data.dmg) {
            texts.push({
                x: data.x, y: data.y - 40, 
                text: data.dmg.toString(), 
                color: data.type === "heavy" ? "#ff3333" : "#ffff00", 
                life: 60, vy: -2, isDmg: true
            });
        }
    }
    if(data.type === "xp_gain") texts.push({ x: data.x, y: data.y - 60, text: "+" + data.amount + " XP", color: "#00ff00", life: 50, vy: -1.5 });
    if(data.type === "transform") { 
        screenShake = 50; flash = 15; 
        let c = "#ff0";
        if(data.form === "GOD") c = "#f00";
        if(data.form === "BLUE") c = "#0ff";
        if(data.form === "UI") c = "#fff";
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
        zone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: '#ff9900',
        size: 120
    });

    joystick.on('move', (evt, data) => {
        if (!data || !data.vector) return;
        joystickMove.x = data.vector.x;
        joystickMove.y = -data.vector.y;
    });

    joystick.on('end', () => {
        joystickMove.x = 0;
        joystickMove.y = 0;
    });
}

// ==========================================
// RENDERIZAÇÃO DO BACKGROUND CORRIGIDA
// ==========================================
function drawBackground(camX, camY) {
    // Calculamos o tamanho da área visível no mundo (Viewport)
    const viewW = canvas.width / ZOOM_SCALE;
    const viewH = canvas.height / ZOOM_SCALE;

    // Determina os limites de onde devemos desenhar
    const startX = camX - (viewW / 2);
    const startY = camY - (viewH / 2);
    const endX = camX + (viewW / 2);
    const endY = camY + (viewH / 2);

    let bgColor = "#122a12"; 
    let gridColor = "rgba(100,255,100,0.1)";

    // Lógica de Biomas baseada na posição da câmera
    const dist = Math.hypot(camX, camY);
    if (dist > 50000) { bgColor = "#050015"; gridColor = "rgba(100,0,255,0.2)"; } 
    else if (camY < -4000 && Math.abs(camX) < Math.abs(camY)) { bgColor = "#220000"; gridColor = "rgba(255,50,50,0.1)"; } // Gods
    else if (camY > 4000 && Math.abs(camX) < Math.abs(camY)) { bgColor = "#331133"; gridColor = "rgba(255,100,255,0.1)"; } // Majin
    else if (camX > 4000 && Math.abs(camY) < camX) { bgColor = "#004444"; gridColor = "rgba(100,255,255,0.1)"; } // Namek
    else if (camX < -4000 && Math.abs(camY) < Math.abs(camX)) { bgColor = "#1a1a1a"; gridColor = "rgba(200,200,200,0.1)"; } // Android

    // 1. Preenche o fundo cobrindo TUDO que é visível (com sobra)
    ctx.fillStyle = bgColor;
    ctx.fillRect(startX - 200, startY - 200, viewW + 400, viewH + 400);

    // 2. Desenha o Planeta/Lua se estiver em Namek e visível
    if(camX > 4000 && Math.abs(camY) < camX && dist < 50000) {
        ctx.fillStyle = "rgba(100,255,200, 0.15)";
        ctx.beginPath(); ctx.arc(6000, 0, 800, 0, Math.PI*2); ctx.fill();
    }

    // 3. GRID FIXO NO MUNDO (Correção do "Bug" de deslizamento)
    const gridSize = 200;
    const firstLineX = Math.floor(startX / gridSize) * gridSize;
    const firstLineY = Math.floor(startY / gridSize) * gridSize;

    ctx.strokeStyle = gridColor; 
    ctx.lineWidth = 4;
    ctx.beginPath();

    // Linhas Verticais
    for(let x = firstLineX; x < endX + gridSize; x += gridSize) {
        ctx.moveTo(x, startY - 100);
        ctx.lineTo(x, endY + 100);
    }
    // Linhas Horizontais
    for(let y = firstLineY; y < endY + gridSize; y += gridSize) {
        ctx.moveTo(startX - 100, y);
        ctx.lineTo(endX + 100, y);
    }
    ctx.stroke();

    // 4. Caminho da Serpente
    if(camY < -1000 && camY > -9000 && Math.abs(camX) < 3000) {
        ctx.save();
        ctx.strokeStyle = "#ffaa00"; 
        ctx.lineWidth = 40; 
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ffaa00";
        ctx.beginPath();
        const startSnake = Math.max(-10000, startY - 200);
        const endSnake = Math.min(-1000, endY + 200);
        for(let y = endSnake; y > startSnake; y -= 100){ 
            ctx.lineTo(Math.sin(y/400)*300, y); 
        }
        ctx.stroke(); 
        ctx.restore();
    }
}

function drawEntity(e) {
    if(e.isDead && e.isNPC) return;
    const isSpirit = e.isSpirit;
    const sizeMult = e.isBoss ? 3.5 : 1;
    
    // AURA TRAIL
    if(hitStop <= 0 && (Math.hypot(e.vx, e.vy) > 10)) {
        let auraColor = e.color || "#fff";
        if(e.form === "SSJ" || e.form === "SSJ2") auraColor = "#ffea00";
        if(e.form === "BLUE") auraColor = "#0ff";
        trails.push({ x: e.x, y: e.y, angle: e.angle, color: auraColor, alpha: 0.4, sizeMult });
    }

    ctx.save(); 
    ctx.translate(e.x, e.y); 
    
    // HOLOGRAMA DE STATUS
    if(!e.isSpirit && e.id !== myId) {
        ctx.save();
        ctx.translate(30 * sizeMult, -50 * sizeMult);
        ctx.transform(1, -0.2, 0, 1, 0, 0); // Inclinação Diagonal

        // Linha
        ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(100, 0); ctx.stroke();

        // Texto
        ctx.fillStyle = e.isBoss ? "#ff3333" : "#00ffff";
        ctx.font = "bold 20px Orbitron";
        ctx.shadowBlur = 4; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(`${e.name}`, 5, -8);
        
        // Barra HP
        const hpPerc = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 5, 100, 6);
        ctx.fillStyle = e.isBoss ? "#f00" : "#0f0"; ctx.fillRect(0, 5, 100 * hpPerc, 6);
        ctx.restore();
    }

    ctx.globalAlpha = isSpirit ? 0.5 : 1.0;
    ctx.rotate(e.angle);

    // CORPO
    ctx.shadowBlur = 0;
    if(e.form === "SSJ") { ctx.shadowBlur = 20; ctx.shadowColor = "#ff0"; }
    
    ctx.fillStyle = e.color; 
    ctx.fillRect(-15*sizeMult, -12*sizeMult, 30*sizeMult, 24*sizeMult);
    
    // CABEÇA
    ctx.fillStyle = e.isNPC ? (e.isBoss ? "#311" : "#2d2") : "#ffdbac"; 
    if(e.name.includes("FRIEZA")) ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, -5*sizeMult, 12*sizeMult, 0, Math.PI*2); ctx.fill();

    // CABELO
    if(!e.isNPC) { 
        let hColor = "#111"; 
        if(e.form === "SSJ") hColor = "#ffea00";
        if(e.form === "BLUE") hColor = "#0ff";
        ctx.fillStyle = hColor; 
        for(let i=0; i<3; i++) { 
            ctx.beginPath(); ctx.moveTo(-10*sizeMult, -10*sizeMult); 
            ctx.lineTo((-15+i*15)*sizeMult, -35*sizeMult); 
            ctx.lineTo((10)*sizeMult, -10*sizeMult); ctx.fill(); 
        } 
    }

    if(e.state === "BLOCKING") { 
        ctx.strokeStyle = "rgba(100,200,255,0.7)"; 
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0,0, 40*sizeMult, -1, 1); ctx.stroke(); 
    }
    
    ctx.restore();
}

function draw() {
    // --- CORREÇÃO IMPORTANTE DO CONGELAMENTO ---
    if(hitStop > 0) hitStop--; 
    // -------------------------------------------

    if(flash > 0) { 
        ctx.fillStyle = `rgba(255,255,255,${flash/10})`; 
        ctx.fillRect(0,0,canvas.width,canvas.height); 
        flash--; 
    } else { 
        ctx.clearRect(0,0,canvas.width,canvas.height); 
    }

    const me = players[myId]; if(!me) return;

    // Câmera Suave
    cam.x += (me.x - cam.x) * 0.1;
    cam.y += (me.y - cam.y) * 0.1;

    let sx = 0, sy = 0;
    if(screenShake > 0) { sx = (Math.random()-0.5)*screenShake; sy = (Math.random()-0.5)*screenShake; screenShake *= 0.9; }

    ctx.save();
    
    // 1. Centraliza
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // 2. Aplica Zoom
    ctx.scale(ZOOM_SCALE, ZOOM_SCALE);
    // 3. Move Câmera (Inverso da posição do player)
    ctx.translate(-cam.x + sx, -cam.y + sy);

    // Renderiza Mundo
    drawBackground(cam.x, cam.y);

    craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
    
    rocks.forEach(r => { 
        ctx.fillStyle = r.type === "rock_namek" ? "#446" : "#543";
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x-r.r/3, r.y+r.r/3, r.r/2, 0, Math.PI*2); ctx.fill();
    });

    trails.forEach((t, i) => { 
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); 
        ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; 
        ctx.fillRect(-15*t.sizeMult, -12*t.sizeMult, 30*t.sizeMult, 24*t.sizeMult); 
        ctx.restore(); 
        t.alpha -= 0.08; if(t.alpha <= 0) trails.splice(i, 1); 
    });

    shockwaves.forEach((s, i) => { 
        s.r += 12; s.a -= 0.05; 
        ctx.strokeStyle = s.color; ctx.lineWidth = 8; ctx.globalAlpha = s.a; 
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); 
        if(s.a <= 0) shockwaves.splice(i, 1); 
    });

    npcs.forEach(drawEntity);
    Object.values(players).forEach(drawEntity);

    projectiles.forEach(pr => { 
        ctx.fillStyle = pr.color; 
        ctx.shadowBlur=20; ctx.shadowColor=pr.color; 
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI*2); ctx.fill(); 
        ctx.shadowBlur=0; 
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size*0.5, 0, Math.PI*2); ctx.fill(); 
    });

    particles.forEach((p, i) => { 
        p.x += p.vx; p.y += p.vy; p.life -= 0.05; 
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life; 
        ctx.fillRect(p.x, p.y, p.size, p.size); 
        if(p.life <= 0) particles.splice(i, 1); 
    });

    texts.forEach((t, i) => { 
        t.y += (t.vy || -0.5); t.life--; 
        ctx.save();
        ctx.translate(t.x, t.y);
        if(t.isDmg) ctx.scale(1 + Math.sin(Date.now()/50)*0.2, 1 + Math.sin(Date.now()/50)*0.2); 
        ctx.fillStyle = t.color; ctx.globalAlpha = t.life/60; 
        ctx.font = "bold 28px Orbitron"; 
        ctx.strokeStyle = "black"; ctx.lineWidth = 4; 
        ctx.strokeText(t.text, 0, 0); ctx.fillText(t.text, 0, 0); 
        ctx.restore();
        if(t.life<=0) texts.splice(i,1); 
    });

    ctx.restore();
}

let lastInputSent = 0;
function update() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    if(!myId) { requestAnimationFrame(update); return; }
    
    const me = players[myId];
    if(me) {
        document.getElementById("hp-bar").style.width = (me.hp/me.maxHp)*100 + "%";
        document.getElementById("ki-bar").style.width = (me.ki/me.maxKi)*100 + "%";
        const xpPerc = (me.xp / (me.level*800)) * 100;
        document.getElementById("xp-bar").style.width = xpPerc + "%";
        document.getElementById("stat-bp").innerText = `LVL ${me.level} | BP: ${me.bp}`;
        
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