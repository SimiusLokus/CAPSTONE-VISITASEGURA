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
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    `http://${LOCAL_IP}:3000`,
    `https://${LOCAL_IP}:3000`,
  ],
  credentials: true
}));

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

// Crear tabla visitas
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
    fecha_hora TEXT
  )
`);

// Crear tabla usuarios
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    rol TEXT
  )
`);


// ---- ENDPOINTS ----

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM usuarios WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err) {
        return res.status(500).json({ ok: false, error: "Error interno" });
      }

      if (!row) {
        return res.json({ ok: false, error: "Credenciales incorrectas" });
      }

      return res.json({
        ok: true,
        username: row.username,
        rol: row.rol
      });
    }
  );
});

app.post("/visitas", (req, res) => {
  const { run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha_hora } = req.body;

  const query = `
    INSERT INTO visitas (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha_hora)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha_hora],
    function(err) {
      if (err) {
        console.error("❌ ERROR DB:", err.message);
        return res.status(500).json({ ok: false, error: "Error al guardar en DB" });
      }

      console.log("✅ Visita guardada:", this.lastID);
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

// ========= NUEVA CONFIGURACIÓN HTTPS REAL (MKCERT) =========

// ⚠️ QUITA TODO LO DE SELFSIGNED
// ⚠️ AGREGA RUTA A LOS CERTIFICADOS DE MKCERT

const options = {
  key: fs.readFileSync(path.join(__dirname, "./certs/localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "./certs/localhost.pem")),
};

// Servidor HTTPS confiable
https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Servidor HTTPS funcionando con CERTIFICADO VÁLIDO");
  console.log(`   Local: https://localhost:${PORT}`);
  console.log(`   Red:   https://${LOCAL_IP}:${PORT}`);
});
