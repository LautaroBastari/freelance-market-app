import { Navigate, useLocation } from "react-router-dom";
import useSession from "../hooks/useSession";

const NORM = (r?: string|null) => (typeof r === "string" ? r.trim().toLowerCase() : undefined);

export default function RequireAuth({
  children,
  roles,
}: { children: React.ReactNode; roles?: ("admin" | "operador")[] }) {
  const location = useLocation();
  const { usuarioId, rol, loading } = useSession();
  const normRol = NORM(rol);

  console.log("[RA] start", { path: location.pathname, usuarioId, rol, normRol, roles, loading });

  if (loading) { console.log("[RA] loading"); return null; }
  if (!usuarioId) { console.log("[RA] noId → /"); return <Navigate to="/" replace state={{ from: location }} />; }
  if (roles && normRol == null) { console.log("[RA] noRolYet"); return null; }

  if (roles) {
    const allow = roles.map(NORM);
    const ok = allow.includes(normRol as any);
    console.log("[RA] check", { allow, normRol, ok });
    if (!ok) return <Navigate to="/ventas" replace />;
  }

  console.log("[RA] ok → render");
  return <>{children}</>;
}
