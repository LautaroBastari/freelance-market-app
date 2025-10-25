// src/pages/RegistrarUsuario.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function RegistrarUsuario() {
  const [nombre, setNombre] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);

    const n = nombre.trim();
    const nu = nombreUsuario.trim();
    if (n === "" || nu === "" || password.length < 6) {
      setOk(false);
      setMsg("Datos inválidos: complete nombre/usuario y use contraseña ≥ 6.");
      return;
    }

    try {
      setLoading(true);
      const id = await invoke<number>("usuario_crear", {
        input: { nombre: n, nombre_usuario: nu, password },
      });
      setOk(true);
      setMsg(`Usuario creado (id ${id}).`);
      setNombre("");
      setNombreUsuario("");
      setPassword("");
    } catch (err) {
      setOk(false);
      setMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h1 className="text-lg font-semibold tracking-tight">Registrar usuario</h1>
            <p className="text-sm text-neutral-600">Creá una cuenta nueva para usar el sistema.</p>
          </div>

          <form onSubmit={onSubmit} className="px-6 py-5 grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Nombre</span>
              <input
                className="h-10 px-3 rounded-xl border border-neutral-300 bg-white outline-none focus:ring-2 focus:ring-ventas-400"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="name"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Usuario</span>
              <input
                className="h-10 px-3 rounded-xl border border-neutral-300 bg-white outline-none focus:ring-2 focus:ring-ventas-400"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Contraseña</span>
              <input
                type="password"
                className="h-10 px-3 rounded-xl border border-neutral-300 bg-white outline-none focus:ring-2 focus:ring-ventas-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-xl bg-ventas-500 border border-ventas-600 text-white font-semibold hover:brightness-95 disabled:opacity-60 active:translate-y-[1px] transition"
            >
              {loading ? "Registrando..." : "Registrar"}
            </button>

            {msg && (
              <div
                className={[
                  "rounded-xl px-3 py-2 text-sm border",
                  ok === true
                    ? "bg-green-50 text-green-800 border-green-200"
                    : "bg-red-50 text-red-800 border-red-200",
                ].join(" ")}
              >
                {msg}
              </div>
            )}
          </form>
        </div>

        {/* Link simple para volver al login (opcional) */}
        <div className="text-center mt-3">
          <a href="/" className="text-sm text-ventas-700 hover:underline">
            Volver al login
          </a>
        </div>
      </div>
    </main>
  );
}
