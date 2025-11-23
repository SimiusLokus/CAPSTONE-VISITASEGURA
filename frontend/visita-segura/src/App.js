import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import Login from "./pages/Login";
import QRScanner from "./pages/QRScanner";
import RequireAuth from "./components/RequireAuth";


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login libre */}
        <Route path="/login" element={<Login />} />

        {/* Redirigir / a /login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Scanner (solo security) */}
        <Route
          path="/scanner"
          element={
            <RequireAuth allowedRoles={["security"]}>
              <QRScanner />
            </RequireAuth>
          }
        />

        {/* Panel Administrador */}
        <Route
          path="/admin"
          element={
            <RequireAuth allowedRoles={["admin"]}>
              <AdminPage />
            </RequireAuth>
          }
        />

        {/* Panel Supervisor */}
        <Route
          path="/supervisor"
          element={
            <RequireAuth allowedRoles={["supervisor"]}>
              <h2>Panel Supervisor</h2>
            </RequireAuth>
          }
        />

        {/* Ruta catch-all */}
        <Route path="*" element={<Navigate to="/login" />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
