import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type StockResumen = {
  id_producto: number;
  codigo: string;
  nombre: string;
  stock_actual: number;
  precio_venta_actual: number;
  costo_actual: number;
};

type CompraRegistrarInput = {
  id_producto: number;
  cantidad: number;
  costo_unitario: number;
  referencia?: string | null;
  mantener_costo: boolean;
};

const money = (v: number) =>
  v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

export default function CostosPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StockResumen[]>([]);

  // Modal compra
  const [open, setOpen] = useState(false);
  const [seleccion, setSeleccion] = useState<StockResumen | null>(null);
  const [cantidad, setCantidad] = useState<string>("1");
  const [costoUnit, setCostoUnit] = useState<string>("");
  const [ref, setRef] = useState<string>("");
  const [mantenerCosto, setMantenerCosto] = useState<boolean>(false);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      // IMPORTANTE:
      // Usá el mismo estilo de keys que ya usás en tu app.
      // Variante A (camelCase):
      const data = await invoke<StockResumen[]>("stock_listar", {
        q: q ?? "",
        soloActivos: true,
        limit: 200,
        offset: 0,
      });

      // Variante B (snake_case) si tu binding lo requiere:
      // const data = await invoke<StockResumen[]>("stock_listar", {
      //   q: q ?? "",
      //   solo_activos: true,
      //   limit: 200,
      //   offset: 0,
      // });

      setRows(data);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.nombre.toLowerCase().includes(s) || r.codigo.toLowerCase().includes(s)
    );
  }, [q, rows]);

  const totalInventario = useMemo(() => {
    return filtrados.reduce((acc, r) => acc + r.stock_actual * r.costo_actual, 0);
  }, [filtrados]);

  function abrirCompra(r: StockResumen) {
    setSeleccion(r);
    setCantidad("1");
    setCostoUnit(String(r.costo_actual ?? ""));
    setRef("");
    setMantenerCosto(false);
    setOpen(true);
  }

  async function registrarCompra() {
    if (!seleccion) return;

    const cant = Math.trunc(Number(cantidad));
    const costo = Math.trunc(Number(costoUnit));

    if (!Number.isFinite(cant) || cant <= 0) {
      setError("Cantidad inválida (> 0)");
      return;
    }

    // Si mantenerCosto = true, el backend ignora costo_unitario,
    // pero igual exigimos algo consistente para no mandar NaN.
    if (!mantenerCosto) {
      if (!Number.isFinite(costo) || costo <= 0) {
        setError("Costo unitario inválido (> 0)");
        return;
      }
    }

    setGuardando(true);
    setError(null);
    try {
      const input: CompraRegistrarInput = {
        id_producto: seleccion.id_producto,
        cantidad: cant,
        costo_unitario: Number.isFinite(costo) ? costo : 0,
        referencia: ref.trim() ? ref.trim() : null,
        mantener_costo: mantenerCosto,
      };

    const costoToSend = mantenerCosto ? 0 : costo;
    await invoke("registrar_compra", {
        idProducto: seleccion.id_producto,
        cantidad: cant,
        costoUnitario: costoToSend,
        referencia: ref.trim() ? ref.trim() : null,
        mantenerCosto,
        });

      setOpen(false);
      await cargar();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Costos</h1>
          <p className="text-sm opacity-70">
            Lista de productos con costo actual. Registrar compra impacta stock y costo.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
          />
          <button
            onClick={cargar}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            Buscar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-sm opacity-80">
            Productos: <span className="font-semibold">{filtrados.length}</span>
          </div>
          <div className="text-sm opacity-80">
            Valor inventario (costo):{" "}
            <span className="font-semibold">{money(totalInventario)}</span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-80">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Costo</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td className="px-4 py-4 opacity-70" colSpan={5}>
                    Cargando…
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 opacity-70" colSpan={5}>
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtrados.map((r) => {
                  const valor = r.stock_actual * r.costo_actual;
                  return (
                    <tr key={r.id_producto} className="border-b border-white/5">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.nombre}</div>
                        <div className="text-xs opacity-60">{r.codigo}</div>
                      </td>
                      <td className="px-4 py-3">{money(r.costo_actual)}</td>
                      <td className="px-4 py-3">{r.stock_actual}</td>
                      <td className="px-4 py-3">{money(valor)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => abrirCompra(r)}
                          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 hover:bg-white/15"
                        >
                          Registrar compra
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {open && seleccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Registrar compra</div>
                <div className="text-sm opacity-70">{seleccion.nombre}</div>
              </div>
              <button
                onClick={() => (guardando ? null : setOpen(false))}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="space-y-1">
                <div className="text-sm opacity-80">Cantidad</div>
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm opacity-80 flex items-center justify-between">
                  <span>Costo unitario</span>
                  <label className="flex items-center gap-2 text-xs opacity-80">
                    <input
                      type="checkbox"
                      checked={mantenerCosto}
                      onChange={(e) => setMantenerCosto(e.target.checked)}
                    />
                    Mantener costo actual
                  </label>
                </div>
                <input
                  value={costoUnit}
                  onChange={(e) => setCostoUnit(e.target.value)}
                  disabled={mantenerCosto}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none disabled:opacity-50"
                />
                <div className="text-xs opacity-60">
                  Si marcás “mantener costo”, se usa el costo_actual de la BD.
                </div>
              </label>

              <label className="space-y-1">
                <div className="text-sm opacity-80">Referencia (opcional)</div>
                <input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="Factura / proveedor / nota…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none"
                />
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={guardando}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarCompra}
                  disabled={guardando}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 hover:bg-white/15 disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
