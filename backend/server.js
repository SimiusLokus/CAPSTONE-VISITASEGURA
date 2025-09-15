const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const selfsigned = require("selfsigned");
const https = require("https");

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
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

// Endpoints
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

  const query =
    "INSERT INTO visitas(run,nombres,apellidos,fecha_nac,sexo,num_doc,tipo_evento,fecha_hora) VALUES(?,?,?,?,?,?,?,?)";
  db.run(
    query,
    [run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha_hora],
    function (err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    }
  );
});

// Generar certificado autofirmado dinámicamente
const attrs = [{ name: "commonName", value: "localhost" }];
const pems = selfsigned.generate(attrs, { days: 365 });

// Servidor HTTPS
https.createServer({ key: pems.private, cert: pems.cert }, app).listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(`Servidor HTTPS corriendo en https://0.0.0.0:${PORT}`);
  }
);
