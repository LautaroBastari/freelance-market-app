import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import LogoutButton from "../../components/LogoutButton";
import AdminShell from "../../components/AdminPageShell";

type AdminHomeAlerta = {
  nivel: "info" | "warn" | "bad" | string;
  texto: string;
};

type AdminHomeResumen = {
  ventas_hoy_total: number;
  ventas_hoy_cant: number;

  resultado_mes_neto: number;
  stock_critico_cant: number;

  top_producto_hoy: null | {
    id_producto: number;
    nombre: string;
    cantidad: number;
    recaudado: number;
  };

  alertas: { nivel: string; texto: string }[];
};

function moneyARS(n: number) {
  // Enteros en pesos. Si después pasás a centavos, lo ajustamos.
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard(props: {
  title: string;
  value: string;
  sub: string;
  sub2?: string; // 👈 nuevo
  sub2Tone?: "neutral" | "good"; // 👈 opcional
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const tone = props.tone ?? "neutral";

  const toneClasses =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-amber-200"
      : tone === "bad"
      ? "border-rose-200"
      : "border-gray-200";

  const sub2Class =
    props.sub2Tone === "good" ? "text-emerald-700 font-medium" : "text-gray-500";

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${toneClasses}`}>
      <div className="text-xs font-medium text-gray-500">{props.title}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
        {props.value}
      </div>
      <div className="mt-1 text-xs text-gray-500">{props.sub}</div>

      {props.sub2 ? (
        <div className={`mt-1 text-xs tabular-nums ${sub2Class}`}>
          {props.sub2}
        </div>
      ) : null}
    </div>
  );
}

function QuickLink(props: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={props.to}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 transition inline-flex items-center justify-center gap-2"
    >
      <span aria-hidden="true">{props.icon}</span>
      <span>{props.label}</span>
    </Link>
  );
}

export default function AdminHome() {
  const [data, setData] = useState<AdminHomeResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function cargar() {
    try {
      setLoading(true);
      setErr(null);

      const r = await invoke<AdminHomeResumen>("admin_home_resumen");
      console.log("admin_home_resumen:", r); // <- dejalo 1 vez para verificar
      setData(r);
    } catch (e: any) {
      console.error(e);
      setErr(String(e?.message ?? e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const ventasHoyTotal = useMemo(() => {
    if (!data) return "—";
    return moneyARS(data.ventas_hoy_total);
  }, [data]);

  const ventasHoyCant = data?.ventas_hoy_cant ?? 0;



  const resultadoDiaSub = useMemo(() => {
    if (!data) return "Cargando…";
    if (data.ventas_hoy_cant === 0) return "Sin movimiento";
    return "Resultado neto del día";
  }, [data]);

  const resumenMes = useMemo(() => {
    if (!data) return "—";
    return moneyARS(data.resultado_mes_neto);
  }, [data]);

  const resumenMesSub = "Resultado neto del mes";

  const stockCritico = data?.stock_critico_cant ?? 0;
  const stockCriticoSub =
    stockCritico > 0 ? "Revisar reposición" : "Sin productos en mínimo";



  return (
    <AdminShell
      title="Estado del negocio"
      subtitle="Resumen operativo y financiero del día."
      actions={<LogoutButton />}
    >
      {/* Estado carga / error */}
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Error cargando resumen: {err}
          <button
            onClick={cargar}
            className="ml-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm hover:bg-rose-50"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas de hoy"
          value={loading ? "…" : ventasHoyTotal}
          sub={loading ? "Cargando…" : `${ventasHoyCant} ventas registradas`}
          tone="good"
        />

        <StatCard
          title="Resumen del mes"
          value={loading ? "…" : resumenMes}
          sub={resumenMesSub}
          tone="neutral"
        />

        <StatCard
          title="Producto más vendido"
          value={
            loading
              ? "…"
              : data?.top_producto_hoy
              ? data.top_producto_hoy.nombre
              : "—"
          }
          sub={
            loading
              ? "Cargando…"
              : data?.top_producto_hoy
              ? `${data.top_producto_hoy.cantidad} unidades`
              : "Sin ventas hoy"
          }
          sub2={
            loading
              ? ""
              : data?.top_producto_hoy
              ? moneyARS(data.top_producto_hoy.recaudado)
              : ""
          }
          sub2Tone="good"
          tone="neutral"
        />

        <StatCard
          title="Stock crítico"
          value={loading ? "…" : String(stockCritico)}
          sub={stockCriticoSub}
          tone={!loading && stockCritico > 0 ? "warn" : "neutral"}
        />
      </div>

      {/* Alertas */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-800">
            Alertas operativas
          </div>
          <button
            onClick={cargar}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Actualizar
          </button>
        </div>

        <div className="mt-2 space-y-1">
          {loading ? (
            <div className="text-sm text-gray-500">Cargando…</div>
          ) : data && data.alertas.length > 0 ? (
            data.alertas.map((a, i) => (
              <div
                key={i}
                className={`text-sm ${
                  a.nivel === "warn"
                    ? "text-amber-700"
                    : a.nivel === "bad"
                    ? "text-rose-700"
                    : "text-gray-600"
                }`}
              >
                • {a.texto}
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">
              No hay alertas operativas.
            </div>
          )}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-gray-800">
          Acciones rápidas
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <QuickLink to="/admin/gastos" icon="➕" label="Cargar gasto" />
          <QuickLink to="/admin/ventas-admin" icon="➕" label="Ventas" />
          <QuickLink to="/admin/stock" icon="📦" label="Ajustar stock" />
          <QuickLink to="/admin/pnl" icon="📊" label="Ver PnL" />
          <QuickLink to="/admin/reportes" icon="🧾" label="Ir a caja" />
        </div>
      </div>
    </AdminShell>
  );
}
