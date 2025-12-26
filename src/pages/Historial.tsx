import { useEffect, useState, useCallback, useMemo  } from "react";
import { invoke } from "@tauri-apps/api/core";

type ItemHistorial = {
  id_venta: number;
  hora: string; // viene de time(v.fecha_hora, 'localtime')
  codigo_producto: string;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total_venta: number;
  pagos_detalle: string | null; // puede ser null si no hay pagos
};

type GrupoVenta = {
  id_venta: number;
  hora: string;
  total_venta: number;
  pagos_detalle: string | null;
  items: ItemHistorial[];
};

export default function Historial() {
  const [items, setItems] = useState<ItemHistorial[]>([]);

    const grupos = useMemo<GrupoVenta[]>(() => {
    const map = new Map<number, GrupoVenta>();

    for (const it of items) {
      let g = map.get(it.id_venta);
      if (!g) {
        g = {
          id_venta: it.id_venta,
          hora: it.hora,
          total_venta: it.total_venta,
          pagos_detalle: it.pagos_detalle,
          items: [],
        };
        map.set(it.id_venta, g);
      }
      g.items.push(it);
    }

    return Array.from(map.values());
  }, [items]);

  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const cargarHistorial = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await invoke<ItemHistorial[]>("historial_ventas_hoy");
      setItems(res);
    } catch (e: unknown) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Error desconocido al cargar historial"
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const formatearDinero = (valor: number) =>
    valor.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Historial de ventas de hoy</h1>
          <p className="text-sm text-gray-500">
            Detalle de productos vendidos en el día actual (ventas finalizadas).
          </p>
        </div>

        <button
          onClick={cargarHistorial}
          disabled={cargando}
          className={`px-3 py-1.5 rounded text-sm border ${
            cargando
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* Estados generales */}
      {error && (
        <div className="text-sm text-red-600 border border-red-300 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      {!cargando && !error && items.length === 0 && (
        <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded p-3">
          No hay ventas finalizadas registradas para hoy.
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto border rounded bg-white dark:bg-gray-900">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium border-b">
                Hora
              </th>
              <th className="px-2 py-1.5 text-left font-medium border-b">
                Venta #
              </th>
              <th className="px-2 py-1.5 text-left font-medium border-b">
                Código
              </th>
              <th className="px-2 py-1.5 text-left font-medium border-b">
                Producto
              </th>
              <th className="px-2 py-1.5 text-right font-medium border-b">
                Cant.
              </th>
              <th className="px-2 py-1.5 text-right font-medium border-b">
                Precio
              </th>
              <th className="px-2 py-1.5 text-right font-medium border-b">
                Subtotal
              </th>
              <th className="px-2 py-1.5 text-right font-medium border-b">
                Total venta
              </th>
              <th className="px-2 py-1.5 text-left font-medium border-b">
                Pagos
              </th>
            </tr>
          </thead>
          <tbody>
                {grupos.map((grupo) =>
                    grupo.items.map((item, index) => {
                    const isFirst = index === 0;
                    const isLast = index === grupo.items.length - 1;

                    const rowBg =
                        "bg-yellow-50 hover:bg-yellow-100/70";

                    const borderClass = isLast
                        ? "border-b-2 border-yellow-300"
                        : "border-b border-yellow-200";

                    return (
                        <tr
                        key={`${grupo.id_venta}-${item.codigo_producto}-${index}`}
                        className={rowBg}
                        >

                        {isFirst && (
                            <td
                            className={`px-2 py-1.5 whitespace-nowrap align-top ${borderClass}`}
                            rowSpan={grupo.items.length}
                            >
                            {grupo.hora}
                            </td>
                        )}


                        {isFirst && (
                            <td
                            className={`px-2 py-1.5 whitespace-nowrap align-top ${borderClass}`}
                            rowSpan={grupo.items.length}
                            >
                            {grupo.id_venta}
                            </td>
                        )}


                        <td
                            className={`px-2 py-1.5 whitespace-nowrap ${borderClass}`}
                        >
                            {item.codigo_producto}
                        </td>
                        <td className={`px-2 py-1.5 ${borderClass}`}>{item.producto}</td>


                        <td
                            className={`px-2 py-1.5 text-right ${borderClass}`}
                        >
                            {item.cantidad}
                        </td>

                        <td
                            className={`px-2 py-1.5 text-right ${borderClass}`}
                        >
                            <span className="text-emerald-700">
                            {formatearDinero(item.precio_unitario)}
                            </span>
                        </td>


                        <td
                            className={`px-2 py-1.5 text-right ${borderClass}`}
                        >
                            <span className="text-emerald-700">
                            {formatearDinero(item.subtotal)}
                            </span>
                        </td>


                        {isFirst && (
                            <td
                            className={`px-2 py-1.5 text-right align-top ${borderClass}`}
                            rowSpan={grupo.items.length}
                            >
                            <span className="text-emerald-700 font-semibold">
                                {formatearDinero(grupo.total_venta)}
                            </span>
                            </td>
                        )}

    
                        {isFirst && (
                            <td
                            className={`px-2 py-1.5 text-xs align-top ${borderClass}`}
                            rowSpan={grupo.items.length}
                            >
                            {grupo.pagos_detalle || "-"}
                            </td>
                        )}
                        </tr>
                    );
                    })
                )}
                </tbody>

        </table>
      </div>
    </div>
  );
}
