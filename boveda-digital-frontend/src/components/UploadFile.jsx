import { uploadFile } from "../services/fileService";
import { encryptFile } from "../crypto/chachaEncrypt";
import { fileToUint8Array, uint8ArrayToBlob } from "../crypto/dataUtils";
import sodium from "libsodium-wrappers";

function UploadFile() {
  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Convertir archivo a Uint8Array
      const fileBuffer = await fileToUint8Array(file);
      
      // Encriptar el archivo
      const { encrypted, key, nonce } = await encryptFile(fileBuffer);
      
      await sodium.ready;
      
      // Convertir key y nonce a base64 de bytes
      const keyBytes = sodium.from_hex(key);
      const nonceBytes = sodium.from_hex(nonce);
      
      // Crear FormData para enviar
      const formData = new FormData();
      formData.append('file', uint8ArrayToBlob(encrypted));
      formData.append('filename', file.name);
      formData.append('key', btoa(String.fromCharCode(...keyBytes)));
      formData.append('nonce', btoa(String.fromCharCode(...nonceBytes)));
      
      // Subir archivo
      await uploadFile(formData);
      
      alert('✅ Archivo subido exitosamente');
      event.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error al subir archivo:', error);
      alert('❌ Error al subir el archivo: ' + error.message);
    }
  };

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '2rem auto', 
      padding: '2rem', 
      background: 'rgba(255,255,255,0.1)', 
      borderRadius: '10px',
      textAlign: 'center'
    }}>
      <h3>📤 Subir Archivo Encriptado</h3>
      <p>Selecciona un archivo para encriptarlo y subirlo a la bandeja de entrada.</p>
      
      <input
        type="file"
        onChange={handleUpload}
        style={{
          margin: '1rem 0',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          background: 'white'
        }}
      />
      
      <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
        El archivo será encriptado con ChaCha20-Poly1305 antes de enviarse.
      </p>
    </div>
  );
}

export default UploadFile;