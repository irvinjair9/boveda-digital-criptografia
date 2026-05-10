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

  // Generate both keypairs: X25519 (encryption) + Ed25519 (signing)
  const { publicKeyHex, signingPublicKeyHex, privateKey, signingPrivateKey } = await generateKeyPair();

  // Encrypt both private keys into one combined file
  const encryptedPrivateKey = await encryptPrivateKey(privateKey, signingPrivateKey, userData.password);

  const response = await api.post("/auth/register", {
    name: userData.name,
    lastName: userData.lastName,
    last_name: userData.lastName,
    username: userData.username,
    email: userData.email,
    password: hashedPassword,
    public_key: publicKeyHex,
    signing_public_key: signingPublicKeyHex,
  });

  return { ...response.data, encryptedPrivateKey };
}
