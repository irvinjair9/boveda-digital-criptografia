import { useState, useEffect } from "react";
import sodium from "libsodium-wrappers";
import { encryptFile } from "../crypto/chachaEncrypt";
import { fileToUint8Array } from "../crypto/dataUtils";
import { getUsers, uploadSharedFile } from "../services/fileService";

function EncryptShare({ usuario }) {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      // Filtrar al usuario actual y solo usuarios con clave pública
      const others = (res.data || []).filter(
        (u) => u.id !== usuario.id && (u.public_key || u.publicKey)
      );
      setUsers(others);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage("");
    }
  };

  const handleEncryptAndShare = async () => {
    if (!selectedFile) {
      setMessage("⚠️ Selecciona un archivo primero");
      return;
    }
    if (selectedUsers.length === 0) {
      setMessage("⚠️ Selecciona al menos un usuario destinatario");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await sodium.ready;

      // 1. Encriptar el archivo con ChaCha20-Poly1305 (genera llave simétrica)
      const fileBuffer = await fileToUint8Array(selectedFile);
      const { encrypted, key, nonce } = await encryptFile(
        fileBuffer,
        selectedFile.name,
        selectedFile.size
      );

      // 2. Cifrar la llave simétrica con la clave pública de cada usuario seleccionado
      const keyBytes = sodium.from_hex(key);
      const shares = [];

      for (const userId of selectedUsers) {
        const user = users.find((u) => u.id === userId);
        if (!user?.public_key) {
          setMessage(`❌ El usuario ${user?.username || userId} no tiene clave pública`);
          setLoading(false);
          return;
        }

        const recipientPubKey = sodium.from_hex(user.public_key);

        // crypto_box_seal: cifrado anónimo con la clave pública del destinatario
        const encryptedKey = sodium.crypto_box_seal(keyBytes, recipientPubKey);

        shares.push({
          user_id: userId,
          encrypted_symmetric_key: sodium.to_hex(encryptedKey),
        });
      }

      // 3. Enviar al backend
      const formData = new FormData();
      formData.append("file", new Blob([encrypted]), selectedFile.name + ".encrypted");
      formData.append("filename", selectedFile.name);
      formData.append("owner_id", usuario.id);
      formData.append("iv", nonce);
      formData.append("shares", JSON.stringify(shares));

      await uploadSharedFile(formData);

      setMessage("✅ Archivo encriptado y compartido exitosamente");
      setSelectedFile(null);
      setSelectedUsers([]);
    } catch (err) {
      setMessage(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="share-panel">
      <div className="share-panel-header">
        <span className="share-panel-icon">🔒</span>
        <h3>Encriptar y Compartir</h3>
        <p>Cifra un archivo y elige quién puede descifrarlo</p>
      </div>

      <div className="share-panel-body">
        {/* Zona de archivo */}
        <div
          className="share-drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="encrypt-file-input"
            onChange={handleFileSelect}
            className="hidden-input"
          />
          <label htmlFor="encrypt-file-input" className="share-drop-label">
            {selectedFile ? (
              <>
                <span className="share-file-icon">✓</span>
                <strong>{selectedFile.name}</strong>
                <small>{(selectedFile.size / 1024).toFixed(2)} KB</small>
              </>
            ) : (
              <>
                <span className="share-file-icon">📎</span>
                <strong>Arrastra un archivo aquí</strong>
                <small>o haz clic para seleccionar</small>
              </>
            )}
          </label>
        </div>

        {/* Selección de usuarios */}
        <div className="share-users-section">
          <h4>👥 Seleccionar destinatarios</h4>
          {loadingUsers ? (
            <p className="share-loading">Cargando usuarios…</p>
          ) : users.length === 0 ? (
            <p className="share-empty">No hay usuarios con clave pública para compartir archivos</p>
          ) : (
            <div className="share-users-list">
              {users.map((u) => (
                <label
                  key={u.id}
                  className={`share-user-item ${selectedUsers.includes(u.id) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <span className="share-user-name">
                    {u.name} {u.last_name || ""}
                  </span>
                  <span className="share-user-username">@{u.username}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Botón de acción */}
        <button
          className="share-btn-action"
          onClick={handleEncryptAndShare}
          disabled={loading || !selectedFile || selectedUsers.length === 0}
        >
          {loading ? "Encriptando y subiendo…" : "🔒 Encriptar y Compartir"}
        </button>

        {message && (
          <div className={`share-message ${message.includes("❌") || message.includes("⚠️") ? "error" : "success"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default EncryptShare;
