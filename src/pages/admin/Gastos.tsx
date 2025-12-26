import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type UsuarioOpcion = {
  id_usuario: number;
  nombre: string;
};


type GastoRow = {
  id_gasto_negocio: number;
  fecha_hora: string;
  categoria: string;
  descripcion?: string | null;
  monto: number;
};

type SueldoRowView = {
  id_sueldo_pago: number;
  fecha_hora: string;
  descripcion: string;
  monto: number;
  id_usuario_destino: number;
  usuario_destino_nombre?: string; // si el backend ya devuelve view
};

type TotalOut = { total: number };

const money = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

function fechaCorta(fecha_hora: string) {
  if (!fecha_hora) return "";
  return fecha_hora.length >= 16 ? fecha_hora.slice(0, 16) : fecha_hora;
}

export default function Gastos() {

  const [tab, setTab] = useState<"gastos" | "sueldos">("gastos");
  function hoyISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function inicioMesISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-01`;
  }
  const [desde, setDesde] = useState(inicioMesISO());
  const [hasta, setHasta] = useState(hoyISO());

  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [sueldos, setSueldos] = useState<SueldoRowView[]>([]);

  const [totalGastos, setTotalGastos] = useState(0);
  const [totalSueldos, setTotalSueldos] = useState(0);

  // --- filtros / form gastos
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState<number | "">("");

  // --- sueldos: empleados
  const [usuarios, setUsuarios] = useState<UsuarioOpcion[]>([]);
  const [uidFiltro, setUidFiltro] = useState<number | "">(""); // opcional para filtrar
  const [uidDestino, setUidDestino] = useState<number | "">(""); // obligatorio al registrar

  const [cargando, setCargando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tituloTab = tab === "gastos" ? "Gastos" : "Sueldos";
  const totalActual = tab === "gastos" ? totalGastos : totalSueldos;

  const montoValido = typeof monto === "number" && Number.isFinite(monto) && monto > 0;
  const descripcionValida = descripcion.trim().length > 0;

  const CATEGORIAS_GASTO = ["Alquiler", "Servicios", "Impuestos", "Otros"] as const;
  type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];


  const categoriaFiltroNorm = useMemo(() => categoriaFiltro.trim(), [categoriaFiltro]);
  const categoriaNuevaNorm = useMemo(() => categoriaNueva.trim(), [categoriaNueva]);
  const empleados = usuarios;
  const puedeBuscar = !cargando && !!desde && !!hasta;

  const puedeRegistrar =
    !registrando &&
    descripcionValida &&
    montoValido &&
    (tab === "gastos" ? categoriaNuevaNorm.length > 0 : typeof uidDestino === "number");

  async function cargarUsuarios() {
    try {
      // Endpoint ya existente en tu sistema
      const rows = await invoke<UsuarioOpcion[]>("usuario_listar_opciones");
      setUsuarios(rows);
    } catch (e: any) {
      // No bloquea toda la pantalla, pero te lo marca
      setError((prev) => prev ?? `Error cargando usuarios: ${String(e)}`);
    }
  }

  async function cargar() {
    setCargando(true);
    setError(null);

    try {
      if (tab === "gastos") {
        const rows = await invoke<GastoRow[]>("gasto_listar_por_periodo", {
          filtro: {
            fecha_desde: desde,
            fecha_hasta: hasta,
            categoria: categoriaFiltroNorm ? categoriaFiltroNorm : null,
          },
        });

        const total = await invoke<TotalOut>("gasto_total_por_periodo", {
          input: {
            fecha_desde: desde,
            fecha_hasta: hasta,
            categoria: categoriaFiltroNorm ? categoriaFiltroNorm : null,
            id_usuario_destino: null,
          },
        });

        setGastos(rows);
        setTotalGastos(total.total);
      } else {
        const rows = await invoke<SueldoRowView[]>("sueldo_listar_por_periodo", {
          input: {
            fecha_desde: desde,
            fecha_hasta: hasta,
            id_usuario_destino: typeof uidFiltro === "number" ? uidFiltro : null,
          },
        });

        const total = await invoke<TotalOut>("sueldo_total_por_periodo", {
          input: {
            fecha_desde: desde,
            fecha_hasta: hasta,
            categoria: null,
            id_usuario_destino: typeof uidFiltro === "number" ? uidFiltro : null,
          },
        });

        setSueldos(rows);
        setTotalSueldos(total.total);
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setCargando(false);
    }
  }

  async function registrar() {
    setError(null);

    if (!descripcionValida) return setError("Descripción obligatoria.");
    if (!montoValido) return setError("Monto inválido (> 0).");

    try {
      setRegistrando(true);

      if (tab === "gastos") {
        if (!categoriaNuevaNorm) {
          setRegistrando(false);
          return setError("Categoría obligatoria.");
        }

        await invoke("gasto_registrar", {
          input: {
            categoria: categoriaNuevaNorm,
            descripcion: descripcion.trim(),
            monto: monto as number,
            fecha_hora: null,
          },
        });

        // limpiar form
        setCategoriaNueva("");
        setDescripcion("");
        setMonto("");
      } else {
        if (typeof uidDestino !== "number") {
          setRegistrando(false);
          return setError("Tenés que seleccionar el empleado destino.");
        }

        await invoke("sueldo_registrar", {
          input: {
            descripcion: descripcion.trim(),
            monto: monto as number,
            id_usuario_destino: uidDestino,
            fecha_hora: null,
          },
        });

        // limpiar form
        setDescripcion("");
        setMonto("");
        setUidDestino("");
      }

      await cargar();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setRegistrando(false);
    }
  }

  // cargar usuarios una vez
  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recargar al cambiar tab
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="p-5">
      <div className="mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gastos y Sueldos</h1>
            <p className="text-sm text-neutral-500">
              Registrá y consultá {tituloTab.toLowerCase()} por período.
            </p>
          </div>

          {/* Total */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-3 min-w-[220px]">
            <div className="text-xs text-neutral-500">Total ({tituloTab})</div>
            <div className="text-lg font-semibold tabular-nums">{money(totalActual)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab("gastos")}
            className={[
              "px-4 py-2 rounded-xl text-sm transition-all",
              tab === "gastos"
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-700 hover:bg-neutral-100",
            ].join(" ")}
          >
            Gastos
          </button>

          <button
            onClick={() => setTab("sueldos")}
            className={[
              "px-4 py-2 rounded-xl text-sm transition-all",
              tab === "sueldos"
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-700 hover:bg-neutral-100",
            ].join(" ")}
          >
            Sueldos
          </button>
        </div>

        {/* Filtros + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Filtros */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <div className="text-sm font-semibold">Período</div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs text-neutral-600">
                Desde
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </label>
              <label className="text-xs text-neutral-600">
                Hasta
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </label>
            </div>

            {/* filtros específicos */}
            {tab === "gastos" ? (
              <div className="mt-3">
                <label className="text-xs text-neutral-600">
                  Categoría (filtro opcional)
                  <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                >
                  <option value="">Todas</option>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                </label>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Dejá vacío para ver todas las categorías.
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label className="text-xs text-neutral-600">
                  Empleado (filtro opcional)
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                    value={uidFiltro}
                    onChange={(e) =>
                      setUidFiltro(e.target.value === "" ? "" : Number(e.target.value))
                    }
                  >
                    <option value="">Todos</option>
                    {empleados.map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre} (#{u.id_usuario})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Buscar SIEMPRE abajo */}
            <button
              onClick={cargar}
              disabled={!puedeBuscar}
              className={[
                "mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium border transition-all",
                puedeBuscar
                  ? "bg-white hover:bg-neutral-50 border-neutral-200"
                  : "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed",
              ].join(" ")}
              title="Recalcular lista y total"
            >
              {cargando ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Registrar {tituloTab}</div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {tab === "gastos" ? (
                <label className="text-xs text-neutral-600">
                  Categoría *
                  <select
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  value={categoriaNueva}
                  onChange={(e) => setCategoriaNueva(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                </label>
              ) : (
                <label className="text-xs text-neutral-600">
                  Empleado *
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                    value={uidDestino}
                    onChange={(e) =>
                      setUidDestino(e.target.value === "" ? "" : Number(e.target.value))
                    }
                  >
                    <option value="">Seleccionar…</option>
                    {empleados.map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre} (#{u.id_usuario})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs text-neutral-600 md:col-span-2">
                Descripción *
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  placeholder={tab === "gastos" ? "Ej: boleta de luz diciembre" : "Ej: sueldo jornada 13/12"}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>

              <label className="text-xs text-neutral-600">
                Monto (ARS) *
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-neutral-500">
                Campos obligatorios marcados con *.
              </div>

              <button
                onClick={registrar}
                disabled={!puedeRegistrar}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  puedeRegistrar
                    ? "bg-neutral-900 text-white hover:bg-neutral-800"
                    : "bg-neutral-200 text-neutral-500 cursor-not-allowed",
                ].join(" ")}
              >
                {registrando ? "Registrando..." : "Registrar"}
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
            <div className="text-sm font-semibold">Listado</div>
            <div className="text-xs text-neutral-500">
              {tab === "gastos" ? gastos.length : sueldos.length} registros
            </div>
          </div>

          <div className="overflow-auto">
            {tab === "gastos" ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr className="border-b border-neutral-200">
                    <th className="text-left font-semibold px-4 py-3 w-[220px]">Fecha</th>
                    <th className="text-left font-semibold px-4 py-3 w-[180px]">Categoría</th>
                    <th className="text-left font-semibold px-4 py-3">Descripción</th>
                    <th className="text-right font-semibold px-4 py-3 w-[160px]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                        No hay gastos para el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    gastos.map((g, idx) => (
                      <tr
                        key={g.id_gasto_negocio}
                        className={[
                          "border-b border-neutral-100 hover:bg-neutral-50",
                          idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">
                          {fechaCorta(g.fecha_hora)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700">
                            {g.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-900">
                          {g.descripcion ?? <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {money(g.monto)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr className="border-b border-neutral-200">
                    <th className="text-left font-semibold px-4 py-3 w-[220px]">Fecha</th>
                    <th className="text-left font-semibold px-4 py-3 w-[220px]">Empleado</th>
                    <th className="text-left font-semibold px-4 py-3">Descripción</th>
                    <th className="text-right font-semibold px-4 py-3 w-[160px]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {sueldos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                        No hay sueldos para el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    sueldos.map((s, idx) => (
                      <tr
                        key={s.id_sueldo_pago}
                        className={[
                          "border-b border-neutral-100 hover:bg-neutral-50",
                          idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 text-neutral-700 whitespace-nowrap">
                          {fechaCorta(s.fecha_hora)}
                        </td>

                        <td className="px-4 py-3 text-neutral-900">
                          {s.usuario_destino_nombre
                            ? s.usuario_destino_nombre
                            : `#${s.id_usuario_destino}`}
                          <span className="ml-2 text-xs text-neutral-500">
                            (id {s.id_usuario_destino})
                          </span>
                        </td>

                        <td className="px-4 py-3 text-neutral-900">{s.descripcion}</td>

                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {money(s.monto)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="text-[11px] text-neutral-500">
          Nota: el empleado “destino” es quien cobra el sueldo (id_usuario_destino). El usuario logueado es quien lo registra.
        </div>
      </div>
    </div>
  );
}
