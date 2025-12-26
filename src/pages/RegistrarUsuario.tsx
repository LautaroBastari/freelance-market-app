// src/pages/RegistrarUsuario.tsx
import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import logoHuevo from "../../public/final2.png";
export default function RegistrarUsuario() {
  const [nombre, setNombre] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const n = nombre.trim();
  const nu = nombreUsuario.trim();

  const passMinOk = password.length >= 4;
  const confirmTouched = password2.length > 0;
  const passwordsMatch = password === password2;

  // Deshabilitar: mientras carga o si el form es inválido
  const disabled = useMemo(() => {
    if (loading) return true;
    if (n === "" || nu === "") return true;
    if (!passMinOk) return true;
    if (!passwordsMatch) return true;
    return false;
  }, [loading, n, nu, passMinOk, passwordsMatch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);

    if (n === "" || nu === "" || !passMinOk) {
      setOk(false);
      setMsg("Datos inválidos: complete nombre/usuario y use contraseña ≥ 4.");
      return;
    }

    // Validación UX obligatoria
    if (!passwordsMatch) {
      setOk(false);
      setMsg("Las contraseñas no coinciden.");
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
      setPassword2("");
    } catch (err) {
      setOk(false);
      setMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  const confirmInputClass = [
    "h-11 px-3 rounded-xl border bg-white/90 outline-none transition",
    "focus:ring-2 focus:border-transparent",
    confirmTouched
      ? passwordsMatch
        ? "border-green-300/80 focus:ring-green-400/40"
        : "border-red-300/80 focus:ring-red-400/40"
      : "border-slate-300/80 focus:ring-ventas-400/70",
  ].join(" ");

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Fondo: gradiente amarillo + textura suave */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.08)_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-yellow-200/40 blur-3xl" />
      <div className="absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

<div className="relative min-h-screen flex items-center justify-center p-4">
  <div className="w-full max-w-md -translate-y-8">
          {/* “Marca” / Logo (placeholder) */}
          <div className="flex flex-col items-center select-none gap-1">
            <img
              src={logoHuevo}
              alt="Logo Huevo Santo"
              className="w-32 h-32 object-contain -mb-2"
              draggable={false}
            />

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight">
              Huevo Santo
            </h1>

            <p className="text-sm text-slate-600 leading-tight">
              Alta de usuarios del sistema
            </p>
          </div>

          {/* Card */}
          <div className="bg-white/80 backdrop-blur border border-white/60 rounded-2xl shadow-[0_12px_40px_rgba(2,6,23,0.12)] overflow-hidden ring-1 ring-black/5">
            {/* Header con acento */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-200/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    Registrar usuario
                  </h1>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Creá una cuenta nueva para usar el sistema.
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-ventas-500/15 border border-ventas-500/25 flex items-center justify-center">
                  <span className="text-ventas-700 text-sm font-semibold">+</span>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="px-6 py-5 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Nombre</span>
                <input
                  className="h-11 px-3 rounded-xl border border-slate-300/80 bg-white/90 outline-none focus:ring-2 focus:ring-ventas-400/70 focus:border-ventas-400/50 transition"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Usuario</span>
                <input
                  className="h-11 px-3 rounded-xl border border-slate-300/80 bg-white/90 outline-none focus:ring-2 focus:ring-ventas-400/70 focus:border-ventas-400/50 transition"
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  placeholder="usuario"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
                <span className="text-xs text-slate-500">
                  Usá un nombre único y fácil de recordar ya que con este ingresaras.
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">Contraseña</span>
                <input
                  type="password"
                  className="h-11 px-3 rounded-xl border border-slate-300/80 bg-white/90 outline-none focus:ring-2 focus:ring-ventas-400/70 focus:border-ventas-400/50 transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 4 caracteres"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                {!passMinOk && password.length > 0 && (
                  <span className="text-xs text-red-600">
                    La contraseña debe tener al menos 4 caracteres.
                  </span>
                )}
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-800">
                  Confirmar contraseña
                </span>
                <input
                  type="password"
                  className={confirmInputClass}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                {confirmTouched && !passwordsMatch && (
                  <span className="text-xs text-red-600">
                    Las contraseñas no coinciden.
                  </span>
                )}
                {confirmTouched && passwordsMatch && passMinOk && (
                  <span className="text-xs text-green-700">
                    Contraseñas coinciden.
                  </span>
                )}
              </label>

              <button
                type="submit"
                disabled={disabled}
                className="h-11 rounded-xl bg-ventas-500 border border-ventas-600 text-white font-semibold hover:brightness-95 disabled:opacity-60 active:translate-y-[1px] transition flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                )}
                <span>{loading ? "Registrando..." : "Registrar"}</span>
              </button>

              {msg && (
                <div
                  className={[
                    "rounded-xl px-3 py-2 text-sm border",
                    ok === true
                      ? "bg-green-50/80 text-green-800 border-green-200"
                      : "bg-red-50/80 text-red-800 border-red-200",
                  ].join(" ")}
                >
                  {msg}
                </div>
              )}
            </form>

            {/* Footer de la card */}
            <div className="px-6 pb-5">
              <div className="h-px bg-slate-200/70" />
              <div className="mt-4 text-xs text-slate-600">
                Al registrar, el usuario queda activo por defecto.
              </div>
            </div>
          </div>

          {/* Link volver */}
          <div className="text-center mt-4">
            <a
              href="/"
              className="text-sm text-ventas-800 hover:underline underline-offset-4"
            >
              Volver al login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
