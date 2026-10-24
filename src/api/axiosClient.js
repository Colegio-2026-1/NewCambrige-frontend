import axios from "axios";
import { emitLoginBlocked, emitSessionExpired } from "./sessionEvents";

const TOKEN_KEY = "access_token";
const REFRESH_HEADER = "x-refreshed-token";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

// =============================
// REQUEST: adjuntar token
// =============================
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// =============================
// RESPONSE
// =============================
axiosClient.interceptors.response.use(
  (response) => {
    // Renovación silenciosa: el backend manda un token nuevo cuando toca
    const refreshed = response.headers[REFRESH_HEADER];
    if (refreshed) {
      localStorage.setItem(TOKEN_KEY, refreshed);
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // -------- LOGIN --------
    if (url.includes("/api/auth/token") || url.includes("/api/auth/logout")) {
      return Promise.reject(error);
    }

    // -------- RESTO (protegidos) --------
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      emitSessionExpired(
        error.response?.data?.detail || "Su sesión ha finalizado."
      );
    }

    return Promise.reject(error);
  }
);

export default axiosClient;