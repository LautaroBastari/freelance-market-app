import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type VentaAdminRow = {
  id_venta: number;
  fecha_hora: string;
  usuario: string;
  id_usuario: number;
  id_caja: number;
  total: number;
  estado: string;
};

type CajaAdminRow = {
  id_caja: number;
  abierta_por: number;
  nombre_usuario: string;
  abierta_en: string;
  cerrada_en: string | null;
  estado: string;
  cantidad_ventas: number;
  total_caja: number;
};

type AdminHistorialDia = {
  fecha: string;
  id_usuario: number | null;
  ventas: VentaAdminRow[];
  cajas: CajaAdminRow[];
  total_dia: number;
  cantidad_ventas: number;
  promedio_ticket: number;
};

type UsuarioOpcion = {
  id_usuario: number;
  nombre: string;
};

export default function AdminHistorialPage() {
  const hoy = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(hoy);
  const [usuarioId, setUsuarioId] = useState<number | "todos">("todos");
  const [usuarios, setUsuarios] = useState<UsuarioOpcion[]>([]);
  const [data, setData] = useState<AdminHistorialDia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Cargar SIEMPRE la lista completa de usuarios activos
  useEffect(() => {
    async function cargarUsuarios() {
      try {
        const lista = await invoke<UsuarioOpcion[]>("usuario_listar_opciones");
        setUsuarios(lista);
      } catch (err) {
        console.error("Error cargando usuarios:", err);
      }
    }

    cargarUsuarios();
  }, []);

  // 2) Cargar el historial (ventas + cajas) para la fecha/usuario seleccionados
  const cargarHistorial = async () => {
    setCargando(true);
    setError(null);
    try {
      const id_usuario =
        usuarioId === "todos" ? null : Number(usuarioId);

      const res = await invoke<AdminHistorialDia>("admin_historial_dia", {
        fecha,
        idUsuario: id_usuario, // camelCase → Rust: id_usuario
      });

      setData(res);
      // ⚠️ IMPORTANTE: acá NO se toca setUsuarios
    } catch (e: any) {
      setError(String(e));
    } finally {
      setCargando(false);
    }
  };

  // Cargar al entrar, día actual por defecto
  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-yellow-50 via-white to-white px-6 py-5">
      <div className="w-full">
        {/* Título */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-800 border border-yellow-200">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M3 3v18h18" />
                  <rect x="5" y="10" width="3" height="7" />
                  <rect x="11" y="6" width="3" height="11" />
                  <rect x="17" y="13" width="3" height="4" />
                </svg>
              </span>
              <span>Cajas</span>
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Historial del administrador para consultar ventas y cajas por día.
            </p>
          </div>

          <button
            onClick={cargarHistorial}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {cargando && (
              <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            )}
            <span>{cargando ? "Actualizando…" : "Actualizar"}</span>
          </button>
        </header>

        {/* Filtros + resumen */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] mb-6">
          {/* Filtros */}
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">
              Filtros
            </h2>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto] items-end">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white/80"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Usuario
                </label>
                <select
                  value={usuarioId}
                  onChange={(e) =>
                    setUsuarioId(
                      e.target.value === "todos"
                        ? "todos"
                        : Number(e.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm shadow-sm bg-white/80 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="todos">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={cargarHistorial}
                disabled={cargando}
                className="mt-1 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {cargando ? "Buscando…" : "Buscar"}
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>

          {/* Resumen */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Fecha
              </div>
              <div className="mt-1 text-base font-semibold text-neutral-900">
                {data?.fecha || fecha}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Cantidad de ventas
              </div>
              <div className="mt-1 text-xl font-semibold text-neutral-900">
                {data?.cantidad_ventas ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Total del día
              </div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">
                {data
                  ? data.total_dia.toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    })
                  : "$ 0,00"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Ticket promedio:{" "}
                {data
                  ? data.promedio_ticket.toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      maximumFractionDigits: 2,
                    })
                  : "$ 0,00"}
              </div>
            </div>
          </div>
        </section>

        {/* Contenido principal */}
        <section className="space-y-4">
          {/* Ventas del día */}
          <div className="rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800">
                Ventas del día
              </h2>
              {data && (
                <span className="text-xs text-neutral-500">
                  {data.cantidad_ventas} registro(s)
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50/80 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Hora</th>
                    <th className="px-3 py-2 text-left font-medium">Usuario</th>
                    <th className="px-3 py-2 text-left font-medium">Caja</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.ventas.length > 0 ? (
                    data.ventas.map((v) => (
                      <tr
                        key={v.id_venta}
                        className="border-t border-neutral-100 hover:bg-neutral-50/70"
                      >
                        <td className="px-3 py-2 align-middle text-neutral-800">
                          {v.fecha_hora.slice(11, 16)}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {v.usuario}
                        </td>
                        <td className="px-3 py-2 align-middle text-neutral-700">
                          #{v.id_caja}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-medium">
                          {v.total.toLocaleString("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          })}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs">
                          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 border border-green-100">
                            {v.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-sm text-neutral-500"
                      >
                        No hay ventas para ese filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cajas del día */}
          <div className="rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800">
                Cajas del día
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50/80 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Caja</th>
                    <th className="px-3 py-2 text-left font-medium">Usuario</th>
                    <th className="px-3 py-2 text-left font-medium">Apertura</th>
                    <th className="px-3 py-2 text-left font-medium">Cierre</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-right font-medium">Ventas</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Total caja
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data && data.cajas.length > 0 ? (
                    data.cajas.map((c) => (
                      <tr
                        key={c.id_caja}
                        className="border-t border-neutral-100 hover:bg-neutral-50/70"
                      >
                        <td className="px-3 py-2 align-middle text-neutral-800">
                          #{c.id_caja}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {c.nombre_usuario}
                        </td>
                        <td className="px-3 py-2 align-middle text-neutral-700">
                          {c.abierta_en.slice(11, 16)}
                        </td>
                        <td className="px-3 py-2 align-middle text-neutral-700">
                          {c.cerrada_en ? c.cerrada_en.slice(11, 16) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs">
                          <span className="inline-flex rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 border border-neutral-200">
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          {c.cantidad_ventas}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-medium">
                          {c.total_caja.toLocaleString("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-4 text-center text-sm text-neutral-500"
                      >
                        No hay cajas para ese día.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
