import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

  //Tipos

type VentaAdminResumenRow = {
  id_venta: number;
  fecha_hora: string;
  id_usuario: number;
  usuario: string;
  id_caja: number;
  total: number;
  estado: string;

  cant_items: number;
  unidades: number;
  costo_total: number;

  ganancia_bruta: number;
  margen_pct: number;

  pagos_resumen?: string | null;
};

type VentaAdminItemRow = {
  id_item: number;
  id_producto: number;
  codigo: string;
  producto: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario_en_venta: number;
  subtotal: number;
  fuente_precio: string;

  costo_linea: number;
  ganancia_linea: number;
};
type UsuarioOperadorRow = {
  id_usuario: number;
  nombre: string;
};
type VentaAdminPagoRow = {
  medio: string;
  monto: number;
  referencia?: string | null;
};

type VentaAdminDetalle = {
  resumen: VentaAdminResumenRow;
  items: VentaAdminItemRow[];
  pagos: VentaAdminPagoRow[];
};

type VentasAdminListarInput = {
  desde: string;
  hasta: string;
  id_usuario?: number | null;
  estado?: string | null;
  medio?: string | null;
  limit?: number;
  offset?: number;
};

type ProductoBasico = {
  id_producto: number;
  codigo_producto: string;
  nombre: string;
  precio_venta_actual: number;
  costo_actual: number;
};

type EditItem = {
  id_producto: number;
  codigo_producto: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario_en_venta: number;
  fuente_precio: "catalogo" | "manual" | "promo";
};

type EditPago = {
  medio: "efectivo" | "debito" | "credito" | "transferencia";
  monto: number;
  referencia?: string | null;
};

/* 
 Helpers */

function hoyISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function moneyARS(n: number) {
  return (n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function clampInt(v: unknown, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/* Estilos y UI  */

const ui = {
  page: "p-6 flex flex-col gap-6 h-full w-full",
  card: "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm",
  cardPad: "p-4",
  soft: "bg-gray-50 dark:bg-gray-900",
  input:
    "border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
  select:
    "border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
  btn:
    "px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed",
  btnPrimary:
    "px-4 py-2 text-sm font-medium rounded-md border transition disabled:opacity-50 disabled:cursor-not-allowed border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20",
  btnGhost:
    "px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition",
  badge:
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900",
  tableWrap:
    "flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm",
  thead:
    "bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 text-xs uppercase tracking-wide text-gray-500",
  th: "px-3 py-2 text-left border-b border-gray-200 dark:border-gray-800",
  td: "px-3 py-2 border-b border-gray-200 dark:border-gray-800",
  tdRight: "px-3 py-2 border-b border-gray-200 dark:border-gray-800 text-right tabular-nums",
};

/* Componente principal*/

export default function VentasAdmin() {
  /* filtros  */
  function inicioMesISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}
  const [desde, setDesde] = useState(inicioMesISO());
  const [hasta, setHasta] = useState(hoyISO());

  const [estado, setEstado] = useState<string>("finalizada");
  const [medio, setMedio] = useState<string>("");
  const [idUsuario, setIdUsuario] = useState<number | null>(null);

  /*  listado */
  const [rows, setRows] = useState<VentaAdminResumenRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(200);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*  modal detalle  */
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleVentaId, setDetalleVentaId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<VentaAdminDetalle | null>(null);
  const [busyDetalle, setBusyDetalle] = useState(false);

  /*  modal editar  */
  const [editOpen, setEditOpen] = useState(false);
  const [editVentaId, setEditVentaId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editPagos, setEditPagos] = useState<EditPago[]>([]);
  const [editBusy, setEditBusy] = useState(false);

  const [prodQ, setProdQ] = useState("");
  const [prodRes, setProdRes] = useState<ProductoBasico[]>([]);
  const [reemplazarIdx, setReemplazarIdx] = useState<number | null>(null);

  /* operadores */
  const [operadores, setOperadores] = useState<UsuarioOperadorRow[]>([]);
  const [busyOps, setBusyOps] = useState(false);
  useEffect(() => {
    let alive = true;

    (async () => {
      setBusyOps(true);
      try {
        const res = await invoke<UsuarioOperadorRow[]>("usuarios_listar_operadores");
        if (alive) setOperadores(res);
      } catch {
        if (alive) setOperadores([]);
      } finally {
        if (alive) setBusyOps(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);
  /* Data load */
const cargar = useCallback(async () => {
  setBusy(true);
  setError(null);
  try {
    const input: VentasAdminListarInput = {
      desde,
      hasta,
      id_usuario: idUsuario,
      estado: estado ? estado : null,
      medio: medio ? medio : null,
      limit,
      offset,
    };

    const res = await invoke<{
      items: VentaAdminResumenRow[];
      total: number;
      limit: number;
      offset: number;
    }>("ventas_admin_listar", { input });

    setRows(res.items);
    setTotal(res.total);
    setLimit(res.limit);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error al cargar ventas");
  } finally {
    setBusy(false);
  }
}, [desde, hasta, idUsuario, estado, medio, limit, offset]);

useEffect(() => {
  setOffset(0);
}, [desde, hasta, idUsuario, estado, medio]);

useEffect(() => {
  cargar();
}, [cargar]);
  /*KPIs */

  const kpis = useMemo(() => {
    const cantidad = rows.length;
    const total = rows.reduce((acc, r) => acc + (r.total ?? 0), 0);
    const costo = rows.reduce((acc, r) => acc + (r.costo_total ?? 0), 0);
    const ganancia = rows.reduce((acc, r) => acc + (r.ganancia_bruta ?? 0), 0);
    const ticket = cantidad > 0 ? Math.round(total / cantidad) : 0;
    const margen = total > 0 ? Math.round((ganancia * 10000) / total) / 100 : 0;
    return { cantidad, total, costo, ganancia, ticket, margen };
  }, [rows]);

  /*  Detalle */

  const abrirDetalle = useCallback(async (id_venta: number) => {
    setError(null);
    setDetalleOpen(true);
    setDetalleVentaId(id_venta);
    setBusyDetalle(true);
    setDetalle(null);

    try {
      const res = await invoke<VentaAdminDetalle>("venta_admin_detalle", {
        idVenta: id_venta
      });
      setDetalle(res);
    } catch (e: unknown) {
      setDetalle(null);
      setError(e instanceof Error ? e.message : "Error al abrir detalle");
    } finally {
      setBusyDetalle(false);
    }
  }, []);

  const cerrarDetalle = useCallback(() => {
    setDetalleOpen(false);
    setDetalleVentaId(null);
    setDetalle(null);
    setBusyDetalle(false);
  }, []);

  /*Editor */

  const abrirEditorVenta = useCallback(async (id_venta: number) => {
    setError(null);
    setEditBusy(true);
    try {

      const det = await invoke<VentaAdminDetalle>("venta_admin_detalle", {
        idVenta: id_venta,
      });

      setEditVentaId(id_venta);
      setEditItems(
        det.items.map((it) => ({
          id_producto: it.id_producto,
          codigo_producto: it.codigo,
          nombre: it.producto,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          costo_unitario_en_venta: it.costo_unitario_en_venta,
          fuente_precio: (it.fuente_precio as any) ?? "manual",
        }))
      );

      setEditPagos(
        det.pagos.map((p) => ({
          medio: (p.medio as any) ?? "efectivo",
          monto: p.monto,
          referencia: p.referencia ?? null,
        }))
      );

      setProdQ("");
      setProdRes([]);
      setReemplazarIdx(null);
      setEditOpen(true);
    } catch (e: any) {
      console.error("abrirEditorVenta error:", e);
      const msg =
        e?.message ??
        e?.toString?.() ??
        (typeof e === "string" ? e : JSON.stringify(e));
      setError(`Error al abrir editor: ${msg}`);
    } finally {
      setEditBusy(false);
    }
  }, []);

  const cerrarEditor = useCallback(() => {
    setEditOpen(false);
    setEditVentaId(null);
    setEditItems([]);
    setEditPagos([]);
    setProdQ("");
    setProdRes([]);
    setReemplazarIdx(null);
    setEditBusy(false);
  }, []);

  const totalNuevo = useMemo(
    () => editItems.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0),
    [editItems]
  );

  const pagosNuevo = useMemo(
    () => editPagos.reduce((acc, p) => acc + (p.monto || 0), 0),
    [editPagos]
  );

  const buscarProductos = useCallback(async () => {
      try {
        const res = await invoke<ProductoBasico[]>("producto_listar_basico", {
          q: prodQ,
          limit: 30,
        });
        setProdRes(res);
      } catch {
        setProdRes([]);
      }
    }, [prodQ]);

    const onPickProducto = useCallback(
  (p: ProductoBasico) => {
    const nuevoBase: EditItem = {
      id_producto: p.id_producto,
      codigo_producto: p.codigo_producto,
      nombre: p.nombre,
      cantidad: 1,
      precio_unitario: p.precio_venta_actual,
      costo_unitario_en_venta: p.costo_actual,
      fuente_precio: "catalogo",
    };

    setEditItems((prev) => {
      if (reemplazarIdx === -1) {
        return [...prev, nuevoBase];
      }

      if (reemplazarIdx !== null && reemplazarIdx >= 0 && reemplazarIdx < prev.length) {
        return prev.map((it, i) => (i === reemplazarIdx ? { ...it, ...nuevoBase, cantidad: it.cantidad } : it));
      }

      return prev;
    });

    setReemplazarIdx(null);
    setProdRes([]);
    setProdQ("");
  },
  [reemplazarIdx, setEditItems, setReemplazarIdx, setProdRes, setProdQ]
);


  const guardarEdicion = useCallback(async () => {
    if (!editVentaId) return;

    setError(null);

    if (editItems.length === 0) {
      setError("La venta no puede quedar sin productos.");
      return;
    }

    if (pagosNuevo !== totalNuevo) {
      setError(
        `No se puede guardar: el total cobrado (${moneyARS(
          pagosNuevo
        )}) debe ser igual al total de productos (${moneyARS(totalNuevo)}).`
      );
      return;
    }

    setEditBusy(true);

    try {
      await invoke("venta_admin_editar_guardar", {
        input: {
          id_venta: editVentaId,
          items: editItems.map((it) => ({
            id_producto: it.id_producto,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            costo_unitario_en_venta: it.costo_unitario_en_venta,
            fuente_precio: it.fuente_precio,
          })),
          pagos: editPagos.map((p) => ({
            medio: p.medio,
            monto: p.monto,
            referencia: p.referencia ?? null,
          })),
        },
      });

      cerrarEditor();
      await cargar();
    } catch (e: any) {
      const raw = e?.message ?? "";
      if (raw.toLowerCase().includes("trigger") || raw.toLowerCase().includes("constraint")) {
        setError(
          `No se pudo guardar: el total cobrado (${moneyARS(
            pagosNuevo
          )}) debe ser igual al total de productos (${moneyARS(totalNuevo)}).`
        );
      } else {
        setError(raw || "Error al guardar cambios");
      }
    } finally {
      setEditBusy(false);
    }
  }, [editVentaId, editItems, editPagos, pagosNuevo, totalNuevo, cerrarEditor, cargar]);

     //Render

  return (
    <div className={ui.page}>
      <Header busy={busy} onRefresh={cargar} />

      <div className={`${ui.card} ${ui.cardPad}`}>
        <Filtros
          desde={desde}
          hasta={hasta}
          estado={estado}
          medio={medio}
          idUsuario={idUsuario}
          busy={busy}
          onChangeDesde={setDesde}
          onChangeHasta={setHasta}
          onChangeEstado={setEstado}
          onChangeMedio={setMedio}
          onChangeIdUsuario={setIdUsuario}
          onBuscar={cargar}
          operadores={operadores}
          busyOps={busyOps}
        />
      </div>

      <Kpis kpis={kpis} />

      {error && (
        <div className="text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3 shadow-sm">
          {error}
        </div>
      )}

      <TablaVentas rows={rows} busy={busy} onOpenDetalle={abrirDetalle} onEditar={abrirEditorVenta} />

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Mostrando {offset + 1}–{Math.min(offset + limit, total)} de {total}
        </div>

        <div className="flex gap-2">
          <button
            className={ui.btn}
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            ← Anterior
          </button>

          <button
            className={ui.btn}
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Modal Detalle */}
      {detalleOpen && (
        <Modal title={`Detalle venta #${detalleVentaId ?? ""}`} onClose={cerrarDetalle}>
          {busyDetalle && <div className="text-sm text-gray-500">Cargando detalle…</div>}
          {!busyDetalle && detalle && <DetalleVenta detalle={detalle} />}
          {!busyDetalle && !detalle && <div className="text-sm text-gray-500">No hay detalle cargado.</div>}
        </Modal>
      )}

      {/* Modal Editor */}
      {editOpen && (
        <Modal title={`Modificar venta #${editVentaId ?? ""}`} onClose={cerrarEditor} disableClose={editBusy}>
          <EditorVenta
            editBusy={editBusy}
            items={editItems}
            pagos={editPagos}
            totalNuevo={totalNuevo}
            pagosNuevo={pagosNuevo}
            prodQ={prodQ}
            prodRes={prodRes}
            onProdQ={setProdQ}
            onBuscarProductos={buscarProductos}
            onAddProducto={onPickProducto}
            onItems={setEditItems}
            onPagos={setEditPagos}
            reemplazarIdx={reemplazarIdx}
            onSetReemplazarIdx={setReemplazarIdx}
            onGuardar={guardarEdicion}
            onCancelar={cerrarEditor}
          />
        </Modal>
      )}
    </div>
  );
}

   //Subcomponentes

function Header({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
      <button
            type="button"
            onClick={() => window.history.back()}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition"
          >
            ← Volver
          </button>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Ventas - Panel de administración
        </h1>
        <p className="text-sm text-gray-500">
          Listado y detalle de ventas con costo, ganancia y medios de pago.
        </p>
      </div>

      <button onClick={onRefresh} disabled={busy} className={ui.btn}>
        {busy ? "Actualizando..." : "Actualizar"}
      </button>
    </div>
  );
}

function Filtros(props: {
  desde: string;
  hasta: string;
  estado: string;
  medio: string;
  idUsuario: number | null;
  busy: boolean;
  operadores: UsuarioOperadorRow[];
  busyOps: boolean;
  onChangeDesde: (v: string) => void;
  onChangeHasta: (v: string) => void;
  onChangeEstado: (v: string) => void;
  onChangeMedio: (v: string) => void;
  onChangeIdUsuario: (v: number | null) => void;
  onBuscar: () => void;
}) {
  const {
    desde,
    hasta,
    estado,
    medio,
    idUsuario,
    busy,
    onChangeDesde,
    onChangeHasta,
    onChangeEstado,
    onChangeMedio,
    onChangeIdUsuario,
    onBuscar,
    operadores,
    busyOps,
  } = props;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Desde</label>
        <input type="date" value={desde} onChange={(e) => onChangeDesde(e.target.value)} className={ui.input} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Hasta</label>
        <input type="date" value={hasta} onChange={(e) => onChangeHasta(e.target.value)} className={ui.input} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Estado</label>
        <select value={estado} onChange={(e) => onChangeEstado(e.target.value)} className={ui.select}>
          <option value="">Todos</option>
          <option value="finalizada">finalizada</option>
          <option value="anulada">anulada</option>
          <option value="en_curso">en_curso</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Medio de pago</label>
        <select value={medio} onChange={(e) => onChangeMedio(e.target.value)} className={ui.select}>
          <option value="">Todos</option>
          <option value="efectivo">efectivo</option>
          <option value="debito">debito</option>
          <option value="credito">credito</option>
          <option value="transferencia">transferencia</option>
        </select>
      </div>

      <div className="flex flex-col gap-1 min-w-[220px]">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Usuario</label>
        <select
          value={idUsuario ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChangeIdUsuario(raw === "" ? null : Number(raw));
          }}
          className={ui.select}
          disabled={busyOps}
        >
          <option value="">{busyOps ? "Cargando..." : "Todos"}</option>
          {operadores.map((u) => (
            <option key={u.id_usuario} value={u.id_usuario}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>

      <button onClick={onBuscar} disabled={busy} className={ui.btn}>
        Buscar
      </button>
    </div>
  );
}

function Kpis({
  kpis,
}: {
  kpis: { cantidad: number; total: number; costo: number; ganancia: number; ticket: number; margen: number };
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <KPI title="Ventas" value={String(kpis.cantidad)} />
      <KPI title="Total" value={moneyARS(kpis.total)} />
      <KPI title="Costo" value={moneyARS(kpis.costo)} />
      <KPI title="Ganancia" value={moneyARS(kpis.ganancia)} />
      <KPI title="Ticket prom." value={moneyARS(kpis.ticket)} />
      <KPI title="Margen" value={`${kpis.margen}%`} />
    </div>
  );
}

function TablaVentas(props: {
  rows: VentaAdminResumenRow[];
  busy: boolean;
  onOpenDetalle: (id_venta: number) => void;
  onEditar: (id_venta: number) => void;
}) {
  const { rows, busy, onOpenDetalle, onEditar } = props;

  return (
    <div className={ui.tableWrap}>
      <table className="min-w-full text-sm border-collapse">
        <thead className={ui.thead}>
          <tr>
            <th className={ui.th}>Fecha/Hora</th>
            <th className={ui.th}>Venta</th>
            <th className={ui.th}>Usuario</th>
            <th className={ui.th}>Caja</th>
            <th className={`${ui.th} text-right`}>Items</th>
            <th className={`${ui.th} text-right`}>Unid.</th>
            <th className={`${ui.th} text-right`}>Total</th>
            <th className={`${ui.th} text-right`}>Costo</th>
            <th className={`${ui.th} text-right`}>Ganancia</th>
            <th className={`${ui.th} text-right`}>Margen</th>
            <th className={ui.th}>Pagos</th>
            <th className={ui.th}>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id_venta}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition"
              onClick={() => onOpenDetalle(r.id_venta)}
            >
              <td className={`${ui.td} whitespace-nowrap`}>{r.fecha_hora}</td>
              <td className={`${ui.td} whitespace-nowrap`}>#{r.id_venta}</td>
              <td className={ui.td}>{r.usuario}</td>
              <td className={`${ui.td} whitespace-nowrap`}>#{r.id_caja}</td>

              <td className={ui.tdRight}>{r.cant_items}</td>
              <td className={ui.tdRight}>{r.unidades}</td>

              <td className={ui.tdRight}>{moneyARS(r.total)}</td>
              <td className={ui.tdRight}>{moneyARS(r.costo_total)}</td>
              <td className={ui.tdRight}>{moneyARS(r.ganancia_bruta)}</td>
              <td className={ui.tdRight}>{(r.margen_pct ?? 0).toFixed(2)}%</td>

              <td className={`${ui.td} text-xs text-gray-600 dark:text-gray-300`}>
                {r.pagos_resumen ?? "-"}
              </td>

              <td className={ui.td}>
                <button
                  className={ui.btnGhost}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditar(r.id_venta);
                  }}
                >
                  Modificar venta
                </button>
              </td>
            </tr>
          ))}

          {!busy && rows.length === 0 && (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-500">
                Sin ventas para los filtros seleccionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Modal(props: {
  title: string;
  onClose: () => void;
  disableClose?: boolean;
  children: React.ReactNode;
}) {
  const { title, onClose, disableClose, children } = props;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
          <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
          <button className={ui.btn} onClick={onClose} disabled={!!disableClose}>
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function DetalleVenta({ detalle }: { detalle: VentaAdminDetalle }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Mini title="Fecha" value={detalle.resumen.fecha_hora} />
        <Mini title="Usuario" value={detalle.resumen.usuario} />
        <Mini title="Caja" value={`#${detalle.resumen.id_caja}`} />
        <Mini title="Total" value={moneyARS(detalle.resumen.total)} />
        <Mini title="Costo" value={moneyARS(detalle.resumen.costo_total)} />
        <Mini title="Margen" value={`${detalle.resumen.margen_pct.toFixed(2)}%`} />
      </div>

      <div className={`${ui.card} ${ui.cardPad}`}>
        <div className="text-sm font-semibold mb-3">Pagos</div>
        {detalle.pagos.length === 0 ? (
          <div className="text-sm text-gray-500">Sin pagos.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Medio</th>
                <th className={`${ui.th} text-right`}>Monto</th>
                <th className={ui.th}>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {detalle.pagos.map((p, idx) => (
                <tr key={idx} className="border-t border-gray-200 dark:border-gray-800">
                  <td className={ui.td}>{p.medio}</td>
                  <td className={ui.tdRight}>{moneyARS(p.monto)}</td>
                  <td className={`${ui.td} text-xs text-gray-600 dark:text-gray-300`}>{p.referencia ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${ui.card} ${ui.cardPad}`}>
        <div className="text-sm font-semibold mb-3">Items</div>
        <table className="min-w-full text-sm">
          <thead className={ui.thead}>
            <tr>
              <th className={ui.th}>Código</th>
              <th className={ui.th}>Producto</th>
              <th className={`${ui.th} text-right`}>Cant.</th>
              <th className={`${ui.th} text-right`}>Precio</th>
              <th className={`${ui.th} text-right`}>Subtotal</th>
              <th className={`${ui.th} text-right`}>Costo</th>
              <th className={`${ui.th} text-right`}>Ganancia</th>
              <th className={ui.th}>Fuente</th>
            </tr>
          </thead>
          <tbody>
            {detalle.items.map((it) => (
              <tr key={it.id_item} className="border-t border-gray-200 dark:border-gray-800">
                <td className={`${ui.td} whitespace-nowrap`}>{it.codigo}</td>
                <td className={ui.td}>{it.producto}</td>
                <td className={ui.tdRight}>{it.cantidad}</td>
                <td className={ui.tdRight}>{moneyARS(it.precio_unitario)}</td>
                <td className={ui.tdRight}>{moneyARS(it.subtotal)}</td>
                <td className={ui.tdRight}>{moneyARS(it.costo_linea)}</td>
                <td className={ui.tdRight}>{moneyARS(it.ganancia_linea)}</td>
                <td className={`${ui.td} text-xs text-gray-600 dark:text-gray-300`}>{it.fuente_precio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorVenta(props: {
  editBusy: boolean;
  items: EditItem[];
  pagos: EditPago[];
  totalNuevo: number;
  pagosNuevo: number;

  prodQ: string;
  prodRes: ProductoBasico[];
  onProdQ: (v: string) => void;
  onBuscarProductos: () => void;
  onAddProducto: (p: ProductoBasico) => void;

  onItems: React.Dispatch<React.SetStateAction<EditItem[]>>;
  onPagos: React.Dispatch<React.SetStateAction<EditPago[]>>;

  reemplazarIdx: number | null;
  onSetReemplazarIdx: (idx: number | null) => void;

  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const {
    editBusy,
    items,
    pagos,
    totalNuevo,
    pagosNuevo,
    prodQ,
    prodRes,
    onProdQ,
    onBuscarProductos,
    onAddProducto,
    onItems,
    onPagos,
    reemplazarIdx,
    onSetReemplazarIdx,
    onGuardar,
    onCancelar,
  } = props;

  const pagosOk = pagosNuevo === totalNuevo && totalNuevo >= 0 && items.length > 0;
useEffect(() => {
  if (reemplazarIdx !== null) {
    onBuscarProductos();
  }
}, [reemplazarIdx]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini title="Total nuevo" value={moneyARS(totalNuevo)} />
        <Mini title="Pagos" value={moneyARS(pagosNuevo)} danger={pagosNuevo !== totalNuevo} />
        <Mini title="Regla" value="Pagos = Total" />
        <Mini title="Estado" value={pagosOk ? "Listo para guardar" : "Revisar importes"} danger={!pagosOk} />
      </div>

      {/* Items */}
      <div className={`${ui.card} ${ui.cardPad}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-sm font-semibold">Items</div>
            <div className="text-xs text-gray-500">Podés cambiar productos, cantidades y precio unitario.</div>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={prodQ}
              onChange={(e) => onProdQ(e.target.value)}
              className={`${ui.input} w-72`}
              placeholder="Buscar producto (código o nombre)"
            />
            <button className={ui.btn} onClick={onBuscarProductos} type="button">
              Buscar
            </button>
          </div>
          {/* Botón AGREGAR PRODUCTO (siempre visible) */}
          <div className="mb-3">
            <button
              type="button"
              className="px-3 py-2 text-xs rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              onClick={() => onSetReemplazarIdx(-1)}
            >
              Agregar producto
            </button>
          </div>

          {/* Mensaje cuando no hay items */}
          {items.length === 0 && (
            <div className="py-3 text-sm text-gray-500">
              La venta no tiene items.
            </div>
          )}
        </div>

        {reemplazarIdx !== null && (
          <div className="mb-3 text-xs text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
            Seleccioná un producto para reemplazar el ítem #{reemplazarIdx + 1}.
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => onSetReemplazarIdx(null)}
            >
              cancelar
            </button>
          </div>
        )}

        {prodQ.trim().length > 0 && prodQ.trim().length < 2 && (
          <div className="mb-3 text-xs text-gray-500">
            Escribí al menos 2 caracteres para buscar.
          </div>
        )}

       {prodRes.length > 0 && (
        <div className="mb-4 max-h-44 overflow-auto rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          {prodRes.map((p) => (
            <button
              key={p.id_producto}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
              onClick={() => onAddProducto(p)}
              type="button"
            >
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                <span className="font-mono text-xs text-gray-500 mr-2">
                  {p.codigo_producto}
                </span>
                {p.nombre}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                PV {moneyARS(p.precio_venta_actual)} · C {moneyARS(p.costo_actual)}
              </div>
            </button>
          ))}
        </div>
      )}

      

        <div className="overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Código</th>
                <th className={ui.th}>Producto</th>
                <th className={`${ui.th} text-right`}>Cant.</th>
                <th className={`${ui.th} text-right`}>Precio</th>
                <th className={`${ui.th} text-right`}>Subtotal</th>
                <th className={ui.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={`${it.id_producto}-${idx}`} className="border-t border-gray-200 dark:border-gray-800">
                  <td className={ui.td}>{it.codigo_producto}</td>
                  <td className={ui.td}>{it.nombre}</td>

                  <td className={`${ui.td} text-right`}>
                    <input
                      type="number"
                      min={1}
                      value={it.cantidad}
                      onChange={(e) => {
                        const v = clampInt(e.target.value || 1, 1, 1_000_000);
                        onItems((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, cantidad: v, fuente_precio: "manual" } : x))
                        );
                      }}
                      className={`${ui.input} w-24 text-right`}
                    />
                  </td>

                  <td className={`${ui.td} text-right`}>
                    <input
                      type="number"
                      min={0}
                      value={it.precio_unitario}
                      onChange={(e) => {
                        const v = clampInt(e.target.value || 0, 0, 9_999_999_999);
                        onItems((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, precio_unitario: v, fuente_precio: "manual" } : x))
                        );
                      }}
                      className={`${ui.input} w-28 text-right`}
                    />
                  </td>

                  <td className={ui.tdRight}>{moneyARS(it.cantidad * it.precio_unitario)}</td>

                  <td className={ui.td}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        onClick={() => onSetReemplazarIdx(idx)}
                      >
                        Cambiar
                      </button>

                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        onClick={() => onItems((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    La venta no tiene items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagos */}
      <div className={`${ui.card} ${ui.cardPad}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-sm font-semibold">Pagos</div>
            <div className="text-xs text-gray-500">El total cobrado debe coincidir con el total de productos.</div>
          </div>

          <button
            className={ui.btn}
            onClick={() => onPagos((prev) => [...prev, { medio: "efectivo", monto: 0, referencia: null }])}
            type="button"
          >
            Agregar pago
          </button>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Medio</th>
                <th className={`${ui.th} text-right`}>Monto</th>
                <th className={ui.th}>Ref</th>
                <th className={ui.th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p, idx) => (
                <tr key={idx} className="border-t border-gray-200 dark:border-gray-800">
                  <td className={ui.td}>
                    <select
                      value={p.medio}
                      onChange={(e) =>
                        onPagos((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, medio: e.target.value as any } : x))
                        )
                      }
                      className={ui.select}
                    >
                      <option value="efectivo">efectivo</option>
                      <option value="debito">debito</option>
                      <option value="credito">credito</option>
                      <option value="transferencia">transferencia</option>
                    </select>
                  </td>

                  <td className={`${ui.td} text-right`}>
                    <input
                      type="number"
                      min={0}
                      value={p.monto}
                      onChange={(e) => {
                        const v = clampInt(e.target.value || 0, 0, 9_999_999_999);
                        onPagos((prev) => prev.map((x, i) => (i === idx ? { ...x, monto: v } : x)));
                      }}
                      className={`${ui.input} w-32 text-right`}
                    />
                  </td>

                  <td className={ui.td}>
                    <input
                      value={p.referencia ?? ""}
                      onChange={(e) =>
                        onPagos((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, referencia: e.target.value ? e.target.value : null } : x
                          )
                        )
                      }
                      className={`${ui.input} w-full`}
                      placeholder="-"
                    />
                  </td>

                  <td className={ui.td}>
                    <button
                      className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      onClick={() => onPagos((prev) => prev.filter((_, i) => i !== idx))}
                      type="button"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}

              {pagos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    No hay pagos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagosNuevo !== totalNuevo && (
          <div className="mt-3 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            <div className="font-medium">Los importes no coinciden.</div>
            <div className="text-xs mt-1">
              Total de productos: <b>{moneyARS(totalNuevo)}</b> · Total cobrado: <b>{moneyARS(pagosNuevo)}</b>
            </div>
            <div className="text-xs mt-1">
              Ajustá los pagos para que el total cobrado sea igual al total de productos.
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button className={ui.btn} onClick={onCancelar} disabled={editBusy} type="button">
          Cancelar
        </button>

        <button
          className={ui.btnPrimary}
          disabled={!pagosOk || editBusy}
          onClick={onGuardar}
          type="button"
        >
          {editBusy ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <div className={`${ui.card} px-4 py-3`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{title}</div>
      <div className="text-lg font-semibold mt-1 text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function Mini({ title, value, danger }: { title: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{title}</div>
      <div className={`text-sm font-semibold mt-1 ${danger ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </div>
    </div>
  );
}
