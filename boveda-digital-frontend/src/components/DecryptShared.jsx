import { useState, useEffect } from "react";
import sodium from "libsodium-wrappers";
import { decryptPrivateKey } from "../crypto/keyPair";
import { decryptFile } from "../crypto/chachaEncrypt";
import { downloadBlob } from "../crypto/dataUtils";
import { getSharedWithMe, downloadSharedFile } from "../services/fileService";
import { sendErrorLog } from "../services/errorLogService";

function DecryptShared({ usuario }) {
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Estado para el flujo de desencriptación
  const [privateKeyFile, setPrivateKeyFile] = useState(null);
  const [password, setPassword] = useState("");
  const [decrypting, setDecrypting] = useState(null); // id del archivo que se está desencriptando

  useEffect(() => {
    loadSharedFiles();
  }, []);

  const loadSharedFiles = async () => {
    try {
      const res = await getSharedWithMe(usuario.id);
      setSharedFiles(res.data || []);
    } catch (err) {
      console.error("Error al cargar archivos compartidos:", err);
      setSharedFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateKeySelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPrivateKeyFile(file);
      setMessage("");
    }
  };

  const handleDownloadEncrypted = async (sharedFile) => {
    try {
      const fileRes = await downloadSharedFile(sharedFile.file_id);
      const blob = new Blob([fileRes.data], { type: "application/octet-stream" });
      downloadBlob(blob, (sharedFile.filename || "archivo") + ".encrypted");
    } catch (err) {
      setMessage(`❌ Error al descargar: ${err.message}`);
    }
  };

  const handleDecrypt = async (sharedFile) => {
    if (!privateKeyFile) {
      setMessage("⚠️ Sube tu archivo de clave privada (.encrypted)");
      return;
    }
    if (!password) {
      setMessage("⚠️ Ingresa tu contraseña para descifrar la clave privada");
      return;
    }

    setDecrypting(sharedFile.file_id);
    setMessage("");

    try {
      await sodium.ready;

      // 1. Leer y descifrar la clave privada con la contraseña
      const privKeyBuffer = await privateKeyFile.arrayBuffer();
      const encryptedPrivKey = new Uint8Array(privKeyBuffer);
      const privateKey = await decryptPrivateKey(encryptedPrivKey, password);

      // 2. Descifrar la llave simétrica con crypto_box_seal_open
      //    Necesitamos la clave pública del propio usuario
      const publicKey = sodium.from_hex(usuario.public_key);
      const encryptedSymKey = sodium.from_hex(sharedFile.encrypted_symmetric_key);

      const symmetricKey = sodium.crypto_box_seal_open(encryptedSymKey, publicKey, privateKey);
      if (!symmetricKey) {
        setMessage("❌ No se pudo descifrar la llave simétrica. Clave privada incorrecta.");
        setDecrypting(null);
        return;
      }

      // 3. Descargar el archivo cifrado del servidor
      const fileRes = await downloadSharedFile(sharedFile.file_id);
      const encryptedFileBuffer = new Uint8Array(fileRes.data);

      // 4. Descifrar el archivo con la llave simétrica
      const symKeyHex = sodium.to_hex(symmetricKey);
      const { data: decryptedData, metadata } = await decryptFile(
        encryptedFileBuffer,
        symKeyHex
      );

      // 5. Descargar automáticamente
      const originalName = metadata?.fileName || sharedFile.filename || "archivo_descifrado";
      const blob = new Blob([decryptedData]);
      downloadBlob(blob, originalName);

      setMessage(`✅ Archivo "${originalName}" descifrado y descargado`);
    } catch (err) {
      console.log("ERROR_REAL_DECRYPT:", err);

      await sendErrorLog({
        module: "DecryptShared.handleDecrypt",
        publicMessage: "DECRYPT_FAILED: archivo o credenciales inválidas",
        internalReason: err?.message || "UNKNOWN_ERROR",
        details: String(err)
      });

      setMessage("❌ DECRYPT_FAILED: archivo o credenciales inválidas");
    } finally {
      setDecrypting(null);
    }
  };

  return (
    <div className="share-panel">
      <div className="share-panel-header decrypt">
        <span className="share-panel-icon">🔓</span>
        <h3>Archivos Compartidos</h3>
        <p>Descifra archivos que te han compartido</p>
      </div>

      <div className="share-panel-body">
        {/* Subir clave privada + contraseña */}
        <div className="decrypt-key-section">
          <h4>🔑 Tu clave privada</h4>
          <div className="decrypt-key-row">
            <div className="decrypt-key-file">
              <input
                type="file"
                id="privkey-input"
                onChange={handlePrivateKeySelect}
                accept=".encrypted"
                className="hidden-input"
              />
              <label htmlFor="privkey-input" className="decrypt-key-label">
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

        {/* Lista de archivos compartidos */}
        <div className="shared-files-section">
          <h4>📂 Archivos disponibles</h4>
          {loading ? (
            <p className="share-loading">Cargando archivos…</p>
          ) : sharedFiles.length === 0 ? (
            <p className="share-empty">No tienes archivos compartidos</p>
          ) : (
            <div className="shared-files-list">
              {sharedFiles.map((sf) => (
                <div key={sf.file_id} className="shared-file-item">
                  <div className="shared-file-info">
                    <span className="shared-file-name">📄 {sf.filename}</span>
                    {sf.owner_name && (
                      <span className="shared-file-owner">de {sf.owner_name}</span>
                    )}
                  </div>
                  <div className="shared-file-actions">
                    <button
                      className="shared-file-download-btn"
                      onClick={() => handleDownloadEncrypted(sf)}
                    >
                      ⬇️ Descargar
                    </button>
                    <button
                      className="shared-file-decrypt-btn"
                      onClick={() => handleDecrypt(sf)}
                      disabled={decrypting === sf.file_id || !privateKeyFile || !password}
                    >
                      {decrypting === sf.file_id ? "Descifrando…" : "🔓 Descifrar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {message && (
          <div className={`share-message ${message.includes("❌") || message.includes("⚠️") ? "error" : "success"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default DecryptShared;
