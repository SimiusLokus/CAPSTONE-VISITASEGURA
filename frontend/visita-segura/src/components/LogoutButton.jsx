import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // eliminar sesión
    localStorage.removeItem("usuario");

    // redirigir al login
    navigate("/login");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "10px 15px",
        background: "#c0392b",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer"
      }}
    >
      Cerrar sesión
    </button>
  );
}

export default LogoutButton;
