import { useState, useEffect } from "react";
import sodium from "libsodium-wrappers";
import { decryptPrivateKey, verifyContainer } from "../crypto/keyPair";
import { decryptFile } from "../crypto/chachaEncrypt";
import { downloadBlob } from "../crypto/dataUtils";
import { getSharedWithMe, downloadSharedFile } from "../services/fileService";
import { sendErrorLog } from "../services/errorLogService";

const truncateSig = (hex) =>
  hex ? `${hex.slice(0, 20)}…${hex.slice(-20)}` : "—";

function SigBadge({ status }) {
  if (status === "loading")  return <span className="sig-badge sig-loading">⏳ Verificando…</span>;
  if (status === "valid")    return <span className="sig-badge sig-valid">✅ Firma válida</span>;
  if (status === "invalid")  return <span className="sig-badge sig-invalid">❌ Firma inválida</span>;
  if (status === "unsigned") return <span className="sig-badge sig-unsigned">⚠️ Sin firma</span>;
  if (status === "error")    return <span className="sig-badge sig-invalid">❌ Error al verificar</span>;
  return null;
}

function DecryptShared({ usuario }) {
  const [sharedFiles, setSharedFiles]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [message, setMessage]           = useState("");
  const [privateKeyFile, setPrivateKeyFile] = useState(null);
  const [password, setPassword]         = useState("");
  const [decrypting, setDecrypting]     = useState(null);
  const [ownKeyCopied, setOwnKeyCopied] = useState(false);

  // { [file_id]: "loading" | "valid" | "invalid" | "unsigned" | "error" }
  const [verifyResults, setVerifyResults] = useState({});
  // file_id whose signature panel is expanded
  const [expandedSig, setExpandedSig]   = useState(null);
  // { [file_id]: string } — manual public key typed by user for verification
  const [manualPubKeys, setManualPubKeys] = useState({});

  useEffect(() => { loadSharedFiles(); }, []);

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
    if (file) { setPrivateKeyFile(file); setMessage(""); }
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

  const handleVerify = async (sharedFile) => {
    if (!sharedFile.signature) {
      setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: "unsigned" }));
      return;
    }

    // Use manually entered public key if provided, otherwise use the one from the API
    const pubKey = manualPubKeys[sharedFile.file_id]?.trim() || sharedFile.signer_signing_public_key;
    if (!pubKey) {
      setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: "error" }));
      return;
    }

    setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: "loading" }));
    try {
      await sodium.ready;
      const fileRes = await downloadSharedFile(sharedFile.file_id);
      const encryptedBytes = new Uint8Array(fileRes.data);
      const sortedShares = [...(sharedFile.all_shares || [])].sort((a, b) => a.user_id - b.user_id);
      const isValid = await verifyContainer(encryptedBytes, sortedShares, sharedFile.signature, pubKey);
      setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: isValid ? "valid" : "invalid" }));
    } catch {
      setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: "error" }));
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

      const privKeyBuffer = await privateKeyFile.arrayBuffer();
      const keys = await decryptPrivateKey(new Uint8Array(privKeyBuffer), password);

      const publicKey = sodium.from_hex(usuario.public_key);
      const encryptedSymKey = sodium.from_hex(sharedFile.encrypted_symmetric_key);
      const symmetricKey = sodium.crypto_box_seal_open(encryptedSymKey, publicKey, keys.x25519);

      if (!symmetricKey) {
        setMessage("❌ No se pudo descifrar la llave simétrica. Clave privada incorrecta.");
        setDecrypting(null);
        return;
      }

      const fileRes = await downloadSharedFile(sharedFile.file_id);
      const encryptedFileBuffer = new Uint8Array(fileRes.data);

      const { signature, signer_signing_public_key, all_shares } = sharedFile;
      if (signature && signer_signing_public_key && Array.isArray(all_shares) && all_shares.length > 0) {
        const sortedShares = [...all_shares].sort((a, b) => a.user_id - b.user_id);
        const isValid = await verifyContainer(
          encryptedFileBuffer, sortedShares, signature, signer_signing_public_key
        );
        setVerifyResults((prev) => ({ ...prev, [sharedFile.file_id]: isValid ? "valid" : "invalid" }));
        if (!isValid) {
          setMessage("❌ FIRMA INVÁLIDA: El archivo fue alterado o la firma no es auténtica. Descifrado rechazado.");
          await sendErrorLog({
            module: "DecryptShared.handleDecrypt",
            publicMessage: "SIGNATURE_INVALID: firma digital no verificada",
            internalReason: `fileId=${sharedFile.file_id} signer_id=${sharedFile.signer_id}`,
            details: "verifyContainer returned false",
          });
          setDecrypting(null);
          return;
        }
      }

      const signatureStatus =
        signature && signer_signing_public_key ? "✅ Firma verificada" : "⚠️ Sin firma digital";

      const symKeyHex = sodium.to_hex(symmetricKey);
      const { data: decryptedData, metadata } = await decryptFile(encryptedFileBuffer, symKeyHex);

      const originalName = metadata?.fileName || sharedFile.filename || "archivo_descifrado";
      const blob = new Blob([decryptedData]);
      downloadBlob(blob, originalName);

      setMessage(`${signatureStatus} — "${originalName}" descifrado y descargado`);
    } catch (err) {
      console.error("ERROR_DECRYPT:", err);
      await sendErrorLog({
        module: "DecryptShared.handleDecrypt",
        publicMessage: "DECRYPT_FAILED: archivo o credenciales inválidas",
        internalReason: err?.message || "UNKNOWN_ERROR",
        details: String(err),
      });
      setMessage("❌ No se pudo descifrar. Verifica tu clave privada y contraseña.");
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
        {usuario.signing_public_key && (
          <div className="decrypt-key-section" style={{ marginBottom: "1rem" }}>
            <h4>🪪 Tu clave pública de firma (Ed25519)</h4>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  fontSize: "0.72rem",
                  background: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  padding: "0.4rem 0.6rem",
                  wordBreak: "break-all",
                  color: "#555",
                  fontFamily: "monospace",
                }}
              >
                {usuario.signing_public_key}
              </code>
              <button
                className="copy-key-btn"
                title="Copiar tu clave pública de firma"
                onClick={async () => {
                  await navigator.clipboard.writeText(usuario.signing_public_key);
                  setOwnKeyCopied(true);
                  setTimeout(() => setOwnKeyCopied(false), 1500);
                }}
              >
                {ownKeyCopied ? "✓" : "📋"}
              </button>
            </div>
            <small style={{ color: "#999", fontSize: "0.75rem" }}>
              Comparte esta clave con otros para que puedan verificar tus firmas.
            </small>
          </div>
        )}

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
                    {sf.owner && (
                      <span className="shared-file-owner">de {sf.owner}</span>
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
                      className="shared-file-sig-btn"
                      title={sf.signature ? "Ver detalles de firma" : "Sin firma digital"}
                      onClick={() =>
                        setExpandedSig((prev) => (prev === sf.file_id ? null : sf.file_id))
                      }
                    >
                      {sf.signature ? "🔏" : "⚠️"}
                    </button>
                    <button
                      className="shared-file-decrypt-btn"
                      onClick={() => handleDecrypt(sf)}
                      disabled={decrypting === sf.file_id || !privateKeyFile || !password}
                    >
                      {decrypting === sf.file_id ? "Descifrando…" : "🔓 Descifrar"}
                    </button>
                  </div>

                  {expandedSig === sf.file_id && (
                    <div className="sig-panel">
                      <div className="sig-panel-row">
                        <span className="sig-label">Algoritmo</span>
                        <span className="sig-value">Ed25519 + SHA-512</span>
                      </div>
                      <div className="sig-panel-row">
                        <span className="sig-label">Firmante</span>
                        <span className="sig-value">{sf.owner || `ID ${sf.signer_id}`}</span>
                      </div>
                      <div className="sig-panel-row">
                        <span className="sig-label">Firma</span>
                        <span className="sig-value sig-hex">
                          {sf.signature ? truncateSig(sf.signature) : "— sin firma —"}
                        </span>
                      </div>
                      <div className="sig-panel-row">
                        <span className="sig-label">Estado</span>
                        <span className="sig-value">
                          {verifyResults[sf.file_id]
                            ? <SigBadge status={verifyResults[sf.file_id]} />
                            : <span style={{ color: "#888", fontSize: "0.8rem" }}>No verificado aún</span>
                          }
                        </span>
                      </div>

                      {sf.signature && (
                        <>
                          <div className="sig-pubkey-row">
                            <label className="sig-label" htmlFor={`pubkey-${sf.file_id}`}>
                              Clave pública Ed25519 del firmante
                            </label>
                            <input
                              id={`pubkey-${sf.file_id}`}
                              type="text"
                              className="sig-pubkey-input"
                              placeholder={
                                sf.signer_signing_public_key
                                  ? `${sf.signer_signing_public_key.slice(0, 24)}… (del sistema)`
                                  : "Pegar clave pública en hex…"
                              }
                              value={manualPubKeys[sf.file_id] || ""}
                              onChange={(e) =>
                                setManualPubKeys((prev) => ({
                                  ...prev,
                                  [sf.file_id]: e.target.value,
                                }))
                              }
                              spellCheck={false}
                            />
                          </div>
                          <small className="sig-pubkey-hint">
                            Déjalo vacío para usar la clave registrada en el sistema. Pega una clave manualmente para verificar de forma independiente.
                          </small>
                          <button
                            className="sig-verify-btn"
                            onClick={() => handleVerify(sf)}
                            disabled={verifyResults[sf.file_id] === "loading"}
                          >
                            🔍 Verificar firma
                          </button>
                        </>
                      )}
                    </div>
                  )}
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
