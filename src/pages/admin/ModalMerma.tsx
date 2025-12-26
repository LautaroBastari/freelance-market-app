import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { StockMermaInput } from "../../api/stock";

type ProductoRow = {
  id_producto: number;
  nombre: string;
  stock_actual: number;
};

type Props = {
  abierto: boolean;
  onClose: () => void;
  producto: ProductoRow | null;
  onSuccess: () => void;
};

const motivosFijos = [
  { value: "merma", label: "Merma general" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "rotura", label: "Rotura" },
  { value: "robo", label: "Robo" },
];

export default function ModalMerma({
  abierto,
  onClose,
  producto,
  onSuccess,
}: Props) {
  const [cantidad, setCantidad] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("merma");
  const [observacion, setObservacion] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto || !producto) {
    return null;
  }

  const handleCerrar = () => {
    if (cargando) return;
    setCantidad("");
    setMotivo("merma");
    setObservacion("");
    setError(null);
    onClose();
  };

  const handleConfirmar = async () => {
    setError(null);

    const cantNum = parseInt(cantidad, 10);
    if (Number.isNaN(cantNum) || cantNum <= 0) {
      setError("La cantidad debe ser un número mayor a 0.");
      return;
    }

    const payload: StockMermaInput = {
      id_producto: producto.id_producto,
      cantidad: cantNum,
      motivo,
      observacion: observacion.trim() === "" ? null : observacion.trim(),

      // USUARIO ESTÁTICO
      id_usuario: 1,
    };

    try {
      setCargando(true);

      await invoke("stock_registrar_merma", {
        input: payload,
      });

      setCargando(false);
      handleCerrar();
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setCargando(false);
      setError(e?.toString() ?? "Error al registrar la merma.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          Registrar pérdida / merma
        </h2>

        <div className="mb-3 text-sm text-gray-700">
          <div className="font-medium">
            Producto: {producto.nombre} (ID {producto.id_producto})
          </div>
          <div className="text-xs text-gray-500">
            Stock actual: {producto.stock_actual}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">
            Cantidad a descontar
          </label>
          <input
            type="number"
            min={1}
            className="w-full rounded border px-2 py-1 text-sm"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">
            Motivo
          </label>
          <select
            className="w-full rounded border px-2 py-1 text-sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            {motivosFijos.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">
            Observación (opcional)
          </label>
          <textarea
            className="h-20 w-full resize-none rounded border px-2 py-1 text-sm"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </div>

        {error && (
          <div className="mb-3 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={handleCerrar}
            disabled={cargando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
            onClick={handleConfirmar}
            disabled={cargando}
          >
            {cargando ? "Guardando..." : "Registrar merma"}
          </button>
        </div>
      </div>
    </div>
  );
}
