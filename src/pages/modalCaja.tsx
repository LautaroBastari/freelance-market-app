import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

type CajaResumenMedio = {
  medio: string;
  total_medio: number;
};

type CajaResumenCierreHoy = {
  id_cajas: number[];
  fecha_min: string | null;
  fecha_max: string | null;
  cantidad_cajas: number;
  cantidad_ventas: number;
  total_general: number;
  por_medio: CajaResumenMedio[];
};

export default function ModalCaja() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<CajaResumenCierreHoy | null>(null);

  const formatearDinero = (valor: number) =>
    valor.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });

  const abrirModal = useCallback(async () => {
    setAbierto(true);
    setCargando(true);
    setError(null);
    setResumen(null);

    try {
      const res = await invoke<CajaResumenCierreHoy>("caja_resumen_diario");
      setResumen(res);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Error al obtener el resumen de caja");
    } finally {
      setCargando(false);
    }
  }, []);

  const cerrarModal = () => {
    if (cerrando) return;
    setAbierto(false);
    setError(null);
    setResumen(null);
  };

  return (
    <>
      {/* Botón */}
      <button
        onClick={abrirModal}
        className="px-3 py-1.5 rounded text-sm font-medium border border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100"
      >
        Reporte diario de caja
      </button>

      {/* Modal */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 border border-amber-300">
            <div className="px-4 py-3 border-b border-amber-200 flex justify-between">
              <h2 className="text-base font-semibold">Cierre de caja</h2>
              <button
                onClick={cerrarModal}
                className="text-gray-500 hover:text-gray-800 text-xl"
              >
                ×
              </button>
            </div>

            <div className="px-4 py-3 space-y-3 text-sm">
              {cargando && <p>Cargando resumen…</p>}
              {error && (
                <div className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {error}
                </div>
              )}

              {!cargando && !error && resumen && (
                <>
                  <p>
                    <strong>Cajas abiertas hoy:</strong>{" "}
                    {resumen.cantidad_cajas}
                  </p>
                  <p>
                    <strong>Ventas finalizadas:</strong>{" "}
                    {resumen.cantidad_ventas}
                  </p>
                  <p>
                    <strong>Total general:</strong>{" "}
                    <span className="text-emerald-700 font-semibold">
                      {formatearDinero(resumen.total_general)}
                    </span>
                  </p>

                  <div className="border-t border-amber-200 pt-2">
                    <p className="font-medium mb-1">Por medio de pago:</p>
                    {resumen.por_medio.length === 0 && (
                      <p className="text-xs text-gray-500">
                        No hay ventas finalizadas hoy.
                      </p>
                    )}

                    <ul className="space-y-1">
                      {resumen.por_medio.map((m) => (
                        <li
                          key={m.medio}
                          className="flex justify-between capitalize"
                        >
                          {m.medio}
                          <span className="font-semibold text-emerald-700">
                            {formatearDinero(m.total_medio)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-amber-200 flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                className="px-3 py-1.5 rounded border border-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
