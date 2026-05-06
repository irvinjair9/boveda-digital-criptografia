import axios from "axios";

const API_URL = "http://localhost:8080/api/error-logs";

export async function sendErrorLog({ module, publicMessage, internalReason, details }) {
  try {
    await axios.post(API_URL, {
      module,
      public_message: publicMessage,
      internal_reason: internalReason,
      details
    });
  } catch (e) {
    // No romper el flujo principal si falla el guardado del log
    console.warn("No se pudo guardar el error en backend");
  }
}