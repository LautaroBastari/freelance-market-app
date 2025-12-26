import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ProductoRentabilidad = {
  id_producto: number;
  nombre: string;
  cantidad_vendida: number;
  ingreso_total: number;
  costo_total: number;
  ganancia: number;
};

type RentabilidadReporte = {
  fecha_desde: string;
  fecha_hasta: string;
  total_ventas: number;
  total_costos: number;
  ganancia_bruta: number;
  margen_pct: number;
  productos: ProductoRentabilidad[];
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function primerDiaMesActual(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function RentabilidadPage() {
  const [desde, setDesde] = useState(primerDiaMesActual);
  const [hasta, setHasta] = useState(hoyISO);
  const [data, setData] = useState<RentabilidadReporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<"hoy" | "semana" | "mes">("mes");

  const aplicarPreset = (p: "hoy" | "semana" | "mes") => {
    const hoy = new Date();
    if (p === "hoy") {
      const iso = hoy.toISOString().slice(0, 10);
      setDesde(iso);
      setHasta(iso);
    } else if (p === "semana") {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - 6);
      setDesde(d.toISOString().slice(0, 10));
      setHasta(hoy.toISOString().slice(0, 10));
    } else {
      // mes actual
      const d = new Date(hoy);
      d.setDate(1);
      setDesde(d.toISOString().slice(0, 10));
      setHasta(hoy.toISOString().slice(0, 10));
    }
    setPreset(p);
  };

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await invoke<RentabilidadReporte>(
        "reporte_rentabilidad",
        {
          desde,
          hasta,
        }
      );
      setData(res);
    } catch (e: any) {
      console.error(e);
      setError(String(e));
    } finally {
      setCargando(false);
    }
  };

  // cargar al entrar (mes actual)
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatearDinero = (valor: number) =>
    valor.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    });

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-yellow-50 via-white to-white px-6 py-5">
      <div className="w-full">
        {/* Título */}
        <header className="flex items-center justify-between gap-4 mb-4">
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
              <span>Rentabilidad</span>
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Margen por periodo y por producto, usando costo histórico.
            </p>
          </div>

          <button
            onClick={cargar}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {cargando && (
              <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            )}
            <span>{cargando ? "Calculando…" : "Actualizar"}</span>
          </button>
        </header>

        {/* Filtros + resumen */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)] mb-4">
          {/* Filtros */}
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">
              Filtros
            </h2>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => aplicarPreset("hoy")}
                className={`px-3 py-1 text-xs rounded-full border ${
                  preset === "hoy"
                    ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => aplicarPreset("semana")}
                className={`px-3 py-1 text-xs rounded-full border ${
                  preset === "semana"
                    ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Últimos 7 días
              </button>
              <button
                onClick={() => aplicarPreset("mes")}
                className={`px-3 py-1 text-xs rounded-full border ${
                  preset === "mes"
                    ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Mes actual
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 items-end">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white/80"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white/80"
                />
              </div>
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
                Periodo
              </div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">
                {data
                  ? `${data.fecha_desde} → ${data.fecha_hasta}`
                  : `${desde} → ${hasta}`}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Total vendido
              </div>
              <div className="mt-1 text-xl font-semibold text-neutral-900">
                {formatearDinero(data?.total_ventas ?? 0)}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Ganancia bruta / Margen
              </div>
              <div className="mt-1 text-lg font-semibold text-green-700">
                {formatearDinero(data?.ganancia_bruta ?? 0)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Margen:{" "}
                {data
                  ? `${data.margen_pct.toFixed(1)} %`
                  : "0.0 %"}
              </div>
            </div>
          </div>
        </section>

        {/* Tabla de productos */}
        <section className="rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-800">
              Rentabilidad por producto
            </h2>
            {data && (
              <span className="text-xs text-neutral-500">
                {data.productos.length} producto(s)
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50/80 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    Producto
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Cantidad
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Ingreso
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Costo
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Ganancia
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Margen
                  </th>
                </tr>
              </thead>
              <tbody>
                {data && data.productos.length > 0 ? (
                  data.productos.map((p) => {
                    const margen =
                      p.ingreso_total > 0
                        ? (p.ganancia * 100) /
                          p.ingreso_total
                        : 0;
                    return (
                      <tr
                        key={p.id_producto}
                        className="border-t border-neutral-100 hover:bg-neutral-50/70"
                      >
                        <td className="px-3 py-2 align-middle text-neutral-800">
                          {p.nombre}
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          {p.cantidad_vendida}
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          {formatearDinero(p.ingreso_total)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          {formatearDinero(p.costo_total)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right font-medium">
                          {formatearDinero(p.ganancia)}
                        </td>
                        <td className="px-3 py-2 align-middle text-right text-xs">
                          {margen.toFixed(1)} %
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-sm text-neutral-500"
                    >
                      No hay datos de rentabilidad para ese período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
