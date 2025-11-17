import { Navigate } from "react-router-dom";

export default function RequireAuth({ children, allowedRoles }) {
  const usuario = JSON.parse(localStorage.getItem("usuario"));

  // No existe usuario
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Si tiene restricciones de rol
  if (allowedRoles && !allowedRoles.includes(usuario.rol)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
