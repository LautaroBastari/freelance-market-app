import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

type ProductoDisponible = {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  stock_disponible: number;
};

export default function VentasPage() {
  const [productos, setProductos] = useState<ProductoDisponible[]>([]);
  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Estado del modal de confirmación de cierre
  const [confirmCerrarOpen, setConfirmCerrarOpen] = useState<boolean>(false);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // TEST: ping al backend (para verificar conexión Tauri)
  useEffect(() => {
    (async () => {
      try {
        const r = await invoke<string>("ping_inline");
        console.log("ping_inline:", r);
      } catch (err) {
        console.error("invoke ping_inline FAILED:", err);
        try { console.error("as JSON:", JSON.stringify(err)); } catch {}
        alert("invoke ping_inline FAILED:\n" + String(err));
      }
    })();
  }, []);

  // Seed de productos (dummy)
  useEffect(() => {
    setProductos([
      { id_producto: 1, nombre: "Café molido 500 g", precio_unitario: 3500, stock_disponible: 12 },
      { id_producto: 2, nombre: "Leche entera 1 L",  precio_unitario: 1400, stock_disponible: 30 },
      { id_producto: 3, nombre: "Azúcar 1 kg",       precio_unitario: 1200, stock_disponible: 22 },
    ]);
  }, []);

  // Hidratar estado real desde backend (sesión ya iniciada)
  useEffect(() => {
    (async () => {
      try {
        const abierta = await invoke<boolean>("caja_esta_abierta");
        setCajaAbierta(Boolean(abierta));
      } catch (e) {
        // Si el backend retorna "no login" o el comando no existe, no rompas la UI
        console.warn("caja_esta_abierta falló:", e);
        setCajaAbierta(false);
      }
    })();
  }, []);

  const abrirCaja = useCallback(async () => {
    setBusy(true);
    try {
      await invoke<number>("caja_abrir");     // SIN user_id
      setCajaAbierta(true);
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes("no login")) {
        alert("Iniciá sesión para abrir la caja.");
      } else {
        alert("No se pudo abrir la caja.\n" + msg);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // Dispara el modal (no cierra todavía)
  const solicitarCerrarCaja = useCallback(() => {
    setConfirmCerrarOpen(true);
    setTimeout(() => cancelBtnRef.current?.focus(), 0);
  }, []);

  // Confirmación “Sí” en el modal
  const confirmarCerrarCaja = useCallback(async () => {
    setBusy(true);
    try {
      await invoke<number>("caja_cerrar");    // SIN user_id
      setCajaAbierta(false);
      setConfirmCerrarOpen(false);
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes("no login")) {
        alert("Iniciá sesión para cerrar la caja.");
      } else {
        alert("No se pudo cerrar la caja.\n" + msg);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // Cancelar modal
  const cancelarCerrarCaja = useCallback(() => {
    setConfirmCerrarOpen(false);
  }, []);

  // Cerrar con ESC
  useEffect(() => {
    if (!confirmCerrarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmCerrarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmCerrarOpen]);

  return (
    <div className="min-h-screen bg-ventas-50 text-neutral-900 flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-gradient-to-b from-ventas-500 to-ventas-300">
        <div className="text-lg font-bold tracking-wide">Ventas</div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${
              cajaAbierta ? "text-ventas-700" : "text-red-700"
            } bg-black/5 border border-black/10 rounded-full px-3 py-1`}
            title={cajaAbierta ? "Caja abierta" : "Caja cerrada"}
          >
            Caja: {cajaAbierta ? "Abierta" : "Cerrada"}
          </span>

          {cajaAbierta ? (
            <button
              type="button"
              onClick={solicitarCerrarCaja}
              disabled={busy}
              title="Cerrar caja"
              className="h-9 px-3 rounded-xl border border-ventas-600 text-ventas-700 bg-transparent hover:bg-white/50 disabled:opacity-60 disabled:pointer-events-none active:translate-y-[1px] transition"
            >
              Cerrar caja
            </button>
          ) : (
            <button
              type="button"
              onClick={abrirCaja}
              disabled={busy}
              title="Abrir caja"
              className="h-9 px-3 rounded-xl border border-green-600 text-green-700 bg-transparent hover:bg-white/50 disabled:opacity-60 disabled:pointer-events-none active:translate-y-[1px] transition"
            >
              Abrir caja
            </button>
          )}
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="p-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Productos */}
        <section className="bg-white border border-neutral-200 rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold">Productos disponibles</div>
          <div className="p-3 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-ventas-100 text-left">
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold">Precio unitario</th>
                  <th className="px-3 py-2 font-semibold">Stock</th>
                  <th className="px-3 py-2 font-semibold w-28">Acción</th>
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-neutral-500" colSpan={4}>Sin resultados.</td>
                  </tr>
                ) : (
                  productos.map(p => (
                    <tr key={p.id_producto} className="border-b border-neutral-200 last:border-0">
                      <td className="px-3 py-2">{p.nombre}</td>
                      <td className="px-3 py-2">$ {p.precio_unitario}</td>
                      <td className="px-3 py-2">{p.stock_disponible}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!cajaAbierta || busy}
                          title={cajaAbierta ? "Agregar al carrito" : "Abrí la caja para vender"}
                          className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-ventas-100 disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px] transition font-semibold"
                        >
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de acciones */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-200 bg-ventas-50">
            <button
              type="button"
              disabled={busy}
              className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px] transition font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!cajaAbierta || busy}
              title={cajaAbierta ? "Registrar venta" : "Abrí la caja para registrar"}
              className="h-9 px-3 rounded-xl border border-ventas-600 bg-ventas-500 hover:brightness-95 disabled:opacity-50 disabled:pointer-events-none active:translate-y-[1px] transition font-semibold"
            >
              Registrar venta
            </button>
          </div>
        </section>

        {/* Resumen */}
        <aside className="bg-white border border-neutral-200 rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold">Resumen</div>
          <div className="p-4 grid gap-2 text-sm">
            <div className="flex justify-between"><span>Ítems</span><strong>0</strong></div>
            <div className="flex justify-between"><span>Subtotal</span><strong>$ 0</strong></div>
            <div className="flex justify-between"><span>Impuestos</span><strong>$ 0</strong></div>
            <hr className="border-neutral-200" />
            <div className="flex justify-between text-base">
              <span>Total</span><strong>$ 0</strong>
            </div>
          </div>
        </aside>
      </main>

      {/* MODAL de confirmación de cierre */}
      {confirmCerrarOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          aria-labelledby="titulo-confirm-cierre"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={cancelarCerrarCaja}
          />
          {/* Caja modal */}
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5 animate-in fade-in zoom-in-95">
            <h2 id="titulo-confirm-cierre" className="text-base font-semibold mb-2">
              ¿Estás seguro/a de cerrar caja?
            </h2>
            <p className="text-sm text-neutral-600 mb-5">
              Se registrará fecha y hora de cierre. No podrás registrar ventas mientras esté cerrada.
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={cancelarCerrarCaja}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 active:translate-y-[1px] transition font-semibold"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmarCerrarCaja}
                disabled={busy}
                className="h-9 px-3 rounded-xl border border-red-600 text-white bg-red-600 hover:brightness-95 disabled:opacity-60 active:translate-y-[1px] transition font-semibold"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
