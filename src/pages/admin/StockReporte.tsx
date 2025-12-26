import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

type StockReporteProducto = {
  id_producto: number;
  codigo_producto: string;
  nombre: string;
  stock_actual: number;
  costo_unitario: number;
  valor_total: number;
  porcentaje_valor: number;
  rotacion_dias?: number;          // días promedio que tarda en rotar
  dias_stock_restante?: number;    // días estimados antes de quedarte sin stock
  clasificacion_abc?: "A" | "B" | "C";
  variacion_pct?: number;          // cambio vs período anterior (%)
  riesgo?: "alto" | "medio" | "bajo";
};

type StockReporteResultado = {
  total_inventario: number;
  cantidad_productos: number;
  productos: StockReporteProducto[];
};

export default function StockReportePage() {
  const [soloActivos, setSoloActivos] = useState<boolean>(true);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockReporteResultado | null>(null);

  const formatearDinero = (valor: number) =>
    valor.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    });

  const formatearNumero = (valor: number) =>
    valor.toLocaleString("es-AR", {
      maximumFractionDigits: 0,
    });

  const formatearDias = (v?: number) =>
    v != null && Number.isFinite(v) ? `${v.toFixed(1)} d` : "—";

  const formatearPorcentaje = (v?: number) =>
    v != null && Number.isFinite(v) ? `${v.toFixed(1)}%` : "—";

  function badgeRiesgo(r?: string) {
    if (r === "alto") {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
          Riesgo alto
        </span>
      );
    }
    if (r === "medio") {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Riesgo medio
        </span>
      );
    }
    if (r === "bajo") {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Riesgo bajo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
        —
      </span>
    );
  }

  function tendenciaIcon(variacion?: number) {
    if (variacion == null || !Number.isFinite(variacion)) {
      return <span className="text-gray-400">—</span>;
    }
    if (variacion > 5) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
          ↑ {variacion.toFixed(1)}%
        </span>
      );
    }
    if (variacion < -5) {
      return (
        <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium">
          ↓ {variacion.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-gray-600 text-xs font-medium">
        → {variacion.toFixed(1)}%
      </span>
    );
  }

  const cargarReporte = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const res = await invoke<StockReporteResultado>("reporte_stock_general", {
        solo_activos: soloActivos,
      });

      setData(res);
    } catch (e: any) {
      console.error(e);
      setError(typeof e === "string" ? e : "Error al cargar el reporte.");
    } finally {
      setCargando(false);
    }
  }, [soloActivos]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);
  return (
    <div className="flex flex-col h-full w-full px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">


        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Reporte de stock
            </h1>
            <p className="text-sm text-gray-500">
              Resumen de inventario por producto y valor total.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
              className="rounded border-gray-300"
            />
            Solo productos activos
          </label>
          <button
            type="button"
            onClick={cargarReporte}
            disabled={cargando}
            className="
              px-3 py-1.5 rounded text-sm font-medium
              border border-amber-500
              text-amber-800
              bg-amber-50
              hover:bg-amber-100
              disabled:opacity-60 disabled:cursor-not-allowed
              transition
            "
          >
            {cargando ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Valor total de inventario
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-800">
            {data ? formatearDinero(data.total_inventario) : "—"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Cantidad de productos
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-800">
            {data ? formatearNumero(data.cantidad_productos) : "—"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Producto más valioso
          </p>
          {data && data.productos.length > 0 ? (
            (() => {
              const top = [...data.productos].sort(
                (a, b) => b.valor_total - a.valor_total
              )[0];
              return (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-800">
                    {top.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    Valor: {formatearDinero(top.valor_total)} (
                    {top.porcentaje_valor.toFixed(1)}% del inventario)
                  </p>
                </div>
              );
            })()
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sin datos.</p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Stock por producto
            </h2>
            <p className="text-xs text-gray-500">
              Detalle de stock, costo y valor de inventario.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            {data ? `${data.productos.length} producto(s)` : "—"}
          </p>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
    <tr>
      <th
        className="text-left px-5 py-2 font-medium"
        title="Código interno del producto."
      >
        Código
      </th>
      <th
        className="text-left px-3 py-2 font-medium"
        title="Nombre descriptivo del producto."
      >
        Nombre
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Stock físico actual registrado en el sistema."
      >
        Stock
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Costo unitario actual de este producto."
      >
        Costo unitario
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Valor total del inventario para este producto (stock × costo)."
      >
        Valor total
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Porcentaje del valor total de inventario que representa este producto."
      >
        % inventario
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Cada cuántos días, aproximadamente, se rota completamente el stock actual según las ventas de los últimos 30 días."
      >
        Rotación
      </th>
      <th
        className="text-right px-3 py-2 font-medium"
        title="Cantidad estimada de días que alcanza el stock actual si se mantiene el ritmo de ventas de los últimos 30 días."
      >
        Días stock
      </th>
      <th
        className="text-center px-3 py-2 font-medium"
        title="Importancia del producto según su peso en el valor total del inventario (A: muy importante, B: medio, C: menor)."
      >
        Importancia (ABC)
      </th>
      <th
        className="text-center px-3 py-2 font-medium"
        title="Nivel de riesgo de inventario según días de stock y categoría ABC."
      >
        Riesgo
      </th>
      <th
        className="text-right px-5 py-2 font-medium"
        title="Tendencia de demanda: si las ventas suben, bajan o se mantienen respecto a los 30 días anteriores."
      >
        Tendencia
      </th>
    </tr>
  </thead>

  <tbody>
    {data && data.productos.length > 0 ? (
      data.productos.map((p) => (
        <tr
          key={p.id_producto}
          className="border-t border-gray-100 hover:bg-gray-50/60"
        >
          <td className="px-5 py-2 text-gray-700">
            {p.codigo_producto}
          </td>
          <td className="px-3 py-2 text-gray-700">{p.nombre}</td>

          <td className="px-3 py-2 text-right text-gray-700">
            {formatearNumero(p.stock_actual)}
          </td>

          <td className="px-3 py-2 text-right text-gray-700">
            {formatearDinero(p.costo_unitario)}
          </td>

          <td className="px-3 py-2 text-right font-medium text-gray-800">
            {formatearDinero(p.valor_total)}
          </td>

          <td className="px-3 py-2 text-right text-gray-600">
            {p.porcentaje_valor.toFixed(1)}%
          </td>

          {/* Rotación */}
          <td className="px-3 py-2 text-right text-gray-700">
            {p.rotacion_dias != null
              ? `${p.rotacion_dias.toFixed(1)} d`
              : "—"}
          </td>

          {/* Días stock */}
          <td className="px-3 py-2 text-right text-gray-700">
            {p.dias_stock_restante != null
              ? `${p.dias_stock_restante.toFixed(1)} d`
              : "—"}
          </td>

          {/* ABC + Riesgo */}
          <td className="px-3 py-2 text-center">
            <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
              {p.clasificacion_abc ?? "—"}
            </span>
          </td>

          <td className="px-3 py-2 text-center">
            {badgeRiesgo(p.riesgo)} {/* tu helper de chips */}
          </td>

          {/* Tendencia (FLECHAS) */}
          <td className="px-5 py-2 text-right">
            {tendenciaIcon(p.variacion_pct)} {/* aquí siguen las flechas */}
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td
          className="px-5 py-6 text-center text-sm text-gray-400"
          colSpan={11}
        >
          {cargando
            ? "Cargando datos de stock..."
            : "No hay datos para mostrar."}
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
