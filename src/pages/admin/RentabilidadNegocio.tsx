import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  RentabilidadNegocioReporte,
  GananciasMesRow,
} from "../../api/reportes";
import type {
  Formatter,
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

function money(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  });
}

const tooltipMoneyFormatter: Formatter<ValueType, NameType> = (value, name) => {
  return [money(value), String(name)];
};

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBoundsNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const desde = new Date(y, m, 1);
  const hasta = new Date(y, m + 1, 0);
  return { desde: isoDate(desde), hasta: isoDate(hasta) };
}

export default function RentabilidadNegocio() {
  const [reporte, setReporte] = useState<RentabilidadNegocioReporte | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoLectura = useMemo(() => {
    if (!reporte) return null;

    const m = reporte.margen_neto_pct;

    if (m >= 20) {
      return {
        color: "green" as const,
        titulo: "Rentabilidad saludable",
        texto: "El negocio genera ganancia de forma consistente.",
      };
    }

    if (m >= 5) {
      return {
        color: "yellow" as const,
        titulo: "Atención en costos",
        texto: "La ganancia existe, pero el margen está bajando.",
      };
    }

    return {
      color: "red" as const,
      titulo: "Riesgo operativo",
      texto: "Los gastos están comprometiendo la ganancia.",
    };
  }, [reporte]);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { desde, hasta } = monthBoundsNow();

      const res = await invoke<RentabilidadNegocioReporte>(
        "reporte_rentabilidad_negocio",
        { desde, hasta }
      );

      setReporte(res);
    } catch (e: any) {
      console.error("reporte_rentabilidad_negocio error:", e);
      setError(
        typeof e === "string"
          ? e
          : e?.message ?? "No se pudo cargar Ganancias"
      );
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const comparativa = useMemo(() => {
    const actual = reporte?.rentabilidad_neta ?? 0;
    const anterior = reporte?.rentabilidad_mes_anterior ?? 0;
    const delta = actual - anterior;
    const pct = anterior !== 0 ? (delta / Math.abs(anterior)) * 100 : 0;
    return { actual, anterior, delta, pct };
  }, [reporte]);

  const rows: GananciasMesRow[] = useMemo(
    () => reporte?.tendencia_mensual ?? [],
    [reporte]
  );

  const dataLinea = useMemo(
    () =>
      rows.map((m) => ({
        mes: m.mes,
        ganancia: m.ganancia_neta ?? 0,
      })),
    [rows]
  );

  const dataBarras = useMemo(
    () =>
      rows.map((m) => ({
        mes: m.mes,
        Ventas: m.ventas ?? 0,
        COGS: m.cogs ?? 0,
        Gastos: m.gastos ?? 0,
      })),
    [rows]
  );

  const estadoKpi = comparativa.actual >= 0 ? "ok" : "bad";
  const estadoDelta = comparativa.delta >= 0 ? "ok" : "bad";

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Ganancias</h1>
          <div className="text-sm text-slate-500">
            Lectura estratégica mes a mes. No confundir con caja.
          </div>
        </div>

        <button
          onClick={cargar}
          disabled={loading}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-sm font-medium"
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Ganancia neta
          </div>
          <div
            className={`mt-2 text-3xl font-bold ${
              estadoKpi === "ok" ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {money(reporte?.rentabilidad_neta)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Período:{" "}
            <span className="font-medium">
              {reporte?.fecha_desde ?? "—"} → {reporte?.fecha_hasta ?? "—"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Comparativa vs mes anterior
          </div>
          <div
            className={`mt-2 text-2xl font-semibold ${
              estadoDelta === "ok" ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {estadoDelta === "ok" ? "▲" : "▼"} {money(comparativa.delta)}{" "}
            <span className="text-sm font-medium text-slate-500">
              ({comparativa.pct.toFixed(1)}%)
            </span>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Mes anterior:{" "}
            <span className="font-medium">{money(comparativa.anterior)}</span>
          </div>
        </div>

        {estadoLectura && (
          <div
            className={`
              border rounded-2xl p-5 shadow-sm
              ${
                estadoLectura.color === "green"
                  ? "bg-green-50 border-green-200"
                  : estadoLectura.color === "yellow"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }
            `}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Lectura rápida
            </div>

            <div className="mt-2 flex items-start gap-2">
              <span className="text-lg">
                {estadoLectura.color === "green" && "🟢"}
                {estadoLectura.color === "yellow" && "🟡"}
                {estadoLectura.color === "red" && "🔴"}
              </span>

              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {estadoLectura.titulo}
                </div>
                <div className="text-sm text-slate-700">
                  {estadoLectura.texto}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-800">
              Tendencia mensual de ganancia
            </div>
            <div className="text-xs text-slate-500">
              Últimos {rows.length} meses
            </div>
          </div>

          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataLinea}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={tooltipMoneyFormatter} />
                <Line
                  type="monotone"
                  dataKey="ganancia"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-800">
              Ventas vs CMV vs Gastos
            </div>
            <div className="text-xs text-slate-500">Mismo rango mensual</div>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            COGS = Costo de mercadería vendida (CMV).
          </p>

          <div className="mt-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataBarras}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={tooltipMoneyFormatter} />
                <Bar dataKey="Ventas" />
                <Bar dataKey="COGS" />
                <Bar dataKey="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="text-sm font-medium text-slate-800 mb-3">
          Detalle mensual
        </div>

        <div className="overflow-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="text-slate-500">
              <tr className="border-b">
                <th className="text-left py-2">Mes</th>
                <th className="text-right py-2">Ventas</th>
                <th className="text-right py-2">CMV</th>
                <th className="text-right py-2">Gastos</th>
                <th className="text-right py-2">Ganancia neta</th>
              </tr>
            </thead>

            <tbody className="text-slate-700">
              {rows.map((m) => {
                const g = (m.ganancia_neta ?? 0) as number;
                return (
                  <tr key={m.mes} className="border-b last:border-0">
                    <td className="py-2 font-medium">{m.mes}</td>
                    <td className="py-2 text-right">{money(m.ventas)}</td>
                    <td className="py-2 text-right">{money(m.cogs)}</td>
                    <td className="py-2 text-right">{money(m.gastos)}</td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        g >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {money(g)}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No hay datos mensuales para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
