/**
 * DashboardPage — New Cambridge School.
 * Layout responsivo profesional: auto-fit grid por rol.
 * Los roles se obtienen desde el backend con getRolesUsuario(id_usuario) o desde AuthContext.
 */
import { useEffect, useState } from "react";
import { Home, LayoutDashboard } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

import Header       from "../../components/layout/header";
import ModuleLayout from "../../components/layout/ModuleLayout";
import Sidebar      from "../../components/layout/Sidebar";
import { useAuth }  from "../../api/AuthContext";

import {
  getRolesUsuario,
  getPeriodos,
  getEstudiantesPorPeriodo,
  getPendientesPazSalvo,
  getPagosPendientes,
  getPrestamosActivosBanda,
  getPrestamosActivosUniformes,
  getSalonesPorPeriodo,
} from "./dashboardService";

import "./DashboardPage.css";

// ── Paleta institucional ───────────────────────────────────────────
const C_RED   = "#8E2A25";
const C_BLUE  = "#1B3A5C";
const C_GREEN = "#2E7D4F";
const C_WARN  = "#A06000";
const DONUT_COLORS = [C_GREEN, C_RED];
const BAR_COLORS   = [C_RED, C_BLUE, C_GREEN, C_WARN];

// ── Permisos por rol ───────────────────────────────────────────────
const PERMISOS = {
  admin:      { kpiEstudiantes: true,  kpiPaz: true,  kpiPendientes: true,  kpiPagos: true,  grafPaz: true,  grafPrestamos: true,  grafSalones: true,  grafPagos: true  },
  secretaria: { kpiEstudiantes: true,  kpiPaz: true,  kpiPendientes: true,  kpiPagos: false, grafPaz: true,  grafPrestamos: false, grafSalones: true,  grafPagos: false },
  rectoria:   { kpiEstudiantes: true,  kpiPaz: true,  kpiPendientes: true,  kpiPagos: false, grafPaz: true,  grafPrestamos: false, grafSalones: false, grafPagos: false },
  tesoreria:  { kpiEstudiantes: false, kpiPaz: false, kpiPendientes: false, kpiPagos: true,  grafPaz: false, grafPrestamos: false, grafSalones: true,  grafPagos: true  },
  banda:      { kpiEstudiantes: false, kpiPaz: false, kpiPendientes: false, kpiPagos: false, grafPaz: false, grafPrestamos: true,  grafSalones: false, grafPagos: false },
  uniformes:  { kpiEstudiantes: false, kpiPaz: false, kpiPendientes: false, kpiPagos: false, grafPaz: false, grafPrestamos: true,  grafSalones: false, grafPagos: false },
  titular:    { kpiEstudiantes: true,  kpiPaz: false, kpiPendientes: false, kpiPagos: false, grafPaz: false, grafPrestamos: false, grafSalones: true,  grafPagos: false },
};

// Combina permisos de TODOS los roles (OR lógico)
const getPermisos = (roles = []) => {
  if (roles.length === 0) return PERMISOS.admin;
  const base = {
    kpiEstudiantes: false, kpiPaz: false, kpiPendientes: false, kpiPagos: false,
    grafPaz: false, grafPrestamos: false, grafSalones: false, grafPagos: false,
  };
  for (const rol of roles) {
    const p = PERMISOS[rol];
    if (!p) continue;
    for (const key of Object.keys(base)) {
      if (p[key]) base[key] = true;
    }
  }
  return base;
};

/**
 * Determina la clase de densidad visual según cuántos módulos tiene el rol.
 * full   → admin / secretaria / rectoria (3+ gráficas)
 * mid    → tesoreria / titular           (2 gráficas)
 * single → banda / uniformes             (1 gráfica)
 */
const getDensity = (can) => {
  const grafCount = [can.grafPaz, can.grafPrestamos, can.grafSalones, can.grafPagos]
    .filter(Boolean).length;
  if (grafCount >= 3) return "dash-density-full";
  if (grafCount === 2) return "dash-density-mid";
  return "dash-density-single";
};

// ── Subcomponentes ───────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label && <p className="dash-tooltip-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// DSH-09: fontFamily Roboto en valores numéricos
const KpiCard = ({ title, value, sub, color, loading }) => (
  <div className="dash-kpi-card" style={{ borderTopColor: color }}>
    <span className="dash-kpi-title">{title}</span>
    {loading
      ? <span className="dash-kpi-skeleton" />
      : <span className="dash-kpi-value" style={{ color, fontFamily: "'Roboto', sans-serif" }}>{value ?? "—"}</span>
    }
    {sub && <span className="dash-kpi-sub">{sub}</span>}
  </div>
);

const ChartSwitch = ({ options, value, onChange }) => (
  <div className="dash-switch">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={`dash-switch-btn ${value === o.value ? "active" : ""}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

// ── Componente principal ─────────────────────────────────────────
export default function DashboardPage() {
  const { user, roles: authRoles, loadingRoles, logout } = useAuth();

  const menuItems = [
    { label: "Inicio",    path: "/home",      icon: <Home size={18} /> },
    { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={18} /> },
  ];

  // ── Estado ─────────────────────────────────────────────────────
  const [roles,            setRoles]            = useState(authRoles || []);
  const [rolesLoaded,      setRolesLoaded]      = useState(!loadingRoles && (authRoles?.length > 0));
  const [selectedMenu,     setSelectedMenu]     = useState("Dashboard");
  const [periodos,         setPeriodos]         = useState([]);
  const [periodoId,        setPeriodoId]        = useState("");
  const [periodosLoaded,   setPeriodosLoaded]   = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);

  // KPIs
  const [totalEstudiantes, setTotalEstudiantes] = useState(null);
  const [totalPazOk,       setTotalPazOk]       = useState(null);
  const [totalPendientes,  setTotalPendientes]  = useState(null);
  const [totalPagos,       setTotalPagos]       = useState(null);

  // Gráficas
  const [pazData,          setPazData]          = useState([]);
  const [prestData,        setPrestData]        = useState([]);
  const [salonesData,      setSalonesData]      = useState([]);
  const [pagosData,        setPagosData]        = useState([]);
  const [pazChart,         setPazChart]         = useState("donut");

  // ── PASO 1: Obtener roles reales del backend al montar ──────────────
  useEffect(() => {
    if (authRoles && authRoles.length > 0) {
      setRoles(authRoles);
      setRolesLoaded(true);
      return;
    }

    if (!user?.id_usuario) {
      if (!loadingRoles) setRolesLoaded(true);
      return;
    }

    getRolesUsuario(user.id_usuario)
      .then((res) => {
        setRoles(res.data ?? []);
      })
      .catch(() => {
        // En caso de restricción en endpoint de roles, usar los de auth si existen
        setRoles(authRoles ?? []);
      })
      .finally(() => setRolesLoaded(true));
  }, [user?.id_usuario, authRoles, loadingRoles]);

  const can     = getPermisos(roles);
  const density = getDensity(can);

  // ── PASO 2: Cargar períodos cuando roles estén listos ────────────
  useEffect(() => {
    if (!rolesLoaded) return;
    getPeriodos()
      .then((res) => {
        const data = res.data ?? [];
        setPeriodos(data);
        // DSH-11: no preseleccionar ningún período, mostrar "Seleccionar" por defecto
        setPeriodoId("");
      })
      .catch((err) => {
        console.error("Error al cargar períodos:", err);
        setError("No se pudieron cargar los períodos.");
      })
      .finally(() => setPeriodosLoaded(true));
  }, [rolesLoaded]);

  // ── PASO 3: Cargar datos según rol + período ────────────────────
  useEffect(() => {
    if (!periodoId || !rolesLoaded) return;
    const id = Number(periodoId);
    setLoading(true);
    setError(null);

    const loadDashboardData = async () => {
      let estudiantesList = [];

      try {
        // 1. Estudiantes del período
        if (can.kpiEstudiantes || can.grafSalones || can.kpiPaz || can.kpiPendientes || can.grafPaz) {
          try {
            const rEst = await getEstudiantesPorPeriodo(id);
            estudiantesList = rEst.data ?? [];
            setTotalEstudiantes(estudiantesList.length);
          } catch (err) {
            console.error("Error al cargar estudiantes del período:", err);
          }
        }

        // 2. Estado de Paz y Salvo
        if (can.kpiPendientes || can.kpiPaz || can.grafPaz) {
          try {
            const pzRes = await getPendientesPazSalvo(id);
            const pendientesList = pzRes.data ?? [];
            const totalPendientesCount = pendientesList.length;

            let alDiaCount = 0;
            let pendCount = totalPendientesCount;

            if (pzRes.total && pzRes.total > 0) {
              alDiaCount = pzRes.alDia ?? 0;
              pendCount = pzRes.total - alDiaCount;
            } else if (estudiantesList.length > 0) {
              alDiaCount = Math.max(0, estudiantesList.length - totalPendientesCount);
              pendCount = totalPendientesCount;
            }

            setTotalPendientes(pendCount);
            setTotalPazOk(alDiaCount);
            setPazData([
              { name: "Al día",    value: alDiaCount },
              { name: "Pendiente", value: pendCount },
            ]);
          } catch (err) {
            console.error("Error al cargar paz y salvo:", err);
          }
        }

        // 3. Matrículas / Pagos Pendientes (Tesorería)
        if (can.kpiPagos || can.grafPagos) {
          try {
            const pRes = await getPagosPendientes(id);
            const pagos = pRes.data ?? [];
            setTotalPagos(pagos.length);
            setPagosData(pagos.slice(0, 5));
          } catch (err) {
            console.error("Error al cargar pagos pendientes:", err);
          }
        }

        // 4. Préstamos Activos (Banda y Uniformes)
        if (can.grafPrestamos) {
          try {
            const [bandaRes, uniformesRes] = await Promise.allSettled([
              getPrestamosActivosBanda(),
              getPrestamosActivosUniformes(),
            ]);

            setPrestData([
              {
                modulo: "Banda",
                activos: bandaRes.status === "fulfilled" ? (bandaRes.value.data?.length ?? 0) : 0,
              },
              {
                modulo: "Uniformes",
                activos: uniformesRes.status === "fulfilled" ? (uniformesRes.value.data?.length ?? 0) : 0,
              },
            ]);
          } catch (err) {
            console.error("Error al cargar préstamos activos:", err);
          }
        }

        // 5. Salones por período con conteo real de estudiantes
        if (can.grafSalones) {
          try {
            const sRes = await getSalonesPorPeriodo(id);
            const salones = sRes.data ?? [];

            // Mapear estudiantes por id_salon
            const countBySalon = {};
            estudiantesList.forEach((e) => {
              if (e.id_salon) {
                countBySalon[e.id_salon] = (countBySalon[e.id_salon] || 0) + 1;
              }
            });

            setSalonesData(
              salones
                .map((s) => ({
                  nombre:      s.nombre ?? `${s.grado}°${s.grupo}`,
                  estudiantes: countBySalon[s.id_salon] ?? s.num_estudiantes ?? 0,
                }))
                .sort((a, b) => b.estudiantes - a.estudiantes)
                .slice(0, 10)
            );
          } catch (err) {
            console.error("Error al cargar salones:", err);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoId, rolesLoaded]);

  // ── Helpers de render ────────────────────────────────────────

  // Cuenta cuántas gráficas se van a mostrar para elegir la clase de grilla
  const grafCards = [
    can.grafPaz,
    can.grafPrestamos,
    can.grafSalones,
    can.grafPagos,
  ].filter(Boolean).length;

  const gridClass = grafCards === 1 ? "dash-grid-single" : "dash-grid";

  // ── Spinner mientras cargan roles ────────────────────────────
  if (!rolesLoaded) {
    return (
      <div className="dashboard-container">
        <Header title="SISTEMA DE PAZ Y SALVO — NEW CAMBRIDGE SCHOOL" />
        <div className="dash-loading-screen">
          <span className="dash-spinner" />
          <p>Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Header title="SISTEMA DE PAZ Y SALVO — NEW CAMBRIDGE SCHOOL" />

      <ModuleLayout
        sidebar={
          <Sidebar
            menuItems={menuItems}
            selectedMenu={selectedMenu}
            setSelectedMenu={setSelectedMenu}
            user={{
              ...user,
              nombre: user?.nombre || "Usuario",
              rol: roles[0] || user?.rol || "Rol Desconocido",
            }}
            logout={logout}
          />
        }
      >
        {/* density class controla el padding de cards según cuántos módulos tiene el rol */}
        <div className={`dash-wrapper ${density}`}>

          {/* ERROR GLOBAL */}
          {error && <p className="dash-error">{error}</p>}

          {/* FILTRO PERÍODO */}
          <div className="dash-filter-bar">
            <label className="dash-filter-label" htmlFor="periodo-select">
              Período académico
            </label>
            <select
              id="periodo-select"
              className="dash-filter-select"
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
            >
              {!periodosLoaded ? (
                <option value="" disabled>Cargando períodos académicos...</option>
              ) : periodos.length === 0 ? (
                <option value="" disabled>No hay períodos académicos registrados</option>
              ) : (
                <>
                  <option value="">Seleccione un período académico</option>
                  {periodos.map((p) => (
                    <option key={p.id_periodo} value={String(p.id_periodo)}>
                      {p.nombre}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* KPI CARDS — auto-fit, no colapsan en pantallas pequeñas */}
          <div className="dash-kpi-grid">
            {can.kpiEstudiantes && (
              <KpiCard title="Estudiantes"           value={totalEstudiantes} sub="En el período"          color={C_BLUE}  loading={loading} />
            )}
            {can.kpiPaz && (
              <KpiCard title="PAZ Y SALVO"           value={totalPazOk}       sub="Sin pendientes"          color={C_GREEN} loading={loading} />
            )}
            {can.kpiPendientes && (
              <KpiCard title="PAZ Y SALVO INCOMPLETO" value={totalPendientes}  sub="Con pendientes"         color={C_RED}   loading={loading} />
            )}
            {can.kpiPagos && (
              <KpiCard title="Matrículas Pendientes" value={totalPagos}       sub="Por período"             color={C_WARN}  loading={loading} />
            )}
          </div>

          {/* GRÁFICAS — grilla fluida: 1 col en móvil, 2 en desktop, no deja huecos */}
          {grafCards > 0 && (
            <div className={gridClass}>

              {can.grafPaz && (
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Estado Paz y Salvo</h3>
                    <ChartSwitch
                      options={[
                        { label: "Donut",  value: "donut" },
                        { label: "Barras", value: "bar"   },
                      ]}
                      value={pazChart}
                      onChange={setPazChart}
                    />
                  </div>
                  <div className="dash-card-inner">
                    {pazData.length === 0 && !loading
                      ? <p className="dash-empty">{periodoId ? "Sin datos para este período" : "Seleccione un período para ver las estadísticas"}</p>
                      : pazChart === "donut" ? (
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie data={pazData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {pazData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={pazData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0d8cc" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="value" name="Estudiantes" radius={[4, 4, 0, 0]}>
                                {pazData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )
                    }
                  </div>
                </div>
              )}

              {can.grafPrestamos && (
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Préstamos Activos</h3>
                    <span className="dash-card-sub">Banda <strong>VS</strong> Uniformes</span>
                  </div>
                  <div className="dash-card-inner">
                    {prestData.length === 0 && !loading
                      ? <p className="dash-empty">Sin datos disponibles</p>
                      : (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={prestData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0d8cc" />
                            <XAxis dataKey="modulo" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="activos" name="Activos" radius={[4, 4, 0, 0]}>
                              {prestData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    }
                  </div>
                </div>
              )}

              {can.grafSalones && (
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Estudiantes por Salón</h3>
                    <span className="dash-card-sub">Período actual · Top 10</span>
                  </div>
                  <div className="dash-card-inner">
                    {salonesData.length === 0 && !loading
                      ? <p className="dash-empty">{periodoId ? "Sin datos para este período" : "Seleccione un período para ver las estadísticas"}</p>
                      : (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={salonesData} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0d8cc" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={45} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="estudiantes" name="Estudiantes" fill={C_BLUE} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    }
                  </div>
                </div>
              )}

              {can.grafPagos && (
                <div className="dash-card">
                  <div className="dash-card-header">
                    <h3 className="dash-card-title">Matrículas Pendientes</h3>
                    <span className="dash-card-sub">Período actual · Top 5</span>
                  </div>
                  <div className="dash-card-inner">
                    {pagosData.length === 0 && !loading
                      ? <p className="dash-empty">{periodoId ? "Sin matrículas pendientes" : "Seleccione un período para ver las matrículas pendientes"}</p>
                      : (
                        <ul className="dash-pagos-list">
                          {pagosData.map((m, i) => (
                            <li key={i} className="dash-pagos-item">
                              <span className="dash-pagos-num">{i + 1}</span>
                              <div className="dash-pagos-info">
                                <span className="dash-pagos-nombre">
                                  {m.nombre ?? m.nombre_estudiante ?? m.estudiante ?? "Estudiante"}
                                </span>
                                <span className="dash-pagos-concepto">
                                  {m.telefono_acudiente
                                    ? `Tel: ${m.telefono_acudiente}`
                                    : (m.concepto ?? m.tipo ?? "Pago de Tesorería")}
                                </span>
                              </div>
                              <span className="dash-pagos-badge">Pendiente</span>
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </ModuleLayout>
    </div>
  );
}
