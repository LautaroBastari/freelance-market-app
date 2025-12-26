import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Producto = {
  id_producto: number;
  nombre: string;
  precio_venta_actual: number;
  costo_actual: number;
};

type UnidadCompra = "MAPLE" | "CAJON";

export default function ComprasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [idProducto, setIdProducto] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState<number>(0);
  const [costoUnit, setCostoUnit] = useState<number>(0);
  const [referencia, setReferencia] = useState<string>("");
  const [mantenerCosto, setMantenerCosto] = useState<boolean>(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [unidad, setUnidad] = useState<UnidadCompra>("MAPLE");
  const [costoTotal, setCostoTotal] = useState<number>(0);
  const [modoCajon, setModoCajon] = useState<boolean>(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const lista = await invoke<Producto[]>("stock_listar", {
          q: "",
          soloActivos: true,
          limit: 999,
          offset: 0,
        });
        setProductos(lista);
      } catch (e) {
        console.error(e);
        setErr("Error cargando productos");
      }
    };
    cargar();
  }, []);

  const registrarCompra = async () => {
    setMsg(null);
    setErr(null);

    if (!idProducto) {
      setErr("Debe seleccionar un producto.");
      return;
    }
    if (cantidad <= 0) {
      setErr("La cantidad debe ser mayor a cero.");
      return;
    }
    if (costoUnit < 0) {
      setErr("Costo inválido.");
      return;
    }
    if (modoCajon && costoTotal < 0) {
      setErr("Costo total inválido.");
      return;
    }

    // Buscamos el producto actual para comparar el costo
    const prod = productos.find((p) => p.id_producto === idProducto);
    const costoActualProducto = prod ? prod.costo_actual : null;

    // Regla de oro:
    // - Si el checkbox está marcado Y el costo del input coincide con costo_actual → mantener
    // - En cualquier otro caso → NO mantener (usamos el que está en el input)
    const mantenerCostoEfectivo =
      mantenerCosto &&
      costoActualProducto !== null &&
      costoUnit === costoActualProducto;

    try {
      if (modoCajon) {
        // compra por cajón / costo total
        await invoke("stock_compra", {
          input: {
            id_producto: idProducto,
            unidad, // "MAPLE" | "CAJON"
            cantidad: Math.trunc(cantidad),
            costo_total: Math.trunc(costoTotal),
          },
        });
      } else {
        // compra normal por costo unitario
        await invoke("registrar_compra", {
          idProducto,
          cantidad,
          costoUnitario: costoUnit,
          referencia: referencia || null,
          mantenerCosto: mantenerCostoEfectivo,
        });
      }

      setMsg("Compra registrada exitosamente.");
      setCantidad(0);
      setCostoUnit(0);
      setCostoTotal(0);
      setReferencia("");
    } catch (e: any) {
      console.error(e);
      setErr(e.toString());
    }
  };

  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-xl p-8 border border-gray-200">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Registrar compra
        </h1>

        {msg && (
          <div className="mb-4 p-3 rounded bg-green-100 text-green-800 border border-green-300">
            {msg}
          </div>
        )}

        {err && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800 border border-red-300">
            {err}
          </div>
        )}

        {/* Producto */}
        <label className="block mb-2 font-semibold text-gray-700">
          Producto
        </label>
        <select
          className="border p-3 rounded-lg w-full mb-5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={idProducto ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            setIdProducto(id);

            const prod = productos.find((p) => p.id_producto === id);
            if (prod) {
              // Prefill automático
              setCostoUnit(prod.costo_actual);

              // Si el usuario pidió "mantener costo actual", forzamos ese valor también
              if (mantenerCosto && costoUnit === 0) {
                setCostoUnit(prod.costo_actual);
              }
            }
          }}
        >
          <option value="">Seleccione producto...</option>
          {productos.map((p) => (
            <option key={p.id_producto} value={p.id_producto}>
              {p.nombre}
            </option>
          ))}
        </select>

        {/* Modo cajón */}
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            className="mr-2 h-4 w-4"
            checked={modoCajon}
            onChange={() => {
              const next = !modoCajon;
              setModoCajon(next);

              // si entra en modo cajón, forzamos CAJON
              if (next) setUnidad("CAJON");
            }}
          />
          <span className="text-sm text-gray-700">
            Compra por cajón / costo total (para huevos)
          </span>
        </div>

        {modoCajon && (
          <>
            {/* Unidad */}
            <label className="block mb-2 font-semibold text-gray-700">
              Unidad
            </label>
            <select
              className="border p-3 rounded-lg w-full mb-5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
              value={unidad}
              disabled={modoCajon}
              onChange={(e) => setUnidad(e.target.value as UnidadCompra)}
            >
              <option value="MAPLE">Maples</option>
              <option value="CAJON">Cajones (12 maples)</option>
            </select>

            {/* Costo total */}
            <label className="block mb-2 font-semibold text-gray-700">
              Costo total de los cajones
            </label>
            <input
              type="number"
              className="border p-3 rounded-lg w-full mb-3 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={costoTotal}
              onChange={(e) => setCostoTotal(Number(e.target.value))}
              min={0}
            />

            {/* Preview */}
            <div className="mb-5 p-3 rounded bg-gray-50 text-gray-800 border border-gray-200 text-sm">
              {(() => {
                const factor = unidad === "CAJON" ? 12 : 1;
                const maples = Math.trunc(cantidad) * factor;
                const unit =
                  maples > 0
                    ? Math.floor(Math.trunc(costoTotal) / maples)
                    : 0;
                return (
                  <>
                    <div>
                      Se ingresarán:{" "}
                      <b>{Number.isFinite(maples) ? maples : 0}</b> maples
                    </div>
                    <div>
                      Costo unitario resultante:{" "}
                      <b>${Number.isFinite(unit) ? unit : 0}</b>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* Cantidad */}
        <label className="block mb-2 font-semibold text-gray-700">
          Cantidad
        </label>
        <input
          type="number"
          className="border p-3 rounded-lg w-full mb-5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={cantidad}
          onChange={(e) => setCantidad(Number(e.target.value))}
        />

        {/* esconder costo unitario y mantener costo cuando modoCajon=true */}
        {!modoCajon && (
          <>
            {/* Costo unitario */}
            <label className="block mb-2 font-semibold text-gray-700">
              Costo unitario
            </label>

            {/* Mantener costo actual */}
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4"
                checked={mantenerCosto}
                onChange={() => {
                  const nuevo = !mantenerCosto;
                  setMantenerCosto(nuevo);

                  if (nuevo && idProducto && costoUnit === 0) {
                    const prod = productos.find(
                      (p) => p.id_producto === idProducto
                    );
                    if (prod) setCostoUnit(prod.costo_actual);
                  }
                }}
              />
              <span className="text-sm text-gray-700">
                Mantener costo actual del producto
              </span>
            </div>

            <input
              type="number"
              className="border p-3 rounded-lg w-full mb-5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={costoUnit}
              onChange={(e) => setCostoUnit(Number(e.target.value))}
            />
          </>
        )}

        {/* Referencia */}
        <label className="block mb-2 font-semibold text-gray-700">
          Referencia (opcional)
        </label>
        <input
          type="text"
          className="border p-3 rounded-lg w-full mb-6 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
        />

        {/* Botón */}
        <button
          onClick={registrarCompra}
          className="w-full bg-blue-600 text-white p-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition shadow"
        >
          Registrar compra
        </button>
      </div>
    </div>
  );
}
