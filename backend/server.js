const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const https = require("https");
const fs = require("fs");
const os = require("os");

const app = express();
const PORT = 3001;

// Obtener IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
const LOCAL_IP = getLocalIP();

// CORS acceso desde frontend
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://localhost:3000",
      `http://${LOCAL_IP}:3000`,
      `https://${LOCAL_IP}:3000`,
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Base de datos
const db = new sqlite3.Database(
  path.join(__dirname, "../data/registros.db"),
  (err) => {
    if (err) console.error(err.message);
    else console.log("Conectado a SQLite");
  }
);

// 🔥 FIX SQLITE_BUSY
db.serialize();
db.run("PRAGMA busy_timeout = 5000");  
db.run("PRAGMA journal_mode = WAL");   

// Crear tablas
db.run(`
 CREATE TABLE IF NOT EXISTS visitas (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   run TEXT,
   nombres TEXT,
   apellidos TEXT,
   fecha_nac TEXT,
   sexo TEXT,
   num_doc TEXT,
   tipo_evento TEXT,
   fecha TEXT,
   hora_entrada TEXT,
   hora_salida TEXT
 )
`);

db.run(`
 CREATE TABLE IF NOT EXISTS usuarios (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   username TEXT UNIQUE,
   password TEXT,
   rol TEXT
 )
`);

// -----------------------
//     ENDPOINT LOGIN
// -----------------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM usuarios WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ ok: false, error: "Error interno" });
      if (!row) return res.json({ ok: false, error: "Credenciales incorrectas" });
      return res.json({ ok: true, username: row.username, rol: row.rol });
    }
  );
});

// -----------------------
//     ENDPOINT VISITAS
// -----------------------
app.post("/visitas", (req, res) => {
  const {
    run,
    nombres = "no disponible",
    apellidos = "no disponible",
    fecha_nac = "no disponible",
    sexo = "no disponible",
    num_doc = "no disponible",
    tipo_evento = "Visita",
    accion,
  } = req.body;

  if (!run || !accion) return res.status(400).json({ ok: false, error: "Falta run o accion" });

  const ahora = new Date();
  const fecha = ahora.toISOString().split("T")[0];
  const hora_entrada = ahora.toTimeString().split(" ")[0];

  db.get(`SELECT * FROM visitas WHERE run = ? ORDER BY id DESC LIMIT 1`, [run], (err, ultimo) => {
    if (err) return res.status(500).json({ ok: false, error: "Error en BD" });

    // -------------------------
    //        ENTRADA
    // -------------------------
    if (accion === "entrada") {
      if (ultimo && ultimo.hora_entrada && !ultimo.hora_salida) {
        return res.status(400).json({ ok: false, error: "Usuario ya registrado" });
      }

      const insertSql = `
        INSERT INTO visitas (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, hora_salida)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `;
      db.run(insertSql, [run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada], function (insErr) {
        if (insErr) return res.status(500).json({ ok: false, error: "Error al crear entrada" });

        // 🔥 EMITIR EVENTO WEBSOCKET
        io.emit("visita_actualizada", {
          tipo: "entrada",
          id: this.lastID,
          run,
          tipo_evento,
          fecha,
          hora_entrada,
        });

        return res.json({
          ok: true,
          tipo: "entrada",
          mensaje: "Entrada registrada",
          id: this.lastID,
          fecha,
          hora_entrada,
          tipo_evento,
        });
      });
    }

    // -------------------------
    //          SALIDA
    // -------------------------
    else if (accion === "salida") {
      db.get(
        `SELECT * FROM visitas 
         WHERE run = ?
         AND hora_entrada IS NOT NULL
         AND (hora_salida IS NULL OR hora_salida = '')
         ORDER BY id DESC LIMIT 1`,
        [run],
        (openErr, abierto) => {
          if (openErr) return res.status(500).json({ ok: false, error: "Error en BD" });

          if (!abierto) return res.status(400).json({ ok: false, error: "Usuario ya posee registro" });

          const hora_salida = new Date().toTimeString().split(" ")[0];

          db.run(`UPDATE visitas SET hora_salida = ? WHERE id = ?`, [hora_salida, abierto.id], function (updErr) {
            if (updErr) return res.status(500).json({ ok: false, error: "Error al registrar salida" });

            // 🔥 EMITIR EVENTO WEBSOCKET
            io.emit("visita_actualizada", {
              tipo: "salida",
              id: abierto.id,
              run,
              hora_salida,
            });

            return res.json({
              ok: true,
              tipo: "salida",
              mensaje: "Salida registrada",
              id: abierto.id,
              hora_salida,
            });
          });
        }
      );
    }

    else return res.status(400).json({ ok: false, error: "accion inválida" });
  });
});

// -----------------------
app.get("/visitas", (req, res) => {
  let sql = "SELECT * FROM visitas";
  const params = [];

  if (req.query.fecha) {
    sql += " WHERE fecha = ?";
    params.push(req.query.fecha);
  }

  sql += " ORDER BY id DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: "Error en BD" });
    return res.json({ ok: true, data: rows });
  });
});

// -----------------------
//        HTTPS + WS
// -----------------------
const options = {
  key: fs.readFileSync(path.join(__dirname, "./certs/localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "./certs/localhost.pem")),
};

const httpsServer = https.createServer(options, app);

// SOCKET.IO
const { Server } = require("socket.io");
const io = new Server(httpsServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://localhost:3000",
      `http://${LOCAL_IP}:3000`,
      `https://${LOCAL_IP}:3000`,
    ],
  }
});

io.on("connection", () => {
  console.log("🔌 Cliente conectado a WebSocket");
});

// -----------------------
httpsServer.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Servidor HTTPS funcionando con CERTIFICADO");
  console.log(`   Local: https://localhost:${PORT}`);
  console.log(`   Red:   https://${LOCAL_IP}:${PORT}`);
});
