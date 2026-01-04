window.onload = function() {
    console.log(">> GAME.JS CARREGADO. AGUARDANDO LOGIN.");

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

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

    // Lógica de Login
    if (btnLogin) {
        btnLogin.onclick = function(e) {
            e.preventDefault();
            const user = document.getElementById("username").value.trim();
            const pass = document.getElementById("password").value.trim();
            
            if (user && pass) {
                console.log(">> ENVIANDO DADOS DE LOGIN:", user);
                btnLogin.innerText = "CONECTANDO...";
                socket.emit("login", { user: user, pass: pass });
            } else {
                alert("Digite Guerreiro e Senha!");
            }
        };
    } else {
        console.error("ERRO: Botão de login não encontrado.");
    }

    // ==========================================
    // 2. VARIÁVEIS DO JOGO
    // ==========================================
    let myId = null;
    let players = {}, npcs = [], projectiles = [], rocks = [], craters = [], chats = [];
    let dominationZones = [], leaderboard = [], currentSaga = null; 

    let cam = { x: 0, y: 0 };
    let mouse = { x: 0, y: 0 };
    let keys = {};
    let mouseLeft = false, mouseRight = false;

    let particles = [], shockwaves = [], trails = [], texts = [];
    let screenShake = 0, flash = 0, hitStop = 0;

    let joystickMove = { x: 0, y: 0 };
    let scouterActive = false; 
    let showMap = true;
    let activeWindow = null; 
    let announcement = { text: "", life: 0, color: "#f00" };

    // ===============================
    // SISTEMA DE TUTORIAL
    // ===============================
    let tutorialActive = false;
    let tutorialStep = 0;
    let tutorialText = "";
    let tutorialIndex = 0;
    let tutorialTimer = 0;

    const TUTORIAL_DATA = [
        { text: "INICIANDO SISTEMA... ANALISANDO USUÁRIO...", duration: 200 },
        { text: "BEM-VINDO À GALÁXIA Z. SEU OBJETIVO É DOMINAR.", duration: 250 },
        { text: "USE [ATK] PARA COMBOS. O TIMING É CRUCIAL.", duration: 300 },
        { text: "SE DOIS GOLPES COLIDIREM, OCORRE UM 'CLASH'.", duration: 300 },
        { text: "SIGA A SETA AMARELA PARA COMPLETAR SUA SAGA.", duration: 300 },
        { text: "NO NÍVEL 150, FAÇA O REBIRTH PARA FICAR MAIS FORTE.", duration: 300 },
        { text: "SISTEMA ONLINE. BOA SORTE, GUERREIRO.", duration: 200 }
    ];

    function initTutorial() {
        if (!localStorage.getItem("dbz_tutorial_v4_complete")) {
            tutorialActive = true;
        }
    }

    const ZOOM_SCALE = 0.6; 
    const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone/i.test(navigator.userAgent);

    // COORDENADAS E GPS (ATUALIZADO COM SEU SERVER.JS)
    const SNAKE_WAY_START = { x: 0, y: -12000 };
    const KAIOH_PLANET    = { x: 0, y: -25000 };
    
    // Sincronizado com Server.js para o GPS funcionar em todas as sagas
    const PLANETS_COORDS = { 
        "EARTH_CORE": {x: 2000, y: 2000}, 
        "KAME_ISLAND": {x: 6000, y: -4000},
        "NAMEK_VILLAGE": {x: -18000, y: 5000}, 
        "GURU_HOUSE": {x: -22000, y: 8000},
        "FRIEZA_BASE": {x: -35000, y: -10000}, 
        "FUTURE_RUINS": {x: 15000, y: 0}, 
        "DEMON_GATE": {x: 0, y: 25000},
        "MAKAI_CORE": {x: 5000, y: 35000}, 
        "VAMPA_WASTES": {x: -45000, y: 15000},
        "BEERUS_PLANET": {x: 0, y: -90000}, 
        "ZEN_PALACE": {x: 0, y: -120000},
        // Fallbacks para tipos genéricos
        "EARTH": {x: 2000, y: 2000},
        "NAMEK": {x: -18000, y: 5000},
        "FUTURE": {x: 15000, y: 0},
        "DEMON": {x: 5000, y: 35000},
        "VAMPA": {x: -45000, y: 15000},
        "DIVINE": {x: 0, y: -90000}
    };

    // Chat Input Setup
    const textInput = document.createElement("input");
    textInput.type = "text"; 
    textInput.style.cssText = "position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:300px; padding:10px; background:rgba(0,0,0,0.8); color:#ffaa00; border:2px solid #ffcc00; display:none; font-family:'Orbitron',sans-serif;";
    textInput.placeholder = "Digite...";
    document.body.appendChild(textInput);

    textInput.addEventListener("keydown", e => { if (e.key === "Enter") { toggleChat(); } });

    // --- NOVO SISTEMA DE ESTRELAS (PARALLAX INFINITO) ---
    const stars = [];
    for(let i=0; i<400; i++) {
        stars.push({
            x: Math.random() * window.innerWidth, // Posição na tela
            y: Math.random() * window.innerHeight,
            z: Math.random() * 0.8 + 0.2, // Profundidade (velocidade)
            size: Math.random() * 2 + 0.5,
            alpha: Math.random()
        });
    }

    // ==========================================
    // 3. LISTENERS E SOCKETS
    // ==========================================

    socket.on("auth_success", (data) => { 
        console.log(">> LOGIN SUCESSO! ID:", data.id);
        myId = data.id; 
        if(loginScreen) loginScreen.style.display = "none"; 
        if(uiLayer) uiLayer.style.display = "block"; 
        initTutorial(); 
        
        if (isMobile) { 
            document.getElementById("mobile-ui").style.display = "block"; 
            requestAnimationFrame(() => { initMobileControls(); }); 
        } 
    });

    socket.on("state", (data) => { 
        if(!myId) return; 
        players = data.players; 
        npcs = data.npcs; 
        projectiles = data.projectiles; 
        rocks = data.rocks; 
        craters = data.craters || []; 
        chats = data.chats || []; 
        dominationZones = data.domination || []; 
        leaderboard = data.leaderboard || []; 
        currentSaga = data.saga || null;
    });

    socket.on("fx", (data) => {
        if(data.type === "hit" || data.type === "heavy") { 
            screenShake = data.type === "heavy" ? 30 : 10; 
            shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: data.type === "heavy" ? 150 : 60, a: 1, color: "#fff" }); 
            for(let i=0; i<12; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: "#ffaa00", size: 4 }); 
            if(data.dmg) texts.push({ x: data.x, y: data.y - 40, text: data.dmg.toString(), color: "#ffff00", life: 60, vy: -2, isDmg: true }); 
        }
        
        if(data.type === "clash") {
            screenShake = 40; hitStop = 6;
            shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 200, a: 1, color: "#ffff00" });
            shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 120, a: 1, color: "#ffffff" });
            for(let i=0; i<20; i++) particles.push({ x: data.x, y: data.y, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40, life: 1.5, color: "#fff", size: 5 });
            texts.push({ x: data.x, y: data.y - 80, text: "CLASH!!", color: "#fff", life: 40, vy: -1.5 });
        }

        if(data.type === "xp_gain") texts.push({ x: data.x, y: data.y - 60, text: "+" + data.amount + " XP", color: "#00ff00", life: 50, vy: -1.5 });
        if(data.type === "transform") { screenShake = 50; flash = 15; let c = "#ff0"; if(data.form === "GOD") c = "#f00"; if(data.form === "BLUE") c = "#0ff"; if(data.form === "UI") c = "#fff"; shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: c }); }
        if(data.type === "vanish") shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 80, a: 0.8, color: "#0ff" });
        if(data.type === "levelup") { texts.push({x: data.x, y: data.y - 80, text: "LEVEL UP!", color: "#00ffff", life: 120, vy: -0.5}); shockwaves.push({ x: data.x, y: data.y, r: 10, maxR: 400, a: 1, color: "#fff" }); }
        if(data.type === "bp_limit") { texts.push({x: data.x, y: data.y - 100, text: data.text, color: "#ff0000", life: 150, vy: -0.5}); announcement = { text: data.text, life: 300, color: "#ff3300" }; screenShake = 20; }
        if(data.type === "emote") { texts.push({x: data.x, y: data.y - 60, text: data.icon, color: "#fff", life: 100, vy: -1, isEmote: true }); }
    });

    socket.on("pvp_status", enabled => { 
        if (btnPvp) btnPvp.classList.toggle("active", enabled); 
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
        textInput.style.display = "block"; textInput.placeholder = "Digite sua mensagem..."; textInput.focus();
        Object.keys(keys).forEach(k => keys[k] = false);
    }

    // Botões
    function bindBtn(id, onPress, onRelease) { 
        const el = document.getElementById(id); 
        if (!el) return; 
        const press = e => { e.preventDefault(); e.stopPropagation(); onPress && onPress(); }; 
        const release = e => { e.preventDefault(); e.stopPropagation(); onRelease && onRelease(); }; 
        el.addEventListener('touchstart', press, { passive: false }); 
        el.addEventListener('touchend', release, { passive: false }); 
        el.addEventListener('mousedown', press); 
        el.addEventListener('mouseup', release); 
    }

    bindBtn('btn-atk', () => mouseLeft=true, () => { mouseLeft=false; socket.emit('release_attack'); });
    bindBtn('btn-blast', () => mouseRight=true, () => { mouseRight=false; socket.emit('release_blast'); });
    bindBtn('btn-block', () => keys['KeyQ']=true, () => delete keys['KeyQ']);
    bindBtn('btn-charge', () => keys['KeyC']=true, () => delete keys['KeyC']);
    bindBtn('btn-vanish', () => socket.emit('vanish'));
    bindBtn('btn-transform', () => socket.emit('transform'));

    // Botões de Menu
    const simpleClick = (id, fn) => {
        const el = document.getElementById(id);
        if(el) { el.onclick = (e) => { e.preventDefault(); fn(); }; el.ontouchstart = (e) => { e.preventDefault(); fn(); }; }
    };

    simpleClick('btn-scouter', () => { scouterActive = !scouterActive; });
    simpleClick('btn-ranking', () => { activeWindow = activeWindow === "ranking" ? null : "ranking"; });
    simpleClick('btn-guild', () => { activeWindow = "menu"; onMenuOption("guild"); });
    simpleClick('btn-rebirth', () => { socket.emit("rebirth"); });
    
    const btnMenu = document.getElementById("btn-menu"); if(btnMenu) btnMenu.onclick = () => { activeWindow = activeWindow ? null : 'menu'; }
    const btnChat = document.getElementById("btn-chat"); if(btnChat) btnChat.onclick = () => { toggleChat(); }
    if(btnPvp) btnPvp.onclick = () => { socket.emit("toggle_pvp"); };

    // Controles Teclado/Mouse
    window.addEventListener("contextmenu", e => e.preventDefault());
    window.addEventListener("mousemove", e => { mouse.x = (e.clientX - window.innerWidth / 2) / ZOOM_SCALE; mouse.y = (e.clientY - window.innerHeight / 2) / ZOOM_SCALE; });
    
    canvas.addEventListener("mousedown", e => { 
        if(tutorialActive) {
            tutorialStep++; tutorialIndex = 0; tutorialTimer = 0;
            if (tutorialStep >= TUTORIAL_DATA.length) { tutorialActive = false; localStorage.setItem("dbz_tutorial_v4_complete", "true"); }
        }
        if(e.button === 0) mouseLeft = true; if(e.button === 2) mouseRight = true; if(activeWindow && (mouse.x > 200 || mouse.x < -200)) activeWindow = null; 
    });
    canvas.addEventListener("mouseup", e => { if(e.button === 0) { mouseLeft = false; socket.emit("release_attack"); } if(e.button === 2) { mouseRight = false; socket.emit("release_blast"); } });
    
    canvas.addEventListener("touchstart", e => {
        if (tutorialActive) { tutorialStep++; tutorialIndex = 0; tutorialTimer = 0; if (tutorialStep >= TUTORIAL_DATA.length) { tutorialActive = false; localStorage.setItem("dbz_tutorial_v4_complete", "true"); } return; }
        if (!activeWindow) return; const touch = e.touches[0]; const rect = canvas.getBoundingClientRect(); const x = touch.clientX - rect.left; const y = touch.clientY - rect.top; handleCanvasUIInteraction(x, y); e.preventDefault();
    }, { passive: false });

    window.addEventListener("keydown", e => {
        if (textInput.style.display === "block") { if(e.key === "Enter") toggleChat(); return; }
        if (e.repeat) return; keys[e.code] = true;
        switch (e.code) {
            case "Space": socket.emit("vanish"); break; case "KeyG": socket.emit("transform"); break; case "KeyT": scouterActive = !scouterActive; break;
            case "KeyP": socket.emit("toggle_pvp"); break; case "KeyH": tutorialActive = !tutorialActive; break; case "KeyL": activeWindow = activeWindow ? null : "menu"; break;
            case "KeyR": activeWindow = "ranking"; break; case "Escape": activeWindow = null; break;
        }
    });
    window.addEventListener("keyup", e => keys[e.code] = false);

    function initMobileControls() { 
        if (!isMobile || !window.nipplejs) return; 
        if (joystick) return; 
        const zone = document.getElementById('joystick-container'); 
        if (!zone) return; 
        joystick = nipplejs.create({ zone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff9900', size: 120 }); 
        joystick.on('move', (evt, data) => { if (!data || !data.vector) return; joystickMove.x = data.vector.x; joystickMove.y = -data.vector.y; }); 
        joystick.on('end', () => { joystickMove.x = 0; joystickMove.y = 0; }); 
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
    // 5. RENDERIZAÇÃO
    // ==========================================

    function drawBackground(camX, camY) {
        // PREENCHE A TELA INTEIRA COM GRADIENTE ESPACIAL
        // Isso roda em coordenadas de tela (sem transform de câmera ainda)
        const w = canvas.width;
        const h = canvas.height;
        
        // Gradiente profundo
        const grd = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h);
        grd.addColorStop(0, "#1a1a2e"); // Centro levemente azulado
        grd.addColorStop(1, "#000000"); // Bordas pretas
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // DESENHA ESTRELAS COM WRAPPING (INFINITO)
        ctx.fillStyle = "#fff";
        stars.forEach(s => {
            // Calcula a posição na tela baseada no movimento da câmera (Parallax)
            // O operador % (módulo) faz ela dar a volta na tela
            let x = (s.x - camX * s.z) % w;
            let y = (s.y - camY * s.z) % h;

            // Correção para números negativos (em JS % pode retornar negativo)
            if (x < 0) x += w;
            if (y < 0) y += h;

            // Piscar
            const twinkle = 0.5 + Math.sin(Date.now() * 0.005 + s.x) * 0.5;
            ctx.globalAlpha = twinkle;
            
            ctx.beginPath();
            ctx.arc(x, y, s.size, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
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

    function drawEntityHUD(e, sizeMult) {
        if (e.isSpirit) return;
        ctx.save(); ctx.translate(30 * sizeMult, -50 * sizeMult); ctx.transform(1, -0.22, 0, 1, 0, 0); 
        const mainColor = e.isBoss ? "#ff3333" : (e.isNPC && !e.isBotPlayer ? "#ffaa00" : "#00ffff");
        ctx.shadowBlur = 8; ctx.shadowColor = mainColor; ctx.strokeStyle = "rgba(0,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-30, 20); ctx.lineTo(0, 0); ctx.lineTo(110, 0); ctx.stroke();
        
        let dispName = e.name?.substring(0, 12) || "???";
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
        if (e.isBotPlayer) { drawMiniWarrior(e, sizeMult); return; } 

        const name = e.name.toUpperCase(); const time = Date.now(); const breathe = Math.sin(time * 0.005) * 1.5;
        if (name.includes("SAIBAMAN")) {
            ctx.fillStyle = "#2d2"; ctx.strokeStyle = "#050"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(-5 * sizeMult, -8 * sizeMult, 6 * sizeMult, 0, Math.PI*2); ctx.arc(-5 * sizeMult, 8 * sizeMult, 6 * sizeMult, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.save(); ctx.translate(2 * sizeMult, 0); ctx.fillStyle = "#3e3"; ctx.beginPath(); ctx.ellipse(0, 0, 14 * sizeMult, 11 * sizeMult, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(6 * sizeMult, -4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.arc(6 * sizeMult, 4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#1a1"; ctx.beginPath(); ctx.moveTo(-5 * sizeMult, -5 * sizeMult); ctx.lineTo(0, -8 * sizeMult); ctx.stroke(); ctx.restore(); return;
        }
        if (name.includes("BUU") || name.includes("FAT") || name.includes("DODORIA")) {
            ctx.fillStyle = "#509"; ctx.beginPath(); ctx.moveTo(-10 * sizeMult, -15 * sizeMult); ctx.lineTo(-25 * sizeMult, 0); ctx.lineTo(-10 * sizeMult, 15 * sizeMult); ctx.fill();
            ctx.fillStyle = name.includes("DODORIA") ? "#d59" : "#fba"; ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.arc(-5 * sizeMult, 0, 18 * sizeMult, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#111"; ctx.fillRect(-10 * sizeMult, -18 * sizeMult, 12 * sizeMult, 36 * sizeMult); ctx.strokeStyle = "#fd0"; ctx.lineWidth = 2; ctx.strokeRect(-10 * sizeMult, -18 * sizeMult, 12 * sizeMult, 36 * sizeMult);
            ctx.fillStyle = name.includes("DODORIA") ? "#d59" : "#fba"; ctx.beginPath(); ctx.arc(0, 0, 12 * sizeMult, 0, Math.PI*2); ctx.fill(); 
            ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.moveTo(6 * sizeMult, -4 * sizeMult); ctx.lineTo(10 * sizeMult, -4 * sizeMult); ctx.moveTo(6 * sizeMult, 4 * sizeMult); ctx.lineTo(10 * sizeMult, 4 * sizeMult); ctx.stroke(); return;
        }
        if (name.includes("FRIEZA") || name.includes("SOLDIER") || name.includes("VEGETA") || name.includes("NAPPA") || name.includes("RADITZ")) {
            ctx.fillStyle = "#113"; ctx.fillRect(-12 * sizeMult, -10 * sizeMult, 24 * sizeMult, 20 * sizeMult);
            ctx.fillStyle = "#eee"; ctx.strokeStyle = "#da0"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-5 * sizeMult, -8 * sizeMult); ctx.lineTo(-20 * sizeMult, -22 * sizeMult); ctx.lineTo(-20 * sizeMult, -5 * sizeMult); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5 * sizeMult, 8 * sizeMult); ctx.lineTo(-20 * sizeMult, 22 * sizeMult); ctx.lineTo(-20 * sizeMult, 5 * sizeMult); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ddcb99"; ctx.fillRect(-8 * sizeMult, -10 * sizeMult, 16 * sizeMult, 20 * sizeMult);
            ctx.save(); ctx.translate(0, breathe); ctx.fillStyle = "#ffdbac"; ctx.beginPath(); ctx.arc(2 * sizeMult, 0, 9 * sizeMult, 0, Math.PI*2); ctx.fill();
            if (!name.includes("FRIEZA_FINAL")) { ctx.fillStyle = "rgba(0, 255, 100, 0.6)"; ctx.fillRect(6 * sizeMult, -6 * sizeMult, 6 * sizeMult, 6 * sizeMult); ctx.strokeStyle = "#0f0"; ctx.strokeRect(6 * sizeMult, -6 * sizeMult, 6 * sizeMult, 6 * sizeMult); }
            if (!name.includes("SOLDIER") && !name.includes("FRIEZA")) { ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-2 * sizeMult, 0, 10 * sizeMult, 0, Math.PI*2); ctx.fill(); }
            ctx.restore(); return;
        }
        if (name.includes("CELL") || name.includes("JR")) {
            ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-15 * sizeMult, -10 * sizeMult); ctx.lineTo(-30 * sizeMult, -20 * sizeMult); ctx.lineTo(-30 * sizeMult, 20 * sizeMult); ctx.lineTo(-15 * sizeMult, 10 * sizeMult); ctx.fill();
            ctx.fillStyle = "#3c3"; ctx.beginPath(); ctx.arc(0, 0, 12 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#050"; ctx.beginPath(); ctx.arc(-2 * sizeMult, -5 * sizeMult, 2 * sizeMult, 0, Math.PI*2); ctx.arc(2 * sizeMult, 4 * sizeMult, 3 * sizeMult, 0, Math.PI*2); ctx.fill();
            ctx.save(); ctx.translate(0, breathe); ctx.fillStyle = "#3c3"; ctx.beginPath(); ctx.moveTo(0, -8 * sizeMult); ctx.lineTo(8 * sizeMult, -15 * sizeMult); ctx.lineTo(5 * sizeMult, 0); ctx.lineTo(8 * sizeMult, 15 * sizeMult); ctx.lineTo(0, 8 * sizeMult); ctx.fill(); ctx.restore(); return;
        }
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
        if (!e) return; if (e.isDead && e.isNPC && !e.isBotPlayer) return; 
        const sizeMult = e.isBoss ? 4 : 1;
        ctx.save(); ctx.translate(e.x, e.y);
        ctx.save(); ctx.rotate(e.angle); 
        
        // Se for NPC genérico, desenha mob. Se for Jogador ou Bot Inteligente, desenha Guerreiro.
        if (e.isNPC && !e.isBotPlayer) { drawMobModel(e, sizeMult); } else { drawMiniWarrior(e, sizeMult); } 
        ctx.restore();
        
        ctx.save(); drawEntityHUD(e, sizeMult); ctx.restore();
        if (e.state === "BLOCKING") {
            ctx.save(); let blockAngle = e.angle;
            if (e.id === myId && !isMobile) blockAngle = Math.atan2(mouse.y, mouse.x);
            if (e.id === myId && isMobile && (Math.abs(joystickMove.x) > 0.1 || Math.abs(joystickMove.y) > 0.1)) { blockAngle = Math.atan2(joystickMove.y, joystickMove.x); }
            ctx.rotate(blockAngle); ctx.strokeStyle = "rgba(100,200,255,0.85)"; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = "#00ffff";
            ctx.beginPath(); ctx.arc(0, 0, 30 * sizeMult, -1, 1); ctx.stroke(); ctx.restore();
        }
        const speedTrail = Math.hypot(e.vx, e.vy);
        if (hitStop <= 0 && speedTrail > 8 && (!e.lastTrail || performance.now() - e.lastTrail > 80)) {
            e.lastTrail = performance.now(); if (trails.length < 100) { trails.push({ x: e.x, y: e.y, angle: e.angle, color: getTrailColor(e), alpha: 0.35, sizeMult }); }
        }
        ctx.restore();
    }

    function drawScouterHUD(me) {
        if (!me) return;
        const W = canvas.width; const H = canvas.height; const cx = W / 2; const cy = H / 2; const time = Date.now();
        ctx.save(); ctx.globalCompositeOperation = "source-over"; const grad = ctx.createRadialGradient(cx, cy, H / 2, cx, cy, H); grad.addColorStop(0, "rgba(0, 255, 0, 0)"); grad.addColorStop(1, "rgba(0, 255, 0, 0.3)"); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        const scanY = (time * 0.5) % H; ctx.fillStyle = "rgba(0, 255, 0, 0.15)"; ctx.fillRect(0, scanY, W, 4);
        ctx.strokeStyle = "rgba(0, 255, 0, 0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.stroke();
        [...npcs, ...Object.values(players)].forEach(e => {
            if (e.id === me.id || e.isDead || e.isSpirit) return;
            const screenX = cx + (e.x - me.x) * ZOOM_SCALE; const screenY = cy + (e.y - me.y) * ZOOM_SCALE; const dist = Math.hypot(e.x - me.x, e.y - me.y); const onScreen = screenX > -50 && screenX < W + 50 && screenY > -50 && screenY < H + 50;
            if (onScreen) {
                const worldDist = dist; const inScanRange  = worldDist < 2200; const inFocusRange = worldDist < 600;
                let color = "#00ff00"; if (!e.isNPC || e.isBotPlayer) color = "#00ffff"; if (inFocusRange) color = "#ff3333";
                const bracketSize = inFocusRange ? 42 + Math.sin(time / 120) * 6 : 28 + Math.sin(time / 200) * 4; const bpDisplay = inScanRange ? e.bp.toLocaleString() : "???";
                ctx.save(); ctx.translate(screenX, screenY); ctx.strokeStyle = color; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-bracketSize, -bracketSize + 10); ctx.lineTo(-bracketSize, -bracketSize); ctx.lineTo(-bracketSize + 10, -bracketSize); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(bracketSize, bracketSize - 10); ctx.lineTo(bracketSize, bracketSize); ctx.lineTo(bracketSize - 10, bracketSize); ctx.stroke();
                ctx.fillStyle = color; ctx.font = "bold 12px Orbitron"; ctx.fillText(`BP: ${bpDisplay}`, bracketSize + 6, -8); ctx.font = "10px Orbitron"; ctx.fillText(e.name, bracketSize + 6, 6);
                if (!e.isNPC || e.isBotPlayer) { ctx.fillStyle = "#00ffff"; ctx.fillText("[P]", -bracketSize - 14, 4); }
                ctx.restore();
            } else if (dist < 4000) {
                const angle = Math.atan2(screenY - cy, screenX - cx); const radius = Math.min(W, H) / 2 - 30; const ix = cx + Math.cos(angle) * radius; const iy = cy + Math.sin(angle) * radius;
                ctx.save(); ctx.translate(ix, iy); ctx.rotate(angle);
                ctx.fillStyle = e.isBoss ? "#ff0000" : ((!e.isNPC || e.isBotPlayer)? "#00ffff" : "#00ff00");
                ctx.beginPath(); 
                ctx.moveTo(10, 0); 
                ctx.lineTo(-10, 6); 
                ctx.lineTo(-10, -6); 
                ctx.fill(); 
                ctx.restore();
            }
        });
        ctx.restore();
    }

    function getTrailColor(e) {
        if (e.isBoss) return "#ff0000";
        if (e.form === "SSJ" || e.form === "SSJ2") return "#ffff00";
        if (e.form === "GOD") return "#ff0055";
        if (e.form === "BLUE") return "#00ffff";
        if (e.form === "UI") return "#ffffff";
        return "#ffffff";
    }

    function drawMiniMap(me) {
        if (!showMap) return;
        const mapSize = 150;
        const padding = 20;
        const mapX = canvas.width - mapSize - padding;
        const mapY = canvas.height - mapSize - padding;
        
        ctx.save();
        ctx.translate(mapX, mapY);
        ctx.fillStyle = "rgba(0, 20, 40, 0.8)";
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.fillRect(0, 0, mapSize, mapSize);
        ctx.strokeRect(0, 0, mapSize, mapSize);

        const scale = mapSize / 150000; 
        const centerX = mapSize / 2;
        const centerY = mapSize / 2;

        ctx.fillStyle = "#ffff00"; 
        Object.values(PLANETS_COORDS).forEach(p => {
            const px = centerX + (p.x - me.x) * scale;
            const py = centerY + (p.y - me.y) * scale;
            if (px >= 0 && px <= mapSize && py >= 0 && py <= mapSize) {
                ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            }
        });

        ctx.fillStyle = "#00ff00";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 4);
        ctx.lineTo(centerX + 3, centerY + 3);
        ctx.lineTo(centerX - 3, centerY + 3);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`X: ${Math.round(me.x)} Y: ${Math.round(me.y)}`, centerX, mapSize + 12);
        ctx.restore();
    }

    function drawUI(me) {
        if (currentSaga) {
            const boxW = 400; const boxX = canvas.width / 2 - boxW / 2;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(boxX, 10, boxW, 50, 5); ctx.fill(); ctx.stroke();

            ctx.fillStyle = "#ffcc00"; ctx.font = "bold 16px Orbitron"; ctx.textAlign = "center";
            ctx.fillText(`SAGA: ${currentSaga.title}`, canvas.width / 2, 30);
            ctx.fillStyle = "#fff"; ctx.font = "14px Arial";
            ctx.fillText(currentSaga.objective, canvas.width / 2, 48);

            // Seta GPS
            if(currentSaga.targetZone && PLANETS_COORDS[currentSaga.targetZone]) {
                const t = PLANETS_COORDS[currentSaga.targetZone];
                const ang = Math.atan2(t.y - me.y, t.x - me.x);
                const indX = canvas.width / 2 + Math.cos(ang) * (boxW/2 + 30);
                const indY = 35 + Math.sin(ang) * 30;
                
                ctx.save(); ctx.translate(indX, indY); ctx.rotate(ang);
                ctx.fillStyle = "#ffcc00"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 7); ctx.lineTo(-10, -7); ctx.fill();
                ctx.restore();
            }
        }

        const barW = 300; const barH = 20; const x = 20; let y = 20;
        
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = "#ff3333"; ctx.fillRect(x, y, barW * (me.hp / me.maxHp), barH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x, y, barW, barH);
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
        ctx.fillText(`HP: ${Math.floor(me.hp)} / ${me.maxHp}`, x + 5, y + 15);
        
        y += 25;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = "#ffff00"; ctx.fillRect(x, y, barW * (me.ki / me.maxKi), barH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x, y, barW, barH);
        ctx.fillStyle = "#000"; ctx.fillText(`KI: ${Math.floor(me.ki)} / ${me.maxKi}`, x + 5, y + 15);
        
        y += 25;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, barW, barH/2);
        ctx.fillStyle = "#00ffff"; ctx.fillRect(x, y, barW * (me.xp / me.xpToNext), barH/2);
        ctx.fillStyle = "#fff"; ctx.font = "12px Orbitron"; 
        ctx.fillText(`LVL: ${me.level}  |  BP: ${me.bp.toLocaleString()}`, x, y + 25);

        if (me.quest && !me.quest.completed) {
            const qY = 150;
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, qY, 220, 50);
            ctx.fillStyle = "#0f0"; ctx.font = "12px Orbitron"; ctx.textAlign = "left";
            ctx.fillText("MISSÃO ATUAL:", 20, qY + 15);
            ctx.fillStyle = "#fff"; ctx.fillText(me.quest.desc, 20, qY + 35);
        }
    }

    function drawLeaderboard() {
        if (activeWindow !== "ranking" && !keys["Tab"]) return;
        const w = 300; const h = 250; const x = canvas.width / 2 - w / 2; const y = canvas.height / 2 - h / 2;
        ctx.fillStyle = "rgba(0, 10, 20, 0.9)"; ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#00ffff"; ctx.font = "bold 20px Orbitron"; ctx.textAlign = "center";
        ctx.fillText("GUERREIROS MAIS FORTES", x + w/2, y + 30);
        ctx.font = "14px Arial"; ctx.textAlign = "left";
        leaderboard.forEach((p, i) => {
            const py = y + 60 + (i * 30);
            ctx.fillStyle = i === 0 ? "#ffff00" : "#fff";
            ctx.fillText(`#${i+1} ${p.name} [${p.guild || "-"}]`, x + 20, py);
            ctx.textAlign = "right"; ctx.fillText(`${p.score} pts`, x + w - 20, py); ctx.textAlign = "left";
        });
    }

    function drawChats(camX, camY) {
        ctx.font = "14px Arial"; ctx.textAlign = "center";
        chats.forEach(c => {
            const screenX = (c.x - camX) * ZOOM_SCALE + canvas.width / 2;
            const screenY = (c.y - camY) * ZOOM_SCALE + canvas.height / 2;
            const w = ctx.measureText(c.text).width + 20;
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.beginPath(); ctx.roundRect(screenX - w/2, screenY - 40, w, 25, 5); ctx.fill();
            ctx.beginPath(); ctx.moveTo(screenX - 5, screenY - 15); ctx.lineTo(screenX + 5, screenY - 15); ctx.lineTo(screenX, screenY - 10); ctx.fill();
            ctx.fillStyle = "#000"; ctx.fillText(c.text, screenX, screenY - 22);
        });
    }

    function drawTutorial() {
        if (!tutorialActive) return;
        const step = TUTORIAL_DATA[tutorialStep]; if (!step) return;
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
        ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, canvas.height - 150); ctx.lineTo(canvas.width, canvas.height - 150); ctx.stroke();
        tutorialTimer++; if (tutorialTimer % 2 === 0 && tutorialIndex < step.text.length) { tutorialText = step.text.substring(0, tutorialIndex + 1); tutorialIndex++; }
        ctx.fillStyle = "#00ffff"; ctx.font = "20px Orbitron"; ctx.textAlign = "left"; ctx.fillText("SISTEMA:", 50, canvas.height - 100);
        ctx.fillStyle = "#fff"; ctx.font = "18px Monospace"; ctx.fillText(tutorialText, 160, canvas.height - 100);
        ctx.font = "12px Arial"; ctx.fillStyle = "#aaa"; ctx.fillText("[CLIQUE PARA CONTINUAR]", canvas.width - 200, canvas.height - 20);
    }

    // ==========================================
    // 6. GAME LOOP PRINCIPAL
    // ==========================================
    function loop() {
        requestAnimationFrame(loop);
        
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        }

        // Hit Stop
        if (hitStop > 0) {
            hitStop--;
            if (screenShake > 0) {
                const shakeX = (Math.random() - 0.5) * screenShake; const shakeY = (Math.random() - 0.5) * screenShake;
                ctx.translate(shakeX, shakeY); screenShake *= 0.9;
            }
        } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        if (!myId || !players[myId]) {
            if(!document.getElementById("login-screen").style.display === "none") {
               ctx.fillStyle = "#fff"; ctx.font = "30px Orbitron"; ctx.textAlign = "center";
               ctx.fillText("CONECTANDO AO UNIVERSO...", canvas.width/2, canvas.height/2);
            }
            return;
        }
        
        const me = players[myId];
        cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1;

        // Fundo desenhado antes de aplicar transform da câmera (Fundo Infinito)
        drawBackground(cam.x, cam.y);

        // Aplica transform da câmera para o mundo
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(ZOOM_SCALE, ZOOM_SCALE); ctx.translate(-cam.x, -cam.y);

        drawOtherWorld(cam.x, cam.y);
        drawDominationZones();

        craters.forEach(c => { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
        rocks.forEach(r => {
            if (Math.abs(r.x - cam.x) > canvas.width*2 && Math.abs(r.y - cam.y) > canvas.height*2) return;
            ctx.fillStyle = r.type === "rock_namek" ? "#686" : (r.type === "rock_metal" ? "#557" : "#654");
            ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.arc(r.x + 10, r.y + 10, r.r * 0.8, 0, Math.PI*2); ctx.fill();
        });
        
        trails = trails.filter(t => t.alpha > 0);
        trails.forEach(t => {
            t.alpha -= 0.02;
            ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.globalAlpha = t.alpha; ctx.fillStyle = t.color;
            const sizeMult = t.sizeMult || 1;
            ctx.beginPath(); ctx.moveTo(-10 * sizeMult, -10 * sizeMult); ctx.lineTo(10 * sizeMult, 0); ctx.lineTo(-10 * sizeMult, 10 * sizeMult); ctx.fill(); ctx.restore();
        });

        projectiles.forEach(p => { ctx.fillStyle = p.color || "#ff0"; ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; });

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; });

        shockwaves = shockwaves.filter(s => s.r < s.maxR);
        shockwaves.forEach(s => { s.r += 10; s.a -= 0.05; if(s.a < 0) s.a = 0; ctx.strokeStyle = s.color; ctx.lineWidth = 5; ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; });

        const entities = [...Object.values(players), ...npcs].sort((a,b) => a.y - b.y);
        entities.forEach(e => { if (Math.abs(e.x - cam.x) < 3000 && Math.abs(e.y - cam.y) < 2000) drawEntity(e); });

        texts = texts.filter(t => t.life > 0);
        texts.forEach(t => { t.x += t.vx || 0; t.y += t.vy; t.life--; ctx.fillStyle = t.color; ctx.font = t.isDmg ? "bold 24px Arial" : (t.isEmote ? "40px Arial" : "16px Orbitron"); ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y); });

        ctx.restore();

        // UI LAYER
        if (scouterActive) drawScouterHUD(me);
        drawChats(cam.x, cam.y);
        drawUI(me);
        drawMiniMap(me);
        drawLeaderboard();
        drawTutorial();

        if (announcement.life > 0) {
            announcement.life--; ctx.fillStyle = announcement.color; ctx.font = "bold 40px Orbitron"; ctx.textAlign = "center"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.strokeText(announcement.text, canvas.width/2, 150); ctx.fillText(announcement.text, canvas.width/2, 150);
        }

        if(activeWindow === 'menu') {
            const mx = canvas.width/2, my = canvas.height/2;
            ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 4; ctx.fillRect(mx - 150, my - 200, 300, 400); ctx.strokeRect(mx - 150, my - 200, 300, 400);
            ctx.font = "bold 24px Orbitron"; ctx.fillStyle = "#ffaa00"; ctx.textAlign = "center"; ctx.fillText("MENU PRINCIPAL", mx, my - 160);
            const options = ["Ranking (K)", "Guilda (Chat /guild)", "Título (Chat /title)", "REBIRTH (R)"];
            ctx.font = "18px Orbitron"; options.forEach((opt, i) => { ctx.fillStyle = "#fff"; ctx.fillText(opt, mx, my - 100 + (i * 50)); });
            ctx.restore();
        }

        const input = { x: 0, y: 0, angle: 0, block: !!keys["KeyQ"], charge: !!keys["KeyC"], holdAtk: mouseLeft };
        if (isMobile) { input.x = joystickMove.x; input.y = joystickMove.y; } 
        else { if (keys["KeyW"]) input.y = -1; if (keys["KeyS"]) input.y = 1; if (keys["KeyA"]) input.x = -1; if (keys["KeyD"]) input.x = 1; }

        if (input.x !== 0 || input.y !== 0) { input.angle = Math.atan2(input.y, input.x); } else { input.angle = Math.atan2(mouse.y, mouse.x); }

        if(input.x !== 0 || input.y !== 0 || input.block || input.charge || input.holdAtk) { socket.emit("input", input); }
    }

    // Iniciar Loop
    loop();
};

// ================= CLIENT-SIDE PREDICTION LAYER =================
// This layer runs movement instantly on client and reconciles with server state.
// Does not replace existing logic.

let clientTick = 0;
let pendingInputs = [];
let lastServerState = null;

function applyLocalPrediction(me, input) {
    const speed = 12;
    me.x += input.x * speed;
    me.y += input.y * speed;
}

socket.on("state", (data) => {
    lastServerState = data;
    if (data.players && data.players[myId]) {
        const serverMe = data.players[myId];
        const me = players[myId];
        if (me) {
            // reconciliation
            me.x = serverMe.x;
            me.y = serverMe.y;
        }
    }
});

const originalEmitInput = socket.emit.bind(socket);
socket.emit = function(ev, payload) {
    if (ev === "input" && payload && players[myId]) {
        clientTick++;
        payload._ctick = clientTick;
        pendingInputs.push(payload);
        applyLocalPrediction(players[myId], payload);
    }
    return originalEmitInput(ev, payload);
};
