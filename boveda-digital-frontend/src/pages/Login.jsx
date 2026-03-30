import { useState } from "react";
import { login, register } from "../services/authService";
import { downloadBlob } from "../crypto/dataUtils";
import "../styles/Login.css";

function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regForm, setRegForm] = useState({
    name: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
  });

  const handleRegChange = (e) => {
    setRegForm({ ...regForm, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      onLoginSuccess(data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Credenciales incorrectas";
      setError(typeof msg === "string" ? msg : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await register(regForm);

      // Descargar automáticamente la clave privada cifrada
      const blob = new Blob([result.encryptedPrivateKey], { type: "application/octet-stream" });
      downloadBlob(blob, `${regForm.username}_private_key.encrypted`);

      setSuccess("Registro exitoso. Tu clave privada cifrada se ha descargado. Ya puedes iniciar sesión.");
      setRegForm({
        name: "",
        lastName: "",
        username: "",
        email: "",
        password: "",
      });
      setTimeout(() => {
        setIsRegister(false);
        setSuccess("");
      }, 2000);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Error al registrar";
      setError(typeof msg === "string" ? msg : "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError("");
    setSuccess("");
  };

  return (
    <div className="login-wrapper">
      <div className={`login-form ${isRegister ? "login-form--register" : ""}`}>
        <div className="login-header">
          <span className="login-icon">{isRegister ? "📝" : "🔐"}</span>
          <h2>Bóveda Digital</h2>
          <p>{isRegister ? "Crea tu cuenta" : "Inicia sesión para continuar"}</p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {!isRegister ? (
          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="login-field">
              <label htmlFor="reg-name">Nombre</label>
              <input
                id="reg-name"
                name="name"
                type="text"
                placeholder="Nombre"
                value={regForm.name}
                onChange={handleRegChange}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-lastName">Apellido</label>
              <input
                id="reg-lastName"
                name="lastName"
                type="text"
                placeholder="Apellido"
                value={regForm.lastName}
                onChange={handleRegChange}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-username">Nombre de Usuario</label>
              <input
                id="reg-username"
                name="username"
                type="text"
                placeholder="Nombre de usuario"
                value={regForm.username}
                onChange={handleRegChange}
                required
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-email">Correo</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={regForm.email}
                onChange={handleRegChange}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                name="password"
                type="password"
                placeholder="Contraseña"
                value={regForm.password}
                onChange={handleRegChange}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Registrando…" : "Crear cuenta"}
            </button>
          </form>
        )}

        <div className="login-toggle">
          {isRegister ? (
            <p>¿Ya tienes cuenta? <button type="button" onClick={switchMode}>Inicia sesión</button></p>
          ) : (
            <p>¿No tienes cuenta? <button type="button" onClick={switchMode}>Regístrate</button></p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
