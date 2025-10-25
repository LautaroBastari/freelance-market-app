// src/api/sys.ts
import { invoke } from "@tauri-apps/api/core";
export async function pingDb(): Promise<number> {
  return await invoke<number>("ping_db");
}