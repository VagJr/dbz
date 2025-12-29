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
let scouterActive = false; 
let showMap = true;

const ZOOM_SCALE = 0.7;
const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

// Partículas de poeira da tela (Screen Space Dust)
const dustParticles = [];
for(let i=0; i<60; i++) {
    dustParticles.push({
        x: Math.random() * 2000, 
        y: Math.random() * 1000, 
        size: Math.random() * 1.5, 
        vx: (Math.random()-0.5)*0.2, 
        vy: (Math.random()-0.5)*0.2,
        alpha: Math.random() * 0.5 + 0.1
    });
}

const WAYPOINTS = [
    { name: "TERRA", x: 0, y: 0 },
    { name: "NAMEK", x: -15000, y: 0 },
    { name: "FUTURO", x: 15000, y: 0 },
    { name: "KAIOH", x: 0, y: -20000 },
    { name: "DEMON", x: 0, y: 15000 },
    { name: "ENMA", x: 0, y: -6000 }
];

function bindBtn(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = e => { e.preventDefault(); e.stopPropagation(); onPress && onPress(); };
    const release = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('mousedown', press); el.addEventListener('mouseup', release);
}

bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
bindBtn('btn-block', () => keys['KeyQ']=true, () => delete keys['KeyQ']);
bindBtn('btn-charge', () => keys['KeyC']=true, () => delete keys['KeyC']);
bindBtn('btn-vanish', () => socket.emit('vanish'));
bindBtn('btn-transform', () => socket.emit('transform'));
bindBtn('btn-scouter', () => { scouterActive = !scouterActive; });

const btnLogin = document.getElementById("btn-login");
if(btnLogin) btnLogin.onclick = () => {
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;
    if(user && pass) window.socket.emit("login", { user, pass });
};

window.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("mousemove", e => { 
    mouse.x = (e.clientX - window.innerWidth / 2) / ZOOM_SCALE;
    mouse.y = (e.clientY - window.innerHeight / 2) / ZOOM_SCALE;
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
    if(e.code === "KeyM") showMap = !showMap; 
    if(e.code === "KeyP") window.socket.emit("toggle_pvp"); 
});
window.addEventListener("keyup", e => keys[e.code] = false);

// Botão PVP Mobile
const btnPvp = document.getElementById("btn-pvp");
if (btnPvp) {
    btnPvp.addEventListener("touchstart", e => {
        e.preventDefault(); socket.emit("toggle_pvp"); btnPvp.classList.toggle("active");
    });
    btnPvp.addEventListener("click", () => {
        socket.emit("toggle_pvp"); btnPvp.classList.toggle("active");
    });
}

window.socket.on("auth_success", (data) => { 
    myId = data.id; 
    document.getElementById("login-screen").style.display = "none"; 
    document.getElementById("ui").style.display = "block"; 
    if (isMobile) {
        document.getElementById("mobile-ui").style.display = "block";
        requestAnimationFrame(() => { initMobileControls(); });
    }
});

window.socket.on("state", data => {
    if(!myId) return;
    players = data.players; npcs = data.npcs; projectiles = data.projectiles; 
    rocks = data.rocks; craters = data.craters || [];
});

window.socket.on("fx", data => {
    if(data.type === "hit" || data.type === "heavy") {
        screenShake = data.type === "heavy" ? 30 : 10;
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: data.type === "heavy" ? 150 : 60, a: 1, color: "#fff" });
        for(let i=0; i<12; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 });
        if(data.dmg) texts.push({ x: data.x, y: data.y - 40, text: data.dmg.toString(), color: "#ffff00", life: 60, vy: -2, isDmg: true });
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
    if(data.type === "bp_limit") {
        texts.push({x: data.x, y: data.y - 100, text: data.text, color: "#ff0000", life: 60, vy: -0.5});
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

function drawBackground(camX, camY) {
    const viewW = canvas.width / ZOOM_SCALE;
    const viewH = canvas.height / ZOOM_SCALE;
    const buffer = 1000; 
    const startX = camX - viewW / 2 - buffer;
    const startY = camY - viewH / 2 - buffer;
    const width = viewW + buffer * 2;
    const height = viewH + buffer * 2;
    const endX = startX + width;
    const endY = startY + height;

    const dist = Math.hypot(camX, camY);
    const angle = Math.atan2(camY, camX);
    
    let c1 = "#1a3a1a", c2 = "#000500"; 
    let starOpacity = 0;

    if (dist >= 5000) {
        starOpacity = 0.8;
        if (Math.abs(angle) > 2.35) { c1 = "#001a1a"; c2 = "#000205"; } 
        else if (Math.abs(angle) < 0.78) { c1 = "#1a1a22"; c2 = "#05050a"; } 
        else if (angle >= 0.78 && angle <= 2.35) { c1 = "#220000"; c2 = "#0a0005"; } 
        else { c1 = "#1a0033"; c2 = "#020005"; } 
    }

    const grd = ctx.createRadialGradient(camX, camY, viewH * 0.1, camX, camY, viewH * 1.5);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);

    ctx.fillStyle = grd;
    ctx.fillRect(startX, startY, width, height);

    if (dist > 4000) {
        const starGrid = 600; 
        const sx = Math.floor(startX / starGrid) * starGrid;
        const sy = Math.floor(startY / starGrid) * starGrid;

        for (let x = sx; x < endX; x += starGrid) {
            for (let y = sy; y < endY; y += starGrid) {
                let seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
                ctx.fillStyle = `rgba(255, 255, 255, ${starOpacity})`;
                for(let k=0; k<4; k++) {
                    seed = Math.sin(seed) * 43758.5453;
                    const rX = x + (Math.abs(seed) % starGrid);
                    seed = Math.sin(seed) * 43758.5453;
                    const rY = y + (Math.abs(seed) % starGrid);
                    const size = (Math.abs(seed) % 2.5) + 0.5;
                    const twinkle = Math.sin(Date.now() * 0.005 + seed) * 0.3 + 0.7;
                    ctx.globalAlpha = twinkle * starOpacity;
                    ctx.beginPath(); ctx.arc(rX, rY, size, 0, Math.PI*2); ctx.fill();
                }
                if (Math.abs(seed) % 100 < 15) {
                    ctx.globalAlpha = 0.04;
                    ctx.fillStyle = (Math.abs(seed) % 10 > 5) ? "#00ffff" : "#ff00ff"; 
                    const blobSize = (Math.abs(seed) % 400) + 200;
                    ctx.beginPath(); ctx.arc(x + starGrid/2, y + starGrid/2, blobSize, 0, Math.PI*2); ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1.0;
    }

    const gridCell = 400;
    const gridOffsetX = Math.floor(startX / gridCell) * gridCell;
    const gridOffsetY = Math.floor(startY / gridCell) * gridCell;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"; 
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let x = gridOffsetX; x < endX; x += gridCell) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
    for(let y = gridOffsetY; y < endY; y += gridCell) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    dustParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if(p.x > 2000) p.x = 0; if(p.x < 0) p.x = 2000;
        if(p.y > 1000) p.y = 0; if(p.y < 0) p.y = 1000;
        const screenPx = camX - viewW/2 + ((p.x + camX * 0.2) % viewW);
        const screenPy = camY - viewH/2 + ((p.y + camY * 0.2) % viewH);
        ctx.beginPath(); ctx.arc(screenPx, screenPy, p.size, 0, Math.PI*2); ctx.fill();
    });
}

function drawOtherWorld(camX, camY) {
    if (camY > -4000 && camY < 20000) return; 
    ctx.save();
    
    ctx.shadowBlur = 30; ctx.shadowColor = "#e6b800";
    ctx.strokeStyle = "#e6b800"; ctx.lineWidth = 60; ctx.lineCap = "round"; ctx.beginPath();
    const startY = -6000; const endY = -20000;
    for (let y = startY; y >= endY; y -= 200) {
        const x = Math.sin(y * 0.0015) * 600; 
        if (y === startY) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    ctx.shadowBlur = 0; 
    ctx.strokeStyle = "#b38f00"; ctx.lineWidth = 6; ctx.beginPath();
    for (let y = startY; y >= endY; y -= 200) {
        const x = Math.sin(y * 0.0015) * 600;
        if (y === startY) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save(); ctx.translate(0, -6000);
    ctx.fillStyle = "#8B4513"; ctx.fillRect(-150, -50, 300, 100); 
    ctx.fillStyle = "#d22"; ctx.beginPath(); ctx.moveTo(-180, -50); ctx.lineTo(0, -150); ctx.lineTo(180, -50); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center"; ctx.fillText("ENMA", 0, 20);
    ctx.restore();

    ctx.save(); ctx.translate(0, -20000); 
    ctx.shadowBlur = 60; ctx.shadowColor = "rgba(100, 255, 100, 0.6)"; 
    ctx.fillStyle = "#4a4"; ctx.beginPath(); ctx.arc(0, 0, 350, 0, Math.PI * 2); ctx.fill(); 
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#dcb"; ctx.lineWidth = 40; ctx.beginPath(); ctx.arc(0, 0, 280, 0, Math.PI * 2); ctx.stroke(); 
    ctx.fillStyle = "#532"; ctx.fillRect(-30, -350, 60, 100); 
    ctx.fillStyle = "#282"; ctx.beginPath(); ctx.arc(0, -400, 120, 0, Math.PI*2); ctx.fill(); 
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(100, -100, 80, 0, Math.PI, true); ctx.fill(); 
    ctx.fillStyle = "#d22"; ctx.beginPath(); ctx.moveTo(20, -100); ctx.lineTo(100, -180); ctx.lineTo(180, -100); ctx.fill(); 
    ctx.fillStyle = "#ff0"; ctx.font = "bold 50px Orbitron"; ctx.textAlign = "center"; ctx.shadowBlur = 10; ctx.shadowColor="#ff0"; ctx.fillText("KAIOH", 0, 500);
    ctx.restore();
}

function drawEntity(e) {
    if(e.isDead && e.isNPC) return;
    const isSpirit = e.isSpirit;
    const sizeMult = e.isBoss ? 4.0 : 1; 
    let auraColor = "#00ffff"; 
    
    if(e.color) auraColor = e.color; 
    if(e.form === "SSJ" || e.form === "SSJ2") auraColor = "#ffea00";
    if(e.form === "SSJ3") auraColor = "#ffcc00";
    if(e.form === "GOD") auraColor = "#ff0000";
    if(e.form === "BLUE") auraColor = "#00bbff";
    if(e.form === "UI") auraColor = "#ffffff";
    
    if(e.name) {
        if(e.name.includes("BLACK") || e.name.includes("ROSE")) auraColor = "#ff0088"; 
        if(e.name.includes("BROLY") || e.name.includes("KEFLA")) auraColor = "#00ff00"; 
        if(e.name.includes("GOMAH") || e.name.includes("DEMON")) auraColor = "#9900ff"; 
        if(e.name.includes("TOPPO") || e.name.includes("EGO")) auraColor = "#8800ff"; 
    }

    if(hitStop <= 0 && (Math.hypot(e.vx, e.vy) > 10)) {
        trails.push({ x: e.x, y: e.y, angle: e.angle, color: auraColor, alpha: 0.4, sizeMult });
    }

    ctx.save(); ctx.translate(e.x, e.y); 
    
    if(e.form !== "BASE" || e.state === "CHARGING") {
        ctx.shadowBlur = 20; ctx.shadowColor = auraColor;
    }

    if (isSpirit) {
        ctx.save(); ctx.translate(0, -50 * sizeMult); 
        ctx.shadowBlur = 15; ctx.shadowColor = "#fff";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 15 * sizeMult, 5 * sizeMult, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    if (e.state === "CHARGING") {
        ctx.save();
        const pulse = Math.sin(Date.now() / 50) * 0.1 + 1; const auraSize = 50 * sizeMult * pulse;
        const grd = ctx.createRadialGradient(0, 0, 10, 0, 0, auraSize);
        grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        grd.addColorStop(0.4, auraColor);
        grd.addColorStop(1, "rgba(0, 0, 0, 0)");
        
        ctx.globalCompositeOperation = 'lighter'; 
        ctx.fillStyle = grd; 
        ctx.beginPath(); ctx.arc(0, -10, auraSize, 0, Math.PI * 2); ctx.fill();
        
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
        for(let i=0; i<3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const d = Math.random() * auraSize;
            ctx.moveTo(0, -10); ctx.lineTo(Math.cos(angle)*d, -10+Math.sin(angle)*d);
        }
        ctx.stroke();
        ctx.restore();
    }

    if (!scouterActive && !isSpirit) {
        ctx.save();
        ctx.translate(30 * sizeMult, -50 * sizeMult);
        ctx.transform(1, -0.2, 0, 1, 0, 0); 
        
        ctx.strokeStyle = "rgba(0, 255, 255, 0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(100, 0); ctx.stroke();
        
        ctx.fillStyle = e.isBoss ? "#ff3333" : "#00ffff"; 
        ctx.font = "bold 20px Orbitron";
        ctx.shadowBlur = 4; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(`${e.name.substring(0,12)}`, 5, -8);
        
        const hpPerc = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 5, 100, 6);
        ctx.fillStyle = e.isBoss ? "#f00" : (e.isNPC ? "#fa0" : "#0f0"); 
        ctx.shadowBlur = 0;
        ctx.fillRect(0, 5, 100 * hpPerc, 6);
        
        if(!e.isNPC) {
             ctx.fillStyle = "#fff"; ctx.font = "12px Orbitron";
             ctx.fillText(`BP: ${e.bp.toLocaleString()}`, 5, 20);
             if(e.pvpMode) {
                 ctx.fillStyle = "#f00"; ctx.font = "bold 10px Arial"; ctx.fillText("PVP ON", 5, 32);
             }
        }
        ctx.restore();
    }

    ctx.rotate(e.angle);
    ctx.lineWidth = 2; ctx.strokeStyle = "#000";

    ctx.fillStyle = e.color; 
    ctx.beginPath(); ctx.rect(-15*sizeMult, -12*sizeMult, 30*sizeMult, 24*sizeMult); 
    ctx.fill(); ctx.stroke(); 

    ctx.fillStyle = e.isNPC ? (e.isBoss ? "#311" : "#2d2") : "#ffdbac"; 
    if(e.name && (e.name.includes("FRIEZA"))) ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, -5*sizeMult, 12*sizeMult, 0, Math.PI*2); 
    ctx.fill(); ctx.stroke(); 

    if(!e.isNPC) { 
        let hColor = "#111"; 
        if(e.form.includes("SSJ")) hColor = "#ffea00"; if(e.form==="GOD") hColor="#f00"; if(e.form==="BLUE") hColor="#00bbff";
        ctx.fillStyle = hColor; 
        for(let i=0; i<3; i++) { 
            ctx.beginPath(); ctx.moveTo(-10*sizeMult, -10*sizeMult); ctx.lineTo((-15+i*15)*sizeMult, -35*sizeMult); ctx.lineTo((10)*sizeMult, -10*sizeMult); 
            ctx.fill(); ctx.stroke();
        } 
    }
    if(e.state === "BLOCKING") { 
        ctx.strokeStyle = "rgba(100,200,255,0.7)"; ctx.lineWidth = 4; 
        ctx.shadowBlur = 15; ctx.shadowColor = "#00ffff";
        ctx.beginPath(); ctx.arc(0,0, 40*sizeMult, -1, 1); ctx.stroke(); 
    }
    ctx.restore();
}

function drawScouterHUD(me) {
    if (!me) return;
    const W = canvas.width; const H = canvas.height; const cx = W / 2; const cy = H / 2;
    const time = Date.now();

    ctx.save();
    ctx.globalCompositeOperation = "source-over"; 
    
    let grad = ctx.createRadialGradient(cx, cy, H/2, cx, cy, H);
    grad.addColorStop(0, "rgba(0, 255, 0, 0)");
    grad.addColorStop(1, "rgba(0, 255, 0, 0.3)");
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    const scanY = (time * 0.5) % H; 
    ctx.fillStyle = "rgba(0, 255, 0, 0.15)"; ctx.fillRect(0, scanY, W, 4); 

    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI*2); ctx.stroke();
    
    ctx.save();
    ctx.translate(W - 150, 100);
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
    ctx.font = "12px monospace";
    for(let i=0; i<15; i++) {
        const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
        ctx.fillText(randomHex, 0, i*14);
    }
    ctx.restore();
    
    let dangerDetected = false;

    [...npcs, ...Object.values(players)].forEach(e => {
        if (e.id === me.id || e.isDead || e.isSpirit) return;
        const screenX = cx + (e.x - cam.x) * ZOOM_SCALE; 
        const screenY = cy + (e.y - cam.y) * ZOOM_SCALE;
        const dist = Math.hypot(e.x - me.x, e.y - me.y);
        const onScreen = screenX > -50 && screenX < W + 50 && screenY > -50 && screenY < H + 50;
        
        if (e.bp > me.bp * 1.5 && dist < 3000) dangerDetected = true;

        if (onScreen) {
            const bracketSize = 30 + Math.sin(time/200)*5;
            const isTarget = Math.hypot(screenX-cx, screenY-cy) < 100;
            const color = isTarget ? "#ff0000" : (e.isNPC ? "#00ff00" : "#00ffff"); 

            ctx.save(); ctx.translate(screenX, screenY);
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            
            ctx.beginPath(); ctx.moveTo(-bracketSize, -bracketSize+10); ctx.lineTo(-bracketSize, -bracketSize); ctx.lineTo(-bracketSize+10, -bracketSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bracketSize, bracketSize-10); ctx.lineTo(bracketSize, bracketSize); ctx.lineTo(bracketSize-10, bracketSize); ctx.stroke();

            ctx.fillStyle = color; ctx.font = "bold 12px Orbitron"; 
            const bpDisplay = isTarget ? e.bp.toLocaleString() : Math.floor(Math.random()*99999);
            ctx.fillText(`BP: ${bpDisplay}`, bracketSize+5, -10);
            ctx.font = "10px Orbitron";
            ctx.fillText(e.name, bracketSize+5, 5);
            if(!e.isNPC) {
                ctx.fillStyle = "#00ffff"; 
                ctx.fillText("[P]", -bracketSize-15, 0); 
            }
            ctx.restore();
        } else {
            if (dist < 4000) {
                const angle = Math.atan2(screenY - cy, screenX - cx);
                const radius = Math.min(W, H) / 2 - 30;
                const ix = cx + Math.cos(angle) * radius;
                const iy = cy + Math.sin(angle) * radius;
                
                ctx.save(); ctx.translate(ix, iy); ctx.rotate(angle);
                ctx.fillStyle = e.isBoss ? "#ff0000" : (!e.isNPC ? "#00ffff" : "#00ff00"); 
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.fill();
                ctx.rotate(-angle);
                ctx.fillStyle = "#fff"; ctx.font = "10px Arial"; ctx.textAlign = "center";
                ctx.fillText(`${Math.floor(dist)}m`, 0, 20);
                if(!e.isNPC) ctx.fillText("P", 0, 5);
                ctx.restore();
            }
        }
    });

    if (dangerDetected && (Math.floor(time / 300) % 2 === 0)) {
        ctx.save(); ctx.translate(cx, cy - 150);
        ctx.fillStyle = "#ff0000"; ctx.font = "bold 24px Orbitron"; ctx.textAlign = "center";
        ctx.shadowBlur = 20; ctx.shadowColor = "#ff0000";
        ctx.fillText("WARNING: HIGH POWER LEVEL", 0, 0);
        ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-150, 10); ctx.lineTo(150, 10); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function drawNavigationMarkers(me) {
    const cx = canvas.width / 2; const cy = canvas.height / 2;
    ctx.save();
    ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    
    WAYPOINTS.forEach(wp => {
        const dx = wp.x - me.x; const dy = wp.y - me.y;
        const dist = Math.hypot(dx, dy);
        
        if(dist > 2000 && dist < 60000) {
            const angle = Math.atan2(dy, dx);
            const radius = Math.min(canvas.width, canvas.height) / 2 - 50;
            const sx = cx + Math.cos(angle) * radius;
            const sy = cy + Math.sin(angle) * radius;
            
            ctx.fillStyle = "rgba(0, 255, 255, 0.6)";
            ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
            
            ctx.shadowColor = "#0ff"; ctx.shadowBlur = 10;
            ctx.fillStyle = "#0ff";
            ctx.fillText(wp.name, sx, sy - 15);
            ctx.font = "10px Arial";
            ctx.fillText(`${Math.floor(dist)}m`, sx, sy - 5);
        }
    });
    ctx.restore();
}

function drawSchematicMap(me) {
    if(!showMap) return;
    const size = isMobile ? 60 : 150; 
    const padding = 20;
    const mapCX = canvas.width - size - padding;
    const mapCY = size + padding;
    const scale = size / 60000; 

    ctx.save();
    ctx.translate(mapCX, mapCY);
    ctx.fillStyle = "rgba(0, 20, 0, 0.7)"; ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)"; ctx.lineWidth = 2; ctx.stroke();
    
    ctx.strokeStyle = "rgba(0, 100, 0, 0.3)"; 
    ctx.beginPath(); ctx.arc(0, 0, 5000*scale, 0, Math.PI*2); ctx.stroke(); 
    ctx.beginPath(); ctx.arc(0, 0, 15000*scale, 0, Math.PI*2); ctx.stroke(); 

    const px = me.x * scale; const py = me.y * scale;
    if (Math.hypot(px, py) < size) {
        ctx.fillStyle = "#ffaa00"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
    }
    Object.values(players).forEach(p => {
        if(p.id !== myId && !p.isDead) {
            const ox = p.x * scale; const oy = p.y * scale;
            if(Math.hypot(ox, oy) < size) {
                ctx.fillStyle = "#00ffff"; ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI*2); ctx.fill();
            }
        }
    });
    ctx.restore();
}

function draw() {
    if(hitStop > 0) hitStop--; 
    if(flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash/10})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash--; } 
    else { ctx.clearRect(0,0,canvas.width,canvas.height); }

    const me = players[myId]; if(!me) return;

    cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1;
    let sx = (Math.random()-0.5)*screenShake; screenShake *= 0.9;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(ZOOM_SCALE, ZOOM_SCALE);
    ctx.translate(-cam.x + sx, -cam.y + sx);

    drawBackground(cam.x, cam.y);
    drawOtherWorld(cam.x, cam.y); 

    craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
    rocks.forEach(r => { 
        ctx.fillStyle = r.type === "rock_namek" ? "#446" : "#543";
        if(r.type === "rock_magic") ctx.fillStyle = "#636"; if(r.type === "rock_god") ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x-r.r/3, r.y+r.r/3, r.r/2, 0, Math.PI*2); ctx.fill();
    });

    trails.forEach((t, i) => { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; ctx.fillRect(-15*t.sizeMult, -12*t.sizeMult, 30*t.sizeMult, 24*t.sizeMult); ctx.restore(); t.alpha -= 0.08; if(t.alpha <= 0) trails.splice(i, 1); });
    shockwaves.forEach((s, i) => { s.r += 12; s.a -= 0.05; ctx.strokeStyle = s.color; ctx.lineWidth = 8; ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); if(s.a <= 0) shockwaves.splice(i, 1); });

    npcs.forEach(drawEntity);
    Object.values(players).forEach(drawEntity);
    
    projectiles.forEach(pr => { 
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 15; ctx.shadowColor = pr.color;
        ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size*0.6, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    });
    
    particles.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, p.size, p.size); if(p.life <= 0) particles.splice(i, 1); });
    texts.forEach((t, i) => { t.y += t.vy; t.life--; ctx.save(); ctx.translate(t.x, t.y); ctx.fillStyle = t.color; ctx.font = "bold 28px Orbitron"; ctx.fillText(t.text, 0, 0); ctx.restore(); if(t.life<=0) texts.splice(i,1); });

    ctx.restore();

    drawSchematicMap(me); 
    if (scouterActive) {
        drawNavigationMarkers(me); 
        drawScouterHUD(me);
    }
}

let lastInputSent = 0;
function update() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    if(!myId) { requestAnimationFrame(update); return; }
    
    const me = players[myId];
    if(me) {
        document.getElementById("hp-bar").style.width = (me.hp/me.maxHp)*100 + "%";
        document.getElementById("ki-bar").style.width = (me.ki/me.maxKi)*100 + "%";
        document.getElementById("xp-bar").style.width = (me.xp / (me.level*800)) * 100 + "%";
        
        const dist = Math.hypot(me.x, me.y);
        const angle = Math.atan2(me.y, me.x);
        let zoneName = "PLANETA TERRA";
        if (dist >= 5000) {
            if (Math.abs(angle) > 2.35) zoneName = "SETOR OESTE (ESPAÇO)";
            else if (Math.abs(angle) < 0.78) zoneName = "SETOR LESTE (FUTURO)";
            else if (angle >= 0.78 && angle <= 2.35) zoneName = "SETOR SUL (DEMON)";
            else zoneName = "SETOR NORTE (DIVINO)";
        }
        document.getElementById("stat-bp").innerText = `LVL ${me.level} | ${zoneName}`;
        
        if(me.pvpMode) {
             document.getElementById("stat-bp").innerText += " [PVP ON]";
             document.getElementById("stat-bp").style.color = "#f00";
        } else {
             document.getElementById("stat-bp").style.color = "#ffcc00";
        }

        let ang = Math.atan2(mouse.y, mouse.x); 
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) ang = Math.atan2(joystickMove.y, joystickMove.x);
        let inputX = (keys["KeyD"]?1:0)-(keys["KeyA"]?1:0);
        let inputY = (keys["KeyS"]?1:0)-(keys["KeyW"]?1:0);
        if (isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) { inputX = joystickMove.x; inputY = joystickMove.y; }

        if(performance.now()-lastInputSent>45){ 
            lastInputSent=performance.now(); 
            window.socket.emit("input", { x: inputX, y: inputY, angle: ang, block: keys["KeyQ"], charge: keys["KeyC"], holdAtk: mouseLeft, holdBlast: mouseRight }); 
        }
    }
    draw(); requestAnimationFrame(update);
}
update();

// =============================================================================
// 🔊 DBZ SFX SYSTEM — IMPACT / SPACE / FIGHT
// =============================================================================
(function(){

    let audioUnlocked = false;

    const SFX = {
        hit:       [],
        heavy:     [],
        blast:     [],
        charge:    [],
        teleport:  [],
        transform: [],
        scouter:   [],
        levelup:   []
    };

    // 🎧 SONS MAIS PESADOS, METÁLICOS, ESPACIAIS
    const SOURCES = {
        // Poradas secas, impacto físico
        hit:       "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3",

        // Pancada forte, corpo sendo arremessado
        heavy:     "https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3",

        // Ki blast / energia explodindo
        blast:     "https://assets.mixkit.co/active_storage/sfx/272/272-preview.mp3",

        // Carregar energia (loop curto e denso)
        charge:    "https://assets.mixkit.co/active_storage/sfx/388/388-preview.mp3",

        // Teleporte / vanish / rasgo no espaço
        teleport:  "https://assets.mixkit.co/active_storage/sfx/250/250-preview.mp3",

        // Transformação poderosa
        transform: "https://assets.mixkit.co/active_storage/sfx/411/411-preview.mp3",

        // Scouter eletrônico sci-fi
        scouter:   "https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3",

        // Level up energético
        levelup:   "https://assets.mixkit.co/active_storage/sfx/201/201-preview.mp3"
    };

    function buildPool() {
        Object.keys(SOURCES).forEach(key => {
            for (let i = 0; i < 6; i++) {
                const a = new Audio(SOURCES[key]);
                a.preload = "auto";
                a.volume = 0.85;
                SFX[key].push(a);
            }
        });
    }

    function unlockAudio() {
        if (audioUnlocked) return;
        audioUnlocked = true;
        buildPool();
    }

    function play(key) {
        if (!audioUnlocked) return;
        const list = SFX[key];
        if (!list) return;

        const a = list.find(x => x.paused);
        if (!a) return;

        a.currentTime = 0;
        a.play().catch(()=>{});
    }

    // 🔓 Gesto obrigatório
    window.addEventListener("pointerdown", unlockAudio, { once:true });

    // 🔊 FX do servidor
    if (window.socket) {
        socket.on("fx", fx => {
            if (!fx || !fx.type) return;
            if (fx.type === "hit") play("hit");
            if (fx.type === "heavy") play("heavy");
            if (fx.type === "vanish") play("teleport");
            if (fx.type === "transform") play("transform");
            if (fx.type === "levelup") play("levelup");
        });
    }

    // 🔫 Ação local imediata
    const originalEmit = socket.emit;
    socket.emit = function(ev, data){
        if (ev === "release_attack") play("hit");
        if (ev === "release_blast") play("blast");
        originalEmit.apply(this, arguments);
    };

    // 📡 Scouter
    let lastScouter = false;
    setInterval(()=>{
        if (typeof scouterActive !== "boolean") return;
        if (scouterActive && !lastScouter) play("scouter");
        lastScouter = scouterActive;
    }, 300);

})();



    window.addEventListener('click', () => {
        if (bgmPlayer.paused && currentBiome) bgmPlayer.play().catch(()=>{});
    }, { once: true });
// ============================================================================
// PATCH V2 FINAL — COMBATE TÉCNICO (APPEND-ONLY)
// ============================================================================
const COMBAT_STATE = { ATTACK:0, DEFEND:1, STUN:2, VANISH:3 };
let combatState = COMBAT_STATE.ATTACK;
let comboChain = 0;
let comboWindow = 0;
let attackCooldown = 0;
let parryWindow = 0;

setInterval(()=>{
  if(attackCooldown>0) attackCooldown--;
  if(comboWindow>0) comboWindow--; else comboChain=0;
  if(parryWindow>0) parryWindow--;
},16);

function canAttack(){ return attackCooldown<=0 && combatState!==COMBAT_STATE.STUN; }
function onAttack(){
  if(!canAttack()) return false;
  comboChain++;
  comboWindow = 18;
  attackCooldown = comboChain>=4 ? 20 : 8;
  if(comboChain>=4) comboChain=0;
  return true;
}

function startDefend(){ combatState=COMBAT_STATE.DEFEND; parryWindow=6; }
function endDefend(){ combatState=COMBAT_STATE.ATTACK; }
function isParry(){ return combatState===COMBAT_STATE.DEFEND && parryWindow>0; }


// === PATCH V3 HOLOGRAMA / DRAGON BALL UI ===
let hologramPulse=0;
socket.on("fx",fx=>{if(fx.type==="hit"&&fx.targetId===myId)hologramPulse=6;});
