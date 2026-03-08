import CryptoTool from "../components/CryptoTool";

function Dashboard() {
  return (
    <div>
      <h1 style={{ textAlign: 'center', color: 'white', marginTop: '2rem' }}>
        🔐 Bóveda Digital - Criptografía ChaCha20-Poly1305
      </h1>
      <CryptoTool />
    </div>
  );
}

export default Dashboard;