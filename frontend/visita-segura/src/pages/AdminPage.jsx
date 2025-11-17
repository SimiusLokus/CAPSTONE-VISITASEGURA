import LogoutButton from "../components/LogoutButton";

function AdminPage() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Hola Administrador</h1>
      <p>Bienvenido al panel administrativo.</p>

      {/* Botón de cerrar sesión */}
      <LogoutButton />
    </div>
  );
}

export default AdminPage;
