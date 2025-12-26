import { invoke } from "@tauri-apps/api/core";

/* TIPOS */

export type PromoComboItemInput = {
  id_producto: number;
  cantidad: number;
};

export type PromoComboCrearInput = {
  nombre: string;
  precio_pack: number;
  precio_min_total: number;
  items: PromoComboItemInput[];
};

export type PromoComboRow = {
  id_combo: number;
  nombre: string;
  precio_pack: number;
  precio_min_total: number;
  activo: number;
  creado_en: string;
};

export type PromoComboItemRow = {
  id_producto: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal_sugerido: number;
};

export type PromoComboDetalle = {
  combo: PromoComboRow;
  items: PromoComboItemRow[];
  total_sugerido: number;
};

/* CALLS (invoke) */

export const promoComboListar = () =>
  invoke<PromoComboRow[]>("promo_combo_listar");

export const promoComboDetalle = (id_combo: number) =>
  invoke<PromoComboDetalle>("promo_combo_detalle", { idCombo: id_combo });

export const promoComboCrear = (input: PromoComboCrearInput) =>
  invoke<number>("promo_combo_crear", { input });

export const ventaAplicarPromoCombo = (input: {
  id_venta: number;
  id_combo: number;
  precio_total_pack: number;
}) =>
  invoke<string>("venta_aplicar_promo_combo", { input });

  export async function promoComboEliminar(id_combo: number): Promise<void> {
  await invoke("promo_combo_eliminar", { idCombo: id_combo});
}