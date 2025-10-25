// src/pages/UsuariosPage.tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { pingDb } from "../api/sys";

export default function UsuariosPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dbOk, setDbOk] = useState<null | boolean>(null);

  useEffect(() => {
    (async () => {
      try {
        const n = await pingDb();          // debe ser 1
        setDbOk(n === 1);
      } catch (e: any) {
        setDbOk(false);
        setErr(String(e));
      }
    })();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!usuario || !password) { setErr("Faltan usuario/contraseña."); return; }
    setBusy(true);
    try {
      // No mandes rol; el back lo fuerza a "operador"
      const id = await invoke<number>("usuario_crear", {
        input: { nombre: usuario, nombre_usuario: usuario, password }
      });
      setMsg(`Creado (id ${id}).`);
      setUsuario(""); setPassword("");
    } catch (e: any) {
      setErr(String(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, Arial, sans-serif" }}>
      <header style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16
      }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Usuarios</h1>
        <span
          style={{
            padding: "4px 10px", borderRadius: 999,
            background: dbOk == null ? "#ddd" : dbOk ? "#d1fae5" : "#fee2e2",
            border: "1px solid #ccc", fontSize: 12
          }}
          title="Estado de conexión con la base"
        >
          BD: {dbOk == null ? "…" : dbOk ? "OK" : "ERROR"}
        </span>
      </header>

      <div style={{ maxWidth: 420 }}>
        <form onSubmit={crear}
          style={{ border: "1px solid #e5e7eb", padding: 16, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Alta rápida (operador)</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Usuario</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 8 }}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid #2563eb",
              background: busy ? "#93c5fd" : "#3b82f6", color: "white", cursor: busy ? "not-allowed" : "pointer"
            }}
          >
            {busy ? "Creando…" : "Crear operador"}
          </button>

          {msg && <p style={{ color: "#065f46", marginTop: 12 }}>{msg}</p>}
          {err && <p style={{ color: "#b91c1c", marginTop: 12, whiteSpace: "pre-wrap" }}>{err}</p>}
        </form>
      </div>
    </div>
  );
}
