const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const selfsigned = require("selfsigned");
const https = require("https");
const os = require("os");

const app = express();
const PORT = 3001;

// Función para obtener IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

// CORS configurado para permitir acceso desde la red
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:30000',
    `http://${LOCAL_IP}:3001`,
    `https://${LOCAL_IP}:3000`,
    // Agrega rangos de IP comunes para mayor compatibilidad
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Base de datos SQLite
const db = new sqlite3.Database(
  path.join(__dirname, "../data/registros.db"),
  (err) => {
    if (err) console.error(err.message);
    else console.log("Conectado a SQLite");
  }
);

// Crear tabla si no existe
db.run(
  `CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run TEXT,
    nombres TEXT,
    apellidos TEXT,
    fecha_nac TEXT,
    sexo TEXT,
    num_doc TEXT,
    tipo_evento TEXT,
    fecha_hora TEXT
  )`
);

// Endpoint para obtener info del servidor (útil para debugging)
app.get("/info", (req, res) => {
  res.json({ 
    message: "Servidor funcionando", 
    ip: LOCAL_IP,
    timestamp: new Date().toISOString()
  });
});

// Endpoints existentes
app.get("/visitas", (req, res) => {
  db.all("SELECT * FROM visitas", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post("/visitas", (req, res) => {
  const {
    run,
    nombres,
    apellidos,
    fecha_nac,
    sexo,
    num_doc,
    tipo_evento,
    fecha_hora,
  } = req.body;

  console.log("📝 Guardando visita:", { run, num_doc, fecha_hora });

  const query =
    "INSERT INTO visitas(run,nombres,apellidos,fecha_nac,sexo,num_doc,tipo_evento,fecha_hora) VALUES(?,?,?,?,?,?,?,?)";
  db.run(
    query,
    [run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha_hora],
    function (err) {
      if (err) {
        console.error("❌ Error al guardar:", err);
        res.status(500).json({ error: err.message });
      } else {
        console.log("✅ Visita guardada con ID:", this.lastID);
        res.json({ id: this.lastID });
      }
    }
  );
});

// Generar certificado con múltiples nombres
const attrs = [
  { name: "commonName", value: "localhost" },
  { name: "commonName", value: LOCAL_IP }
];

const altNames = [
  { type: 2, value: "localhost" },
  { type: 7, ip: "127.0.0.1" },
  { type: 7, ip: LOCAL_IP }
];

const pems = selfsigned.generate(attrs, { 
  days: 365,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: altNames
    }
  ]
});

// Servidor HTTPS
https.createServer({ key: pems.private, cert: pems.cert }, app).listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(`🚀 Servidor HTTPS corriendo en:`);
    console.log(`   Local:    https://localhost:${PORT}`);
    console.log(`   Red:      https://${LOCAL_IP}:${PORT}`);
    console.log(`   Móvil:    https://${LOCAL_IP}:${PORT}`);
    console.log(`\n📱 Para acceso desde móvil, usa: https://${LOCAL_IP}:${PORT}`);
  }
);