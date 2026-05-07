import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";

function App() {
  const [usuario, setUsuario] = useState(() => {
    const saved = sessionStorage.getItem("usuario");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (data) => {
    sessionStorage.setItem("usuario", JSON.stringify(data));
    setUsuario(data);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("usuario");
    setUsuario(null);
  };

  if (!usuario) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Navigation usuario={usuario} onLogout={handleLogout} />
      <div style={{ marginTop: "70px" }}>
        <Routes>
          <Route path="/" element={<Dashboard usuario={usuario} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
