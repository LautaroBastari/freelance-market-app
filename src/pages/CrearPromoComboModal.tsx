import { useEffect, useMemo, useState } from "react";
import { promoComboCrear } from "../api/promos";
import type { PromoComboCrearInput } from "../api/promos";

type Producto = {
  id_producto: number;
  nombre: string;
  precio_venta_actual: number;
};

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  productos: Producto[];
  onCreada: () => void;
};

export default function CrearPromoComboModal({
  abierto,
  onCerrar,
  productos,
  onCreada,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [precioPack, setPrecioPack] = useState<number>(0);

  // buscador de productos
  const [qProd, setQProd] = useState("");

  // id_producto -> cantidad
  const [sel, setSel] = useState<Record<number, number>>({});

  // ui states
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  

  // Reset cuando se cierra el modal
  useEffect(() => {
    if (!abierto) {
      setNombre("");
      setPrecioPack(0);
      setQProd("");
      setSel({});
      setError(null);
      setGuardando(false);
    }
  }, [abierto]);

  const productosOrdenados = useMemo(() => {
    return [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = qProd.trim().toLowerCase();
    if (!q) return productosOrdenados;
    return productosOrdenados.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [qProd, productosOrdenados]);

  // items seleccionados en formato backend
  const items = useMemo(() => {
    return Object.entries(sel)
      .map(([id, cant]) => ({ id_producto: Number(id), cantidad: cant }))
      .filter((x) => x.cantidad > 0);
  }, [sel]);

  // lookup rápido id->producto (evita find() en loops)
  const productoById = useMemo(() => {
    const m = new Map<number, Producto>();
    for (const p of productos) m.set(p.id_producto, p);
    return m;
  }, [productos]);

  // lista seleccionados con data de producto
  const seleccionados = useMemo(() => {
    const out: Array<Producto & { cantidad: number; subtotal: number }> = [];
    for (const it of items) {
      const p = productoById.get(it.id_producto);
      if (!p) continue;
      out.push({
        ...p,
        cantidad: it.cantidad,
        subtotal: p.precio_venta_actual * it.cantidad,
      });
    }
    out.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return out;
  }, [items, productoById]);

  const totalSugerido = useMemo(() => {
    return seleccionados.reduce((acc, x) => acc + x.subtotal, 0);
  }, [seleccionados]);

  const toggleProd = (id: number) => {
    setError(null);
    setSel((prev) => {
      const next = { ...prev };
      if (next[id] != null) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setCant = (id: number, cantidad: number) => {
    setError(null);
    const v = Math.max(0, Math.trunc(Number.isFinite(cantidad) ? cantidad : 0));
    setSel((prev) => {
      const next = { ...prev };
      if (v <= 0) {
        // si llega a 0, lo sacamos para mantener limpio
        delete next[id];
      } else {
        next[id] = v;
      }
      return next;
    });
  };

  const quitar = (id: number) => {
    setError(null);
    setSel((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validar = (input: PromoComboCrearInput) => {
    if (!input.nombre.trim()) return "Nombre obligatorio";
    if (input.precio_pack < 0) return "Precio pack inválido";
    if (input.items.length === 0) return "Elegí al menos 1 producto";
    if (input.items.some((x) => x.cantidad <= 0)) return "Cantidad inválida (debe ser > 0)";
    return null;
  };

  const guardar = async () => {
    try {
      setError(null);

      const input: PromoComboCrearInput = {
        nombre: nombre.trim(),
        precio_pack: Math.max(0, Math.trunc(precioPack || 0)),
        precio_min_total: 0, //deprecado
        items,
      };

      const v = validar(input);
      if (v) {
        setError(v);
        return;
      }

      setGuardando(true);
      await promoComboCrear(input);

      onCreada();
      onCerrar(); // el useEffect resetea estado
    } catch (e) {
      setError(String(e));
    } finally {
      setGuardando(false);
    }
  };

  // Enter para guardar (cuando está abierto)
  useEffect(() => {
    if (!abierto) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        // Ctrl+Enter / Cmd+Enter
        guardar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, nombre, sel, qProd]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => {
        // click fuera cierra
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-4xl rounded-xl bg-zinc-900 p-4 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Crear promoción (combo)</h2>
          <button className="text-zinc-300 hover:text-white" onClick={onCerrar} title="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Izquierda: datos del combo + seleccionados */}
          <div className="space-y-3">
            <div>
              <label className="text-sm text-zinc-300">Nombre</label>
              <input
                className="mt-1 w-full rounded-lg bg-zinc-800 p-2 outline-none text-white placeholder:text-zinc-500"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Desayuno x3"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-300">Precio del combo (pack)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg bg-zinc-800 p-2 outline-none text-white"
                value={precioPack}
                min={0}
                onChange={(e) => setPrecioPack(Number(e.target.value))}
              />
              <div className="mt-1 text-xs text-zinc-400">
                Si lo dejás en 0, en ventas se sugiere por sumatoria normal.
              </div>
            </div>


          </div>

            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="text-sm text-zinc-300">Precio sugerido (sumatoria normal)</div>
              <div className="text-xl font-semibold text-white">
                ${totalSugerido.toLocaleString("es-AR")}
              </div>
              <div className="text-xs text-zinc-400">
                Informativo. Se usa para prorratear el ingreso entre productos.
              </div>
            </div>

            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="mb-2 text-sm text-zinc-300">Seleccionados</div>

              {seleccionados.length === 0 ? (
                <div className="text-sm text-zinc-400">Todavía no agregaste productos.</div>
              ) : (
                <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                  {seleccionados.map((p) => (
                    <div
                      key={p.id_producto}
                      className="flex items-center gap-2 rounded-lg bg-zinc-900 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{p.nombre}</div>
                        <div className="text-xs text-zinc-400">
                          Unit: ${p.precio_venta_actual.toLocaleString("es-AR")} · Subtotal: $
                          {p.subtotal.toLocaleString("es-AR")}
                        </div>
                      </div>

                      <input
                        type="number"
                        className="w-20 rounded-md bg-zinc-700 p-1 text-right outline-none text-white"
                        value={p.cantidad}
                        min={1}
                        onChange={(e) => setCant(p.id_producto, Number(e.target.value))}
                      />

                      <button
                        className="rounded-md bg-zinc-700 px-2 py-1 text-sm text-white hover:bg-zinc-600"
                        onClick={() => quitar(p.id_producto)}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 text-xs text-zinc-400">
                Tip: Ctrl+Enter para guardar.
              </div>
            </div>
          </div>

          {/* Derecha: buscador + lista de productos disponibles */}
          <div className="rounded-lg bg-zinc-800 p-3">
            <div className="mb-2 text-sm text-zinc-300">Productos del combo</div>

            <input
              className="mb-2 w-full rounded-lg bg-zinc-900 p-2 outline-none text-white placeholder:text-zinc-500"
              value={qProd}
              onChange={(e) => setQProd(e.target.value)}
              placeholder="Buscar producto…"
            />

            <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
              {productosFiltrados.map((p) => {
                const selected = sel[p.id_producto] != null;
                const cant = sel[p.id_producto] ?? 0;

                return (
                  <div
                    key={p.id_producto}
                    className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900 p-2"
                  >
                    <button
                      className={`rounded-md px-2 py-1 text-sm text-white ${
                        selected ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                      onClick={() => toggleProd(p.id_producto)}
                      title={selected ? "Quitar del combo" : "Agregar al combo"}
                    >
                      {selected ? "✓" : "+"}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-white">{p.nombre}</div>
                      <div className="text-xs text-zinc-400">
                        ${p.precio_venta_actual.toLocaleString("es-AR")}
                      </div>
                    </div>

                    <input
                      type="number"
                      className="w-20 rounded-md bg-zinc-700 p-1 text-right outline-none text-white disabled:opacity-40"
                      disabled={!selected}
                      value={cant}
                      min={1}
                      onChange={(e) => setCant(p.id_producto, Number(e.target.value))}
                    />
                  </div>
                );
              })}

              {productosFiltrados.length === 0 && (
                <div className="text-sm text-zinc-400">No hay resultados.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-lg bg-zinc-700 px-3 py-2 text-white hover:bg-zinc-600"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>

          <button
            className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? "Guardando…" : "Guardar promoción"}
          </button>
        </div>
      </div>
    </div>
  );
}
