window.onload = function() {
    console.log(">> GAME.JS CARREGADO. SISTEMA HÍBRIDO: VISUAL CLÁSSICO + CONTROLE NOVO.");
const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    // --- CORREÇÃO DE INPUT: BLOQUEAR MENU DO BOTÃO DIREITO ---
    // Isso garante que o clique direito funcione apenas como ataque no jogo
    canvas.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    // Bloqueio secundário para garantir
    window.addEventListener('contextmenu', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });

    // Ajusta tela
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // ==========================================
    // 1. CONEXÃO E LOGIN
    // ==========================================
    const socket = io({ transports: ['websocket'], upgrade: false });
    window.socket = socket;

    // Referências HTML
    const loginScreen = document.getElementById("login-screen");
    const uiLayer = document.getElementById("ui");
    const btnLogin = document.getElementById("btn-login");
    const btnPvp = document.getElementById("btn-pvp");

    // Elemento de Input de Chat
    const textInput = document.createElement("input");
    textInput.type = "text"; 
    textInput.style.cssText = "position:absolute; bottom:80px; left:50%; transform:translateX(-50%); width:400px; padding:12px; background:rgba(0,0,0,0.85); color:#00ff00; border:2px solid #00ff00; border-radius: 8px; display:none; font-family:'Orbitron',sans-serif; z-index: 2000; font-size: 16px;";
    textInput.placeholder = "Pressione ENTER para enviar...";
    document.body.appendChild(textInput);

    // Lógica de Login
    if (btnLogin) {
        btnLogin.onclick = function(e) {
            e.preventDefault();
            const user = document.getElementById("username").value.trim();
            const pass = document.getElementById("password").value.trim();
            
            if (user && pass) {
                console.log(">> ENVIANDO LOGIN:", user);
                btnLogin.innerText = "CARREGANDO UNIVERSO...";
                btnLogin.disabled = true;
                socket.emit("login", { user: user, pass: pass });
                AudioSys.unlock(); // Tenta iniciar áudio
            } else {
                alert("Digite Guerreiro e Senha!");
            }
        };
    }

    // ==========================================
    // 2. VARIÁVEIS E DADOS
    // ==========================================
    let myId = null;
    let players = {}, npcs = [], projectiles = [], rocks = [], craters = [], chats = [];
    let dominationZones = [], leaderboard = [], currentSaga = null; 
    let dragonBalls = []; 

    let cam = { x: 0, y: 0 };
    let mouse = { x: 0, y: 0 };
    let keys = {};
    let mouseLeft = false, mouseRight = false;
    let joystickMove = { x: 0, y: 0, active: false };

    // Efeitos
    let particles = [], shockwaves = [], trails = [], texts = [];
    let screenShake = 0, flash = 0, hitStop = 0;

    // UI & Estado
    let scouterActive = false; 
    let showMap = true;
    let activeWindow = null; 
    let announcement = { text: "", life: 0, color: "#f00" };

    const ZOOM_SCALE = 0.6; 
    const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

    // --- COORDENADAS DO MAPA (Sincronizadas com Server.js) ---
    const SNAKE_WAY_START = { x: 0, y: -12000 };
    const KAIOH_PLANET    = { x: 0, y: -25000 };
    
    // IDs devem bater com o server para o GPS funcionar
    const PLANETS_COORDS = { 
        "EARTH_CORE": {x: 2000, y: 2000, name: "Capital do Oeste"}, 
        "KAME_ISLAND": {x: 6000, y: -4000, name: "Casa do Kame"},
        "NAMEK_VILLAGE": {x: -18000, y: 5000, name: "Namekusei"}, 
        "FRIEZA_BASE": {x: -35000, y: -10000, name: "Base Freeza"}, 
        "FUTURE_RUINS": {x: 15000, y: 0, name: "Futuro"}, 
        "DEMON_GATE": {x: 0, y: 25000, name: "Portão Demoníaco"}, 
        "MAKAI_CORE": {x: 5000, y: 35000, name: "Reino Demoníaco"},
        "VAMPA_WASTES": {x: -45000, y: 15000, name: "Vampa"},
        "BEERUS_PLANET": {x: 0, y: -90000, name: "Planeta Bills"}, 
        "KAIOH": {x: 0, y: -25000, name: "Sr. Kaioh"}
    };

    // Fundo Galáctico (SEU CÓDIGO ORIGINAL)
    const stars = [];
    for(let i=0; i<350; i++) {
        stars.push({
            x: Math.random() * window.innerWidth, 
            y: Math.random() * window.innerHeight,
            z: Math.random() * 0.8 + 0.2,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random(),
            blink: Math.random() * 0.05
        });
    }

    // --- SISTEMA DE ÁUDIO OTIMIZADO ---
    const AudioSys = {
        bgm: new Audio('./bgm.mp3'),
        sfxHit: new Audio('https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3'),
        sfxBlast: new Audio('https://assets.mixkit.co/active_storage/sfx/272/272-preview.mp3'),
        sfxHeavy: new Audio('https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3'),
        sfxTeleport: new Audio('https://assets.mixkit.co/active_storage/sfx/250/250-preview.mp3'),
        sfxCharge: new Audio('https://assets.mixkit.co/active_storage/sfx/297/297-preview.mp3'),
        unlocked: false,
        
        init: function() { this.bgm.loop = true; this.bgm.volume = 0.25; },
        unlock: function() {
            if(this.unlocked) return;
            this.bgm.play().then(() => { this.unlocked = true; console.log(">> Áudio Destravado"); }).catch(()=>{});
        },
        play: function(type) {
            if(!this.unlocked) return;
            let sound;
            if(type === 'hit') sound = this.sfxHit;
            else if(type === 'blast') sound = this.sfxBlast;
            else if(type === 'heavy') sound = this.sfxHeavy;
            else if(type === 'teleport') sound = this.sfxTeleport;
            else if(type === 'charge') sound = this.sfxCharge;
            if(sound) { const clone = sound.cloneNode(); clone.volume = 0.35; clone.play().catch(()=>{}); }
        }
    };
    AudioSys.init();
    
    // Listeners globais de áudio
    ['click', 'touchstart', 'keydown'].forEach(evt => window.addEventListener(evt, () => AudioSys.unlock(), {once:true}));

    // ==========================================
    // 3. LISTENERS E SOCKETS
    // ==========================================

    socket.on("auth_success", (data) => { 
        console.log(">> LOGIN SUCESSO! ID:", data.id);
        myId = data.id; 
        if(loginScreen) loginScreen.style.display = "none"; 
        if(uiLayer) uiLayer.style.display = "block"; 
        if (isMobile) { document.getElementById("mobile-ui").style.display = "block"; initMobileControls(); } 
    });

    socket.on("state", (data) => { 
        if(!myId) return; 
        players = data.players; npcs = data.npcs; projectiles = data.projectiles; 
        rocks = data.rocks; craters = data.craters || []; chats = data.chats || []; 
        dominationZones = data.domination || []; leaderboard = data.leaderboard || []; 
        currentSaga = data.saga || null;
        dragonBalls = data.dbs || [];
    });

    socket.on("fx", (data) => {
        const me = players[myId];
        let isVisible = false;
        if (me) { const dist = Math.hypot(data.x - me.x, data.y - me.y); if (dist < 1500) isVisible = true; }

        // Efeitos de Texto Flutuante (Damage, XP, Avisos)
        if (data.type === "bp_limit") texts.push({ x: data.x, y: data.y - 80, text: data.text, color: "#00ffff", life: 100, vy: -1, isDmg: false });
        if (data.type === "xp_gain") texts.push({ x: data.x, y: data.y - 60, text: `+${data.amount} XP`, color: "#00ff00", life: 80, vy: -1.5, isDmg: false });
        if (data.type === "levelup") { 
            texts.push({ x: data.x, y: data.y - 100, text: "LEVEL UP!", color: "#ffff00", life: 120, vy: -0.5, isEmote: true });
            shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 300, a: 1, color: "#ffff00" });
        }

        if(data.type === "hit" || data.type === "heavy" || data.type === "block_hit" || data.type === "finisher") { 
            for(let i=0; i<(data.type==="heavy"?12:6); i++) {
                particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 }); 
            }
            shockwaves.push({ x: data.x, y: data.y, r: 5, maxR: 40, a: 0.8, color: "#fff" });
            if(data.dmg) texts.push({ x: data.x, y: data.y - 40, text: data.dmg.toString(), color: "#ffff00", life: 60, vy: -2, isDmg: true }); 
        }
        
        if (data.type === "block_perfect") {
             shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 150, a: 1, color: "#00ffff" });
             texts.push({ x: data.x, y: data.y - 60, text: "PERFECT!", color: "#00ffff", life: 50, vy: -2, isDmg: true }); 
        }
        
        if (data.type === "guard_break") {
             shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 100, a: 1, color: "#ff0000" });
             texts.push({ x: data.x, y: data.y - 60, text: "BREAK!!", color: "#ff0000", life: 60, vy: -1, isDmg: true }); 
        }

        if (isVisible) {
            if(data.type === "hit") { AudioSys.play('hit'); screenShake = 4; }
            if(data.type === "heavy" || data.type === "finisher") { AudioSys.play('heavy'); screenShake = 15; hitStop = 3; }
            if(data.type === "block_hit") { AudioSys.play('hit'); screenShake = 3; }
            if(data.type === "guard_break") { AudioSys.play('heavy'); screenShake = 30; }
            if(data.type === "vanish") { AudioSys.play('teleport'); particles.push({ x: data.x, y: data.y, vx: 0, vy: 0, life: 0.5, color: "#fff", size: 30, isVanish: true }); }
            
            if(data.type === "clash") {
                AudioSys.play('heavy'); screenShake = 40; hitStop = 6;
                shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 200, a: 1, color: "#ffff00" });
                texts.push({ x: data.x, y: data.y - 80, text: "CLASH!!", color: "#fff", life: 40, vy: -1.5 });
            }
            
            if(data.type === "transform") { 
                AudioSys.play('charge'); screenShake = 40; flash = 10; 
                let c = "#ff0"; if(data.form === "GOD") c = "#f00"; if(data.form === "BLUE") c = "#0ff"; if(data.form === "UI") c = "#fff"; 
                shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: c }); 
            }
        }
    });

    socket.on("pvp_status", enabled => { 
        if (btnPvp) { btnPvp.classList.toggle("active", enabled); btnPvp.innerText = enabled ? "PVP: ON" : "PVP: OFF"; }
    });

    // ==========================================
    // 4. INPUTS E INTERAÇÃO
    // ==========================================

    function toggleChat(forceOpen = false) {
        if (textInput.style.display === "block" && !forceOpen) { 
            const msg = textInput.value.trim(); 
            if (msg) { socket.emit("chat", msg); } 
            textInput.value = ""; textInput.style.display = "none"; textInput.blur(); return; 
        }
        textInput.style.display = "block"; textInput.placeholder = "Digite... (Enter para enviar)"; textInput.focus();
        Object.keys(keys).forEach(k => keys[k] = false);
    }

    // Input Helpers
    function bindBtn(id, onPress, onRelease) { 
        const el = document.getElementById(id); if (!el) return; 
        const press = e => { e.preventDefault(); e.stopPropagation(); onPress && onPress(); }; 
        const release = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(); }; 
        el.addEventListener('touchstart', press, { passive: false }); 
        el.addEventListener('touchend', release, { passive: false }); 
        el.addEventListener('mousedown', press); 
        el.addEventListener('mouseup', release); 
    }

    bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
    bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
    bindBtn('btn-block', () => keys['KeyQ']=true, () => { keys['KeyQ']=false; socket.emit("input", { block: false }); });
    bindBtn('btn-charge', () => { keys['KeyC']=true; AudioSys.play('charge'); }, () => { keys['KeyC']=false; socket.emit("input", { charge: false }); });
    
    const simpleClick = (id, fn) => {
        const el = document.getElementById(id);
        if(el) { el.onclick = (e) => { e.preventDefault(); fn(); }; el.ontouchstart = (e) => { e.preventDefault(); fn(); }; }
    };

    simpleClick('btn-vanish', () => socket.emit('vanish'));
    simpleClick('btn-transform', () => socket.emit('transform'));
    simpleClick('btn-scouter', () => { scouterActive = !scouterActive; });
    simpleClick('btn-ranking', () => { activeWindow = activeWindow === "ranking" ? null : "ranking"; });
    simpleClick('btn-menu', () => { activeWindow = activeWindow === "menu" ? null : "menu"; });
    simpleClick('btn-chat', () => { toggleChat(); });
    simpleClick('btn-pvp', () => { socket.emit("toggle_pvp"); });
    
    // Mouse / Touch
    window.addEventListener("mousemove", e => { mouse.x = (e.clientX - window.innerWidth / 2) / ZOOM_SCALE; mouse.y = (e.clientY - window.innerHeight / 2) / ZOOM_SCALE; });
    
    canvas.addEventListener("mousedown", e => { 
        // Lógica de Avançar Tutorial (Click)
        if (currentSaga && currentSaga.type === "TUTORIAL" && players[myId]?.isTutorialDialogActive) {
            socket.emit("tutorial_next");
            return; 
        }
        if(e.button === 0) mouseLeft = true; 
        if(e.button === 2) mouseRight = true; 
        if(activeWindow && (mouse.x > 200 || mouse.x < -200)) activeWindow = null; 
    });
    canvas.addEventListener("mouseup", e => { 
        if (currentSaga && currentSaga.type === "TUTORIAL") return;
        if(e.button === 0) { mouseLeft = false; socket.emit("release_attack"); } 
        if(e.button === 2) { mouseRight = false; socket.emit("release_blast"); } 
    });
    
    canvas.addEventListener("touchstart", e => {
        if (currentSaga && currentSaga.type === "TUTORIAL" && players[myId]?.isTutorialDialogActive) { 
            socket.emit("tutorial_next"); e.preventDefault(); return; 
        }
        if (!activeWindow) return; const touch = e.touches[0]; const rect = canvas.getBoundingClientRect(); const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; handleCanvasUIInteraction(x, y); e.preventDefault();
    }, { passive: false });

    // Keyboard
    window.addEventListener("keydown", e => {
        if (textInput.style.display === "block") { if(e.key === "Enter") toggleChat(); return; }
        if (e.repeat) return; 
        
        // Bloqueio de Tutorial
        if (currentSaga && currentSaga.type === "TUTORIAL" && players[myId]?.isTutorialDialogActive) {
             if(e.code === "Space" || e.code === "Enter") socket.emit("tutorial_next");
             return;
        }

        keys[e.code] = true;
        if(e.code === "Enter") toggleChat();
        if(e.code === "KeyG") socket.emit("transform");
        if(e.code === "Space") socket.emit("vanish");
        if(e.code === "KeyT") scouterActive = !scouterActive;
        if(e.code === "KeyP") socket.emit("toggle_pvp");
        if(e.code === "KeyL") activeWindow = activeWindow ? null : "menu";
        if(e.code === "KeyR") activeWindow = "ranking";
        if(e.code === "Escape") activeWindow = null;
    });

    window.addEventListener("keyup", e => {
        keys[e.code] = false;
        if(e.code === "KeyC") { keys["KeyC"] = false; socket.emit("input", { charge: false }); }
        if(e.code === "KeyQ") { keys["KeyQ"] = false; socket.emit("input", { block: false }); }
    });

    function initMobileControls() { 
        if (!isMobile || !window.nipplejs) return; 
        if (joystickMove.active) return;
        const zone = document.getElementById('joystick-container'); 
        if (!zone) return; 
        const joystick = nipplejs.create({ zone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff9900', size: 120 }); 
        joystick.on('move', (evt, data) => { 
            if (!data || !data.vector) return; 
            joystickMove.x = data.vector.x; 
            joystickMove.y = -data.vector.y; 
        }); 
        joystick.on('end', () => { joystickMove.x = 0; joystickMove.y = 0; }); 
        joystickMove.active = true;
    }

    function handleCanvasUIInteraction(x, y) {
        const cx = canvas.width / 2; const cy = canvas.height / 2;
        if (activeWindow === "menu") {
            const options = [ { name: "ranking", y: cy - 100 }, { name: "guild",   y: cy - 50 }, { name: "title",   y: cy }, { name: "rebirth", y: cy + 50 } ];
            for (const opt of options) { if (Math.abs(y - opt.y) < 20 && Math.abs(x - cx) < 140) { onMenuOption(opt.name); return; } }
        }
        if (activeWindow === "ranking") { activeWindow = null; }
    }

    function onMenuOption(option) {
        if (option === "ranking") activeWindow = "ranking";
        if (option === "guild") { textInput.placeholder = "Digite: /guild NomeDaGuilda"; toggleChat(true); }
        if (option === "title") { textInput.placeholder = "Digite: /title MeuTitulo"; toggleChat(true); }
        if (option === "rebirth") { socket.emit("rebirth"); activeWindow = null; }
    }

    // ==========================================
    // 5. RENDERIZAÇÃO (PRESERVANDO SEU CÓDIGO)
    // ==========================================

    function drawBackground(camX, camY) {
        const w = canvas.width;
        const h = canvas.height;
        
        let topColor = "#050510"; let botColor = "#000000"; let starTint = "255,255,255";
        if (camY < -20000) { topColor = "#1a0033"; botColor = "#000011"; starTint = "200,200,255"; } 
        else if (camY > 20000) { topColor = "#220000"; botColor = "#050000"; starTint = "255,100,100"; } 
        else if (camX < -40000) { topColor = "#111100"; botColor = "#050500"; starTint = "255,255,150"; }

        const grd = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h);
        grd.addColorStop(0, topColor); grd.addColorStop(1, botColor);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        stars.forEach(s => {
            let dx = (s.x - camX * s.z) % w;
            let dy = (s.y - camY * s.z) % h;
            if(dx < 0) dx += w; if(dy < 0) dy += h;
            s.alpha += s.blink; if(s.alpha > 1 || s.alpha < 0.2) s.blink *= -1;
            ctx.fillStyle = `rgba(${starTint}, ${s.alpha})`;
            ctx.beginPath(); ctx.arc(dx, dy, s.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore();
    }

    function drawSnakeWay() {
        const startY = SNAKE_WAY_START.y; const endY = KAIOH_PLANET.y;
        if (cam.y > endY - 2000 && cam.y < startY + 2000) {
            ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = "#e6b800"; ctx.strokeStyle = "#e6b800"; ctx.lineWidth = 80; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(0, startY); for (let y = startY; y > endY; y -= 1000) { const wave = Math.sin(y * 0.002) * 500; ctx.lineTo(wave, y); } ctx.stroke();
            ctx.fillStyle = "#4a8"; ctx.beginPath(); ctx.arc(0, endY, 400, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#a33"; ctx.fillRect(-100, endY - 480, 200, 150); ctx.beginPath(); ctx.moveTo(-120, endY - 480); ctx.lineTo(0, endY - 600); ctx.lineTo(120, endY - 480); ctx.fill();
            ctx.restore();
        }
    }
    function drawOtherWorld(camX, camY) { drawSnakeWay(); }

    function drawDominationZones() { 
        dominationZones.forEach(z => { 
            ctx.save(); ctx.translate(z.x, z.y); 
            ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI*2); ctx.strokeStyle = z.owner ? "#00ff00" : "#aaaaaa"; ctx.lineWidth = 15; ctx.setLineDash([30, 20]); ctx.stroke(); 
            ctx.fillStyle = z.owner ? "rgba(0, 255, 0, 0.2)" : "rgba(100, 100, 100, 0.2)"; ctx.fill();
            ctx.font = "bold 40px Orbitron"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(z.name, 0, -z.radius - 40); 
            ctx.font = "24px Orbitron"; 
            if(z.owner) { ctx.fillStyle = "#00ff00"; ctx.fillText(`GOVERNADOR: ${z.owner}`, 0, -z.radius + 20); ctx.font = "18px Arial"; ctx.fillStyle = "#ffff00"; ctx.fillText(`IMPOSTO: ${z.taxRate || 0}%`, 0, -z.radius + 50); } else { ctx.fillStyle = "#ccc"; ctx.fillText(`NEUTRO - ESTABILIDADE: ${z.stability}%`, 0, -z.radius + 20); } 
            ctx.restore(); 
        }); 
    }

    function drawDragonBalls() {
        dragonBalls.forEach(db => {
            if (!db.held) {
                const size = 15;
                ctx.save();
                ctx.translate(db.x, db.y);
                ctx.shadowBlur = 20; ctx.shadowColor = "#ffaa00";
                ctx.fillStyle = "orange";
                ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "red"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("★".repeat(db.id), 0, 0);
                ctx.restore();
            }
        });
    }

    function drawEntityHUD(e, sizeMult) {
        if (e.isSpirit) return;
        ctx.save(); ctx.translate(30 * sizeMult, -50 * sizeMult); ctx.transform(1, -0.22, 0, 1, 0, 0); 
        const mainColor = e.isBoss ? "#ff3333" : (e.isNPC && !e.isBotPlayer ? "#ffaa00" : "#00ffff");
        ctx.shadowBlur = 8; ctx.shadowColor = mainColor; ctx.strokeStyle = "rgba(0,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(110, 0); ctx.stroke();
        
        let dispName = e.name?.substring(0, 12) || "???";
        if(e.dbCount > 0) dispName += " 🐉"; 

        ctx.fillStyle = mainColor; ctx.font = "bold 20px Orbitron"; ctx.fillText(dispName, 5, -8);

        if (!e.isNPC || e.isBotPlayer) { 
            ctx.font = "italic 12px Arial"; ctx.fillStyle = "#ffcc00"; 
            let title = `<${e.current_title || "Novato"}>`; 
            if (e.rebirths > 0) title = `[R${e.rebirths}] ` + title;
            if (e.guild) title = `[${e.guild}] ` + title; 
            ctx.fillText(title, 5, -28); 
        }
        const hpPerc = Math.max(0, e.hp / e.maxHp); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 5, 100, 6); ctx.fillStyle = e.isBoss ? "#ff0000" : (e.isNPC && !e.isBotPlayer ? "#ffaa00" : "#00ff00"); ctx.shadowBlur = 0; ctx.fillRect(0, 5, 100 * hpPerc, 6);
        if (!e.isNPC || e.isBotPlayer) { ctx.fillStyle = "#ffffff"; ctx.font = "12px Orbitron"; ctx.fillText(`BP: ${e.bp.toLocaleString()}`, 5, 20); if (e.pvpMode) { ctx.fillStyle = "#ff0000"; ctx.font = "bold 10px Arial"; ctx.fillText("PVP ON", 5, 32); } }
        ctx.restore();
    }

    function drawMobModel(e, sizeMult) {
        const name = e.name.toUpperCase();
        const time = Date.now();
        const breathe = Math.sin(time * 0.005) * 1.5;

        // --- 1. SAIBAMAN ---
        if (name.includes("SAIBAMAN")) {
            ctx.fillStyle = "#2d2"; ctx.strokeStyle = "#050"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(-5 * sizeMult, -8 * sizeMult, 6 * sizeMult, 0, Math.PI*2); ctx.arc(-5 * sizeMult, 8 * sizeMult, 6 * sizeMult, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.save(); ctx.translate(2 * sizeMult, 0); 
            ctx.fillStyle = "#3e3"; ctx.beginPath(); ctx.ellipse(0, 0, 14 * sizeMult, 11 * sizeMult, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(6 * sizeMult, -4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.arc(6 * sizeMult, 4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#1a1"; ctx.beginPath(); ctx.moveTo(-5 * sizeMult, -5 * sizeMult); ctx.lineTo(0, -8 * sizeMult); ctx.stroke(); 
            ctx.restore(); return;
        }
        // --- 2. MAJIN BUU ---
        if (name.includes("BUU") || name.includes("FAT") || name.includes("DODORIA")) {
            ctx.fillStyle = "#509"; ctx.beginPath(); ctx.moveTo(-10 * sizeMult, -15 * sizeMult); ctx.lineTo(-25 * sizeMult, 0); ctx.lineTo(-10 * sizeMult, 15 * sizeMult); ctx.fill();
            ctx.fillStyle = name.includes("DODORIA") ? "#d59" : "#fba"; ctx.strokeStyle = "#000"; 
            ctx.beginPath(); ctx.arc(-5 * sizeMult, 0, 18 * sizeMult, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#111"; ctx.fillRect(-10 * sizeMult, -18 * sizeMult, 12 * sizeMult, 36 * sizeMult); 
            ctx.strokeStyle = "#fd0"; ctx.lineWidth = 2; ctx.strokeRect(-10 * sizeMult, -18 * sizeMult, 12 * sizeMult, 36 * sizeMult);
            ctx.fillStyle = name.includes("DODORIA") ? "#d59" : "#fba"; ctx.beginPath(); ctx.arc(0, 0, 12 * sizeMult, 0, Math.PI*2); ctx.fill(); 
            ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.moveTo(6 * sizeMult, -4 * sizeMult); ctx.lineTo(10 * sizeMult, -4 * sizeMult); ctx.moveTo(6 * sizeMult, 4 * sizeMult); ctx.lineTo(10 * sizeMult, 4 * sizeMult); ctx.stroke(); 
            return;
        }
        // --- 3. ARMADURAS ---
        if (name.includes("FRIEZA") || name.includes("SOLDIER") || name.includes("VEGETA") || name.includes("NAPPA") || name.includes("RADITZ")) {
            ctx.fillStyle = "#113"; ctx.fillRect(-12 * sizeMult, -10 * sizeMult, 24 * sizeMult, 20 * sizeMult);
            ctx.fillStyle = "#eee"; ctx.strokeStyle = "#da0"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-5 * sizeMult, -8 * sizeMult); ctx.lineTo(-20 * sizeMult, -22 * sizeMult); ctx.lineTo(-20 * sizeMult, -5 * sizeMult); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5 * sizeMult, 8 * sizeMult); ctx.lineTo(-20 * sizeMult, 22 * sizeMult); ctx.lineTo(-20 * sizeMult, 5 * sizeMult); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ddcb99"; ctx.fillRect(-8 * sizeMult, -10 * sizeMult, 16 * sizeMult, 20 * sizeMult);
            ctx.save(); ctx.translate(0, breathe); 
            ctx.fillStyle = "#ffdbac"; ctx.beginPath(); ctx.arc(2 * sizeMult, 0, 9 * sizeMult, 0, Math.PI*2); ctx.fill();
            if (!name.includes("FRIEZA_FINAL")) { ctx.fillStyle = "rgba(0, 255, 100, 0.6)"; ctx.fillRect(6 * sizeMult, -6 * sizeMult, 6 * sizeMult, 6 * sizeMult); ctx.strokeStyle = "#0f0"; ctx.strokeRect(6 * sizeMult, -6 * sizeMult, 6 * sizeMult, 6 * sizeMult); }
            if (!name.includes("SOLDIER") && !name.includes("FRIEZA")) { ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-2 * sizeMult, 0, 10 * sizeMult, 0, Math.PI*2); ctx.fill(); }
            ctx.restore(); return;
        }
        // --- 4. CELL / MONSTROS ---
        if (name.includes("CELL") || name.includes("JR")) {
            ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-15 * sizeMult, -10 * sizeMult); ctx.lineTo(-30 * sizeMult, -20 * sizeMult); ctx.lineTo(-30 * sizeMult, 20 * sizeMult); ctx.lineTo(-15 * sizeMult, 10 * sizeMult); ctx.fill();
            ctx.fillStyle = "#3c3"; ctx.beginPath(); ctx.arc(0, 0, 12 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#050"; ctx.beginPath(); ctx.arc(-2 * sizeMult, -5 * sizeMult, 2 * sizeMult, 0, Math.PI*2); ctx.arc(2 * sizeMult, 4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.save(); ctx.translate(0, breathe); ctx.fillStyle = "#3c3"; ctx.beginPath(); ctx.moveTo(0, -8 * sizeMult); ctx.lineTo(8 * sizeMult, -15 * sizeMult); ctx.lineTo(5 * sizeMult, 0); ctx.lineTo(8 * sizeMult, 15 * sizeMult); ctx.lineTo(0, 8 * sizeMult); ctx.fill(); ctx.restore(); return;
        }
        // --- 5. ALIENÍGENAS ---
        if (name.includes("FRIEZA") || name.includes("COOLER") || name.includes("ALIEN")) {
            ctx.fillStyle = "#fff"; ctx.strokeStyle = "#dce"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 10 * sizeMult, 14 * sizeMult, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#a0a"; ctx.beginPath(); ctx.arc(-5 * sizeMult, -6 * sizeMult, 4 * sizeMult, 0, Math.PI*2); ctx.arc(-5 * sizeMult, 6 * sizeMult, 4 * sizeMult, 0, Math.PI*2); ctx.arc(0, 0, 5 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.save(); ctx.translate(2 * sizeMult, breathe); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 9 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#a0a"; ctx.beginPath(); ctx.arc(-2 * sizeMult, 0, 7 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#f00"; ctx.beginPath(); ctx.moveTo(5 * sizeMult, -2 * sizeMult); ctx.lineTo(8 * sizeMult, -3 * sizeMult); ctx.lineTo(8 * sizeMult, -1 * sizeMult); ctx.moveTo(5 * sizeMult, 2 * sizeMult); ctx.lineTo(8 * sizeMult, 3 * sizeMult); ctx.lineTo(8 * sizeMult, 1 * sizeMult); ctx.fill(); ctx.restore(); return;
        }
        drawMiniWarrior(e, sizeMult);
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
        
        if ((auraColor || e.state === "CHARGING") && !e.isDead) { 
            ctx.save(); ctx.globalCompositeOperation = "lighter"; const pulse = 1 + Math.sin(time * 0.02) * 0.15; const auraSize = 45 * sizeMult * pulse; 
            const grd = ctx.createRadialGradient(0, 0, 10, 0, 0, auraSize); grd.addColorStop(0, auraColor || "rgba(255,255,255,0.8)"); grd.addColorStop(1, "rgba(0,0,0,0)"); 
            ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, auraSize, 0, Math.PI * 2); ctx.fill(); 
            if (lightning) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); const lAng = Math.random() * Math.PI * 2; ctx.moveTo(Math.cos(lAng) * 10, Math.sin(lAng) * 10); ctx.lineTo(Math.cos(lAng) * 30, Math.sin(lAng) * 30); ctx.stroke(); } 
            ctx.restore(); 
        }
        
        ctx.fillStyle = giColor; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; 
        ctx.beginPath(); ctx.moveTo(-14 * sizeMult - lean, -12 * sizeMult); ctx.lineTo(14 * sizeMult - lean, -12 * sizeMult); ctx.lineTo(10 * sizeMult, 12 * sizeMult); ctx.lineTo(-10 * sizeMult, 12 * sizeMult); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = beltColor; ctx.fillRect(-10 * sizeMult, 8 * sizeMult, 20 * sizeMult, 4 * sizeMult);
        
        ctx.save(); ctx.translate(-lean, breathe);
        ctx.fillStyle = skinColor; ctx.beginPath(); ctx.arc(0, 0, 11 * sizeMult, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = (currentForm && currentForm !== "BASE") ? eyeColor : "#fff"; 
        ctx.beginPath(); ctx.moveTo(2 * sizeMult, -4 * sizeMult); ctx.lineTo(7 * sizeMult, -5 * sizeMult); ctx.lineTo(6 * sizeMult, -1 * sizeMult); ctx.closePath(); 
        ctx.moveTo(2 * sizeMult, 4 * sizeMult); ctx.lineTo(7 * sizeMult, 5 * sizeMult); ctx.lineTo(6 * sizeMult, 1 * sizeMult); ctx.closePath(); ctx.fill();
        
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
        if (e.isDead && e.isNPC && !e.isBotPlayer) return;
        const sizeMult = e.isBoss ? 4 : 1;
        
        ctx.save();
        ctx.translate(e.x, e.y);

        if (e.state === "CHARGING_ATK") {
            const time = Date.now();
            ctx.save();
            ctx.rotate(e.angle);
            ctx.fillStyle = `rgba(255, 200, 0, ${0.5 + Math.sin(time * 0.02) * 0.3})`;
            ctx.shadowBlur = 20; ctx.shadowColor = "#ffaa00";
            ctx.beginPath(); ctx.arc(15 * sizeMult, 0, 10 * sizeMult * (1 + Math.sin(time * 0.05)*0.2), 0, Math.PI*2); ctx.fill();
            if (Math.random() > 0.5) {
                particles.push({ x: e.x + Math.cos(e.angle)*20, y: e.y + Math.sin(e.angle)*20, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, life: 0.4, color: "#fff", size: 2 });
            }
            ctx.restore();
        }

        ctx.save();
        ctx.rotate(e.angle); 
        if (e.isNPC && !e.isBotPlayer) drawMobModel(e, sizeMult);
        else drawMiniWarrior(e, sizeMult);
        ctx.restore();

        ctx.save();
        drawEntityHUD(e, sizeMult);
        ctx.restore();

        if (e.state === "BLOCKING") {
            ctx.save();
            const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.05;
            let shieldColor = "rgba(100, 200, 255, 0.4)";
            if (e.form === "SSJ" || e.form === "SSJ2") shieldColor = "rgba(255, 230, 50, 0.4)";
            if (e.form === "GOD") shieldColor = "rgba(255, 50, 50, 0.4)";
            ctx.fillStyle = shieldColor; ctx.strokeStyle = shieldColor.replace("0.4", "0.8"); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 35 * sizeMult * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            let blockAngle = e.angle;
            if (e.id === myId && !isMobile) blockAngle = Math.atan2(mouse.y, mouse.x);
            else if (e.id === myId && isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) {
                 blockAngle = Math.atan2(joystickMove.y, joystickMove.x);
            }
            
            ctx.rotate(blockAngle);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.shadowBlur = 10; ctx.shadowColor = "#fff";
            ctx.beginPath(); ctx.arc(0, 0, 35 * sizeMult * pulse, -0.6, 0.6); ctx.stroke();
            ctx.restore();
        }
        ctx.restore();

        if (Math.hypot(e.vx, e.vy) > 10 && Math.random() > 0.6) {
             trails.push({ x: e.x, y: e.y, angle: e.angle, color: e.color || "#fff", alpha: 0.5 });
        }
    }

    function drawTrails(camX, camY) {
        trails = trails.filter(t => t.alpha > 0);
        trails.forEach(t => {
            t.alpha -= 0.05; 
            ctx.save(); 
            ctx.translate(t.x, t.y); 
            ctx.rotate(t.angle);
            ctx.globalAlpha = t.alpha * 0.5; 
            ctx.shadowBlur = 10; ctx.shadowColor = t.color; ctx.fillStyle = t.color;
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(15, 0); ctx.lineTo(-10, 10); ctx.fill();
            ctx.restore();
        });
    }

    function drawMiniMap(me) {
        if (!showMap) return;
        const mapSize = 140; const padding = 20; const mapX = canvas.width - mapSize - padding; const mapY = canvas.height - mapSize - padding; const radius = mapSize / 2; const cx = mapX + radius; const cy = mapY + radius;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "rgba(0, 50, 0, 0.85)"; ctx.fillRect(mapX, mapY, mapSize, mapSize);
        ctx.strokeStyle = "rgba(0, 255, 0, 0.3)"; ctx.lineWidth = 1;
        ctx.beginPath(); for(let i=0; i<mapSize; i+=20) { ctx.moveTo(mapX + i, mapY); ctx.lineTo(mapX + i, mapY + mapSize); ctx.moveTo(mapX, mapY + i); ctx.lineTo(mapX + mapSize, mapY + i); } ctx.stroke();
        const scale = mapSize / 160000; 
        
        ctx.fillStyle = "#ffff00"; 
        Object.values(PLANETS_COORDS).forEach(p => { 
            const px = cx + (p.x - me.x) * scale; const py = cy + (p.y - me.y) * scale; 
            if (Math.hypot(px-cx, py-cy) < radius) { ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); } 
        });

        dragonBalls.forEach(db => {
            const dbX = (db.x - me.x) * scale; const dbY = (db.y - me.y) * scale;
            if (Math.hypot(dbX, dbY) < radius) { ctx.fillStyle = "#ffaa00"; ctx.beginPath(); ctx.arc(cx + dbX, cy + dbY, 4, 0, Math.PI*2); ctx.fill(); }
        });

        ctx.translate(cx, cy); ctx.rotate(me.angle || 0); ctx.fillStyle = "#00ff00"; ctx.shadowColor = "#0f0"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 6); ctx.lineTo(0, 4); ctx.lineTo(-5, 6); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#00aa00"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.stroke();
    }

    function drawNavigationArrow(me) {
        // Lógica de GPS para guiar o jogador
        let target = null;
        if (currentSaga && currentSaga.targetZone) target = PLANETS_COORDS[currentSaga.targetZone];
        if (!target && dragonBalls.length > 0) {
            // Se não tem saga, aponta para esfera mais próxima
            let minDist = Infinity;
            dragonBalls.forEach(db => { if(!db.held) { const d = Math.hypot(db.x - me.x, db.y - me.y); if(d < minDist) { minDist = d; target = db; } } });
        }

        if (target) {
            const angle = Math.atan2(target.y - me.y, target.x - me.x);
            const dist = 100; // Raio ao redor do player
            const cx = canvas.width / 2; const cy = canvas.height / 2;
            const arrowX = cx + Math.cos(angle) * dist;
            const arrowY = cy + Math.sin(angle) * dist;
            
            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);
            ctx.fillStyle = "#ffff00"; ctx.shadowBlur = 15; ctx.shadowColor = "#ffff00";
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 7); ctx.lineTo(-10, -7); ctx.fill();
            
            // Texto de Distância
            ctx.rotate(-angle);
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center"; ctx.shadowBlur = 0;
            ctx.fillText(`${Math.floor(Math.hypot(target.x - me.x, target.y - me.y))}m`, 0, 20);
            ctx.restore();
        }
    }

    // ==========================================
// UI ESTILO SCOUTER (TUTORIAL VISUAL MELHORADO)
// ==========================================
function drawScouterPanel(saga) {
    if (!saga) return;
    const W = canvas.width;

    const boxW = 600, boxH = 95;
    const x = W / 2 - boxW / 2;
    const y = 30;

    ctx.save();

    // Fundo do Scouter
    ctx.fillStyle = "rgba(0, 40, 0, 0.75)";
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.lineTo(x + boxW - 20, y);
    ctx.lineTo(x + boxW, y + 20);
    ctx.lineTo(x + boxW, y + boxH - 10);
    ctx.lineTo(x + boxW - 20, y + boxH);
    ctx.lineTo(x + 20, y + boxH);
    ctx.lineTo(x, y + boxH - 10);
    ctx.lineTo(x, y + 20);
    ctx.closePath();
    ctx.fill();

    // Borda Neon
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ff00";
    ctx.strokeStyle = "rgba(50,255,50,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scanline
    const time = Date.now();
    const scanY = y + ((time % 3000) / 3000) * boxH;
    ctx.strokeStyle = "rgba(0,255,0,0.4)";
    ctx.beginPath();
    ctx.moveTo(x + 10, scanY);
    ctx.lineTo(x + boxW - 10, scanY);
    ctx.stroke();

    // Header
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 11px Orbitron";
    ctx.textAlign = "left";
    ctx.fillText("SCOUTER v3.5 // ANALYSIS MODE", x + 15, y + 18);

    // Título da Saga
    ctx.font = "bold 18px Orbitron";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ccffcc";
    ctx.fillText(`MISSÃO ATUAL: ${saga.title}`, W / 2, y + 45);

    // Objetivo
    ctx.font = "15px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`>>> ${saga.objective}`, W / 2, y + 70);

    ctx.restore();
}


    function drawUI(me) {
        const W = canvas.width;
        const H = canvas.height;

        // 1. Painel de Status (Canto Superior Esquerdo)
        const barW = 300, barH = 20, x = 20, y = 20;
        
        // HP Bar
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = "#ff3333"; ctx.fillRect(x, y, barW * (me.hp / me.maxHp), barH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x, y, barW, barH);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
        ctx.fillText(`HP: ${Math.floor(me.hp)} / ${me.maxHp}`, x + 10, y + 14);

        // KI Bar
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y + 25, barW, barH);
        ctx.fillStyle = "#ffff00"; ctx.fillRect(x, y + 25, barW * (me.ki / me.maxKi), barH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x, y + 25, barW, barH);
        ctx.fillStyle = "#000"; ctx.fillText(`KI: ${Math.floor(me.ki)} / ${me.maxKi}`, x + 10, y + 39);

        // Level & BP info
        ctx.fillStyle = "#00ffff"; ctx.font = "16px Orbitron";
        ctx.fillText(`LVL ${me.level}  |  BP: ${me.bp.toLocaleString()}`, x, y + 70);
        
        // 2. PAINEL SCOUTER (Sistema de Guia / Tutorial)
        if (currentSaga) {
            drawScouterPanel(currentSaga);
        }

        // 3. Seta de Navegação GPS (Mantido do código anterior)
        drawNavigationArrow(me);

        // 4. Notificações de Skills (Tutorial de Combate em tempo real)
        if (me.state === "CHARGING") {
            const cx = W / 2, cy = H / 2 + 100;
            ctx.textAlign = "center"; ctx.font = "bold 14px Orbitron";
            
            // Dica visual para ensinar o jogador a usar skills
            if (me.ki >= 80 && (!me.skills || me.skills.includes("KAMEHAMEHA"))) {
                ctx.fillStyle = "#00ffff"; 
                ctx.fillText("⚡ KAMEHAMEHA PRONTO! [SOLTE 'C']", cx, cy);
            }
            if (me.ki >= 300 && me.skills && me.skills.includes("GENKI_DAMA")) {
                ctx.fillStyle = "#00aaff"; 
                ctx.fillText("⚡ GENKI DAMA PRONTA! [SOLTE 'C']", cx, cy + 25);
            }
        }

        // 5. Radar / Minimapa (Mantém o desenho padrão)
        if (showMap) {
            // ... (Seu código de minimapa existente é chamado no loop principal, 
            // mas se quiser desenhar bordas extras tech, pode adicionar aqui)
        }
    }

    function drawLeaderboard() {
        if (activeWindow !== "ranking" && !keys["Tab"]) return;
        const w = 300; const h = 250; const x = canvas.width / 2 - w / 2; const y = canvas.height / 2 - h / 2;
        ctx.fillStyle = "rgba(0, 10, 20, 0.9)"; ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#00ffff"; ctx.font = "bold 20px Orbitron"; ctx.textAlign = "center"; ctx.fillText("GUERREIROS MAIS FORTES", x + w/2, y + 30);
        ctx.font = "14px Arial"; ctx.textAlign = "left";
        leaderboard.forEach((p, i) => { const py = y + 60 + (i * 30); ctx.fillStyle = i === 0 ? "#ffff00" : "#fff"; ctx.fillText(`#${i+1} ${p.name} [${p.guild || "-"}]`, x + 20, py); ctx.textAlign = "right"; ctx.fillText(`${p.score} pts`, x + w - 20, py); ctx.textAlign = "left"; });
    }

    function drawChats(camX, camY) {
        ctx.font = "14px Arial"; ctx.textAlign = "center";
        chats.forEach(c => {
            const screenX = (c.x - camX) * ZOOM_SCALE + canvas.width / 2; const screenY = (c.y - camY) * ZOOM_SCALE + canvas.height / 2; const w = ctx.measureText(c.text).width + 20;
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.beginPath(); ctx.roundRect(screenX - w/2, screenY - 40, w, 25, 5); ctx.fill();
            ctx.beginPath(); ctx.moveTo(screenX - 5, screenY - 15); ctx.lineTo(screenX + 5, screenY - 15); ctx.lineTo(screenX, screenY - 10); ctx.fill();
            ctx.fillStyle = "#000"; ctx.fillText(c.text, screenX, screenY - 22);
        });
    }

    function drawScouterHUD(me) {
        if (!me) return; const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
        ctx.save(); ctx.fillStyle = "rgba(0, 255, 100, 0.1)"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "rgba(0, 255, 0, 0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI*2); ctx.stroke();
        const drawMarker = (targetX, targetY, color, label) => {
            const dx = targetX - me.x; const dy = targetY - me.y; const dist = Math.hypot(dx, dy); const screenX = cx + dx * ZOOM_SCALE; const screenY = cy + dy * ZOOM_SCALE; const onScreen = screenX > 0 && screenX < W && screenY > 0 && screenY < H;
            if (onScreen) { const size = 30; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(screenX - size, screenY - size + 10); ctx.lineTo(screenX - size, screenY - size); ctx.lineTo(screenX - size + 10, screenY - size); ctx.moveTo(screenX + size, screenY + size - 10); ctx.lineTo(screenX + size, screenY + size); ctx.lineTo(screenX + size - 10, screenY + size); ctx.stroke(); ctx.fillStyle = color; ctx.font = "10px Orbitron"; ctx.fillText(`${label} [${Math.floor(dist/100)}m]`, screenX + size + 5, screenY); } 
            else { const angle = Math.atan2(dy, dx); const radius = Math.min(W, H) / 2 - 40; const px = cx + Math.cos(angle) * radius; const py = cy + Math.sin(angle) * radius; ctx.save(); ctx.translate(px, py); ctx.rotate(angle); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 6); ctx.lineTo(-10, -6); ctx.fill(); ctx.restore(); ctx.fillStyle = color; ctx.font = "10px Arial"; ctx.textAlign = "center"; ctx.fillText(`${label}`, px, py + 20); }
        };
        Object.keys(PLANETS_COORDS).forEach(key => { const p = PLANETS_COORDS[key]; if(Math.hypot(p.x - me.x, p.y - me.y) > 3000) drawMarker(p.x, p.y, "#ffff00", key.replace("_", " ")); });
        [...npcs, ...Object.values(players)].forEach(e => { if (e.id !== me.id && !e.isDead && !e.isSpirit) drawMarker(e.x, e.y, e.isBoss ? "#ff0000" : "#00ffff", `BP: ${e.bp}`); });
        ctx.restore();
    }

    // ==========================================
    // 6. GAME LOOP PRINCIPAL
    // ==========================================
    function loop() {
        requestAnimationFrame(loop);
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

        if (hitStop > 0) {
            hitStop--; if (screenShake > 0) { const shakeX = (Math.random() - 0.5) * screenShake; const shakeY = (Math.random() - 0.5) * screenShake; ctx.translate(shakeX, shakeY); screenShake *= 0.9; }
        } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        if (!myId || !players[myId]) {
            if(document.getElementById("login-screen").style.display !== "none") return;
            ctx.fillStyle = "#fff"; ctx.font = "30px Orbitron"; ctx.textAlign = "center"; ctx.fillText("CONECTANDO...", canvas.width/2, canvas.height/2); return;
        }
        
        const me = players[myId];
        cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1;

        drawBackground(cam.x, cam.y);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(ZOOM_SCALE, ZOOM_SCALE); ctx.translate(-cam.x, -cam.y);

        drawOtherWorld(cam.x, cam.y);
        drawDominationZones();
        drawDragonBalls();
        
        drawTrails(cam.x, cam.y);
        
        craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
        rocks.forEach(r => { if (Math.abs(r.x - cam.x) > canvas.width*2 && Math.abs(r.y - cam.y) > canvas.height*2) return; ctx.fillStyle = r.type === "rock_namek" ? "#686" : (r.type === "rock_metal" ? "#557" : "#654"); ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x + 10, r.y + 10, r.r * 0.8, 0, Math.PI*2); ctx.fill(); });

        projectiles.forEach(p => { ctx.fillStyle = p.color || "#ff0"; ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; });

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => { 
            p.x += p.vx; p.y += p.vy; p.life -= (p.isVanish ? 0.05 : 0.05); 
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; 
        });

        shockwaves = shockwaves.filter(s => s.r < s.maxR);
        shockwaves.forEach(s => { s.r += 10; s.a -= 0.05; if(s.a < 0) s.a = 0; ctx.strokeStyle = s.color; ctx.lineWidth = 5; ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; });

        const entities = [...Object.values(players), ...npcs].sort((a,b) => a.y - b.y);
        entities.forEach(e => { 
            if (Math.abs(e.x - cam.x) < 3000 && Math.abs(e.y - cam.y) < 2000) {
                drawEntity(e); 
                if(Math.abs(e.vx) > 10 || Math.abs(e.vy) > 10) {
                     if(Math.random() > 0.5) trails.push({ x: e.x, y: e.y, angle: e.angle, color: e.color || "#fff", alpha: 0.5 });
                }
            }
        });

        texts = texts.filter(t => t.life > 0);
        texts.forEach(t => { t.x += t.vx || 0; t.y += t.vy; t.life--; ctx.fillStyle = t.color; ctx.font = t.isDmg ? "bold 24px Arial" : (t.isEmote ? "40px Arial" : "16px Orbitron"); ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y); });

        ctx.restore();

        // UI LAYER
        drawNavigationArrow(me); // NOVA FUNÇÃO DE GPS
        if (scouterActive) drawScouterHUD(me);
        drawChats(cam.x, cam.y);
        drawUI(me);
        drawMiniMap(me);
        drawLeaderboard();

        if (announcement.life > 0) { announcement.life--; ctx.fillStyle = announcement.color; ctx.font = "bold 40px Orbitron"; ctx.textAlign = "center"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.strokeText(announcement.text, canvas.width/2, 150); ctx.fillText(announcement.text, canvas.width/2, 150); }

        if(activeWindow === 'menu') {
            const mx = canvas.width/2, my = canvas.height/2;
            ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 4; ctx.fillRect(mx - 150, my - 200, 300, 400); ctx.strokeRect(mx - 150, my - 200, 300, 400);
            ctx.font = "bold 24px Orbitron"; ctx.fillStyle = "#ffaa00"; ctx.textAlign = "center"; ctx.fillText("MENU PRINCIPAL", mx, my - 160);
            const options = ["Ranking (K)", "Guilda (Chat /guild)", "Título (Chat /title)", "REBIRTH (R)"];
            ctx.font = "18px Orbitron"; options.forEach((opt, i) => { ctx.fillStyle = "#fff"; ctx.fillText(opt, mx, my - 100 + (i * 50)); });
            ctx.restore();
        }

        // INPUT LOGIC (ATUALIZADO)
        const tutorialActive = currentSaga && currentSaga.type === "TUTORIAL";
        
        // Sincroniza estado de dialogo com servidor
        if (me.isTutorialDialogActive !== tutorialActive) {
            socket.emit("tutorial_dialog_state", tutorialActive);
            me.isTutorialDialogActive = tutorialActive;
        }

        // Só processa input de combate se NÃO estiver lendo o tutorial
        if (!tutorialActive || !me.isTutorialDialogActive) {
            const input = { 
                x: 0, y: 0, angle: 0, 
                block: !!keys["KeyQ"], 
                charge: !!keys["KeyC"], 
                holdAtk: mouseLeft 
            };
            
            if (isMobile) { 
                input.x = joystickMove.x; input.y = joystickMove.y; 
                if (joystickMove.active && (input.x !== 0 || input.y !== 0)) {
                    input.angle = Math.atan2(joystickMove.y, joystickMove.x);
                } else {
                    input.angle = me.angle; 
                }
            } 
            else { 
                if (keys["KeyW"]) input.y = -1; if (keys["KeyS"]) input.y = 1; 
                if (keys["KeyA"]) input.x = -1; if (keys["KeyD"]) input.x = 1; 
                input.angle = Math.atan2(mouse.y, mouse.x);
            }
            
            // Audio Attack
            if(input.holdAtk && !me.isSpirit) AudioSys.play('hit');

            if(input.x !== 0 || input.y !== 0 || input.block || input.charge || input.holdAtk || input.angle !== me.angle) { 
                socket.emit("input", input); 
            }
        }
    }

    loop();
};