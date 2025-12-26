// src/api/stock.ts
import { invoke } from "@tauri-apps/api/core";

export type StockMermaInput = {
  id_producto: number;
  cantidad: number; // POSITIVA, el backend la hace negativa
  motivo: string; // "merma" | "vencimiento" | "rotura" | "robo", etc.
  observacion?: string | null;
  id_usuario: number;
};

// Helper opciona
export async function stockRegistrarMerma(input: StockMermaInput): Promise<void> {
  await invoke("stock_registrar_merma", { input });
}

export type ReposicionModo = "unitario" | "cajon";

export type ProductoCrearInput = {
  codigo: string;
  nombre: string;
  precio_venta: number;
  costo: number;
  reposicion_modo: ReposicionModo;
  reposicion_factor: number; // default 12
};

export type ProductoIdOut = { id_producto: number };

export const productoCrear = (input: ProductoCrearInput) =>
  invoke<ProductoIdOut>("producto_crear", { input });


   //STOCK LISTAR (admin)

export type StockResumen = {
  id_producto: number;
  codigo: string;
  nombre: string;
  stock_actual: number;
  precio_venta_actual: number;
  costo_actual: number;
  activo: number; // 1 | 0
};

export type StockListarInput = {
  q?: string;
  solo_activos?: boolean;
  limit?: number;
  offset?: number;
};

export const stockListar = (input: StockListarInput) =>
  invoke<StockResumen[]>("stock_listar", input);

/* PRODUCTO ACTIVO (alta/baja lógica) */

export type ProductoSetActivoIn = {
  id_producto: number;
  activo: boolean;
};

export const productoSetActivo = (input: ProductoSetActivoIn) =>
  invoke<void>("producto_set_activo", { input });
