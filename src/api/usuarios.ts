import { invoke } from "@tauri-apps/api/core";

export async function usuarioCrear(input: {
  nombre: string;
  nombre_completo: string;
  rol?: "empleado";
  password: string;
}) {
  return await invoke<number>("usuario_crear", { input: { ...input, rol: "empleado" } });
}