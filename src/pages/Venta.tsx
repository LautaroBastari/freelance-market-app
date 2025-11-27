import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

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

  // Modales de confirmación de caja
  const [confirmCerrarOpen, setConfirmCerrarOpen] = useState<boolean>(false);
  const [confirmAbrirOpen, setConfirmAbrirOpen] = useState<boolean>(false);

  const [horaAbrir, setHoraAbrir] = useState<string>("");
  const [horaCerrar, setHoraCerrar] = useState<string>("");

  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Logout
  const logout = useCallback(async () => {
    try {
      await invoke("auth_logout");
      window.location.href = "/"; // volver al login
    } catch (err) {
      alert("Error al cerrar sesión:\n" + String(err));
    }
  }, []);

  // Modal de logout
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const solicitarLogout = () => {
    setConfirmLogoutOpen(true);
  };

  const cancelarLogout = () => {
    setConfirmLogoutOpen(false);
  };

  const confirmarLogout = async () => {
    await logout();
    setConfirmLogoutOpen(false);
  };

  // Carrito
  const refrescarCarrito = useCallback(async (id: number) => {
    const dto = await invoke<{ total: number; lineas: Linea[] }>(
      "venta_listar",
      { idVenta: id }
    );
    setCarrito(dto);
  }, []);

  const asegurarVenta = useCallback(async () => {
    if (idVenta != null) return idVenta;
    const id = await invoke<number>("venta_iniciar");
    setIdVenta(id);
    await refrescarCarrito(id);
    return id;
  }, [idVenta, refrescarCarrito]);

  // ======================
  //  Efectos
  // ======================

  // ESC cierra modales de abrir/cerrar caja
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

  // Cargar productos disponibles desde backend (reemplaza los hardcodeados)
  useEffect(() => {
    async function cargarProductos() {
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
    }

    cargarProductos();
  }, []);

  // ======================
  //  Caja
  // ======================

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
    } catch (e) {
      // abrirCaja ya muestra el error
    } finally {
      setBusy(false);
    }
  }, [abrirCaja]);

  const cancelarAbrirCaja = useCallback(() => {
    setConfirmAbrirOpen(false);
  }, []);

  //  Operaciones de venta

  const agregarItem = useCallback(
  async (p: ProductoDisponible) => {
    try {
      setBusy(true);

      const id_venta = await asegurarVenta();

      await invoke("venta_agregar_item", {
        input: {
          id_venta: id_venta,
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

  const registrarVenta = useCallback(async () => {
    if (!idVenta) return;
    try {
      setBusy(true);
      await invoke("venta_finalizar", { idVenta });
      setIdVenta(null);
      setCarrito({ total: 0, lineas: [] });
      alert("Venta registrada correctamente.");
    } catch (e) {
      alert("Error al registrar venta:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, [idVenta]);

  const cancelarVenta = useCallback(async () => {
    if (!idVenta) return;
    try {
      setBusy(true);
      await invoke("venta_cancelar", { idVenta });
      setIdVenta(null);
      setCarrito({ total: 0, lineas: [] });
    } catch (e) {
      alert("No se pudo cancelar la venta:\n" + String(e));
    } finally {
      setBusy(false);
    }
  }, [idVenta]);

  // ======================
  //  Layout principal
  // ======================

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-yellow-50 via-white/80 to-white/95">
      <main className="flex-1 mx-auto px-6 md:px-8 py-7 space-y-5 max-w-[1600px] 2xl:max-w-[1800px]">
        {/* Header */}
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
                onClick={solicitarCerrarCaja}
                disabled={busy}
                className="h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base hover:bg-white shadow-sm disabled:opacity-60"
              >
                Cerrar caja
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

        {/* CONTENIDO */}
        <div className="grid gap-6 lg:grid-cols-[1fr_420px] 2xl:grid-cols-[1fr_500px] items-start">
          {/* LISTADO */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                Productos disponibles
              </h3>
            </div>

            <div className="overflow-auto rounded-2xl">
              <table className="w-full text-[15px] font-light table-fixed">
                <thead className="sticky top-0 bg-gray-50/80 backdrop-blur text-gray-700">
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left font-semibold tracking-wide">
                      Producto
                    </th>
                    <th className="w-40 px-5 py-2.5 text-right font-semibold tracking-wide">
                      Precio unitario
                    </th>
                    <th className="w-28 px-5 py-2.5 text-center font-semibold tracking-wide">
                      Stock
                    </th>
                    <th className="w-36 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {errorProductos ? (
                    <tr>
                      <td
                        className="px-5 py-4 text-sm text-red-600"
                        colSpan={4}
                      >
                        {errorProductos}
                      </td>
                    </tr>
                  ) : cargandoProductos ? (
                    <tr>
                      <td
                        className="px-5 py-4 text-gray-500"
                        colSpan={4}
                      >
                        Cargando productos...
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td className="px-5 py-4 text-gray-500" colSpan={4}>
                        Sin resultados.
                      </td>
                    </tr>
                  ) : (
                    productos.map((p) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-yellow-50/40">
              <button
                onClick={cancelarVenta}
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
                className="h-10 rounded-lg bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Registrar venta
              </button>
            </div>
          </section>

          {/* RESUMEN */}
          <aside className="rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Resumen</h3>
            </div>

            <div className="p-5 grid gap-2 text-sm">
              <div className="flex justify-between">
                <span>Ítems</span>
                <strong>
                  {carrito.lineas.reduce((a, l) => a + l.cantidad, 0)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <strong>$ {carrito.total}</strong>
              </div>
              <div className="flex justify-between">
                <span>Impuestos</span>
                <strong>$ 0</strong>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between text-base">
                <span>Total</span>
                <strong>$ {carrito.total}</strong>
              </div>
            </div>

            <ul className="divide-y border-t">
              {carrito.lineas.map((l) => (
                <li
                  key={l.id_item}
                  className="flex items-center justify-between py-2 px-5"
                >
                  <div className="flex-1">
                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-xs text-gray-500">
                      ${l.precio_unitario} c/u
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 border rounded"
                      onClick={async () => {
                        const nueva = l.cantidad - 1;
                        await invoke("venta_set_cantidad", {
                          idItem: l.id_item,
                          nuevaCantidad: nueva,
                        });
                        if (idVenta) await refrescarCarrito(idVenta);
                      }}
                    >
                      -
                    </button>
                    <span className="w-6 text-center">{l.cantidad}</span>
                    <button
                      className="px-2 border rounded"
                      onClick={async () => {
                        const nueva = l.cantidad + 1;
                        await invoke("venta_set_cantidad", {
                          idItem: l.id_item,
                          nuevaCantidad: nueva,
                        });
                        if (idVenta) await refrescarCarrito(idVenta);
                      }}
                    >
                      +
                    </button>
                    <button
                      className="ml-3 px-2 border rounded"
                      onClick={async () => {
                        await invoke("venta_quitar_item", {
                          idItem: l.id_item,
                        });
                        if (idVenta) await refrescarCarrito(idVenta);
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="w-24 text-right font-mono tabular-nums">
                    $ {l.subtotal}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>

      {/* MODAL DE APERTURA DE CAJA */}
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

      {/* MODAL DE CIERRE DE CAJA */}
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
                disabled={busy}
                className="h-9 px-3 rounded-xl border border-red-600 text-white bg-red-600 hover:brightness-95 disabled:opacity-60 font-semibold"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LOGOUT */}
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
    </div>
  );
}
