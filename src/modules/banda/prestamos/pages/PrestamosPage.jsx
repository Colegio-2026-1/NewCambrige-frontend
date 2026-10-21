import React from 'react';
import usePrestamos from "../hooks/usePrestamos";
import { useAuth } from "../../../../api/AuthContext";

import Icon from '../../../../components/common/Icon';
import { mdiHome, mdiAccountMusic, mdiPiano } from '@mdi/js';
import { Home, LayoutList, ClipboardCheck } from "lucide-react";

import ModuleLayout from "../../../../components/layout/ModuleLayout";
import Sidebar from "../../../../components/layout/Sidebar";
import Header from "../../../../components/layout/header";
import DataTable from "../../../../components/shared/DataTable";
import SearchBar from "../../../../components/shared/searchBar";
import ActionButtons from "../../../../components/shared/ActionButtons";
import Alert from "../../../../components/shared/Alert";

import AgregarPrestamoModal from "../components/modals/AgregarPrestamoModal";
import DevolverInstrumentoModal from "../components/modals/DevolverInstrumentoModal";


const PrestamosPage = () => {
  const prestamos = usePrestamos();
  const { user, roles } = useAuth();

  const primerRol = roles?.[0];
  const rolTexto = typeof primerRol === 'object' ? primerRol.nombre : (primerRol || "Banda");
 
  const estudianteSel = prestamos.estudianteSeleccionado;
  const tieneP = estudianteSel ? prestamos.prestamos.some(p => String(p.id_estudiante) === String(estudianteSel.id_estudiante) && p.estado_entrega === "prestado") : false;


  if (prestamos.loading) return <div>Cargando...</div>;

  const menuBanda = [
  { 
    label: "Inicio", 
    path: "/banda", 
    icon: <Home size={18} /> 
  },
   { label: "Inventario", path: "/banda/inventario", icon: <Icon icon={mdiPiano} size={18} /> },
      { label: "Asignaciones", path: "/banda/prestamos", icon: <Icon icon={mdiAccountMusic} size={18} /> }
];

const renderBadge = (estado) => {
    const isPendiente = estado === "Pendiente";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "4px 12px", borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)", fontWeight: "var(--font-bold)",
        backgroundColor: isPendiente ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', 
        color: isPendiente ? 'var(--color-warning-dark)' : 'var(--color-success-dark)',
        textTransform: "uppercase", fontFamily: "var(--font-number)"
      }}>
        {estado}
      </span>
    );
  };

const columnasEstudiantes = [
    { key: "documento", label: "CÓDIGO",
      render: (value) => <span style={{ fontFamily: 'var(--font-number)', fontWeight: 400 }}>{value}</span>
     }, 
    { key: "nombre", label: "NOMBRE COMPLETO" },
    { key: "grado", label: "GRADO", render: (_, row) => prestamos.salonesMap[row.id_salon]?.grado || "—"  },
    { key: "grupo", label: "GRUPO", render: (_, row) => prestamos.salonesMap[row.id_salon]?.grupo || "_" },
    { 
      key: "instrumento_nombre", 
      label: "INSTRUMENTO",
      render: (val, row) => {
        const p = (prestamos.prestamos || []).find(p => String(p.id_estudiante) === String(row.id_estudiante) && p.estado_entrega === "prestado");
        return p ? <b style={{color: "var(--color-secondary)"}}>{p.instrumento_nombre}</b> : "—";
      }
    },
    { 
      key: "estado", 
      label: "ESTADO",
      render: (val, row) => {
        const tiene = prestamos.prestamos.some(p => String(p.id_estudiante) === String(row.id_estudiante) && p.estado_entrega === "prestado");
        return renderBadge(tiene ? "Pendiente" : "Disponible");
      }
    },
  ];

  
  return (
    <>
    <Header title="SISTEMA DE PAZ Y SALVO - NEW CAMBRIDGE SCHOOL" />

      <ModuleLayout
        sidebar={<Sidebar selectedMenu="Asignaciones" menuItems={menuBanda} user={{nombre: String(user?.nombre || ""), rol: String(rolTexto)}} logout={() => {}} />}
        actions={
          <ActionButtons
            filaSeleccionada={estudianteSel}
            botones={[
              { label: "Asignar Instrumento", onClick: () => prestamos.setModalAgregar(true), disabled: !estudianteSel || tieneP, variante: "primary" },
              { label: "Devolver Instrumento", onClick: () => prestamos.abrirModalDevolver(estudianteSel), disabled: !estudianteSel || !tieneP, variante: "secondary" },
            ]}
          />
        }
      >
        <Alert 
          isOpen={prestamos.alert.isOpen} 
          type={prestamos.alert.type} 
          title={prestamos.alert.title} 
          message={prestamos.alert.message} 
          onClose={prestamos.closeAlert} 
          />
          <SearchBar
            onChange={(key, value) => {
              if (key === "grado") {
                prestamos.setFiltroGrado(value);
                prestamos.setFiltroGrupo("");
              }
            }
          }
          fields={[
            { key: "documento", label: "Código", type: "text" },
            { key: "nombre", label: "Nombre", type: "text" },
            {
              key: "grado",
              label: "Grado",
              type: "select",
              options: prestamos.opcionesGrado
            },
            {
              key: "grupo",
              label: "Grupo",
              type: "select",
              options: prestamos.opcionesGrupo
            }
          ]
        }
        onSearch={(f) => {
          prestamos.setFiltroDocumento(f.documento);
          prestamos.setFiltroNombre(f.nombre);
          prestamos.setFiltroGrado(f.grado);
          prestamos.setFiltroGrupo(f.grupo);
          }
          }
          />
            <DataTable
             columns={columnasEstudiantes} rows={prestamos.estudiantesFiltrados} pageSize={10} onRowClick={(row) => prestamos.seleccionarEstudiante(row)} emptyText="No hay estudiantes"
          />
      </ModuleLayout>

      <AgregarPrestamoModal open={prestamos.modalAgregar} onClose={() =>
         prestamos.setModalAgregar(false)} form={prestamos.form} setForm={prestamos.setForm}
          instrumentos={prestamos.instrumentos} handleAgregar={prestamos.handleAgregar} />
      <DevolverInstrumentoModal open={prestamos.modalDevolver} onClose={() =>
         prestamos.setModalDevolver(false)} onConfirm={prestamos.handleDevolver}
          prestamo={prestamos.prestamoSeleccionado} form={prestamos.formDevolucion} setForm={prestamos.setFormDevolucion} errores={prestamos.errores} />
    </>
  );
};

export default PrestamosPage;