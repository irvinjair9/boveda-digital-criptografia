import EncryptShare from "../components/EncryptShare";
import DecryptShared from "../components/DecryptShared";
import "../styles/Dashboard.css";

function Dashboard({ usuario }) {
  return (
    <div className="dashboard">
      <div className="dashboard-greeting">
        <h1>¡Hola {usuario?.name || usuario?.username}!</h1>
      </div>

      <div className="dashboard-panels">
        <EncryptShare usuario={usuario} />
        <DecryptShared usuario={usuario} />
      </div>
    </div>
  );
}

export default Dashboard;