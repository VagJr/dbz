
/*
====================================================
 DRAGON BALL UNIVERSE — STABLE (POSTGRES EDITION)
 Persistence: PostgreSQL (Render)
 Gameplay / Physics / BP: UNCHANGED
====================================================
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require("pg");

/* =========================
   POSTGRES CONNECTION
   ========================= */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              name VARCHAR(32) UNIQUE NOT NULL,
              pass VARCHAR(64) NOT NULL,
              level INT DEFAULT 1,
              xp INT DEFAULT 0,
              bp INT DEFAULT 500
            );
        `);
        console.log("Postgres: tabela users pronta");
    } catch (err) {
        console.error("Erro ao preparar tabela users:", err);
    }
})();


/* =========================
   GAME STATE
   ========================= */
const TICK = 24;
const players = {};
let projectiles = [];
let npcs = [];
let rocks = [];
let craters = [];

/* =========================
   STATS & CAPS (UNCHANGED)
   ========================= */
const FORM_STATS = {
    BASE: { spd: 5, dmg: 1.0, hpMult: 1.0, kiMult: 1.0 },
    SSJ: { spd: 7, dmg: 1.5, hpMult: 1.5, kiMult: 1.2 },
    SSJ2: { spd: 8, dmg: 1.8, hpMult: 1.8, kiMult: 1.4 },
    SSJ3: { spd: 9, dmg: 2.2, hpMult: 2.2, kiMult: 1.5 },
    GOD: { spd: 11, dmg: 3.0, hpMult: 3.0, kiMult: 2.0 },
    BLUE: { spd: 13, dmg: 4.5, hpMult: 4.0, kiMult: 3.0 },
    UI: { spd: 16, dmg: 6.0, hpMult: 5.0, kiMult: 5.0 }
};

const BP_TRAIN_CAP = {
    BASE: 1200,
    SSJ: 2500,
    SSJ2: 5000,
    SSJ3: 9000,
    GOD: 16000,
    BLUE: 28000,
    UI: 45000
};

function getMaxBP(p) {
    const form = p.form || "BASE";
    const formCap = BP_TRAIN_CAP[form] || BP_TRAIN_CAP.BASE;
    return p.level * formCap;
}

function clampBP(p) {
    const maxBP = getMaxBP(p);
    if (p.bp > maxBP) p.bp = maxBP;
    if (p.bp < 0) p.bp = 0;
}

/* =========================
   HTTP SERVER
   ========================= */
const server = http.createServer((req, res) => {
    const safeUrl = req.url === "/" ? "/index.html" : req.url;
    const p = path.join(__dirname, safeUrl);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(p);
        const mime =
            ext === ".js" ? "application/javascript" :
            ext === ".html" ? "text/html" :
            "text/plain";
        res.writeHead(200, { "Content-Type": mime });
        fs.createReadStream(p).pipe(res);
    } else {
        res.writeHead(404);
        res.end();
    }
});

const io = new Server(server, { transports: ["websocket"] });

/* =========================
   SOCKET.IO
   ========================= */

function packStateForPlayer(pid) {
    const p = players[pid];
    if (!p) return null;

    const R = 4500;
    const inRange = (o) => Math.hypot(o.x - p.x, o.y - p.y) < R;

    return {
        players,
        npcs: npcs.filter(inRange),
        projectiles: projectiles.filter(inRange),
        rocks: rocks.filter(inRange),
        craters
    };
}

io.on("connection", (socket) => {

    socket.on("login", async (data) => {
        try {
            const res = await pool.query(
                "SELECT * FROM users WHERE name=$1",
                [data.user]
            );

            let user = res.rows[0];

            if (!user) {
                const insert = await pool.query(
                    "INSERT INTO users (name, pass) VALUES ($1,$2) RETURNING *",
                    [data.user, data.pass]
                );
                user = insert.rows[0];
            } else if (user.pass !== data.pass) {
                return;
            }

            players[socket.id] = {
                id: socket.id,
                name: user.name,
                level: user.level,
                xp: user.xp,
                bp: user.bp,
                r: 20,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                angle: 0,
                baseMaxHp: 1000 + user.level * 200,
                baseMaxKi: 100 + user.level * 10,
                hp: 1000 + user.level * 200,
                maxHp: 1000 + user.level * 200,
                ki: 100,
                maxKi: 100 + user.level * 10,
                form: "BASE",
                state: "IDLE",
                combo: 0,
                attackLock: 0,
                stun: 0,
                isDead: false,
                isSpirit: false
            };

            socket.emit("auth_success", players[socket.id]);
        } catch (e) {
            console.error("Login error:", e);
        }
    });

    socket.on("disconnect", async () => {
        const p = players[socket.id];
        if (p) {
            try {
                await pool.query(
                    "UPDATE users SET level=$1, xp=$2, bp=$3 WHERE name=$4",
                    [p.level, p.xp, p.bp, p.name]
                );
            } catch (e) {
                console.error("Save error:", e);
            }
        }
        delete players[socket.id];
    });
});

/* =========================
   GAME LOOP (UNCHANGED CORE)
   ========================= */
setInterval(() => {

    // 1. Atualiza lógica dos players
    Object.values(players).forEach(p => {
        if (!p.isDead && !p.isSpirit) {

            if (p.state === "CHARGING" && Math.random() > 0.85) {
                p.xp += 1;
                p.bp += 5;
                clampBP(p);
            }

            const xpReq = p.level * 800;
            if (p.xp >= xpReq) {
                p.level++;
                p.xp = 0;
                p.bp += 5000;
                clampBP(p);
            }
        }
    });

    // 2. Envia estado UMA VEZ por tick (correto)
    Object.keys(players).forEach(id => {
        const st = packStateForPlayer(id);
        if (st) io.to(id).emit("state", st);
    });

}, TICK);


server.listen(3000, () => {
    console.log("Dragon Ball Universe — Postgres STABLE ONLINE");
});
