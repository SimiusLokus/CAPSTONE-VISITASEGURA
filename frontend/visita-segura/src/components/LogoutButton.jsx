import { Button } from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  return (
    <Button
      variant="contained"
      onClick={handleLogout}
      sx={{
        backgroundColor: "#FFB71C",
        "&:hover": { backgroundColor: "#a93226" },

        // 🔴 tamaño responsivo del botón
        width: { xs: 40, sm: 44, md: 48, lg: 52 },
        height: { xs: 40, sm: 44, md: 48, lg: 52 },

        // ❗ DESACTIVAR el minWidth por defecto de MUI
        minWidth: "unset",

        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      <PowerSettingsNewIcon
        sx={{
          color: "white",
          // 🔥 ícono más grande y responsivo
          fontSize: { xs: 22, sm: 26, md: 30, lg: 32 },
        }}
      />
    </Button>
  );
}

export default LogoutButton;
