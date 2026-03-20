import api from "./api";

export async function login(username, password) {
  const response = await api.post("/auth/login", { username, password });
  return response.data.user;
}

export async function register(userData) {
  const response = await api.post("/auth/register", userData);
  return response.data;
}
