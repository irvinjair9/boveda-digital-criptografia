import api from "./api";

export const uploadFile = async (formData) => {
  return api.post("/files/upload", formData);
};

export const getInbox = async () => {
  return api.get("/files/inbox");
};

export const downloadFile = async (id) => {
  return api.get(`/files/${id}`);
};

// --- Endpoints para compartición de archivos ---

/** Listar usuarios registrados (para seleccionar destinatarios) */
export const getUsers = async () => {
  return api.get("/users");
};

/** Subir archivo cifrado con llaves simétricas cifradas por usuario */
export const uploadSharedFile = async (formData) => {
  return api.post("/files/share", formData);
};

/** Listar archivos compartidos conmigo */
export const getSharedWithMe = async (userId) => {
  return api.get(`/files/shared/${userId}`);
};

/** Descargar un archivo compartido (obtiene el blob cifrado) */
export const downloadSharedFile = async (fileId) => {
  return api.get(`/files/shared/download/${fileId}`, { responseType: "arraybuffer" });
};