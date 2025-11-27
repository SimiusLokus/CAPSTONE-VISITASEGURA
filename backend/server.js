const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const https = require("https");
const fs = require("fs");
const os = require("os");
const { Server } = require("socket.io");

const { sincronizarDatosFicticios } = require("./servicios/querys/query_json_sql");
const { indexarRegistro } = require("./servicios/querys/index_qr_datos.js");
const { router: indexacionRouter } = require("./servicios/querys/index_qr_datos.js");

const ServicioHash = require("./servicios/seguridad/hash");
const CifradorAES = require("./servicios/seguridad/cifrado");
const cifradoRouter = require("./servicios/seguridad/cifrado_router");

const servicioHash = new ServicioHash();
const cifradorAES = new CifradorAES();

const app = express();
const PORT = 3001;

sincronizarDatosFicticios()
  .then(() => {
    console.log("Tabla datos_ficticios sincronizada exitosamente");
  })
  .catch((error) => {
    console.error("Error sincronizando datos ficticios:", error);
  });

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

app.use((req, res, next) => {
  const publicEndpoints = [
    '/login', 
    '/info', 
    '/api/cifrado/status',
    '/api/cifrado/procesar-qr',
    '/api/indexar',
    '/visitas'
  ];
  
  if (publicEndpoints.includes(req.path)) {
    return next();
  }
  servicioHash.middlewareProteccion()(req, res, next);
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    `http://${LOCAL_IP}:3000`,
    `https://${LOCAL_IP}:3000`,
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

app.use("/api/cifrado", cifradoRouter);
app.use("/api", indexacionRouter);

const db = new sqlite3.Database(
  path.join(__dirname, "../data/registros.db"),
  (err) => {
    if (err) console.error(err.message);
    else console.log("Conectado a SQLite");
  }
);

db.serialize();
db.run("PRAGMA busy_timeout = 5000");  
db.run("PRAGMA journal_mode = WAL");   

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
   hora_salida TEXT,
   datos_cifrados TEXT
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

app.get("/info", (req, res) => {
  res.json({ 
    message: "Servidor funcionando", 
    ip: LOCAL_IP,
    timestamp: new Date().toISOString()
  });
});

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

app.post("/visitas", async (req, res) => {
  try {
    const { accion, run, num_doc, datos_cifrados } = req.body;

    let datosCifradosParaBD = datos_cifrados;
    let runFinal = run;
    let numDocFinal = num_doc;

    if (datos_cifrados) {
      try {
        const datosOriginales = cifradorAES.descifrarDesdeBD(datos_cifrados);
        runFinal = datosOriginales.run;
        numDocFinal = datosOriginales.num_doc;
        console.log("Datos descifrados para RUN:", runFinal);
      } catch (error) {
        console.error("Error descifrando datos:", error);
      }
    }

    if (accion && (accion === "entrada" || accion === "salida")) {
      const {
        nombres = "no disponible",
        apellidos = "no disponible", 
        fecha_nac = "no disponible",
        sexo = "no disponible",
        tipo_evento = "Visita",
      } = req.body;

      if (!runFinal) return res.status(400).json({ ok: false, error: "Falta run" });

      const ahora = new Date();
      const fecha = ahora.toISOString().split("T")[0];
      const hora_entrada = ahora.toTimeString().split(" ")[0];

      db.get(`SELECT * FROM visitas WHERE run = ? ORDER BY id DESC LIMIT 1`, [runFinal], (err, ultimo) => {
        if (err) {
          console.error("Error DB SELECT ultimo:", err);
          return res.status(500).json({ ok: false, error: "Error en BD" });
        }

        if (accion === "entrada") {
          if (ultimo && ultimo.hora_entrada && !ultimo.hora_salida) {
            return res.status(400).json({ ok: false, error: "Usuario ya registrado" });
          }

          const insertSql = `
            INSERT INTO visitas (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, hora_salida, datos_cifrados)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
          `;
          db.run(insertSql, [runFinal, nombres, apellidos, fecha_nac, sexo, numDocFinal || "no disponible", tipo_evento, fecha, hora_entrada, datosCifradosParaBD || null], function (insErr) {
            if (insErr) {
              console.error("Error INSERT entrada:", insErr.message);
              return res.status(500).json({ ok: false, error: "Error al crear entrada" });
            }

            io.emit("visita_actualizada", {
              tipo: "entrada",
              id: this.lastID,
              run: runFinal,
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
              cifrado: !!datosCifradosParaBD
            });
          });
        }

        else if (accion === "salida") {
          db.get(
            `SELECT * FROM visitas 
             WHERE run = ? 
             AND hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id DESC LIMIT 1`,
            [runFinal],
            (openErr, abierto) => {
              if (openErr) {
                console.error("Error DB SELECT abierto:", openErr);
                return res.status(500).json({ ok: false, error: "Error en BD" });
              }

              if (!abierto) return res.status(400).json({ ok: false, error: "No tiene entrada registrada" });

              const hora_salida = new Date().toTimeString().split(" ")[0];
              db.run(`UPDATE visitas SET hora_salida = ? WHERE id = ?`, [hora_salida, abierto.id], function (updErr) {
                if (updErr) {
                  console.error("Error UPDATE salida:", updErr);
                  return res.status(500).json({ ok: false, error: "Error al registrar salida" });
                }

                io.emit("visita_actualizada", {
                  tipo: "salida",
                  id: abierto.id,
                  run: runFinal,
                  hora_salida,
                });

                return res.json({ 
                  ok: true, 
                  tipo: "salida", 
                  mensaje: "Salida registrada", 
                  id: abierto.id, 
                  hora_salida 
                });
              });
            }
          );
        }
      });
    }
    
    else if (runFinal && numDocFinal && !req.body.nombres) {
      console.log("Iniciando indexacion para RUN:", runFinal, "NumDoc:", numDocFinal);
      
      const resultadoIndexacion = await indexarRegistro(runFinal, numDocFinal);
      
      if (!resultadoIndexacion.exito) {
        console.error("Error en indexacion:", resultadoIndexacion.mensaje);
        return res.status(400).json({ 
          ok: false,
          error: resultadoIndexacion.mensaje 
        });
      }

      console.log("Indexacion exitosa, datos obtenidos:", resultadoIndexacion.registroIndexado);

      const registro = resultadoIndexacion.registroIndexado;
      const query = "INSERT INTO visitas(run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, datos_cifrados) VALUES(?,?,?,?,?,?,?,?,?,?)";
      
      const ahora = new Date();
      const fecha = ahora.toISOString().split("T")[0];
      const hora_entrada = ahora.toTimeString().split(" ")[0];
      
      db.run(
        query,
        [registro.run, registro.nombres, registro.apellidos, registro.fecha_nac, registro.sexo, registro.num_doc, registro.tipo_evento || "Visita", fecha, hora_entrada, datosCifradosParaBD || null],
        function (err) {
          if (err) {
            console.error("Error al guardar visita indexada:", err);
            return res.status(500).json({ ok: false, error: err.message });
          }
          
          console.log("Visita indexada guardada con ID:", this.lastID);
          console.log("Datos cifrados:", datosCifradosParaBD ? "SI" : "NO");

          io.emit("visita_actualizada", {
            tipo: "entrada",
            id: this.lastID,
            run: registro.run,
            tipo_evento: registro.tipo_evento || "Visita",
            fecha,
            hora_entrada,
            indexado: true
          });

          return res.json({ 
            ok: true,
            id: this.lastID,
            indexado: true,
            tipo: "entrada",
            mensaje: "Entrada registrada con indexacion",
            registro: registro,
            cifrado: !!datosCifradosParaBD
          });
        }
      );
    }
    
    else {
      const { nombres, apellidos, fecha_nac, sexo, tipo_evento = "Visita" } = req.body;
      
      const ahora = new Date();
      const fecha = ahora.toISOString().split("T")[0];
      const hora_entrada = ahora.toTimeString().split(" ")[0];
      
      const query = "INSERT INTO visitas(run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, datos_cifrados) VALUES(?,?,?,?,?,?,?,?,?,?)";
      db.run(
        query,
        [runFinal, nombres, apellidos, fecha_nac, sexo, numDocFinal, tipo_evento, fecha, hora_entrada, datosCifradosParaBD || null],
        function (err) {
          if (err) {
            console.error("Error al guardar:", err);
            return res.status(500).json({ ok: false, error: err.message });
          }
          
          console.log("Visita guardada con ID:", this.lastID);

          io.emit("visita_actualizada", {
            tipo: "entrada",
            id: this.lastID,
            run: runFinal,
            tipo_evento,
            fecha,
            hora_entrada,
          });

          return res.json({ 
            ok: true, 
            id: this.lastID,
            tipo: "entrada", 
            mensaje: "Entrada registrada",
            cifrado: !!datosCifradosParaBD
          });
        }
      );
    }

  } catch (error) {
    console.error("Error en endpoint visitas:", error);
    res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
});

app.get("/visitas", (req, res) => {
  let sql = "SELECT * FROM visitas";
  const params = [];

  if (req.query.fecha) {
    sql += " WHERE fecha = ?";
    params.push(req.query.fecha);
  }

  sql += " ORDER BY id DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Error SELECT visitas:", err.message);
      return res.status(500).json({ ok: false, error: "Error en BD" });
    }
    return res.json({ ok: true, data: rows });
  });
});

const options = {
  key: fs.readFileSync(path.join(__dirname, "./certs/localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "./certs/localhost.pem")),
};

const httpsServer = https.createServer(options, app);

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
  console.log("Cliente conectado a WebSocket");
});

httpsServer.listen(PORT, "0.0.0.0", () => {
  console.log("   Servidor HTTPS funcionando con CERTIFICADO");
  console.log(`   Local: https://localhost:${PORT}`);
  console.log(`   Red:   https://${LOCAL_IP}:${PORT}`);
  console.log("   Servicio de cifrado INTEGRADO");
  console.log("   Servicio de indexacion INTEGRADO");
});