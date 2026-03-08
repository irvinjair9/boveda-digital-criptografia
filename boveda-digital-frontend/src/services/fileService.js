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