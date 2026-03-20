import { Link } from "react-router-dom";
import "../styles/Navigation.css";

function Navigation({ usuario, onLogout }) {
  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          🔐 Bóveda Digital
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className="nav-link">
              🔐 Encriptar
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/inbox" className="nav-link">
              📬 Bandeja
            </Link>
          </li>
          <li className="nav-item nav-user">
            <span className="nav-username">👤 {usuario?.username}</span>
            <button className="nav-logout" onClick={onLogout}>
              Salir
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;
