import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function Ping() {
  const [n, setN] = useState<number | null>(null);
  const probar = async () => {
    try { setN(await invoke<number>("ping_db")); }
    catch (e:any) { alert("Error: " + e.toString()); }
  };
  return (
    <div style={{ padding: 16 }}>
      <button onClick={probar}>Probar conexión (React→Rust→SQLite)</button>
      <div>{n !== null ? `Filas en log: ${n}` : "—"}</div>
    </div>
  );
}
