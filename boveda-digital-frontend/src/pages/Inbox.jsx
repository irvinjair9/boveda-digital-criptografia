import { useState } from "react";
import FileInbox from "../components/FileInbox";

function Inbox() {
  const [message, setMessage] = useState("");

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>📬 Bandeja de Entrada</h1>
      <p>Archivos encriptados con ChaCha20-Poly1305</p>

      <FileInbox setMessage={setMessage} />

      {message && (
        <div style={{
          padding: '1rem',
          margin: '1rem 0',
          borderRadius: '5px',
          background: message.includes("❌") ? '#f8d7da' : '#d1edff',
          color: message.includes("❌") ? '#721c24' : '#0c5460',
          border: `1px solid ${message.includes("❌") ? '#f5c6cb' : '#bee5eb'}`
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default Inbox;