import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

function StockPromocionesPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [combos, setCombos] = useState<any[]>([]);

  const recargarCombos = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await invoke<any[]>("promo_combo_listar", { soloActivos: true });
      setCombos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
      setCombos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recargarCombos();
  }, []);

  const eliminarCombo = async (idCombo: number) => {
    if (!confirm("¿Eliminar este combo?")) return;
    setLoading(true);
    setError("");
    try {
      await invoke("promo_combo_eliminar", { idCombo });
      await recargarCombos();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px] 2xl:grid-cols-[1fr_520px] items-start">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-900">Promociones</div>
          <button
            className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm disabled:opacity-60"
            onClick={recargarCombos}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Refrescar"}
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="space-y-2">
          {combos.map((c) => (
            <div key={c.id_combo} className="group relative rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
              <div className="font-medium text-gray-900">{c.nombre}</div>

              {c.resumen && (
                <div className="mt-1 text-xs text-gray-500 truncate">
                  {c.resumen}
                </div>
              )}

              <div className="mt-1 text-sm text-gray-700">
                Mínimo: ${Number(c.precio_min_total).toLocaleString("es-AR")}
              </div>

              <button
                className="
                  absolute right-3 top-3
                  rounded-md bg-gray-900 px-2 py-1 text-xs text-white hover:bg-black
                  opacity-0 pointer-events-none
                  group-hover:opacity-100 group-hover:pointer-events-auto
                  group-focus-within:opacity-100 group-focus-within:pointer-events-auto
                "
                onClick={() => eliminarCombo(c.id_combo)}
                disabled={loading}
              >
                Eliminar
              </button>
            </div>
          ))}

          {!loading && combos.length === 0 && (
            <div className="text-sm text-gray-500">No hay promociones activas.</div>
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-gray-200 bg-white shadow-md p-4">
        <div className="font-semibold text-gray-900">Detalle</div>
        <div className="text-sm text-gray-500 mt-1">
          Seleccioná un combo para ver sus productos.
        </div>
      </aside>
    </div>
  );
}
