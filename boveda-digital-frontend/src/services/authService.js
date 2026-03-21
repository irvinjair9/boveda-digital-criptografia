import api from "./api";
import { hashPassword } from "../crypto/passwordHash";

export async function login(username, password) {
  const hashedPassword = await hashPassword(password);
  const response = await api.post("/auth/login", { username, password: hashedPassword });
  return response.data.user;
}

export async function register(userData) {
  const hashedPassword = await hashPassword(userData.password);
  const response = await api.post("/auth/register", {
    ...userData,
    password: hashedPassword,
  });
  return response.data;
}
