import { useState } from "react";
import sodium from "libsodium-wrappers";
import { encryptFile, decryptFile } from "../crypto/chachaEncrypt";
import { fileToUint8Array, uint8ArrayToBlob, downloadBlob, blobToUint8Array } from "../crypto/dataUtils";
import "../styles/CryptoTool.css";

function CryptoTool() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [encryptedData, setEncryptedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("encrypt"); // "encrypt" o "decrypt"
  const [keyInput, setKeyInput] = useState("");
  const [tagInput, setTagInput] = useState(""); // Tag de Poly1305 (opcional)

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage("");
      setEncryptedData(null);
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
      setEncryptedData(null);
    }
  };

  const handleEncrypt = async () => {
    if (!selectedFile) {
      setMessage("⚠️ Selecciona un archivo primero");
      return;
    }

    setLoading(true);
    try {
      const fileBuffer = await fileToUint8Array(selectedFile);
      const { encrypted, key, nonce, tag, metadata } = await encryptFile(
        fileBuffer,
        selectedFile.name,
        selectedFile.size
      );

      const encryptedName = `${selectedFile.name}.encrypted`;

      setEncryptedData({
        encrypted,
        key,
        nonce,
        tag,
        originalName: selectedFile.name,
        originalSize: selectedFile.size,
        encryptedSize: encrypted.length,
        metadata
      });

      // Auto-descargar el archivo encriptado inmediatamente
      await sodium.ready;
      const blobWithMetadata = new Blob([encrypted]);
      downloadBlob(blobWithMetadata, encryptedName);

      // Limpiar el archivo seleccionado
      setSelectedFile(null);

      setMessage(`✅ Archivo encriptado y descargado como "${encryptedName}". Para desencriptar, sube ESE archivo y usa la KEY de arriba.`);
    } catch (error) {
      setMessage(`❌ Error al encriptar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedFile) {
      setMessage("⚠️ Selecciona un archivo encriptado primero");
      return;
    }

    if (!keyInput.trim()) {
      setMessage("❌ Ingresa la CLAVE de desencriptación");
      return;
    }

    setLoading(true);
    try {
      const encryptedBuffer = await fileToUint8Array(selectedFile);
      
      // Desencriptar (la función extrae el nonce y metadatos internamente)
      const { data: decrypted, metadata, tag, nonce } = await decryptFile(
        encryptedBuffer,
        keyInput.trim(),
        selectedFile.name
      );

      // Usar el nombre original del metadato si está disponible
      const originalName = metadata?.fileName || selectedFile.name.replace('.encrypted', '');
      
      // Descargar el archivo desencriptado
      const blob = new Blob([decrypted]);
      downloadBlob(blob, originalName);

      // Almacenar información de desencriptación para mostrar
      setEncryptedData({
        tag,
        nonce,
        metadata,
        decrypted: true
      });

      setMessage("✅ Archivo desencriptado y descargado");
      
      // Reiniciar después de 3 segundos
      setTimeout(() => {
        setSelectedFile(null);
        setEncryptedData(null);
        setKeyInput("");
        setTagInput("");
        setMessage("");
      }, 3000);
      
    } catch (error) {
      const msg = error.message || "";
      if (msg.startsWith("KEY_INVALID")) {
        setMessage("❌ Clave incorrecta — no se puede descifrar el archivo con esta clave");
      } else if (msg.startsWith("METADATA_TAMPERED")) {
        setMessage("❌ Los metadatos del archivo fueron alterados — no es posible descifrarlo");
      } else {
        setMessage(`❌ Error al desencriptar: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadEncrypted = async () => {
    if (!encryptedData) return;
    
    // El archivo encriptado ya contiene la estructura completa:
    // [4B header length][metadata][12B nonce][ciphertext + tag]
    const blob = new Blob([encryptedData.encrypted]);
    downloadBlob(blob, `${encryptedData.originalName}.encrypted`);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(encryptedData.key);
    setMessage("✅ Clave copiada al portapapeles");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleCopyNonce = () => {
    navigator.clipboard.writeText(encryptedData.nonce);
    setMessage("✅ Nonce copiado al portapapeles");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleCopyTag = () => {
    navigator.clipboard.writeText(encryptedData.tag);
    setMessage("✅ Tag copiado al portapapeles");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleCopyCredentials = () => {
    if (!encryptedData) return;
    const credentials = `KEY: ${encryptedData.key}\nNONCE: ${encryptedData.nonce}\nTAG: ${encryptedData.tag}`;
    navigator.clipboard.writeText(credentials);
    setMessage("✅ Credenciales copiadas al portapapeles");
    setTimeout(() => setMessage(""), 2000);
  };



  return (
    <div className="crypto-tool">
      <div className="crypto-container">
        {/* Sección de Upload */}
        <div className="section">
          <h3>📁 Seleccionar Archivo</h3>
          <div
            className="drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              className="hidden-input"
            />
            <label htmlFor="file-input" className="drop-label">
              {selectedFile ? (
                <>
                  <span className="file-icon">✓</span>
                  <strong>{selectedFile.name}</strong>
                  <small>{(selectedFile.size / 1024).toFixed(2)} KB</small>
                </>
              ) : (
                <>
                  <span className="file-icon">📎</span>
                  <strong>Arrastra un archivo aquí</strong>
                  <small>o haz clic para seleccionar</small>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Sección de Acciones */}
        <div className="section">
          <h3>🔐 Operaciones</h3>
          
          {/* Switch Button */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setMode("encrypt");
                setSelectedFile(null);
                setEncryptedData(null);
                setKeyInput("");
                setMessage("");
              }}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                background: mode === "encrypt" ? '#28a745' : '#e9ecef',
                color: mode === "encrypt" ? 'white' : '#495057',
                transition: 'all 0.3s ease'
              }}
            >
              🔒 Encriptar
            </button>
            <button
              onClick={() => {
                setMode("decrypt");
                setSelectedFile(null);
                setEncryptedData(null);
                setKeyInput("");
                setMessage("");
              }}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                background: mode === "decrypt" ? '#dc3545' : '#e9ecef',
                color: mode === "decrypt" ? 'white' : '#495057',
                transition: 'all 0.3s ease'
              }}
            >
              🔓 Desencriptar
            </button>
          </div>

          {/* Controles según el modo */}
          {mode === "encrypt" && (
            <div className="button-group">
              <button
                onClick={handleEncrypt}
                disabled={!selectedFile || loading}
                className="btn btn-primary"
              >
                🔒 Encriptar Archivo
              </button>
            </div>
          )}

          {mode === "decrypt" && (
            <>
              {!selectedFile && (
                <div style={{
                  padding: '1rem',
                  background: '#fff3cd',
                  border: '1px solid #ffeaa7',
                  borderRadius: '4px',
                  color: '#856404',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  fontWeight: '500'
                }}>
                  ⚠️ Selecciona un archivo primero para desencriptar
                </div>
              )}
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    🔑 Clave (Key):
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="Ingresa la clave hexadecimal o en base64"
                    disabled={!selectedFile}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      opacity: !selectedFile ? 0.5 : 1,
                      cursor: !selectedFile ? 'not-allowed' : 'text',
                      background: !selectedFile ? '#f5f5f5' : 'white'
                    }}
                  />
                </div>
                <button
                  onClick={handleDecrypt}
                  disabled={!selectedFile || !keyInput || loading}
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem' }}
                >
                  🔓 Desencriptar Archivo
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sección de Resultados - Solo para Encriptación */}
        {mode === "encrypt" && encryptedData && (
          <div className="section">
            <h3>📋 Resultados de Encriptación</h3>
            
            {/* Información del archivo */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>📄 Archivo Original</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', wordBreak: 'break-word' }}>
                  {encryptedData.originalName}
                </div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>📊 Tamaño</div>
                <div style={{ fontSize: '0.9rem' }}>
                  <div>Original: {(encryptedData.originalSize / 1024).toFixed(2)} KB</div>
                  <div style={{ marginTop: '0.3rem' }}>Encriptado: {(encryptedData.encryptedSize / 1024).toFixed(2)} KB</div>
                </div>
              </div>
            </div>

            {/* Credenciales */}
            <div style={{
              background: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 1.5rem 0', color: '#333' }}>🔐 Credenciales de Encriptación</h4>
              
              {/* Clave */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '1rem',
                  position: 'relative'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#667eea',
                    marginBottom: '0.5rem'
                  }}>
                    🔑 Clave (Key)
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {encryptedData.key}
                  </div>
                  <button
                    onClick={handleCopyKey}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#764ba2'}
                    onMouseLeave={(e) => e.target.style.background = '#667eea'}
                  >
                    📋 Copiar Clave
                  </button>
                </div>
              </div>

              {/* Nonce */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#667eea',
                    marginBottom: '0.5rem'
                  }}>
                    🔢 Nonce
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {encryptedData.nonce}
                  </div>
                  <button
                    onClick={handleCopyNonce}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#764ba2'}
                    onMouseLeave={(e) => e.target.style.background = '#667eea'}
                  >
                    📋 Copiar Nonce
                  </button>
                </div>
              </div>

              {/* Tag de Poly1305 */}
              <div>
                <div style={{
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#667eea',
                    marginBottom: '0.5rem'
                  }}>
                    🏷️ Tag Poly1305 (Autenticación)
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {encryptedData.tag}
                  </div>
                  <button
                    onClick={handleCopyTag}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#764ba2'}
                    onMouseLeave={(e) => e.target.style.background = '#667eea'}
                  >
                    📋 Copiar Tag
                  </button>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <button
                onClick={handleDownloadEncrypted}
                style={{
                  background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(74, 222, 128, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                ⬇️ Descargar Encriptado
              </button>

              <button
                onClick={handleCopyCredentials}
                style={{
                  background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(96, 165, 250, 0.3)'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                📋 Copiar Todo
              </button>
            </div>
          </div>
        )}

        {/* Sección de Resultados de Desencriptación */}
        {mode === "decrypt" && encryptedData && encryptedData.decrypted && (
          <div className="section">
            <h3>📋 Información de Desencriptación</h3>
            
            <div style={{
              background: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 1.5rem 0', color: '#333' }}>🔍 Datos del Archivo Encriptado</h4>
              
              {/* Nonce */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#667eea',
                    marginBottom: '0.5rem'
                  }}>
                    🔢 Nonce
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {encryptedData.nonce}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(encryptedData.nonce);
                      setMessage("✅ Nonce copiado");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#764ba2'}
                    onMouseLeave={(e) => e.target.style.background = '#667eea'}
                  >
                    📋 Copiar Nonce
                  </button>
                </div>
              </div>

              {/* Tag */}
              <div>
                <div style={{
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#667eea',
                    marginBottom: '0.5rem'
                  }}>
                    🏷️ Tag Poly1305
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {encryptedData.tag}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(encryptedData.tag);
                      setMessage("✅ Tag copiado");
                      setTimeout(() => setMessage(""), 2000);
                    }}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#764ba2'}
                    onMouseLeave={(e) => e.target.style.background = '#667eea'}
                  >
                    📋 Copiar Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sección de Mensajes */}
        {message && (
          <div className={`message ${message.includes("❌") ? "error" : message.includes("✅") ? "success" : "info"}`}>
            {message}
          </div>
        )}


      </div>
    </div>
  );
}

export default CryptoTool;