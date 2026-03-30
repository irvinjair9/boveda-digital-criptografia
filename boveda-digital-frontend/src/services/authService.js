import api from "./api";
import { hashPassword } from "../crypto/passwordHash";
import { generateKeyPair, encryptPrivateKey } from "../crypto/keyPair";

export async function login(username, password) {
  const hashedPassword = await hashPassword(password);
  const response = await api.post("/auth/login", { username, password: hashedPassword });
  return response.data.user;
}

export async function register(userData) {
  const hashedPassword = await hashPassword(userData.password);

  // Generar par de claves X25519
  const { publicKeyHex, privateKey } = await generateKeyPair();

  // Cifrar la clave privada con la contraseña en claro (determinista)
  const encryptedPrivateKey = await encryptPrivateKey(privateKey, userData.password);

  const response = await api.post("/auth/register", {
    name: userData.name,
    lastName: userData.lastName,
    last_name: userData.lastName,
    username: userData.username,
    email: userData.email,
    password: hashedPassword,
    public_key: publicKeyHex,
  });

  return { ...response.data, encryptedPrivateKey };
}
