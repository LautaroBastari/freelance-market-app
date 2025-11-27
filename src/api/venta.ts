import { invoke } from "@tauri-apps/api/core";

export type ProductoDisponible = {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  stock_disponible: number;
};

export type VentaLineaInput = { id_producto: number; cantidad: number };

export async function cajaAbierta(): Promise<number | null> {
  return await invoke<number | null>("caja_abierta");
}
export async function cajaAbrir(): Promise<number> {
  return await invoke<number>("caja_abrir");
}
export async function cajaCerrar(): Promise<void> {
  return await invoke<void>("caja_cerrar");
}
export async function productosDisponibles(): Promise<ProductoDisponible[]> {
  return await invoke<ProductoDisponible[]>("productos_disponibles");
}
export async function ventaRegistrar(lineas: VentaLineaInput[]): Promise<number> {
  return await invoke<number>("venta_registrar", { lineas });
}
