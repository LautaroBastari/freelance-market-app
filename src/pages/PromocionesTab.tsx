import { useEffect, useMemo, useState } from "react";
import {
  promoComboDetalle,
  promoComboListar,
  promoComboEliminar, 
  ventaAplicarPromoCombo,
  PromoComboDetalle,
  PromoComboRow,
} from "../api/promos";

export default function PromocionesTab({
  idVentaActual,
  onRefrescarCarrito,
}: {
  idVentaActual: number;
  onRefrescarCarrito: () => void;
}) {
  const [promos, setPromos] = useState<PromoComboRow[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<PromoComboDetalle | null>(null);

  const [precio, setPrecio] = useState<number>(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promoSeleccionada = useMemo(
    () => promos.find((p) => p.id_combo === selId) ?? null,
    [promos, selId]
  );

  const recargarPromos = async () => {
    const data = await promoComboListar();
    setPromos(data);

    // Si la promo seleccionada ya no existe (por eliminación), limpiamos
    if (selId && !data.some((p) => p.id_combo === selId)) {
      setSelId(null);
      setDetalle(null);
      setPrecio(0);
    }
  };

  useEffect(() => {
    recargarPromos().catch((e) => setError(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError(null);

    if (!selId) {
      setDetalle(null);
      setPrecio(0);
      return;
    }

    promoComboDetalle(selId)
      .then((d) => {
        setDetalle(d);

        // Default: si el combo trae precio_pack > 0, lo usamos; si no, sugerido vs mínimo
        // OJO: esto asume que d.combo puede traer precio_pack; si no existe, cae al sugerido/min.
        const precioPack = (d.combo as any).precio_pack as number | undefined;
        const base =
          typeof precioPack === "number" && precioPack > 0
            ? precioPack
            : Math.max(d.combo.precio_min_total, d.total_sugerido);

        setPrecio(Math.trunc(base));
      })
      .catch((e) => {
        setError(String(e?.message ?? e));
        setDetalle(null);
        setPrecio(0);
      });
  }, [selId]);

  const eliminarCombo = async (idCombo: number) => {
    setError(null);
    if (!confirm("¿Eliminar este combo?")) return;

    setCargando(true);
    try {
      await promoComboEliminar(idCombo); 
      await recargarPromos();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    if (!detalle) return;

    setError(null);

    const min = detalle.combo.precio_min_total;
    const pack = Math.trunc(precio || 0);

    if (pack < min) {
      setError("Precio por debajo del mínimo.");
      return;
    }

    setCargando(true);
    try {
      await ventaAplicarPromoCombo({
        id_venta: idVentaActual,
        id_combo: detalle.combo.id_combo,
        precio_total_pack: pack,
      });

      await onRefrescarCarrito();

      // reset UI
      setSelId(null);
      setDetalle(null);
      setPrecio(0);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {/* LISTA */}
      <div className="rounded-xl bg-zinc-900 p-3">
        <div className="mb-2 font-semibold">Promociones</div>

        {error && (
          <div className="mb-2 rounded-lg bg-red-950/40 p-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {promos.map((p) => {
            const seleccionado = selId === p.id_combo;
            const resumen = (p as any).resumen as string | undefined;

            return (
              <div
                key={p.id_combo}
                className={`rounded-lg p-2 ${
                  seleccionado ? "bg-emerald-700" : "bg-zinc-800 hover:bg-zinc-700"
                }`}
              >
                <button
                  onClick={() => setSelId(p.id_combo)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.nombre}</div>

                      {/* Resumen sutil (si existe) */}
                      {resumen && resumen.trim().length > 0 && (
                        <div className="mt-0.5 truncate text-xs text-zinc-200/80">
                          {resumen}
                        </div>
                      )}

                      <div className="mt-1 text-xs text-zinc-300">
                        Precio: ${p.precio_pack.toLocaleString("es-AR")}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="mt-2 flex justify-end">
                  <button
                    disabled={cargando}
                    onClick={() => eliminarCombo(p.id_combo)}
                    className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-950 disabled:opacity-50"
                    title="Desactivar combo"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}

          {promos.length === 0 && (
            <div className="text-sm text-zinc-400">No hay promociones activas.</div>
          )}
        </div>
      </div>

      {/* DETALLE */}
      <div className="rounded-xl bg-zinc-900 p-3">
        <div className="mb-2 font-semibold">Detalle</div>

        {!detalle ? (
          <div className="text-sm text-zinc-400">
            Seleccioná una promoción.
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-zinc-800 p-3">
              <div className="font-semibold">{detalle.combo.nombre}</div>

              <div className="mt-1 text-sm text-zinc-300">
                Sugerido: ${detalle.total_sugerido.toLocaleString("es-AR")}
              </div>

              <div className="text-sm text-zinc-300">
                Precio: ${detalle.combo.precio_pack.toLocaleString("es-AR")}
              </div>

              {/* Si existe precio_pack en el combo, lo mostramos */}
              {typeof (detalle.combo as any).precio_pack === "number" && (
                <div className="text-sm text-zinc-300">
                  Pack: ${(detalle.combo as any).precio_pack.toLocaleString("es-AR")}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {detalle.items.map((it) => (
                <div
                  key={it.id_producto}
                  className="flex items-center justify-between rounded-lg bg-zinc-800 p-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.nombre}</div>
                    <div className="text-xs text-zinc-400">
                      {it.cantidad} x ${it.precio_unitario.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    ${it.subtotal_sugerido.toLocaleString("es-AR")}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg bg-zinc-800 p-3">
              <label className="text-sm text-zinc-300">
                Precio total del pack (operador)
              </label>

              <input
                type="number"
                className="mt-2 w-full rounded-lg bg-zinc-900 p-2 outline-none"
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
              />

              <div className="mt-2 text-xs text-zinc-400">
                Se valida contra el mínimo. El sistema prorratea y calcula ganancia por producto.
              </div>

              <button
                disabled={cargando}
                onClick={aplicar}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 font-semibold disabled:opacity-50"
              >
                {cargando ? "Aplicando..." : "Agregar al carrito"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
