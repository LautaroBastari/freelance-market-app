// src/pages/admin/Stock.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";

/* ===== Tipos ===== */
type StockResumen = {
  id_producto: number;
  codigo: string;
  nombre: string;
  stock_actual: number;
  precio_venta_actual: number;
  costo_actual: number;
};

type StockMov = {
  id_movimiento: number;
  cantidad_delta: number;
  motivo: string;
  referencia?: string | null;
  fecha_hora: string; // ISO o "YYYY-MM-DD HH:MM:SS" UTC
};

type PrecioHist = {
  id_precio: number;
  tipo: "venta" | "costo";
  precio: number;
  vigente_desde: string;
  vigente_hasta?: string | null;
};

type Evento = {
  t: "stock" | "precio";
  fecha: string;
  desc: string;
  badgeClass: string;
};

type Accion = "cantidad" | "precio_venta" | "costo" | "ambos";
type ModoCant = "delta" | "fijar";

/* ===== Helpers ===== */
const withTimeout = <T,>(p: Promise<T>, ms = 7000) =>
  Promise.race<T>([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("timeout backend")), ms),
    ),
  ]);

const toInt = (n: number | string): number => {
  const x = typeof n === "string" ? Number(n.trim()) : n;
  return Number.isFinite(x) ? Math.trunc(Number(x)) : NaN;
};

function toast(msg: string) {
  const el = document.createElement("div");
  el.className =
    "fixed left-1/2 -translate-x-1/2 bottom-5 z-50 rounded-lg bg-gray-900 text-white px-4 py-2 shadow-xl opacity-0 transition";
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 2200);
}

function formatFecha(s: string) {
  // Ej.: "2025-10-23 00:49:06" (UTC guardado por SQLite)
  const [datePart, timePart] = s.trim().split(" ");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  const [H, M, S] = (timePart ?? "00:00:00").split(":").map(Number);
  const dUtc = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1, H || 0, M || 0, S || 0));
  return dUtc.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false });
}

/* ===== Componente ===== */
export default function Stock() {
  const nav = useNavigate();

  /* ---- Estado base ---- */
  const [q, setQ] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [rows, setRows] = useState<StockResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  /* ---- Modal ACTUALIZAR ---- */
  const [openAct, setOpenAct] = useState(false);
  const [selAct, setSelAct] = useState<StockResumen | null>(null);
  const [accion, setAccion] = useState<Accion>("cantidad");
  const [modoCant, setModoCant] = useState<ModoCant>("delta");
  const [cantidad, setCantidad] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  const [costo, setCosto] = useState<number>(0);
  const [nota, setNota] = useState("");
  const [savingAct, setSavingAct] = useState(false);

  /* ---- Panel HISTORIAL ---- */
  const [histSel, setHistSel] = useState<StockResumen | null>(null);
  const [histEventos, setHistEventos] = useState<Evento[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  /* ---- Modal NUEVO PRODUCTO ---- */
  const [openNuevo, setOpenNuevo] = useState(false);
  const [npCodigo, setNpCodigo] = useState("");
  const [npNombre, setNpNombre] = useState("");
  const [npPrecioVenta, setNpPrecioVenta] = useState<number>(0);
  const [npCosto, setNpCosto] = useState<number>(0);
  const [npStockIni, setNpStockIni] = useState<number>(0);
  const [savingNuevo, setSavingNuevo] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== Data ===== */
  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const data = await withTimeout(
        invoke<StockResumen[]>("stock_listar", {
          q,
          solo_activos: soloActivos,
          limit: 200,
          offset: 0,
        }),
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  /* ===== Historial lateral ===== */
  function humanizeMotivo(m: string, delta: number): string {
  const s = (m || "").trim().toLowerCase();

  if (s === "ingreso_inicial") return "Ingreso inicial";
  if (s === "ingreso_manual")  return "Ingreso manual";
  if (s === "egreso_manual")   return "Egreso manual";

  if (s.startsWith("ajuste_absoluto")) {
    const arrow =
      delta > 0
        ? '<span style="color:#16a34a;">↑</span>'   // verde (subida)
        : '<span style="color:#dc2626;">↓</span>';  // rojo (bajada)
    return `Ajuste ${arrow}`;
  }

  if (s === "venta")       return "Venta";
  if (s === "devolucion")  return "Devolución";
  if (s === "compra")      return "Compra";
  if (s === "merma")       return "Merma";

  // fallback: capitaliza y reemplaza _
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function humanizeRef(ref?: string | null): string {
  if (!ref) return "";
  const r = ref.trim();
  if (!r || r.toLowerCase() === "alta_producto") return ""; // ocultar ruido interno
  return ` · Ref. ${r}`;
}

async function abrirHistorial(p: StockResumen) {
  setHistSel(p);
  setLoadingHist(true);
  try {
    const [movs, phVenta, phCosto] = await Promise.all([
      withTimeout(
        invoke<StockMov[]>("stock_mov_listar", {
          input: { id_producto: p.id_producto, limit: 15 },
        }),
      ),
      withTimeout(
        invoke<PrecioHist[]>("precio_hist_listar", {
          input: { id_producto: p.id_producto, tipo: "venta", limit: 10 },
        }),
      ),
      withTimeout(
        invoke<PrecioHist[]>("precio_hist_listar", {
          input: { id_producto: p.id_producto, tipo: "costo", limit: 10 },
        }),
      ),
    ]);

    const evStock: Evento[] = (movs || []).map((m) => {
      const sign = m.cantidad_delta > 0 ? `+${m.cantidad_delta}` : `-${Math.abs(m.cantidad_delta)}`;
      const motive = humanizeMotivo(m.motivo || "", m.cantidad_delta);
      const refTxt = humanizeRef(m.referencia);
      return {
        t: "stock",
        fecha: m.fecha_hora,
        desc: `Stock ${sign} · ${motive}${refTxt}`,
        badgeClass:
          m.cantidad_delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      };
    });

    const evPrecio: Evento[] = [...(phVenta || []), ...(phCosto || [])].map((h) => ({
      t: "precio",
      fecha: h.vigente_desde,
      desc: `Precio ${h.tipo === "venta" ? "venta" : "costo"}: ${h.precio}`,
      badgeClass: h.tipo === "venta" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700",
    }));

    const merged = [...evStock, ...evPrecio].sort((a, b) =>
      a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0,
    );

    setHistEventos(merged.slice(0, 20));
  } catch (e) {
    toast(String(e));
    setHistEventos([]);
  } finally {
    setLoadingHist(false);
  }
}

  /* ===== Actualizar ===== */
  function abrirActualizar(p: StockResumen) {
    lockBodyScroll();
    setSelAct(p);
    setAccion("cantidad");
    setModoCant("delta");
    setCantidad(0);
    setPrecioVenta(p.precio_venta_actual);
    setCosto(p.costo_actual);
    setNota("");
    setOpenAct(true);
  }

  async function guardarActualizar() {
    if (!selAct || savingAct) return;
    setSavingAct(true);
    try {
      // 1) Cantidad
      if (accion === "cantidad" || accion === "ambos") {
        if (modoCant === "delta") {
          const delta = Math.trunc(cantidad);
          if (!Number.isFinite(delta) || delta === 0) throw new Error("Cantidad inválida.");
          const final = selAct.stock_actual + delta;
          if (final < 0) throw new Error("Stock negativo: el ajuste dejaría < 0.");
          await withTimeout(
            invoke("stock_ajustar", {
              input: {
                id_producto: selAct.id_producto,
                delta,
                motivo: delta > 0 ? "ingreso_manual" : "egreso_manual",
                referencia: nota || null,
              },
            }),
          );
        } else {
          // MODO FIJAR ABSOLUTO
          const nuevo = Math.trunc(cantidad);
          if (!Number.isFinite(nuevo) || nuevo < 0) throw new Error("Stock inválido. No puede ser negativo.");

          await withTimeout(
            invoke("stock_fijar_absoluto", {
              input: {
                id_producto: selAct.id_producto,
                nuevo,
                motivo: "ajuste_absoluto_ui",
                referencia: nota || null,
              },
            }),
          );
        }
      }

      // 2) Precio de venta
      if (accion === "precio_venta" || accion === "ambos") {
        const pv = toInt(precioVenta);
        if (!Number.isFinite(pv) || pv < 0) throw new Error("Precio inválido.");
        if (pv !== selAct.precio_venta_actual) {
          await withTimeout(
            invoke("precio_actualizar", {
              input: { id_producto: selAct.id_producto, tipo: "venta", nuevo: pv },
            }),
          );
        }
      }

      // 3) Costo
      if (accion === "costo" || accion === "ambos") {
        const co = toInt(costo);
        if (!Number.isFinite(co) || co < 0) throw new Error("Costo inválido.");
        if (co !== selAct.costo_actual) {
          await withTimeout(
            invoke("precio_actualizar", {
              input: { id_producto: selAct.id_producto, tipo: "costo", nuevo: co },
            }),
          );
        }
      }

      setOpenAct(false);
      unlockBodyScroll();
      await cargar();
      toast("Actualizado.");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("stock_actual") && msg.includes("CHECK")) {
        toast("Rechazado por la base: stock no puede quedar negativo.");
      } else if (msg.toLowerCase().includes("timeout")) {
        toast("Timeout del backend.");
      } else {
        toast(msg);
      }
    } finally {
      setSavingAct(false);
    }
  }

  /* ===== Nuevo producto ===== */
  async function crearProducto() {
    if (!npCodigo.trim()) throw new Error("Código requerido.");
    if (!npNombre.trim()) throw new Error("Nombre requerido.");
    if (!Number.isFinite(npPrecioVenta) || npPrecioVenta < 0) throw new Error("Precio de venta inválido.");
    if (!Number.isFinite(npCosto) || npCosto < 0) throw new Error("Costo inválido.");
    if (!Number.isFinite(npStockIni) || npStockIni < 0) throw new Error("Stock inicial inválido.");

    setSavingNuevo(true);
    try {
      const res = await withTimeout(
        invoke<{ id_producto: number }>("producto_crear", {
          input: {
            codigo: npCodigo.trim(),
            nombre: npNombre.trim(),
            precio_venta: Math.trunc(npPrecioVenta),
            costo: Math.trunc(npCosto),
          },
        }),
      );

      if (npStockIni > 0) {
        await withTimeout(
          invoke("stock_ajustar", {
            input: {
              id_producto: res.id_producto,
              delta: Math.trunc(npStockIni),
              motivo: "ingreso_inicial",
              referencia: "alta_producto",
            },
          }),
        );
      }

      setOpenNuevo(false);
      unlockBodyScroll();
      setNpCodigo("");
      setNpNombre("");
      setNpPrecioVenta(0);
      setNpCosto(0);
      setNpStockIni(0);
      await cargar();
      toast("Producto creado.");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("UNIQUE") || msg.toLowerCase().includes("codigo")) {
        toast("El código ya existe.");
      } else if (msg.toLowerCase().includes("timeout")) {
        toast("Timeout del backend.");
      } else {
        toast(msg);
      }
    } finally {
      setSavingNuevo(false);
    }
  }

  const vacio = !loading && rows.length === 0 && !error;

  function lockBodyScroll() {
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = scrollBarWidth + "px";
  }
  function unlockBodyScroll() {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  /* ===== UI ===== */
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-yellow-50 via-white/80 to-white/95">
      <motion.main
        initial={{ opacity: 0, y: 10, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.995 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="mx-auto w-full px-5 md:px-7 py-5 md:py-7 space-y-5 max-w-[1600px] 2xl:max-w-[1800px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav("/admin")}
              className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm"
            >
              ← Volver
            </button>
            <div>
              <h1 className="font-semibold text-gray-900 text-[clamp(1.4rem,1.2vw+1rem,1.9rem)]">Inventario</h1>
              <p className="text-[clamp(0.95rem,0.6vw+0.7rem,1.05rem)] text-gray-600">
                Gestión de stock y precios con historial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[clamp(0.95rem,0.6vw+0.7rem,1.05rem)] text-gray-700">
              <input
                type="checkbox"
                className="size-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo activos
            </label>
            <button
              className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm disabled:opacity-60"
              onClick={cargar}
              disabled={loading}
            >
              {loading ? "Cargando…" : "Refrescar"}
            </button>
            <button
              className="h-10 rounded-lg bg-green-600 px-4 text-base font-medium text-white hover:bg-green-700 shadow-sm"
              onClick={() => {
                setNpCodigo("");
                setNpNombre("");
                setNpPrecioVenta(0);
                setNpCosto(0);
                setNpStockIni(0);
                lockBodyScroll();
                setOpenNuevo(true);
              }}
            >
              Nuevo producto
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="h-11 w-[28rem] max-w-full rounded-lg border border-gray-300 bg-white/90 px-3 text-base outline-none shadow-sm focus:ring-2 focus:ring-blue-200"
            placeholder="Buscar por nombre o código"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") cargar();
            }}
          />
          <button
            className="h-11 rounded-lg bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 shadow-sm disabled:opacity-60"
            onClick={cargar}
            disabled={loading}
          >
            Buscar
          </button>
          {error && <span className="text-base text-red-600">{error}</span>}
        </div>

        {/* Listado + Panel lateral */}
        <div className="grid gap-6 lg:grid-cols-[1fr_440px] 2xl:grid-cols-[1fr_520px] items-start">
          {/* LISTADO */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-md">
            <div className="overflow-auto rounded-2xl">
              <table className="w-full text-[15px] font-light table-fixed">
  <thead className="sticky top-0 bg-gray-50/80 backdrop-blur text-gray-700">
    <tr className="border-b border-gray-100">
      <th className="w-24 px-5 py-2.5 text-left font-semibold tracking-wide">Código</th>
      <th className="px-5 py-2.5 text-left font-semibold tracking-wide">Nombre</th>
      <th className="w-28 px-5 py-2.5 text-center font-semibold tracking-wide">Stock</th>
      <th className="w-32 px-5 py-2.5 text-right font-semibold tracking-wide">Precio venta</th>
      <th className="w-28 px-5 py-2.5 text-right font-semibold tracking-wide">Costo</th>
      <th className="w-44 px-5 py-2.5" />
    </tr>
  </thead>

  <tbody>
    {rows.map((r) => (
      <tr
        key={r.id_producto}
        className="border-b border-gray-100 hover:bg-yellow-50/30 transition-colors"
      >
        <td className="px-5 py-3 font-mono text-gray-800">{r.codigo}</td>
        <td className="px-5 py-3 text-gray-800">{r.nombre}</td>

        {/* Stock centrado */}
        <td className="px-5 py-3 text-center">
          <span
            className={[
              "inline-flex justify-center items-center rounded-full px-3 py-0.5 text-sm font-medium border shadow-sm transition-colors duration-200",
              r.stock_actual <= 0
                ? "bg-red-50 text-red-700 border-red-200"
                : r.stock_actual < 5
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-green-50 text-green-700 border-green-200",
            ].join(" ")}
          >
            {r.stock_actual}
          </span>
        </td>

        {/* Números más finos y alineados */}
        <td className="px-5 py-3 text-right font-mono text-gray-800 tabular-nums">
          {r.precio_venta_actual}
        </td>
        <td className="px-5 py-3 text-right font-mono text-gray-800 tabular-nums">
          {r.costo_actual}
        </td>

        {/* Botones con separación extra */}
        <td className="px-5 py-3">
          <div className="flex gap-3 justify-end">
            <button
              className="h-9 rounded-md bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-3 text-[13px] font-medium 
             hover:from-yellow-600 hover:to-yellow-700 shadow-sm transition-all active:scale-[0.97]"
              onClick={() => abrirActualizar(r)}
            >
              Actualizar
            </button>
            <button
              className="h-9 rounded-md border border-gray-300 px-3 text-[13px] font-medium hover:bg-gray-50 bg-white shadow-sm"
              onClick={() => abrirHistorial(r)}
            >
              Historial
            </button>
          </div>
        </td>
      </tr>
    ))}
  </tbody>
</table>

            </div>
          </section>

          {/* PANEL HISTORIAL */}
          <div className="relative w-full h-[30vh] min-h-[380px] 2xl:min-h-[420px]">
            <div className="h-full rounded-2xl border border-transparent bg-transparent" />
            <AnimatePresence initial={false}>
              <motion.aside
                key={histSel ? histSel.id_producto : "hist"}
                layout={false}
                className="absolute inset-0 rounded-2xl border border-gray-200
  bg-gradient-to-b from-yellow-50 via-white to-white shadow-md
  flex flex-col min-h-0"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <div className="border-b border-gray-200 px-5 py-4">
                  <h3 className="text-base font-semibold text-gray-900">
                    Historial {histSel ? `· ${histSel.nombre}` : ""}
                  </h3>
                  {!histSel && (
                    <p className="text-sm text-gray-500">Elegí “Historial” en una fila para ver eventos.</p>
                  )}
                </div>

                <div className="p-4 space-y-3 max-h-[60vh] overflow-auto">
                  {loadingHist && <div className="text-base text-gray-500">Cargando…</div>}
                  {!loadingHist && histSel && histEventos.length === 0 && (
                    <div className="text-base text-gray-500">Sin eventos recientes.</div>
                  )}
                  {!loadingHist &&
                    histEventos.map((ev, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 rounded-lg border border-gray-100 p-2 hover:bg-gray-50"
                      >
                        <span
                          className={`mt-0.5 inline-flex min-w-16 justify-center rounded-full px-2 py-0.5 text-xs font-medium ${ev.badgeClass}`}
                        >
                          {ev.t === "stock" ? "Stock" : "Precio"}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-gray-500">{formatFecha(ev.fecha)}</div>
                          <div
                            className="text-base text-gray-800 truncate"
                            dangerouslySetInnerHTML={{ __html: ev.desc }}
                          />
                        </div>
                      </motion.div>
                    ))}
                </div>
              </motion.aside>
            </AnimatePresence>
          </div>
        </div>

        {/* ===== Modal ACTUALIZAR ===== */}
        <AnimatePresence>
          {openAct && selAct && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
              onClick={() => {
                unlockBodyScroll();
                setOpenAct(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-[620px] max-w-[92vw] rounded-2xl border border-gray-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
              >
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Actualizar: {selAct.nombre} <span className="text-gray-500 font-medium">({selAct.codigo})</span>
                  </h3>
                </div>

                <div className="grid gap-4 px-6 py-5 text-base">
                  <label className="grid gap-1">
                    <span className="text-sm text-gray-600">¿Qué actualizar?</span>
                    <select
                      className="h-11 rounded-lg border border-gray-300 px-3"
                      value={accion}
                      onChange={(e) => setAccion(e.target.value as Accion)}
                    >
                      <option value="cantidad">Cantidad</option>
                      <option value="precio_venta">Precio de venta</option>
                      <option value="costo">Costo</option>
                      <option value="ambos">Cantidad y precios</option>
                    </select>
                  </label>

                  {(accion === "cantidad" || accion === "ambos") && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="text-sm text-gray-600">Modo</span>
                          <select
                            className="h-11 rounded-lg border border-gray-300 px-3"
                            value={modoCant}
                            onChange={(e) => setModoCant(e.target.value as ModoCant)}
                          >
                            <option value="delta">Delta (±)</option>
                            <option value="fijar">Fijar absoluto</option>
                          </select>
                        </label>

                        <label className="grid gap-1">
                          <span className="text-sm text-gray-600">
                            {modoCant === "delta" ? "Δ Cantidad" : `Nuevo stock (actual: ${selAct.stock_actual})`}
                          </span>
                          <input
                            type="number"
                            className="h-11 rounded-lg border border-gray-300 px-3"
                            value={cantidad}
                            onChange={(e) => setCantidad(Number(e.target.value))}
                          />
                        </label>
                      </div>

                      <label className="grid gap-1">
                        <span className="text-sm text-gray-600">Nota (opcional)</span>
                        <input
                          className="h-11 rounded-lg border border-gray-300 px-3"
                          placeholder="Detalle, OC, etc."
                          value={nota}
                          onChange={(e) => setNota(e.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {(accion === "precio_venta" || accion === "ambos") && (
                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Precio de venta</span>
                      <input
                        type="number"
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={precioVenta}
                        onChange={(e) => setPrecioVenta(Number(e.target.value))}
                        min={0}
                      />
                    </label>
                  )}

                  {(accion === "costo" || accion === "ambos") && (
                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Costo</span>
                      <input
                        type="number"
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={costo}
                        onChange={(e) => setCosto(Number(e.target.value))}
                        min={0}
                      />
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                  <button
                    className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-base hover:bg-gray-50"
                    onClick={() => {
                      unlockBodyScroll();
                      setOpenAct(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="h-10 rounded-lg bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={guardarActualizar}
                    disabled={savingAct}
                  >
                    {savingAct ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Modal NUEVO PRODUCTO ===== */}
        <AnimatePresence>
          {openNuevo && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
              onClick={() => {
                unlockBodyScroll();
                setOpenNuevo(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-[620px] max-w-[92vw] rounded-2xl border border-gray-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
              >
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="text-lg font-semibold text-gray-900">Nuevo producto</h3>
                </div>

                <div className="grid gap-4 px-6 py-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Código</span>
                      <input
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={npCodigo}
                        onChange={(e) => setNpCodigo(e.target.value)}
                        placeholder="Ej: P001"
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Nombre</span>
                      <input
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={npNombre}
                        onChange={(e) => setNpNombre(e.target.value)}
                        placeholder="Ej: Huevo blanco"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Precio de venta</span>
                      <input
                        type="number"
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={npPrecioVenta}
                        onChange={(e) => setNpPrecioVenta(Number(e.target.value))}
                        min={0}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Costo</span>
                      <input
                        type="number"
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={npCosto}
                        onChange={(e) => setNpCosto(Number(e.target.value))}
                        min={0}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-sm text-gray-600">Stock inicial</span>
                      <input
                        type="number"
                        className="h-11 rounded-lg border border-gray-300 px-3"
                        value={npStockIni}
                        onChange={(e) => setNpStockIni(Number(e.target.value))}
                        min={0}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                  <button
                    className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-base hover:bg-gray-50"
                    onClick={() => {
                      unlockBodyScroll();
                      setOpenNuevo(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="h-10 rounded-lg bg-green-600 px-5 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        await crearProducto();
                      } catch (e) {
                        toast(String(e));
                      }
                    }}
                    disabled={savingNuevo}
                  >
                    {savingNuevo ? "Creando…" : "Crear"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}


