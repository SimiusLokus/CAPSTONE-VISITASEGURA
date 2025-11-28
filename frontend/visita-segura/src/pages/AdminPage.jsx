import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  TablePagination,
  InputAdornment,
  Fade,
  Tooltip
} from "@mui/material";
import {
  Download,
  Person,
  PersonOutline,
  CalendarToday,
  Search,
  Dashboard as DashboardIcon
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import LogoutButton from "../components/LogoutButton";

function AdminPage() {
  const [visitas, setVisitas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [personasDentro, setPersonasDentro] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

const fetchVisitas = async (fecha) => {
  try {
    const url = fecha 
      ? `https://localhost:3001/visitas?fecha=${fecha}` 
      : "https://localhost:3001/visitas";
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error en la respuesta del servidor");
    
    const data = await response.json();
    const visitasMostradas = data.data || [];
    setVisitas(visitasMostradas);
    setTotalUsuarios(visitasMostradas.length);
    setPersonasDentro(visitasMostradas.filter(v => !v.hora_salida).length);
  } catch (error) {
    console.error("Error al cargar visitas:", error);
  }
};



  useEffect(() => {
    fetchVisitas(filtroFecha);
  }, [filtroFecha]);
  // WebSocket: actualizar tabla en tiempo real cuando el backend emite "visita_actualizada"
useEffect(() => {
  // crea conexión (ajusta la URL si tu backend no está en localhost)
  const socket = io("https://localhost:3001", {
    transports: ["websocket"],
    secure: true,
  });

  socket.on("connect", () => {
    console.log("🟢 WS conectado:", socket.id);
  });

  // escucha el evento que emite tu backend
  socket.on("visita_actualizada", (payload) => {
    console.log("🔔 evento visita_actualizada recibido:", payload);
    fetchVisitas(filtroFecha); // vuelve a cargar la lista según el filtro actual
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 WS desconectado:", reason);
  });

  return () => {
    socket.off("visita_actualizada");
    socket.disconnect();
  };
}, [filtroFecha]); // re-conecta si cambia el filtroFecha (igual que tu fetch)

  const exportarExcel = () => {
    if (visitas.length === 0) return;

    const dataExport = visitas.map((v, idx) => ({
      "#": idx + 1,
      RUN: v.run,
      Nombres: v.nombres,
      Apellidos: v.apellidos,
      "Tipo Evento": v.tipo_evento,
      Fecha: v.fecha,
      "Hora Entrada": v.hora_entrada,
      "Hora Salida": v.hora_salida || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visitas");

    const fechaStr = filtroFecha || new Date().toISOString().split("T")[0];
    const fileName = `reporte-${fechaStr}.xlsx`;

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, fileName);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredVisitas = visitas.filter(v => 
    v.run?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.apellidos?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedVisitas = filteredVisitas.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "#f5f7fa" }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: "#1976d2" }}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Panel Administrativo
          </Typography>
          <Tooltip title="Cerrar sesión">
            <IconButton color="inherit">
              <div>
                <LogoutButton />
              </div>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Fade in timeout={800}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: "#1a237e", mb: 1 }}>
              Bienvenido, Administrador
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Gestiona y monitorea el registro de visitas en tiempo real
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={2} sx={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-4px)" }
                }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {totalUsuarios}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Total Registros
                        </Typography>
                      </Box>
                      <Person sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={2} sx={{ 
                  background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  color: "white",
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-4px)" }
                }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {personasDentro}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Personas Dentro
                        </Typography>
                      </Box>
                      <PersonOutline sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={2} sx={{ 
                  background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  color: "white",
                  transition: "transform 0.2s",
                  "&:hover": { transform: "translateY(-4px)" }
                }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                          {totalUsuarios - personasDentro}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Salidas Registradas
                        </Typography>
                      </Box>
                      <CalendarToday sx={{ fontSize: 60, opacity: 0.3 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Box display="flex" flexWrap="wrap" gap={2} alignItems="center" sx={{ mb: 3 }}>
                <TextField
                  type="date"
                  label="Filtrar por fecha"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  sx={{ minWidth: 200 }}
                />
                
                <TextField
                  placeholder="Buscar por RUN, nombre o apellido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{ flexGrow: 1, minWidth: 250 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  variant="contained"
                  startIcon={<Download />}
                  onClick={exportarExcel}
                  disabled={visitas.length === 0}
                  sx={{ 
                    bgcolor: "#4caf50",
                    "&:hover": { bgcolor: "#388e3c" },
                    textTransform: "none",
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  Exportar Excel
                </Button>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>RUN</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Nombres</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Apellidos</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tipo Evento</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Hora Entrada</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Hora Salida</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedVisitas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                          <Typography variant="body1">
                            No hay registros para mostrar
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedVisitas.map((v, idx) => (
                        <TableRow
                          key={v.id}
                          sx={{
                            "&:hover": { bgcolor: "#f5f5f5" },
                            transition: "background-color 0.2s"
                          }}
                        >
                          <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{v.run}</TableCell>
                          <TableCell>{v.nombres}</TableCell>
                          <TableCell>{v.apellidos}</TableCell>
                          <TableCell>
                            <Chip 
                              label={v.tipo_evento} 
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{v.fecha}</TableCell>
                          <TableCell>{v.hora_entrada}</TableCell>
                          <TableCell>
                            {v.hora_salida ? (
                              v.hora_salida
                            ) : (
                              <Chip label="Dentro" size="small" color="success" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filteredVisitas.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Filas por página:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} de ${count}`
                }
              />
            </Paper>
          </Box>
        </Fade>
      </Container>

      <Box component="footer" sx={{ py: 3, px: 2, mt: "auto", bgcolor: "#1a237e", color: "white" }}>
        <Container maxWidth="xl">
          <Typography variant="body2" align="center">
            © {new Date().getFullYear()} Sistema de Registro de Visitas
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default AdminPage;