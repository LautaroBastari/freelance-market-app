// src/pages/Login.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { sessionInfo, type SessionInfo } from "../api/sesion";

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

    const u = usuario.trim();
    if (!u || !password) {
      setMsg("Usuario y contraseña son obligatorios");
      return;
    }

    setLoading(true);
    try {
      // 1) Autenticar (debe setear sesión del lado Tauri)
      const ok = await invoke<boolean>("login", {
        input: { nombre_usuario: u, password },
      });
      if (!ok) {
        setMsg("Credenciales incorrectas");
        return;
      }

      // 2) Intentar obtener {usuarioId, rol} de forma robusta
      const { usuarioId, rol } = await fetchUsuarioYRol(u);

      if (!usuarioId || !rol) {
        setMsg(
          "Sesión inválida: faltan datos de usuario/rol. " +
          "Asegurate de que el backend exponga sessionInfo() o un comando que devuelva el rol."
        );
        return;
      }

      // 3) Persistir para useSession()
      localStorage.setItem("usuarioId", String(usuarioId));
      localStorage.setItem("rol", rol.toLowerCase());
      window.dispatchEvent(new Event("session-updated"));
      navigate(rol === "admin" ? "/admin" : "/ventas", { replace: true });

      // 4) Redirigir
      navigate(rol === "admin" ? "/admin" : "/ventas", { replace: true });
    } catch (err) {
      setMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-yellow-50 to-white">
      <form
        onSubmit={handleLogin}
        className="bg-white/70 backdrop-blur-sm border border-yellow-100 p-8 rounded-2xl shadow-lg w-96 flex flex-col gap-4"
      >
        <h1 className="text-3xl font-bold text-gray-800 text-center">
          Iniciar sesión
        </h1>

        <input
          placeholder="Usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="bg-white/90 border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-yellow-300 outline-none"
          autoComplete="username"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-white/90 border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-yellow-300 outline-none"
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-100 hover:bg-yellow-200 text-gray-800 font-semibold p-2 rounded-md transition disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/registrar")}
          style={{
            backgroundColor: "#fff7cc",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 0 2px rgba(0,0,0,0.15)",
            width: "100%",
            marginTop: "0.5rem",
          }}
        >
          RegistrarCuenta
        </button>

        {msg && <p className="text-red-500 text-sm text-center">{msg}</p>}
      </form>
    </main>
  );
}

/* ---------------------- helpers ---------------------- */

async function fetchUsuarioYRol(nombreUsuario: string): Promise<{ usuarioId: number | null; rol?: Rol }> {
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

  // si nada devuelve rol válido -> error explícito (no navegues)
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
