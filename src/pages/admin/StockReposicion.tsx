import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ReposicionModo = "unitario" | "cajon";

type StockReposicionRow = {
  id_producto: number;
  codigo_producto: string;
  nombre: string;
  vendidos: number; // unidades base
  reposicion_modo: ReposicionModo;
  reposicion_factor: number;
};

type Preset = "hoy" | "7d" | "mes";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatearCantidad(vendidos: number, modo: ReposicionModo, factor: number) {
  if (modo === "unitario") return `${vendidos} unidades`;

  const f = factor > 0 ? factor : 12;
  const cajones = Math.floor(vendidos / f);
  const resto = vendidos % f;

  if (cajones > 0 && resto > 0) return `${cajones} cajones + ${resto}`;
  if (cajones > 0) return `${cajones} cajones`;
  return `${resto}`;
}

export default function StockReposicion() {
  // default: últimos 7 días (incluye hoy)
  const [preset, setPreset] = useState<Preset>("7d");
  const [desde, setDesde] = useState<string>(() => toISODate(addDays(new Date(), -6)));
  const [hasta, setHasta] = useState<string>(() => toISODate(new Date()));

  const [rows, setRows] = useState<StockReposicionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //Modal editar modo 
  const [openModo, setOpenModo] = useState(false);
  const [savingModo, setSavingModo] = useState(false);
  const [sel, setSel] = useState<StockReposicionRow | null>(null);
  const [modo, setModo] = useState<ReposicionModo>("unitario");
  const [factor, setFactor] = useState<number>(12);

  const invalidRange = useMemo(() => {
    if (!desde || !hasta) return true;
    return desde > hasta; 
  }, [desde, hasta]);

  const aplicarPreset = (p: Preset) => {
    const now = new Date();
    if (p === "hoy") {
      setDesde(toISODate(now));
      setHasta(toISODate(now));
    } else if (p === "7d") {
      setDesde(toISODate(addDays(now, -6)));
      setHasta(toISODate(now));
    } else {
      setDesde(toISODate(firstDayOfMonth(now)));
      setHasta(toISODate(now));
    }
    setPreset(p);
  };

  const cargar = async () => {
    if (invalidRange) return;

    try {
      setLoading(true);
      setError(null);

      const data = await invoke<StockReposicionRow[]>("reporte_stock_reposicion", {
        input: { desde, hasta },
      });

      setRows(data);
    } catch (e: any) {
      setError(typeof e === "string" ? e : (e?.message ?? "Error al cargar reposición"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [desde, hasta]);

  const abrirModo = (r: StockReposicionRow) => {
    setSel(r);
    setModo(r.reposicion_modo ?? "unitario");
    setFactor(r.reposicion_factor && r.reposicion_factor > 0 ? r.reposicion_factor : 12);
    setOpenModo(true);
  };

  const cerrarModo = () => {
    if (savingModo) return;
    setOpenModo(false);
    setSel(null);
  };

  const guardarModo = async () => {
    if (!sel) return;

    if (modo === "cajon") {
      if (!Number.isFinite(factor) || factor <= 0) {
        setError("Unidades por cajón inválidas (debe ser > 0).");
        return;
      }
    }

    setSavingModo(true);
    try {
      await invoke("producto_actualizar_reposicion", {
        input: {
          id_producto: sel.id_producto,
          reposicion_modo: modo,
          reposicion_factor: modo === "cajon" ? Math.trunc(factor) : 12,
        },
      });

      // refrescar tabla para que se vea el cambio
      await cargar();
      setOpenModo(false);
      setSel(null);
    } catch (e: any) {
      setError(typeof e === "string" ? e : (e?.message ?? "No se pudo actualizar reposición"));
    } finally {
      setSavingModo(false);
    }
  };

  return (
    
    <div className="p-4 space-y-4">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition"
          >
            ← Volver
          </button>

          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Reposición</h1>
            <p className="text-sm text-gray-500">
              Productos vendidos en el período para planificar reabastecimiento.
            </p>
          </div>
        </div>

        <div />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-gray-800">Filtros</div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => aplicarPreset("hoy")}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              preset === "hoy"
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Hoy
          </button>

          <button
            onClick={() => aplicarPreset("7d")}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              preset === "7d"
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Últimos 7 días
          </button>

          <button
            onClick={() => aplicarPreset("mes")}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              preset === "mes"
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Mes actual
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPreset(null as any);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPreset(null as any);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {invalidRange && (
          <div className="mt-3 text-sm text-red-700">
            Rango inválido: “Desde” no puede ser mayor que “Hasta”.
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-gray-500">Cargando…</div>}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-24">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 w-40">Vendido</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 w-28">Modo</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map((r, idx) => {
                const vendidoTxt = formatearCantidad(r.vendidos, r.reposicion_modo, r.reposicion_factor);
                const isZero = r.vendidos === 0;

                return (
                  <tr key={r.id_producto} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-4 py-3 text-gray-600">{r.codigo_producto}</td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.nombre}</div>
                      <div className="text-xs text-gray-500">
                        {r.reposicion_modo === "cajon" ? `Cajón (${r.reposicion_factor || 12})` : "Unitario"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                          isZero ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-800",
                        ].join(" ")}
                      >
                        {vendidoTxt}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => abrirModo(r)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                    No hay ventas en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar modo */}
      {openModo && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">Modo de reposición</div>
                <div className="text-sm text-gray-600">
                  {sel.nombre} ({sel.codigo_producto})
                </div>
              </div>

              <button
                onClick={cerrarModo}
                className="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-60"
                disabled={savingModo}
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-800">Reposición</div>

              <div className="mt-3 flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="modo"
                    value="unitario"
                    checked={modo === "unitario"}
                    onChange={() => setModo("unitario")}
                    disabled={savingModo}
                  />
                  Unitario
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="modo"
                    value="cajon"
                    checked={modo === "cajon"}
                    onChange={() => setModo("cajon")}
                    disabled={savingModo}
                  />
                  Cajones
                </label>
              </div>

              {modo === "cajon" && (
                <div className="mt-3 grid gap-1">
                  <span className="text-xs text-gray-600">Unidades por cajón</span>
                  <input
                    type="number"
                    min={1}
                    className="h-11 w-40 rounded-lg border border-gray-300 px-3"
                    value={factor}
                    onChange={(e) => setFactor(Number(e.target.value || 12))}
                    disabled={savingModo}
                  />
                  <div className="text-xs text-gray-500">Ej: 12 maples por cajón</div>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={cerrarModo}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                disabled={savingModo}
              >
                Cancelar
              </button>

              <button
                onClick={guardarModo}
                className="rounded bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
                disabled={savingModo}
              >
                {savingModo ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
