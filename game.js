const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
window.socket = io({
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

let myId = null;
let players = {}, npcs = [], projectiles = [], rocks = [], craters = [];
let cam = { x: 0, y: 0 }, mouse = { x: 0, y: 0 }, keys = {};
let mouseLeft = false, mouseRight = false;
let particles = [], shockwaves = [], trails = [], texts = [];
let screenShake = 0, flash = 0, hitStop = 0;
let localVX = 0, localVY = 0;


// CONTROLES E LOGIN
const btnLogin = document.getElementById("btn-login");
if(btnLogin) btnLogin.onclick = () => {
    const user = document.getElementById("username").value;
    const pass = document.getElementById("password").value;
    if(user && pass) window.socket.emit("login", { user, pass });
};

window.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener("mousedown", e => { if(e.button === 0) mouseLeft = true; if(e.button === 2) mouseRight = true; });
window.addEventListener("mouseup", e => { 
    if(e.button === 0) { mouseLeft = false; window.socket.emit("release_attack"); } 
    if(e.button === 2) { mouseRight = false; window.socket.emit("release_blast"); } 
});
window.addEventListener("keydown", e => { keys[e.code] = true; if(e.code === "Space") window.socket.emit("vanish"); if(e.code === "KeyG") window.socket.emit("transform"); });
window.addEventListener("keyup", e => keys[e.code] = false);

window.socket.on("auth_success", () => { myId = window.socket.id; document.getElementById("login-screen").style.display = "none"; document.getElementById("ui").style.display = "block"; });

window.socket.on("state", data => {
    if(!myId) return;
    if(hitStop > 0) return; 
    players = data.players; npcs = data.npcs; projectiles = data.projectiles; rocks = data.rocks; craters = data.craters || [];
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
                life: 60, vy: -2
            });
        }
    }
    // NOTIFICAÇÃO DE XP
    if(data.type === "xp_gain") {
        if(!data.silent) {
            texts.push({
                x: data.x, y: data.y - 60, 
                text: "+" + data.amount + " XP", 
                color: "#00ff00", life: 50, vy: -1.5
            });
        }
    }
    if(data.type === "rock_break") { 
        screenShake = 20; 
        for(let i=0; i<15; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#666", size: 8 }); 
    }
    if(data.type === "transform") { 
        screenShake = 50; flash = 15; 
        let c = "#ff0";
        if(data.form === "GOD") c = "#f00";
        if(data.form === "BLUE") c = "#0ff";
        if(data.form === "UI") c = "#fff";
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: c }); 
    }
    if(data.type === "vanish") {
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 80, a: 0.8, color: "#0ff" });
    }
    if(data.type === "levelup") {
        texts.push({x: data.x, y: data.y - 80, text: "LEVEL UP!", color: "#00ffff", life: 120, vy: -0.5});
        shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: "#fff" });
        for(let i=0; i<30; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20, life: 1.5, color: "#ff0", size: 5 });
    }
});

function drawBackground(camX, camY) {
    const W = canvas.width, H = canvas.height;
    let bgColor = "#111"; let gridColor = "rgba(255,255,255,0.1)";
    const dist = Math.hypot(camX, camY);

    if (dist > 50000) { bgColor = "#050015"; gridColor = "rgba(100,0,255,0.2)"; } 
    else if (camY < -4000 && Math.abs(camX) < Math.abs(camY)) { bgColor = "#330000"; gridColor = "rgba(255,200,50,0.1)"; } 
    else if (camY > 4000 && Math.abs(camX) < Math.abs(camY)) { bgColor = "#551a55"; gridColor = "rgba(255,100,255,0.1)"; } 
    else if (camX > 4000 && Math.abs(camY) < camX) { bgColor = "#006666"; gridColor = "rgba(100,255,255,0.1)"; } 
    else if (camX < -4000 && Math.abs(camY) < Math.abs(camX)) { bgColor = "#2a2a2a"; gridColor = "rgba(200,200,200,0.1)"; } 
    else { bgColor = "#1a4a1a"; gridColor = "rgba(100,255,100,0.1)"; }

    if(camY < -7000 && camX > -2000 && camX < 2000) { bgColor = "#200020"; }

    ctx.fillStyle = bgColor; ctx.fillRect(0,0, W, H);

    if(bgColor === "#330000" || dist > 50000) {
        ctx.fillStyle = "#fff";
        for(let i=0; i<80; i++) ctx.fillRect((i*137)%W, (i*241)%H, 2, 2);
    }
    if(camX > 4000 && Math.abs(camY) < camX && dist < 50000) {
        ctx.save(); ctx.fillStyle = "rgba(100,255,200, 0.2)"; ctx.translate(-cam.x/20, -cam.y/20);
        ctx.beginPath(); ctx.arc(800, 300, 100, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(200, 100, 50, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    ctx.save(); ctx.translate(-cam.x % 100, -cam.y % 100);
    ctx.strokeStyle = gridColor; ctx.lineWidth = 2;
    ctx.beginPath();
    for(let x=0; x<W+100; x+=100) { ctx.moveTo(x,0); ctx.lineTo(x,H+100); }
    for(let y=0; y<H+100; y+=100) { ctx.moveTo(0,y); ctx.lineTo(W+100,y); }
    ctx.stroke(); ctx.restore();
}

function drawEntity(e) {
    if(e.isDead && e.isNPC) return;
    const isSpirit = e.isSpirit;
    const opacity = isSpirit ? 0.5 : 1.0;
    const sizeMult = e.isBoss ? (e.id.includes("JIREN") || e.id.includes("BROLY") ? 2.5 : 3.5) : 1;
    
    if(hitStop <= 0 && (Math.hypot(e.vx, e.vy) > 10)) {
        let auraColor = e.color || "#fff";
        if(e.form === "SSJ" || e.form === "SSJ2" || e.form === "SSJ3") auraColor = "#ffea00";
        if(e.form === "GOD") auraColor = "#f00";
        if(e.form === "BLUE") auraColor = "#0ff";
        if(e.form === "UI") auraColor = "#fff";
        trails.push({ x: e.x, y: e.y, angle: e.angle, color: auraColor, alpha: 0.4, sizeMult });
    }

    // --- ANIMAÇÃO DE CARREGAR KI (IMPLOSÃO) ---
    if(e.state === "CHARGING") {
        if(Math.random() > 0.4) {
             // Cria partículas longe que vêm para perto (implosão)
             const ang = Math.random() * Math.PI * 2;
             const dist = 60 * sizeMult;
             particles.push({
                 x: e.x + Math.cos(ang)*dist, y: e.y + Math.sin(ang)*dist,
                 vx: -Math.cos(ang)*5, vy: -Math.sin(ang)*5, // Velocidade negativa (vai pro centro)
                 life: 0.5, size: 3, color: e.color
             });
        }
        if(e.id === myId) screenShake = 2; // Treme a tela levemente
    }

    ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = opacity;

    if(!isSpirit) {
        let blur = 0; let sColor = "#000";
        if(e.form === "SSJ") { blur=20; sColor="#ff0"; }
        if(e.form === "SSJ2") { blur=30; sColor="#ff0"; } 
        if(e.form === "SSJ3") { blur=40; sColor="#fb0"; }
        if(e.form === "GOD") { blur=30; sColor="#f33"; }
        if(e.form === "BLUE") { blur=35; sColor="#0ff"; }
        if(e.form === "UI") { blur=50; sColor="#fff"; }
        if(e.isBoss && e.level > 100) { blur=40; sColor=e.color; }
        // Se estiver carregando, aumenta a aura
        if(e.state === "CHARGING") { blur += 20; }

        ctx.shadowBlur = blur; ctx.shadowColor = sColor;
        
        if(["SSJ2", "SSJ3", "BLUE", "UI"].includes(e.form) && Math.random() > 0.7) {
            ctx.strokeStyle = (e.form === "BLUE") ? "#fff" : "#0cf";
            ctx.lineWidth = 2; ctx.beginPath();
            ctx.moveTo((Math.random()-0.5)*40, (Math.random()-0.5)*40);
            ctx.lineTo((Math.random()-0.5)*50, (Math.random()-0.5)*50); ctx.stroke();
        }
    }

    ctx.rotate(e.angle);
    ctx.fillStyle = e.color; ctx.fillRect(-15*sizeMult, -12*sizeMult, 30*sizeMult, 24*sizeMult);
    ctx.fillStyle = e.isNPC ? (e.isBoss ? "#311" : "#2d2") : "#ffdbac"; 
    
    if(e.name.includes("FRIEZA")) ctx.fillStyle = "#848";
    if(e.name.includes("CELL")) ctx.fillStyle = "#38a";
    if(e.name.includes("BUU")) ctx.fillStyle = "#fbb";
    if(e.name.includes("JIREN")) ctx.fillStyle = "#ddd";

    ctx.beginPath(); ctx.arc(0, -5*sizeMult, 12*sizeMult, 0, Math.PI*2); ctx.fill();
    
    if(!e.isNPC) { 
        let hColor = "#111"; let hLen = 1; 
        if(e.form === "SSJ" || e.form === "SSJ2") hColor = "#ffea00";
        if(e.form === "SSJ3") { hColor = "#ffcc00"; hLen = 2.5; }
        if(e.form === "GOD") hColor = "#e00";
        if(e.form === "BLUE") hColor = "#0ff";
        if(e.form === "UI") hColor = "#ddd";
        ctx.fillStyle = hColor; 
        for(let i=0; i<5; i++) { 
            ctx.beginPath(); ctx.moveTo((-10+i*5)*sizeMult, -10*sizeMult); 
            ctx.lineTo((-15+i*8)*sizeMult, (-35*hLen-i%2*10)*sizeMult); 
            ctx.lineTo((5+i*3)*sizeMult, -10*sizeMult); ctx.fill(); 
        } 
    } else {
        if(e.name.includes("FRIEZA")) { ctx.fillStyle="#fff"; ctx.fillRect(-5,-20,10,10); } 
        if(e.name.includes("CELL")) { ctx.fillStyle="#050"; ctx.beginPath(); ctx.moveTo(-10,-15); ctx.lineTo(0,-30); ctx.lineTo(10,-15); ctx.fill(); }
        if(e.name.includes("BUU")) { ctx.fillStyle="#000"; ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(5,-35); ctx.lineTo(-5,-35); ctx.fill(); }
    }
    
    if(isSpirit) { ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -25*sizeMult, 10, 3, 0, 0, Math.PI*2); ctx.stroke(); }
    if(e.state === "ATTACKING") { ctx.fillStyle = "#333"; ctx.fillRect(15*sizeMult, -15*sizeMult, 25*sizeMult, 10*sizeMult); }
    if(e.state === "BLOCKING") { ctx.strokeStyle = "#0cf"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0,0, 40*sizeMult, -1, 1); ctx.stroke(); }
    
    ctx.restore();

    if(e.id !== myId) {
        ctx.fillStyle = "#000"; ctx.fillRect(e.x-30*sizeMult, e.y-60*sizeMult, 60*sizeMult, 8);
        ctx.fillStyle = e.isBoss ? "#f00" : "#f0f"; ctx.fillRect(e.x-30*sizeMult, e.y-60*sizeMult, 60*sizeMult * (e.hp/e.maxHp), 8);
        if(e.isBoss) { ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.fillText(`LVL ${e.level} ${e.name}`, e.x-40, e.y-70); }
    }
}

function draw() {
    if(flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash/10})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash--; } else { ctx.clearRect(0,0,canvas.width,canvas.height); }

    const me = players[myId]; if(!me) return;
    cam.x += (me.x - canvas.width/2 - cam.x)*0.1; cam.y += (me.y - canvas.height/2 - cam.y)*0.1;

    let sx = 0, sy = 0; if(screenShake > 0) { sx = (Math.random()-0.5)*screenShake; sy = (Math.random()-0.5)*screenShake; screenShake *= 0.9; }

    drawBackground(cam.x, cam.y);
    drawSnakeWay(cam.x, cam.y);

    if(cam.y < -6000) {
        ctx.save(); ctx.translate(-cam.x, -cam.y); ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(0, -8000, 400, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = "#00aa00"; ctx.beginPath(); ctx.arc(0, -8400, 300, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }

    ctx.save(); ctx.translate(-cam.x + sx, -cam.y + sy);

    craters.forEach(c => { ctx.beginPath(); ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "rgba(50,50,50,0.5)"; ctx.lineWidth=3; ctx.stroke(); });
    rocks.forEach(r => { 
        if(r.type === "rock_namek") ctx.fillStyle = "#446"; else if(r.type === "rock_city") ctx.fillStyle = "#555"; else if(r.type === "rock_magic") ctx.fillStyle = "#636"; else if(r.type === "rock_god") ctx.fillStyle = "#622"; else if(r.type === "rock_void") ctx.fillStyle = "#204"; else ctx.fillStyle = "#543";
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x-10, r.y-10, r.r/3, 0, Math.PI*2); ctx.fill();
    });

    trails.forEach((t, i) => { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color; ctx.fillRect(-15*t.sizeMult, -12*t.sizeMult, 30*t.sizeMult, 24*t.sizeMult); ctx.restore(); t.alpha -= 0.08; if(t.alpha <= 0) trails.splice(i, 1); });
    shockwaves.forEach((s, i) => { s.r += 12; s.a -= 0.05; ctx.strokeStyle = s.color; ctx.lineWidth = 5; ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); if(s.a <= 0) shockwaves.splice(i, 1); });

    npcs.forEach(drawEntity);
    Object.values(players).forEach(drawEntity);
    projectiles.forEach(pr => { ctx.fillStyle = pr.color; ctx.shadowBlur=15; ctx.shadowColor=pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.size*0.6, 0, Math.PI*2); ctx.fill(); });
    particles.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, p.size, p.size); if(p.life <= 0) particles.splice(i, 1); });

    texts.forEach((t, i) => { t.y += (t.vy || -0.5); t.life--; ctx.fillStyle = t.color; ctx.globalAlpha = t.life/60; ctx.font = "bold 24px Orbitron"; ctx.strokeStyle = "black"; ctx.lineWidth = 3; ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y); if(t.life<=0) texts.splice(i,1); });
    ctx.restore();
}

function update() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    if(!myId) { requestAnimationFrame(update); return; }
    if(hitStop > 0) { hitStop--; draw(); requestAnimationFrame(update); return; }

    const me = players[myId];
    if(me) {
        // CLIENT-SIDE PREDICTION (instant movement)
        const speed = me.form === 'UI' ? 12 : me.form === 'GOD' ? 9 : me.form === 'SSJ' ? 7 : 5;
        localVX = ((keys['KeyD']?1:0)-(keys['KeyA']?1:0)) * speed;
        localVY = ((keys['KeyS']?1:0)-(keys['KeyW']?1:0)) * speed;
        me.x += localVX;
        me.y += localVY;

        document.getElementById("hp-bar").style.width = (me.hp/me.maxHp)*100 + "%";
        document.getElementById("ki-bar").style.width = (me.ki/me.maxKi)*100 + "%";
        // BARRA DE XP
        const xpPerc = (me.xp / (me.level*800)) * 100;
        document.getElementById("xp-bar").style.width = xpPerc + "%";
        
        let zone = "TERRA";
        const dist = Math.hypot(me.x, me.y);
        if(dist > 50000) zone = "VOID"; else if(me.y < -4000 && Math.abs(me.x) < Math.abs(me.y)) zone = "GODS"; else if(me.y > 4000 && Math.abs(me.x) < Math.abs(me.y)) zone = "MAJIN"; else if(me.x > 4000 && Math.abs(me.y) < me.x) zone = "NAMEK"; else if(me.x < -4000 && Math.abs(me.y) < Math.abs(me.x)) zone = "ANDROID"; 
        if(me.isSpirit) zone = "OUTRO MUNDO";

        document.getElementById("stat-bp").innerText = `LVL ${me.level} | BP: ${me.bp}`;
        document.getElementById("stat-zone").innerText = `${me.form} | ${zone}`;

        const ang = Math.atan2(mouse.y - (me.y - cam.y), mouse.x - (me.x - cam.x));
        const now = performance.now(); if(now-lastInputSent>50){ lastInputSent=now; window.socket.emit("input", { x: (keys['KeyD']?1:0)-(keys['KeyA']?1:0), y: (keys['KeyS']?1:0)-(keys['KeyW']?1:0), angle: ang, block: keys['KeyQ'], charge: keys['KeyC'], holdAtk: mouseLeft, holdBlast: mouseRight, cx: me.x, cy: me.y }); }
    }
    draw(); requestAnimationFrame(update);
}
update();

function drawSnakeWay(camX, camY) {
    if(camY < -2000 && camY > -7000) {
        ctx.save(); ctx.translate(-camX, -camY); ctx.strokeStyle = "#ff0"; ctx.lineWidth = 20; ctx.beginPath();
        for(let y=0; y > -10000; y-=200){ ctx.lineTo(Math.sin(y/300)*200, y); }
        ctx.stroke(); ctx.restore();
    }
}