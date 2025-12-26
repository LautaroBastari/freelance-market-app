import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type PnlReporteInput = {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  group_by: "dia" | "semana" | "mes" | "total";
  id_usuario?: number | null;
  incluir_no_finalizadas?: boolean | null;
};

type PnlMeta = {
  desde: string;
  hasta: string;
  group_by: string;
  moneda: string;
  generado_en: string;
  criterio_costos: string;
  criterio_gastos_fijos: string;
};

type PnlTotales = {
  ventas_brutas: number;
  costo_mercaderia_vendida: number;
  margen_bruto: number;
  margen_bruto_pct: number | null;
  ingresos_extra: number;
  egresos_operativos: number;
  resultado_neto: number;
  resultado_neto_pct: number | null;
};

type PnlPeriodo = {
  periodo_key: string;
  desde: string;
  hasta: string;
  ventas_brutas: number;
  costo_mercaderia_vendida: number;
  margen_bruto: number;
  ingresos_extra: number;
  egresos_operativos: number;
  resultado_neto: number;
};

type PnlGastoCategoria = {
  categoria: string;
  ingresos: number;
  egresos: number;
  neto: number;
};

type PnlMedioPago = {
  medio: string;
  monto: number;
};

type PnlReporte = {
  meta: PnlMeta;
  totales: PnlTotales;
  periodos: PnlPeriodo[];
  gastos_por_categoria: PnlGastoCategoria[];
  ingresos_por_medio_pago?: PnlMedioPago[] | null;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function toYYYYMMDD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0=domingo
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeekSunday(d: Date) {
  const monday = startOfWeekMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function formatPct(x: number | null) {
  if (x === null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Card(props: {
  title: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const tone = props.tone ?? "neutral";
  return (
    <div
      className={cls(
        "rounded-xl border bg-white shadow-sm",
        tone === "good" && "border-emerald-200",
        tone === "bad" && "border-rose-200",
        tone === "warn" && "border-amber-200",
        tone === "neutral" && "border-slate-200"
      )}
    >
      <div className="p-4">
        <div className="text-xs font-medium text-slate-500">{props.title}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
          {props.value}
        </div>
        {props.sub ? (
          <div className="mt-1 text-xs text-slate-500">{props.sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-slate-200" />;
}

function SkeletonLine() {
  return <div className="h-4 w-full animate-pulse rounded bg-slate-100" />;
}

type Preset = "hoy" | "esta_semana" | "este_mes" | "custom" | "todo";

export default function PnL() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [preset, setPreset] = useState<Preset>("hoy");
  const [groupBy, setGroupBy] = useState<PnlReporteInput["group_by"]>("dia");

  const [desde, setDesde] = useState<string>(() => toYYYYMMDD(today));
  const [hasta, setHasta] = useState<string>(() => toYYYYMMDD(today));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PnlReporte | null>(null);

  useEffect(() => {
    const d = new Date(today);

    if (preset === "hoy") {
      setDesde(toYYYYMMDD(d));
      setHasta(toYYYYMMDD(d));
      setGroupBy("dia");
      return;
    }

    if (preset === "esta_semana") {
      const a = startOfWeekMonday(d);
      const b = endOfWeekSunday(d);
      setDesde(toYYYYMMDD(a));
      setHasta(toYYYYMMDD(b));
      setGroupBy("dia");
      return;
    }

    if (preset === "este_mes") {
      const a = startOfMonth(d);
      const b = endOfMonth(d);
      setDesde(toYYYYMMDD(a));
      setHasta(toYYYYMMDD(b));
      setGroupBy("dia");
      return;
    }

    if (preset === "todo") {
      setDesde("2000-01-01");
      setHasta(toYYYYMMDD(d));
      setGroupBy("mes");
      return;
    }
  }, [preset, today]);

  const cargar = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const input: PnlReporteInput = {
        desde,
        hasta,
        group_by: groupBy,
        id_usuario: null,
        incluir_no_finalizadas: false,
      };

      const res = await invoke<PnlReporte>("pnl_reporte", { input });
      setData(res);
    } catch (e: any) {
      setData(null);
      setErr(e?.toString?.() ?? "Error desconocido");
    } finally {
      setBusy(false);
    }
  }, [desde, hasta, groupBy]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tot = data?.totales ?? null;

  const resultadoTone = useMemo(() => {
    if (!tot) return "neutral" as const;
    if (tot.resultado_neto > 0) return "good" as const;
    if (tot.resultado_neto < 0) return "bad" as const;
    return "warn" as const;
  }, [tot]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-amber-50 via-white to-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                📊
              </div>

              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Pérdidas y Ganancias (PnL)
                </h1>
                <p className="mt-0.5 text-sm text-slate-600">
                  Análisis del resultado del negocio por período, incluyendo
                  ventas, costos y gastos.
                </p>

                {data?.meta?.generado_en ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Generado el{" "}
                    <span className="font-medium">{data.meta.generado_en}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:min-w-[420px]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  className={cls(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    preset === "hoy"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setPreset("hoy")}
                >
                  Hoy
                </button>

                <button
                  className={cls(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    preset === "esta_semana"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setPreset("esta_semana")}
                >
                  Semana
                </button>

                <button
                  className={cls(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    preset === "este_mes"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setPreset("este_mes")}
                >
                  Mes
                </button>

                <button
                  className={cls(
                    "h-9 rounded-lg border px-3 text-sm font-medium",
                    preset === "todo"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setPreset("todo")}
                >
                  Histórico
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-600">
                      Rango
                    </div>
                    <button
                      className="text-xs font-medium text-slate-700 hover:text-slate-900"
                      onClick={() => setPreset("custom")}
                      title="Habilitar edición manual"
                    >
                      Personalizar
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block">
                      <div className="mb-1 text-[11px] text-slate-500">
                        Desde
                      </div>
                      <input
                        type="date"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                        value={desde}
                        onChange={(e) => {
                          setPreset("custom");
                          setDesde(e.target.value);
                        }}
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-[11px] text-slate-500">
                        Hasta
                      </div>
                      <input
                        type="date"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                        value={hasta}
                        onChange={(e) => {
                          setPreset("custom");
                          setHasta(e.target.value);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-medium text-slate-600">
                    Agrupar
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as any)}
                    >
                      <option value="dia">Día</option>
                      <option value="semana">Semana</option>
                      <option value="mes">Mes</option>
                      <option value="total">Total</option>
                    </select>

                    <button
                      className={cls(
                        "h-9 rounded-lg border px-3 text-sm font-medium",
                        busy
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                      disabled={busy}
                      onClick={cargar}
                    >
                      {busy ? "Cargando…" : "Refrescar"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-medium text-slate-600">Estado</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {busy ? "Cargando…" : err ? "Con errores" : "Listo"}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {err ? "Revisá el mensaje abajo." : "Datos actualizados según el rango."}
                  </div>
                </div>
              </div>

              {err ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <div className="font-semibold">Error</div>
                  <div className="mt-1 break-words">{err}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {busy && !data ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <SkeletonLine />
                <div className="mt-3">
                  <SkeletonLine />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <SkeletonLine />
                <div className="mt-3">
                  <SkeletonLine />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <SkeletonLine />
                <div className="mt-3">
                  <SkeletonLine />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <SkeletonLine />
                <div className="mt-3">
                  <SkeletonLine />
                </div>
              </div>
            </>
          ) : (
            <>
              <Card
                title="Ventas brutas"
                value={formatARS(tot?.ventas_brutas ?? 0)}
                sub={`Rango: ${desde} → ${hasta}`}
              />
              <Card
                title="Costo mercadería vendida"
                value={formatARS(tot?.costo_mercaderia_vendida ?? 0)}
                sub="CMV(COGS)"
              />
              <Card
                title="Margen bruto"
                value={formatARS(tot?.margen_bruto ?? 0)}
                sub={`Margen: ${formatPct(tot?.margen_bruto_pct ?? null)}`}
                tone={(tot?.margen_bruto ?? 0) >= 0 ? "neutral" : "bad"}
              />
              <Card
                title="Resultado neto"
                value={formatARS(tot?.resultado_neto ?? 0)}
                sub={`Neto: ${formatPct(tot?.resultado_neto_pct ?? null)}`}
                tone={resultadoTone}
              />
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Períodos</div>
                <div className="mt-1 text-xs text-slate-500">
                  {groupBy === "total"
                    ? "Agrupación TOTAL (una sola fila)."
                    : "Sumatoria por período según el agrupamiento elegido."}
                </div>
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {data?.periodos?.length ?? 0} filas
              </div>
            </div>

            <Divider />

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Período</th>
                    <th className="px-4 py-3 text-right font-semibold">Ventas</th>
                    <th className="px-4 py-3 text-right font-semibold">CMV</th>
                    <th className="px-4 py-3 text-right font-semibold">Margen</th>
                    <th className="px-4 py-3 text-right font-semibold">Gastos</th>
                    <th className="px-4 py-3 text-right font-semibold">Neto</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {(data?.periodos ?? []).map((p) => {
                    const gastosNetos = p.egresos_operativos - p.ingresos_extra;
                    const netTone =
                      p.resultado_neto > 0
                        ? "text-emerald-700"
                        : p.resultado_neto < 0
                        ? "text-rose-700"
                        : "text-slate-700";

                    return (
                      <tr key={p.periodo_key} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {p.periodo_key}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.desde} → {p.hasta}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatARS(p.ventas_brutas)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatARS(p.costo_mercaderia_vendida)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatARS(p.margen_bruto)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums"
                          title="Egresos operativos - Ingresos extra"
                        >
                          {formatARS(gastosNetos)}
                        </td>
                        <td
                          className={cls(
                            "px-4 py-3 text-right tabular-nums font-semibold",
                            netTone
                          )}
                        >
                          {formatARS(p.resultado_neto)}
                        </td>
                      </tr>
                    );
                  })}

                  {!busy && (data?.periodos?.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-slate-500"
                        colSpan={6}
                      >
                        No hay datos en el rango seleccionado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4">
              <div className="text-sm font-semibold text-slate-900">
                Gastos por categoría
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Resumen del rango seleccionado.
              </div>
            </div>

            <Divider />

            <div className="p-4">
              <div className="space-y-3">
                {(data?.gastos_por_categoria ?? []).map((g) => {
                  const netTone =
                    g.neto > 0
                      ? "text-emerald-700"
                      : g.neto < 0
                      ? "text-rose-700"
                      : "text-slate-700";

                  return (
                    <div
                      key={g.categoria}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          {g.categoria}
                        </div>
                        <div
                          className={cls(
                            "text-sm font-semibold tabular-nums",
                            netTone
                          )}
                        >
                          {formatARS(g.neto)}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Ingresos:{" "}
                          <span className="font-semibold tabular-nums">
                            {formatARS(g.ingresos)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Egresos:{" "}
                          <span className="font-semibold tabular-nums">
                            {formatARS(g.egresos)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!busy && (data?.gastos_por_categoria?.length ?? 0) === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    No hay gastos cargados en el rango.
                  </div>
                ) : null}
              </div>
            </div>

            {data?.ingresos_por_medio_pago ? (
              <>
                <Divider />
                <div className="p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Ingresos por medio de pago
                  </div>

                  <div className="mt-3 space-y-2">
                    {data.ingresos_por_medio_pago.map((m) => (
                      <div
                        key={m.medio}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-slate-800">{m.medio}</div>
                        <div className="font-semibold tabular-nums text-slate-900">
                          {formatARS(m.monto)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
