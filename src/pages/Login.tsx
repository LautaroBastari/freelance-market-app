// src/pages/Login.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { sessionInfo, type SessionInfo } from "../api/sesion";
import logoHuevo from "../../public/final2.png";

type Rol = "admin" | "operador";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const u = usuario.trim().toLowerCase();
    if (!u || !password) {
      setMsg("Usuario y contraseña son obligatorios");
      return;
    }

    setLoading(true);
    try {
      //  Autenticar (debe setear sesión del lado Tauri)
      const ok = await invoke<boolean>("login", {
        input: { nombre_usuario: u, password },
      });
      if (!ok) {
        setMsg("Credenciales incorrectas");
        return;
      }

      //  Intentar obtener {usuarioId, rol} de forma robusta
      const { usuarioId, rol } = await fetchUsuarioYRol(u);

      if (!usuarioId || !rol) {
        setMsg(
          "Sesión inválida: faltan datos de usuario/rol. " +
            "Asegurate de que el backend exponga sessionInfo() o un comando que devuelva el rol."
        );
        return;
      }

      //  Persistir para useSession()
      localStorage.setItem("usuarioId", String(usuarioId));
      localStorage.setItem("rol", rol.toLowerCase());
      window.dispatchEvent(new Event("session-updated"));

      //  Redirigir (una sola vez)
      navigate(rol === "admin" ? "/admin" : "/ventas", { replace: true });
    } catch (err) {
      setMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 via-yellow-50 to-white">
      <div className="min-h-screen flex justify-center px-6 pt-16 pb-10">
        <div className="w-full max-w-md">
          {/* Logo centrado arriba de la card */}
          <div className="flex flex-col items-center text-center gap-1">
            <img
              src="/final2.png"
              alt="Logo Huevo Santo"
              className="w-32 h-32 object-contain -mb-2"
              draggable={false}
            />

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight">
              Huevo Santo
            </h1>

            <p className="text-sm text-slate-600 leading-tight">
              Sistema de gestión comercial
            </p>
          </div>
          {/* Card centrada */}
          <form
            onSubmit={handleLogin}
            className="bg-white/70 backdrop-blur-sm border border-yellow-100 rounded-2xl shadow-lg p-7"
          >
            <div className="mb-6">
              <h1 className="text-lg font-semibold text-slate-900">
                Iniciar sesión
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Ingresá tus credenciales para continuar.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Usuario
                </label>
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-300 bg-white/90 px-3 text-slate-900
                             placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300/70"
                  placeholder="Tu usuario"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-300 bg-white/90 px-3 text-slate-900
                             placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-300/70"
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-slate-900 text-white font-medium
                           hover:bg-slate-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Validando..." : "Iniciar sesión"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/registrar")}
                className="w-full h-11 rounded-xl border border-slate-300 bg-white/90 text-slate-900 font-medium
                           hover:bg-white transition"
              >
                Registrar cuenta
              </button>
              
              {msg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-sm text-red-700">{msg}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
              <span>
                <span className="font-medium text-slate-700">Uso interno.</span>{" "}
                No compartas tus credenciales.
              </span>
              <span className="text-slate-400">v0.1.0</span>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Huevo Santo
          </div>
        </div>
      </div>
    </main>
  );
}

// helpers 

async function fetchUsuarioYRol(
  nombreUsuario: string
): Promise<{ usuarioId: number | null; rol?: Rol }> {
  try {
    const info: SessionInfo = await sessionInfo();
    const parsed = parseSessionInfo(info);
    if (parsed.usuarioId && parsed.rol) return parsed;
  } catch {}

  try {
    const info: unknown = await invoke("session_info");
    const parsed = parseSessionInfo(info as SessionInfo);
    if (parsed.usuarioId && parsed.rol) return parsed;
  } catch {}

  try {
    const me = (await invoke("user_me")) as any;
    const usuarioId = normId(me?.id);
    const rol = normRol(me?.rol ?? me?.rol_tipo);
    if (usuarioId && rol) return { usuarioId, rol };
  } catch {}

  try {
    const data = (await invoke("user_role", { nombre_usuario: nombreUsuario })) as any;
    const usuarioId = normId(data?.id ?? data?.usuarioId);
    const rol = normRol(data?.rol ?? data?.rol_tipo);
    if (usuarioId && rol) return { usuarioId, rol };
  } catch {}

  return { usuarioId: null, rol: undefined };
}

function parseSessionInfo(info: SessionInfo | unknown): { usuarioId: number | null; rol?: Rol } {
  if (typeof info === "number") {
    return { usuarioId: info, rol: undefined };
  }
  if (info && typeof info === "object") {
    const anyInfo = info as any;
    const usuarioId = normId(anyInfo.usuarioId ?? anyInfo.id);
    const rol = normRol(anyInfo.rol ?? anyInfo.rol_tipo);
    return { usuarioId, rol };
  }
  return { usuarioId: null, rol: undefined };
}

function normId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normRol(v: unknown): Rol | undefined {
  if (v === "admin" || v === "operador") return v;
  if (typeof v === "string") {
    const w = v.toLowerCase().trim();
    if (w === "admin" || w === "operador") return w as Rol;
  }
  return undefined;
}
