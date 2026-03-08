import { useEffect, useState } from "react";
import sodium from "libsodium-wrappers";
import { getInbox, downloadFile } from "../services/fileService";
import { decryptFile } from "../crypto/chachaEncrypt";
import { blobToUint8Array, uint8ArrayToBlob, downloadBlob } from "../crypto/dataUtils";

function FileInbox() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decrypting, setDecrypting] = useState(null);

  useEffect(() => {
    loadInbox();
  }, []);

  const loadInbox = async () => {
    try {
      setLoading(true);
      const inboxFiles = await getInbox();
      setFiles(inboxFiles);
    } catch (err) {
      setError("Error al cargar la bandeja de entrada");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId, encryptedData, key, nonce) => {
    try {
      setDecrypting(fileId);
      
      console.log("🔍 Debug handleDownload:");
      console.log("  - fileId:", fileId);
      console.log("  - key (raw):", key);
      console.log("  - nonce (raw):", nonce);
      console.log("  - encryptedData type:", typeof encryptedData, "length:", encryptedData?.length);
      
      await sodium.ready;
      
      // Validar y procesar key y nonce
      // La key debe tener 64 caracteres hex (32 bytes) = 64 chars
      // El nonce debe tener 24 caracteres hex (12 bytes) = 24 chars
      let keyHex = key?.trim();
      let nonceHex = nonce?.trim();
      
      // Validar longitudes básicas primero
      console.log(`  - Key length check: ${keyHex?.length} chars (esperado 64)`);
      console.log(`  - Nonce length check: ${nonceHex?.length} chars (esperado 24)`);
      
      // Validar formato hex y longitud
      if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
        console.warn("⚠️ Key inválida, intentando decodificar de base64");
        try {
          const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
          keyHex = sodium.to_hex(keyBytes);
          console.log(`  - Key decodificado de base64, longitud hex: ${keyHex.length}`);
        } catch (e) {
          const details = {
            longitud_recibida: key?.length,
            formato: /^[0-9a-fA-F]*$/.test(keyHex) ? "hexadecimal" : "desconocido",
            primeros_chars: key?.substring(0, 20),
            contenido: key
          };
          console.error("❌ ERROR EN LA CLAVE:", details);
          throw new Error(`❌ Clave inválida. Esperada: 64 chars hex, Recibida: ${JSON.stringify(details)}`);
        }
      }
      
      if (!nonceHex || !/^[0-9a-fA-F]{24}$/.test(nonceHex)) {
        console.warn("⚠️ Nonce inválido, intentando decodificar de base64");
        try {
          const nonceBytes = Uint8Array.from(atob(nonce), c => c.charCodeAt(0));
          nonceHex = sodium.to_hex(nonceBytes);
          console.log(`  - Nonce decodificado de base64, longitud hex: ${nonceHex.length}`);
        } catch (e) {
          const details = {
            longitud_recibida: nonce?.length,
            formato: /^[0-9a-fA-F]*$/.test(nonceHex) ? "hexadecimal" : "desconocido",
            primeros_chars: nonce?.substring(0, 20),
            contenido: nonce
          };
          console.error("❌ ERROR EN EL NONCE:", details);
          throw new Error(`❌ Nonce inválido. Esperado: 24 chars hex, Recibido: ${JSON.stringify(details)}`);
        }
      }
      
      console.log("  - keyHex (primeros 16):", keyHex.substring(0, 16) + "...");
      console.log("  - nonceHex:", nonceHex);
      // Decodificar encryptedData
      let encryptedArray;
      if (typeof encryptedData === 'string') {
        try {
          // Intentar decodificar como base64 primero
          console.log("  - Intentando decodificar encryptedData como base64");
          encryptedArray = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
          console.log("  - Decodificado como base64, length:", encryptedArray.length);
        } catch (e) {
          console.log("  - Falló base64, intentando como hex");
          // Si falla, intentar como hex
          encryptedArray = sodium.from_hex(encryptedData);
          console.log("  - Decodificado como hex, length:", encryptedArray.length);
        }
      } else {
        console.log("  - encryptedData no es string, convirtiendo a Uint8Array");
        encryptedArray = new Uint8Array(encryptedData);
      }
      
      console.log("  - encryptedArray length:", encryptedArray.length);
      
      const decrypted = await decryptFile(encryptedArray, keyHex, nonceHex);
      const blob = uint8ArrayToBlob(decrypted);
      downloadBlob(blob, `decrypted_${fileId}`);
    } catch (err) {
      alert("Error al desencriptar el archivo: " + err.message);
    } finally {
      setDecrypting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div>🔄 Cargando archivos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
        ❌ {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2>📂 Archivos Recibidos</h2>
      
      {files.length === 0 ? (
        <div style={{
          background: '#f8f9fa',
          padding: '2rem',
          borderRadius: '10px',
          margin: '2rem 0',
          border: '2px dashed #dee2e6',
          textAlign: 'center'
        }}>
          <h3>📭 No hay archivos</h3>
          <p>No has recibido ningún archivo encriptado aún.</p>
          <p style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '1rem' }}>
            Los archivos aparecerán aquí cuando alguien te envíe archivos encriptados.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {files.map((file) => (
            <div key={file.id} style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>📄 {file.filename}</h4>
                  <p style={{ margin: '0', fontSize: '0.9rem', color: '#6c757d' }}>
                    Tamaño: {(file.size / 1024).toFixed(2)} KB • 
                    Recibido: {new Date(file.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(file.id, file.encryptedData, file.key, file.nonce)}
                  disabled={decrypting === file.id}
                  style={{
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: decrypting === file.id ? 'not-allowed' : 'pointer',
                    opacity: decrypting === file.id ? 0.6 : 1
                  }}
                >
                  {decrypting === file.id ? '🔓 Desencriptando...' : '⬇️ Descargar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileInbox;