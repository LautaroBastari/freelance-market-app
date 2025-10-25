import { Navigate, useLocation } from "react-router-dom";
import useSession from "../hooks/useSession";

export default function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { usuarioId, rol, loading } = useSession();
  const loc = useLocation();

  if (loading) return null;                    // no decidir hasta cargar
  if (!usuarioId) return <Navigate to="/" replace state={{ from: loc }} />;

  const r = (rol ?? "").toLowerCase();
  if (r !== "admin") return <Navigate to="/ventas" replace />;

  return <>{children}</>;
}