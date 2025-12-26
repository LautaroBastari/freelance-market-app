import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import ModalCaja from "./modalCaja";
import logo from "../../public/final2.png";

import {
  promoComboListar,
  promoComboDetalle,
  ventaAplicarPromoCombo,
  type PromoComboRow,
  type PromoComboDetalle,
} from "../api/promos";

type ProductoDisponible = {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  stock_disponible: number;
};

type Linea = {
  id_item: number;
  id_producto: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type MedioPago = "efectivo" | "debito" | "credito" | "transferencia";

export default function VentasPage() {
  const [productos, setProductos] = useState<ProductoDisponible[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState<boolean>(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  const [cajaAbierta, setCajaAbierta] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const [idVenta, setIdVenta] = useState<number | null>(null);

  const [carrito, setCarrito] = useState<{ total: number; lineas: Linea[] }>({
    total: 0,
    lineas: [],
  });

  const hayVentaEnCurso = idVenta != null && (carrito?.lineas?.length ?? 0) > 0;

  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [pagoMixto, setPagoMixto] = useState<boolean>(false);
  const [medioPago2, setMedioPago2] = useState<MedioPago>("debito");
  const [montoSegundo, setMontoSegundo] = useState<number>(0);

  const [confirmCerrarOpen, setConfirmCerrarOpen] = useState<boolean>(false);
  const [confirmAbrirOpen, setConfirmAbrirOpen] = useState<boolean>(false);
  const [horaAbrir, setHoraAbrir] = useState<string>("");
  const [horaCerrar, setHoraCerrar] = useState<string>("");

  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  const [confirmCancelarVentaOpen, setConfirmCancelarVentaOpen] = useState(false);

  const [tabListado, setTabListado] = useState<"productos" | "promos">(
    "productos"
  );
  const [combos, setCombos] = useState<PromoComboRow[]>([]);
  const [cargandoCombos, setCargandoCombos] = useState<boolean>(true);
  const [errorCombos, setErrorCombos] = useState<string | null>(null);

  const [aplicarComboOpen, setAplicarComboOpen] = useState(false);
  const [comboSel, setComboSel] = useState<PromoComboDetalle | null>(null);
  const [precioPack, setPrecioPack] = useState<number>(0);

  const [ventaOkOpen, setVentaOkOpen] = useState(false);

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const logout = useCallback(async () => {
    try {
      await invoke("auth_logout");
      window.location.href = "/";
    } catch (err) {
      alert("Error al cerrar sesión:\n" + String(err));
    }
  }, []);

  const solicitarLogout = () => setConfirmLogoutOpen(true);
  const cancelarLogout = () => setConfirmLogoutOpen(false);
  const confirmarLogout = async () => {
    await logout();
    setConfirmLogoutOpen(false);
  };

  const cargarEstadoCaja = useCallback(async () => {
    try {
      const abierta = await invoke<boolean>("caja_estado");
      setCajaAbierta(abierta);
    } catch (err) {
      console.error("Error consultando caja:", err);
    }
  }, []);

  const cargarProductos = useCallback(async () => {
    try {
      setCargandoProductos(true);
      const data = await invoke<ProductoDisponible[]>("productos_disponibles");
      setProductos(data);
      setErrorProductos(null);
    } catch (err) {
      console.error(err);
      setErrorProductos("No se pudieron cargar los productos.");
    } finally {
      setCargandoProductos(false);
    }
  }, []);

  const cargarCombos = useCallback(async () => {
    try {
      setCargandoCombos(true);
      const data = await promoComboListar();
      setCombos(data);
      setErrorCombos(null);
    } catch (e) {
      console.error(e);
      setErrorCombos("No se pudieron cargar las promociones.");
    } finally {
      setCargandoCombos(false);
    }
  }, []);

  const refrescarCarrito = useCallback(async (id: number) => {
    const [lineas, total] = await invoke<[Linea[], number]>("venta_listar", {
      input: { id_venta: id },
    });
    setCarrito({ total, lineas });
  }, []);

  const asegurarVenta = useCallback(async () => {
    if (idVenta != null) return idVenta;
    const id = await invoke<number>("venta_iniciar");
    setIdVenta(id);
    await refrescarCarrito(id);
    return id;
  }, [idVenta, refrescarCarrito]);

  useEffect(() => {
    if (!confirmCerrarOpen && !confirmAbrirOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmAbrirOpen(false);
        setConfirmCerrarOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmAbrirOpen, confirmCerrarOpen]);

  useEffect(() => {
    cargarProductos();
    cargarCombos();
    cargarEstadoCaja();
  }, [cargarProductos, cargarCombos, cargarEstadoCaja]);

  const abrirCaja = useCallback(async () => {
    setBusy(true);
    try {
      await invoke<number>("caja_abrir");
      setCajaAbierta(true);
    } catch (e) {
      alert("Error al abrir caja:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const solicitarCerrarCaja = useCallback(() => {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setHoraCerrar(hora);
    setConfirmCerrarOpen(true);
    setTimeout(() => cancelBtnRef.current?.focus(), 0);
  }, []);

  const confirmarCerrarCaja = useCallback(async () => {
    setBusy(true);
    try {
      await invoke<number>("caja_cerrar");
      setCajaAbierta(false);
      setConfirmCerrarOpen(false);
    } catch (e) {
      alert("Error al cerrar caja:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const cancelarCerrarCaja = useCallback(() => {
    setConfirmCerrarOpen(false);
  }, []);

  const solicitarAbrirCaja = useCallback(() => {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setHoraAbrir(hora);
    setConfirmAbrirOpen(true);
    setTimeout(() => cancelBtnRef.current?.focus(), 0);
  }, []);

  const confirmarAbrirCaja = useCallback(async () => {
    setBusy(true);
    try {
      await abrirCaja();
      setConfirmAbrirOpen(false);
    } finally {
      setBusy(false);
    }
  }, [abrirCaja]);

  const cancelarAbrirCaja = useCallback(() => {
    setConfirmAbrirOpen(false);
  }, []);

  const agregarItem = useCallback(
    async (p: ProductoDisponible) => {
      try {
        setBusy(true);
        const id_venta = await asegurarVenta();

        await invoke("venta_agregar_item", {
          input: {
            id_venta,
            id_producto: p.id_producto,
            cantidad: 1,
          },
        });

        await refrescarCarrito(id_venta);
      } catch (e) {
        alert("No se pudo agregar el producto:\n" + String(e));
      } finally {
        setBusy(false);
      }
    },
    [asegurarVenta, refrescarCarrito]
  );

  const abrirAplicarCombo = useCallback(
    async (c: PromoComboRow) => {
      try {
        setBusy(true);

        const id_venta = await asegurarVenta();
        const det = await promoComboDetalle(c.id_combo);

        setComboSel(det);
        setPrecioPack(c.precio_pack);
        setAplicarComboOpen(true);

        await refrescarCarrito(id_venta);
      } catch (e) {
        alert("No se pudo abrir la promoción:\n" + String(e));
      } finally {
        setBusy(false);
      }
    },
    [asegurarVenta, refrescarCarrito]
  );

  const confirmarAplicarCombo = useCallback(async () => {
    if (!comboSel) return;

    try {
      setBusy(true);

      if (!cajaAbierta) {
        alert("La caja está cerrada.");
        return;
      }

      const id_venta = await asegurarVenta();
      const precio = Math.max(0, Math.trunc(precioPack || 0));

      if (precio < comboSel.combo.precio_min_total) {
        alert("El precio del pack está por debajo del mínimo.");
        return;
      }

      await ventaAplicarPromoCombo({
        id_venta,
        id_combo: comboSel.combo.id_combo,
        precio_total_pack: precio,
      });

      setAplicarComboOpen(false);
      setComboSel(null);

      await refrescarCarrito(id_venta);
      await cargarProductos();
    } catch (e) {
      alert("No se pudo aplicar la promoción:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, [
    comboSel,
    cajaAbierta,
    asegurarVenta,
    precioPack,
    refrescarCarrito,
    cargarProductos,
  ]);

  const registrarVenta = useCallback(async () => {
    if (!idVenta) return;
    if (carrito.total <= 0) return;

    try {
      setBusy(true);

      let pagos: {
        medio: MedioPago;
        monto: number;
        referencia: string | null;
      }[] = [];

      if (!pagoMixto) {
        pagos.push({
          medio: medioPago,
          monto: carrito.total,
          referencia: null,
        });
      } else {
        const segundo = Math.trunc(montoSegundo) || 0;
        const primero = carrito.total - segundo;

        if (segundo <= 0 || primero <= 0) {
          alert(
            "El monto del segundo método debe ser mayor que 0 y menor que el total."
          );
          return;
        }

        pagos.push({ medio: medioPago, monto: primero, referencia: null });
        pagos.push({ medio: medioPago2, monto: segundo, referencia: null });
      }

      await invoke("venta_finalizar", {
        input: {
          id_venta: idVenta,
          pagos,
        },
      });

      await cargarProductos();

      setIdVenta(null);
      setCarrito({ total: 0, lineas: [] });
      setPagoMixto(false);
      setMontoSegundo(0);
      setVentaOkOpen(true);
    } catch (e) {
      alert("Error al registrar venta:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, [
    idVenta,
    carrito.total,
    medioPago,
    medioPago2,
    pagoMixto,
    montoSegundo,
    cargarProductos,
  ]);

  const cancelarVenta = useCallback(async () => {
    if (!idVenta) return;
    try {
      setBusy(true);
      await invoke("venta_cancelar", {
        input: { id_venta: idVenta },
      });
      setIdVenta(null);
      setCarrito({ total: 0, lineas: [] });
    } catch (e) {
      alert("No se pudo cancelar la venta:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, [idVenta]);

  const solicitarCancelarVenta = useCallback(() => {
    if (!idVenta) return;
    setConfirmCancelarVentaOpen(true);
  }, [idVenta]);

  const confirmarCancelarVenta = useCallback(async () => {
    await cancelarVenta();
    setConfirmCancelarVentaOpen(false);
  }, [cancelarVenta]);

  const cancelarDialogoCancelarVenta = useCallback(() => {
    setConfirmCancelarVentaOpen(false);
  }, []);

  const totalItems = carrito.lineas.reduce((a, l) => a + l.cantidad, 0);

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-yellow-50 via-white/80 to-white/95">
      <main className="flex-1 mx-auto px-6 md:px-8 py-7 space-y-5 max-w-[1600px] 2xl:max-w-[1800px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900 text-[clamp(1.4rem,1.2vw+1rem,1.9rem)]">
              Ventas
            </h1>
            <p className="text-[clamp(0.95rem,0.6vw+0.7rem,1.05rem)] text-gray-600">
              Registrá operaciones y controlá el carrito.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center text-sm font-medium rounded-full px-3 py-1 border shadow-sm ${
                cajaAbierta
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              Caja: {cajaAbierta ? "Abierta" : "Cerrada"}
            </span>

            {cajaAbierta ? (
              <button
                onClick={() => {
                  if (hayVentaEnCurso) return;
                  solicitarCerrarCaja();
                }}
                disabled={busy || hayVentaEnCurso}
                className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm disabled:opacity-60"
              >
                {hayVentaEnCurso ? "Venta en curso" : "Cerrar caja"}
              </button>
            ) : (
              <button
                onClick={solicitarAbrirCaja}
                disabled={busy}
                className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm disabled:opacity-60"
              >
                Abrir caja
              </button>
            )}

            <ModalCaja />

            <button
              onClick={solicitarLogout}
              disabled={cajaAbierta}
              className={`h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base shadow-sm ${
                cajaAbierta ? "opacity-50 cursor-not-allowed" : "hover:bg-white"
              }`}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px] 2xl:grid-cols-[1fr_500px] items-start">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {tabListado === "productos"
                  ? "Productos disponibles"
                  : "Promociones disponibles"}
              </h3>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setTabListado("productos")}
                  className={`h-9 rounded-lg px-3 text-sm border shadow-sm ${
                    tabListado === "productos"
                      ? "bg-yellow-100 border-yellow-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Productos
                </button>

                <button
                  onClick={() => {
                    setTabListado("promos");
                    cargarCombos();
                  }}
                  className={`h-9 rounded-lg px-3 text-sm border shadow-sm ${
                    tabListado === "promos"
                      ? "bg-yellow-100 border-yellow-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Promociones
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl">
              {tabListado === "promos" ? (
                <div className="p-5">
                  {errorCombos ? (
                    <div className="text-sm text-red-600">{errorCombos}</div>
                  ) : cargandoCombos ? (
                    <div className="text-gray-500">Cargando promociones...</div>
                  ) : combos.length === 0 ? (
                    <div className="text-gray-500">
                      No hay promociones activas.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {combos.map((c) => (
                        <div
                          key={c.id_combo}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {c.nombre}
                            </div>
                            <div className="text-xs text-gray-500">
                              Precio: $ {c.precio_pack}
                            </div>
                          </div>

                          <button
                            onClick={() => abrirAplicarCombo(c)}
                            disabled={!cajaAbierta || busy}
                            className="h-9 rounded-md border border-gray-300 px-3 text-[13px] font-medium hover:bg-gray-50 bg-white shadow-sm disabled:opacity-50"
                          >
                            Agregar promocion
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tabListado === "productos" && (
                <>
                  {errorProductos ? (
                    <div className="p-5 text-sm text-red-600">
                      {errorProductos}
                    </div>
                  ) : null}

                  {cargandoProductos ? (
                    <div className="p-5 text-gray-500">Cargando productos...</div>
                  ) : (
                    <table className="w-full table-fixed text-[15px] font-light">
                      <colgroup>
                        <col />
                        <col className="w-40" />
                        <col className="w-28" />
                        <col className="w-36" />
                      </colgroup>

                      <thead className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur text-gray-700">
                        <tr className="border-b border-gray-200">
                          <th className="px-5 py-2.5 text-left font-semibold tracking-wide">
                            Producto
                          </th>
                          <th className="px-5 py-2.5 text-right font-semibold tracking-wide">
                            Precio unitario
                          </th>
                          <th className="px-5 py-2.5 text-center font-semibold tracking-wide">
                            Stock
                          </th>
                          <th className="px-5 py-2.5" />
                        </tr>
                      </thead>

                      <tbody>
                        {productos.map((p) => (
                          <tr
                            key={p.id_producto}
                            className="border-b border-gray-100 hover:bg-yellow-50/30 transition-colors"
                          >
                            <td className="px-5 py-3 text-gray-800">{p.nombre}</td>

                            <td className="px-5 py-3 text-right font-mono text-gray-800 tabular-nums">
                              $ {p.precio_unitario}
                            </td>

                            <td className="px-5 py-3 text-center">
                              <span
                                className={[
                                  "inline-flex justify-center items-center rounded-full px-3 py-0.5 text-sm font-medium border shadow-sm",
                                  p.stock_disponible <= 0
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : p.stock_disponible < 5
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-green-50 text-green-700 border-green-200",
                                ].join(" ")}
                              >
                                {p.stock_disponible}
                              </span>
                            </td>

                            <td className="px-5 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => agregarItem(p)}
                                  disabled={!cajaAbierta || busy}
                                  className="h-9 rounded-md border border-gray-300 px-3 text-[13px] font-medium hover:bg-gray-50 bg-white shadow-sm disabled:opacity-50"
                                >
                                  Agregar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Resumen</h3>
                <img
                  src={logo}
                  alt="Logo"
                  className="h-7 w-auto opacity-90 select-none"
                  draggable={false}
                />
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              {carrito.lineas.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-500">
                  Carrito vacío. Agregá productos para iniciar una venta.
                </div>
              ) : (
                <ul className="divide-y border-b border-gray-200">
                  {carrito.lineas.map((l) => (
                    <li key={l.id_item} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">
                            {l.nombre}
                          </div>
                          <div className="text-xs text-gray-500">
                            $ {l.precio_unitario} c/u
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                              disabled={busy}
                              onClick={async () => {
                                const nueva = l.cantidad - 1;
                                await invoke("venta_set_cantidad", {
                                  input: { id_item: l.id_item, cantidad: nueva },
                                });
                                if (idVenta) await refrescarCarrito(idVenta);
                              }}
                            >
                              -
                            </button>

                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-16 h-8 text-center border border-gray-300 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                              value={l.cantidad}
                              onChange={async (e) => {
                                const raw = e.target.value;

                                if (raw === "") return;
                                if (!/^\d+$/.test(raw)) return;

                                let nueva = Number(raw);
                                if (nueva < 1) nueva = 1;

                                await invoke("venta_set_cantidad", {
                                  input: { id_item: l.id_item, cantidad: nueva },
                                });

                                if (idVenta) await refrescarCarrito(idVenta);
                              }}
                              onBlur={async (e) => {
                                if (e.target.value === "") {
                                  await invoke("venta_set_cantidad", {
                                    input: { id_item: l.id_item, cantidad: 1 },
                                  });
                                  if (idVenta) await refrescarCarrito(idVenta);
                                }
                              }}
                            />

                            <button
                              className="h-8 w-8 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                              disabled={busy}
                              onClick={async () => {
                                const nueva = l.cantidad + 1;
                                await invoke("venta_set_cantidad", {
                                  input: { id_item: l.id_item, cantidad: nueva },
                                });
                                if (idVenta) await refrescarCarrito(idVenta);
                              }}
                            >
                              +
                            </button>

                            <button
                              className="ml-2 h-8 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                              disabled={busy}
                              onClick={async () => {
                                await invoke("venta_quitar_item", {
                                  input: { id_item: l.id_item },
                                });
                                if (idVenta) await refrescarCarrito(idVenta);
                              }}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>

                        <div className="w-24 text-right font-mono tabular-nums text-gray-900">
                          $ {l.subtotal}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-5 py-4 border-b border-gray-200">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Ítems</span>
                  <strong className="text-gray-900">{totalItems}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Subtotal</span>
                  <strong className="text-gray-900">$ {carrito.total}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Impuestos</span>
                  <strong className="text-gray-900">$ 0</strong>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-gray-200">
              <div className="grid gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Método de pago
                  </label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                    className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={pagoMixto}
                    onChange={(e) => setPagoMixto(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Pago mixto (dos métodos)
                </label>

                {pagoMixto && (
                  <div className="grid gap-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Segundo método
                      </label>
                      <select
                        value={medioPago2}
                        onChange={(e) => setMedioPago2(e.target.value as MedioPago)}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Monto segundo método
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={carrito.total}
                        value={montoSegundo === 0 ? "" : montoSegundo}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMontoSegundo(Number.isFinite(v) ? v : 0);
                        }}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 bg-yellow-50/40">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm text-gray-700">Total</span>
                <span className="text-xl font-semibold font-mono tabular-nums text-green-700">
                  $ {carrito.total}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={solicitarCancelarVenta}
                  disabled={busy || idVenta == null}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-base hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarVenta}
                  disabled={
                    !cajaAbierta ||
                    busy ||
                    idVenta == null ||
                    carrito.lineas.length === 0
                  }
                  className="h-10 rounded-lg bg-green-600 px-5 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Registrar venta
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {confirmAbrirOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={cancelarAbrirCaja}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">
              ¿Estás seguro/a de abrir caja?
            </h2>
            <p className="text-sm text-neutral-600 mb-5">
              Estás por abrir caja a las{" "}
              <strong>
                {horaAbrir ||
                  new Date().toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
              </strong>
              .
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelarAbrirCaja}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 font-semibold"
              >
                No
              </button>
              <button
                onClick={confirmarAbrirCaja}
                disabled={busy}
                className="h-9 px-3 rounded-xl border border-emerald-600 text-white bg-emerald-600 hover:brightness-95 disabled:opacity-60 font-semibold"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCerrarOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={cancelarCerrarCaja}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">
              ¿Estás seguro/a de cerrar caja?
            </h2>
            <p className="text-sm text-neutral-600 mb-5">
              Se registrará fecha y hora de cierre. Hora actual:{" "}
              <strong>
                {horaCerrar ||
                  new Date().toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
              </strong>
              . No podrás registrar ventas mientras esté cerrada.
            </p>
            {hayVentaEnCurso && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                Hay una venta en curso. Cancelala o registrala antes de cerrar
                caja.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                ref={cancelBtnRef}
                onClick={cancelarCerrarCaja}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 font-semibold"
              >
                No
              </button>
              <button
                onClick={confirmarCerrarCaja}
                disabled={busy || hayVentaEnCurso}
                className="h-9 px-3 rounded-xl border border-red-600 text-white bg-red-600 hover:brightness-95 disabled:opacity-60 font-semibold"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {ventaOkOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setVentaOkOpen(false)}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">Venta registrada</h2>
            <p className="text-sm text-neutral-600 mb-5">
              La operación se registró correctamente. El carrito quedó vacío y
              podés iniciar una nueva venta.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setVentaOkOpen(false)}
                className="h-9 px-4 rounded-xl border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLogoutOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={cancelarLogout}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">¿Cerrar sesión?</h2>
            <p className="text-sm text-neutral-600 mb-5">
              Vas a salir del sistema y volver al inicio de sesión.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelarLogout}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 font-semibold"
              >
                No
              </button>
              <button
                onClick={confirmarLogout}
                className="h-9 px-3 rounded-xl border border-red-600 text-white bg-red-600 hover:brightness-95 font-semibold"
              >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {aplicarComboOpen && comboSel && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => {
              if (busy) return;
              setAplicarComboOpen(false);
              setComboSel(null);
            }}
          />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">Aplicar promoción</h2>

            <div className="text-sm text-gray-700 mb-2">
              <div className="font-semibold">{comboSel.combo.nombre}</div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Precio total del pack (manual)
              </label>
              <input
                type="number"
                value={precioPack}
                onChange={(e) => setPrecioPack(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              />
            </div>

            <div className="max-h-44 overflow-auto rounded-lg border border-gray-200 p-2 mb-4">
              {comboSel.items.map((it) => (
                <div
                  key={it.id_producto}
                  className="flex justify-between text-sm py-1"
                >
                  <span className="truncate">
                    {it.nombre} x{it.cantidad}
                  </span>
                  <span className="font-mono tabular-nums">
                    $ {it.subtotal_sugerido}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                disabled={busy}
                onClick={() => {
                  setAplicarComboOpen(false);
                  setComboSel(null);
                }}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 font-semibold disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={confirmarAplicarCombo}
                className="h-9 px-3 rounded-xl border border-emerald-600 text-white bg-emerald-600 hover:brightness-95 disabled:opacity-60 font-semibold"
              >
                Aplicar promocion
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancelarVentaOpen && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={cancelarDialogoCancelarVenta}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-2">
              ¿Cancelar la venta en curso?
            </h2>
            <p className="text-sm text-neutral-600 mb-5">
              Se vaciará el carrito y la venta quedará anulada. Esta acción no se
              puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelarDialogoCancelarVenta}
                className="h-9 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 font-semibold"
              >
                No
              </button>
              <button
                onClick={confirmarCancelarVenta}
                disabled={busy}
                className="h-9 px-3 rounded-xl border border-red-600 text-white bg-red-600 hover:brightness-95 disabled:opacity-60 font-semibold"
              >
                Sí, cancelar venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
