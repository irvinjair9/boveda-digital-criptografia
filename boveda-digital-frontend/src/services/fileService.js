import api from "./api";

export const getUsers = async () => api.get("/users");

export const uploadSharedFile = async (formData) => api.post("/files/share", formData);

export const getSharedWithMe = async (userId) => api.get(`/files/shared/${userId}`);

export const downloadSharedFile = async (fileId) =>
  api.get(`/files/shared/download/${fileId}`, { responseType: "arraybuffer" });
