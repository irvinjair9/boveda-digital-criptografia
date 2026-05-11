import { useState, useEffect } from "react";
import sodium from "libsodium-wrappers";
import { encryptFile } from "../crypto/chachaEncrypt";
import { fileToUint8Array } from "../crypto/dataUtils";
import { decryptPrivateKey, signContainer } from "../crypto/keyPair";
import { getUsers, uploadSharedFile } from "../services/fileService";

function EncryptShare({ usuario }) {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [privateKeyFile, setPrivateKeyFile] = useState(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getUsers();
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

  const handleCopyKey = async (u) => {
    if (!u.signing_public_key) return;
    await navigator.clipboard.writeText(u.signing_public_key);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) { setSelectedFile(file); setMessage(""); }
  };

  const handlePrivateKeySelect = (e) => {
    const file = e.target.files[0];
    if (file) { setPrivateKeyFile(file); setMessage(""); }
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
    if (file) { setSelectedFile(file); setMessage(""); }
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
    if (!privateKeyFile) {
      setMessage("⚠️ Sube tu archivo de clave privada para firmar");
      return;
    }
    if (!password) {
      setMessage("⚠️ Ingresa tu contraseña");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await sodium.ready;

      // Decrypt the combined key file to get both private keys
      const privKeyBuffer = await privateKeyFile.arrayBuffer();
      const keys = await decryptPrivateKey(new Uint8Array(privKeyBuffer), password);

      if (!keys.ed25519) {
        setMessage("❌ Tu archivo de clave es antiguo y no contiene clave de firma. Crea una cuenta nueva.");
        setLoading(false);
        return;
      }

      const fileBuffer = await fileToUint8Array(selectedFile);
      const { encrypted, key, nonce } = await encryptFile(
        fileBuffer,
        selectedFile.name,
        selectedFile.size
      );

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
        const encryptedKey = sodium.crypto_box_seal(keyBytes, recipientPubKey);
        shares.push({
          user_id: userId,
          encrypted_symmetric_key: sodium.to_hex(encryptedKey),
        });
      }

      if (usuario?.public_key) {
        const ownerPubKey = sodium.from_hex(usuario.public_key);
        const encryptedKey = sodium.crypto_box_seal(keyBytes, ownerPubKey);
        shares.push({
          user_id: usuario.id,
          encrypted_symmetric_key: sodium.to_hex(encryptedKey),
        });
      }

      // Sign: SHA-512(encryptedBytes || canonicalize(sortedShares))
      const sortedShares = [...shares].sort((a, b) => a.user_id - b.user_id);
      const signature = await signContainer(encrypted, sortedShares, keys.ed25519);

      const formData = new FormData();
      formData.append("file", new Blob([encrypted]), selectedFile.name + ".encrypted");
      formData.append("filename", selectedFile.name);
      formData.append("owner_id", usuario.id);
      formData.append("iv", nonce);
      formData.append("shares", JSON.stringify(shares));
      formData.append("signature", signature);
      formData.append("signer_id", usuario.id);
      formData.append("signing_public_key", usuario.signing_public_key || "");

      await uploadSharedFile(formData);

      setMessage("✅ Archivo encriptado, firmado y compartido exitosamente");
      setSelectedFile(null);
      setSelectedUsers([]);
      setPassword("");
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

        <div className="share-users-section">
          <h4>👥 Seleccionar destinatarios</h4>
          {loadingUsers ? (
            <p className="share-loading">Cargando usuarios…</p>
          ) : users.length === 0 ? (
            <p className="share-empty">No hay otros usuarios con clave pública disponibles</p>
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
                  <button
                    className="copy-key-btn"
                    type="button"
                    title={
                      u.signing_public_key
                        ? "Copiar clave pública Ed25519 (firma)"
                        : "Este usuario no tiene clave de firma registrada (cuenta antigua)"
                    }
                    disabled={!u.signing_public_key}
                    onClick={(e) => { e.preventDefault(); handleCopyKey(u); }}
                  >
                    {copiedId === u.id ? "✓" : "📋"}
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="decrypt-key-section">
          <h4>✍️ Tu clave privada (para firmar)</h4>
          <div className="decrypt-key-row">
            <div className="decrypt-key-file">
              <input
                type="file"
                id="sign-privkey-input"
                onChange={handlePrivateKeySelect}
                accept=".encrypted"
                className="hidden-input"
              />
              <label htmlFor="sign-privkey-input" className="decrypt-key-label">
                {privateKeyFile ? (
                  <><span>✓</span> {privateKeyFile.name}</>
                ) : (
                  <><span>📁</span> Seleccionar clave privada</>
                )}
              </label>
            </div>
            <input
              type="password"
              className="decrypt-password-input"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          className="share-btn-action"
          onClick={handleEncryptAndShare}
          disabled={loading || !selectedFile || selectedUsers.length === 0 || !privateKeyFile || !password}
        >
          {loading ? "Encriptando y subiendo…" : "🔒 Encriptar, Firmar y Compartir"}
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
