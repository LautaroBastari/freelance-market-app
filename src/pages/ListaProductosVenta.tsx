// src/pages/ListaProductosVenta.tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ProductoDisponible = {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  stock_disponible: number;
};

type Props = {
  productos: ProductoDisponible[];
  cargando: boolean;
  error: string | null;
};

export function ListaProductosVenta({ productos, cargando, error }: Props) {
  return (
    <section className="mt-3 mb-3 max-w-sm rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Productos disponibles
        </h3>
      </header>

      <div className="divide-y">
        {cargando && (
          <div className="px-4 py-3 text-xs text-gray-500">Cargando...</div>
        )}

        {error && !cargando && (
          <div className="px-4 py-3 text-xs text-red-600">{error}</div>
        )}

        {!cargando && !error && productos.length === 0 && (
          <div className="px-4 py-3 text-xs text-gray-500">
            Sin productos para mostrar.
          </div>
        )}

        {!cargando &&
          !error &&
          productos.slice(0, 5).map((p) => (
            <div key={p.id_producto} className="px-4 py-3 flex justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {p.nombre}
                </div>
                <div className="text-xs text-gray-500">
                  Stock: {p.stock_disponible}
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                ${p.precio_unitario.toFixed(2)}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
