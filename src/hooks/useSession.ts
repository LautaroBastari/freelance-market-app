// src/hooks/useSession.ts
import { useEffect, useState } from "react";
import { sessionInfo, type SessionInfo } from "../api/sesion";

type Rol = "admin" | "operador";
type SessionState = { usuarioId: number | null; rol?: Rol; loading: boolean };

const normRol = (v: unknown): Rol | undefined => {
  if (typeof v !== "string") return undefined;
  const w = v.trim().toLowerCase();
  return w === "admin" || w === "operador" ? (w as Rol) : undefined;
};

const parse = (info: SessionInfo | unknown): { usuarioId: number | null; rol?: Rol } => {
  if (typeof info === "number") return { usuarioId: info, rol: undefined };
  if (info && typeof info === "object") {
    const any = info as any;
    const id = Number(any.usuarioId ?? any.id);
    return {
      usuarioId: Number.isFinite(id) && id > 0 ? id : null,
      rol: normRol(any.rol ?? any.rol_tipo),
    };
  }
  return { usuarioId: null, rol: undefined };
};

export default function useSession(): SessionState {
  const [s, setS] = useState<SessionState>({ usuarioId: null, rol: undefined, loading: true });

  async function sync() {
    try {
      // leer front
      const lsId = localStorage.getItem("usuarioId");
      const lsRol = normRol(localStorage.getItem("rol"));
      if (lsId && lsRol) { setS({ usuarioId: Number(lsId), rol: lsRol, loading: false }); return; }

      //  backend
      const info = await sessionInfo();
      const { usuarioId, rol } = parse(info);
      setS({ usuarioId, rol, loading: false });

      //  corrige localStorage
      if (usuarioId) localStorage.setItem("usuarioId", String(usuarioId));
      if (rol) localStorage.setItem("rol", rol);
    } catch {
      setS(x => ({ ...x, loading: false }));
    }
  }

  useEffect(() => {
    sync();
    const onUpdate = () => sync();
    window.addEventListener("session-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("session-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  return s;
}
