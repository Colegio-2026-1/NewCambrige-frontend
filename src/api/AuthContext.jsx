import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { getMeRequest, loginRequest, logoutRequest } from "./authService";
import { allrolesuserRequest } from "./endpoints";
import {
  LOGIN_BLOCKED_EVENT,
  SESSION_EXPIRED_EVENT,
} from "./sessionEvents";

const TOKEN_KEY = "access_token";
const HIDDEN_THRESHOLD_MS = 60_000; // revalida si estuvo oculta > 1 min

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionMessage, setSessionMessage] = useState("");

  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setRoles([]);
  }, []);

  const fetchRoles = useCallback(async (userId) => {
    if (!userId) {
      setRoles([]);
      setLoadingRoles(false);
      return;
    }
    try {
      setLoadingRoles(true);
      const { data } = await allrolesuserRequest(userId);
      setRoles(data || []);
    } catch {
      setRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const login = useCallback(
    async (username, password) => {
      setLoading(true);
      setError(null);
      try {
        const data = await loginRequest(username, password);
        localStorage.setItem(TOKEN_KEY, data.access_token);

        const { data: userData } = await getMeRequest();
        setUser(userData);
        await fetchRoles(userData.id_usuario);
        navigate("/home");
      } catch (err) {
        // Si /me falla, no dejamos token huérfano
        localStorage.removeItem(TOKEN_KEY);
        setError(err.response?.data?.detail || "Error al iniciar sesión");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [navigate, fetchRoles]
  );
const logout = useCallback(
  async (message = "", options = {notifyBackend: true}) => {
    if (options?.notifyBackend) {
      try {
        await logoutRequest();
      } catch {
        // Silencioso: puede fallar si el token ya expiró (401) o si no hay red.
      }
    }
    clearSession();
    setLoadingRoles(true);
    if (message) setSessionMessage(message);
    navigate("/");
  },
  [clearSession, navigate]
);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoadingRoles(false);
      return;
    }
    try {
      const { data: userData } = await getMeRequest();
      setUser(userData);
      await fetchRoles(userData.id_usuario);
    } catch (err) {
      // El interceptor ya emite session:expired en 401
      if (err.response?.status !== 401) setLoadingRoles(false);
    }
  }, [fetchRoles]);

  // --- Check inicial ---
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // --- Escuchar eventos de sesión ---
  useEffect(() => {
    const handleExpired = (e) => {
      logout(e.detail || "Su sesión ha finalizado.", { notifyBackend: false });
    };
    const handleBlocked = (e) => {
      setSessionMessage(e.detail?.message || "Demasiados intentos.");
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    window.addEventListener(LOGIN_BLOCKED_EVENT, handleBlocked);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
      window.removeEventListener(LOGIN_BLOCKED_EVENT, handleBlocked);
    };
  }, [logout]);

  // --- Revalidar al volver a la pestaña ---
  useEffect(() => {
    let hiddenAt = null;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        if (away > HIDDEN_THRESHOLD_MS) checkAuth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [checkAuth]);

  const value = {
    user,
    roles,
    loadingRoles,
    loading,
    error,
    login,
    logout,
    sessionMessage,
    setSessionMessage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}