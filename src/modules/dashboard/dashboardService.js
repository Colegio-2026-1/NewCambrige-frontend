/**
 * dashboardService.js
 * Servicio del módulo Dashboard en New Cambridge School.
 * Consume los endpoints correspondientes de cada módulo del backend:
 * - Parametrización: /api/parametrizacion/anio-escolar (períodos académicos para todos los roles)
 * - Paz y Salvo: /api/paz-salvo/estudiantes-rectoria y /api/paz-salvo/periodos
 * - Estudiantes: /api/estudiantes/periodo/{id}
 * - Tesorería: /api/tesoreria/pagos-pendientes
 * - Secretaría: /api/secretaria/matriculas/pendientes y /api/secretaria/matriculas/periodo/{id}
 * - Banda: /api/banda/prestamos/activos y /api/banda/estadisticas
 * - Uniformes: /api/uniformes/prestamos/activos
 * - Salones: /api/salones/periodo/{id} y /api/salones/
 * - Usuarios: /api/usuarios/{id}/roles
 */
import axiosClient from "../../api/axiosClient";

// ── ROLES DEL USUARIO ────────────────────────────────────────────────────────
export const getRolesUsuario = (idUsuario) =>
  axiosClient.get(`/api/usuarios/${idUsuario}/roles`);

// ── PERÍODOS ACADÉMICOS ──────────────────────────────────────────────────────
// Intenta primero /api/parametrizacion/anio-escolar (accesible para todos los roles),
// y hace fallback a /api/paz-salvo/periodos (admin / rectoria).
export const getPeriodos = async () => {
  try {
    const res = await axiosClient.get("/api/parametrizacion/anio-escolar");
    return res;
  } catch (err) {
    // Fallback a paz-salvo si falla
    return axiosClient.get("/api/paz-salvo/periodos");
  }
};

// ── ESTUDIANTES DEL PERÍODO ──────────────────────────────────────────────────
// GET /api/estudiantes/periodo/{id_periodo}?limit=500
export const getEstudiantesPorPeriodo = (idPeriodo, params = {}) =>
  axiosClient.get(`/api/estudiantes/periodo/${idPeriodo}`, {
    params: { limit: 500, ...params },
  });

// ── ESTADO DE PAZ Y SALVO ────────────────────────────────────────────────────
// Backend tiene GET /api/paz-salvo/estudiantes-rectoria?periodo_id={id}
// Cada estudiante tiene { id_estudiante, nombre, semaforo, todas_firmadas, firmas_completadas, total_firmas }
export const getPazSalvoEstado = (idPeriodo) =>
  axiosClient.get("/api/paz-salvo/estudiantes-rectoria", {
    params: idPeriodo ? { periodo_id: idPeriodo } : {},
  });

// Alias compatible para pendientes de paz y salvo
export const getPendientesPazSalvo = async (idPeriodo) => {
  try {
    const res = await getPazSalvoEstado(idPeriodo);
    // Filtrar los estudiantes con firmas pendientes
    const list = res.data ?? [];
    const pendientes = list.filter((e) => !e.todas_firmadas && e.semaforo !== "VERDE");
    return { ...res, data: pendientes, total: list.length, alDia: list.length - pendientes.length };
  } catch (err) {
    // Si no tiene permiso de rectoría/admin, devolver array vacío
    return { data: [], total: 0, alDia: 0 };
  }
};

// ── PAGOS PENDIENTES / TESORERÍA ─────────────────────────────────────────────
// GET /api/tesoreria/pagos-pendientes?periodo_id=X (roles: admin, tesoreria)
// Fallback a /api/secretaria/matriculas/pendientes (roles: admin, secretaria)
export const getPagosPendientes = async (idPeriodo) => {
  try {
    return await axiosClient.get("/api/tesoreria/pagos-pendientes", {
      params: idPeriodo ? { periodo_id: idPeriodo } : {},
    });
  } catch (err) {
    // Si falla por permisos u otro, intentar con secretaría
    try {
      return await axiosClient.get("/api/secretaria/matriculas/pendientes");
    } catch {
      return { data: [] };
    }
  }
};

// GET /api/secretaria/matriculas/periodo/{id_periodo}
export const getMatriculasPorPeriodo = (idPeriodo) =>
  axiosClient.get(`/api/secretaria/matriculas/periodo/${idPeriodo}`);

// ── BANDA — PRÉSTAMOS ACTIVOS Y ESTADÍSTICAS ────────────────────────────────
export const getPrestamosActivosBanda = () =>
  axiosClient.get("/api/banda/prestamos/activos");

export const getPrestamosBandaActivos = getPrestamosActivosBanda;

export const getEstadisticasBanda = () =>
  axiosClient.get("/api/banda/estadisticas");

// ── UNIFORMES — PRÉSTAMOS ACTIVOS ───────────────────────────────────────────
export const getPrestamosActivosUniformes = () =>
  axiosClient.get("/api/uniformes/prestamos/activos");

export const getPrestamosUniformesActivos = getPrestamosActivosUniformes;

// ── SALONES POR PERÍODO ──────────────────────────────────────────────────────
// GET /api/salones/periodo/{id_periodo} (roles: admin, titular)
// Fallback a /api/parametrizacion/salones/periodo/{id_periodo} o /api/salones/
export const getSalonesPorPeriodo = async (idPeriodo) => {
  try {
    return await axiosClient.get(`/api/salones/periodo/${idPeriodo}`);
  } catch (err) {
    try {
      return await axiosClient.get(`/api/parametrizacion/salones/periodo/${idPeriodo}`);
    } catch {
      return axiosClient.get("/api/salones/");
    }
  }
};

export const getSalones = () =>
  axiosClient.get("/api/salones/");
