import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Login from "./pages/Login";
import VentasPage from "./pages/Venta";
import RequireAuth from "./components/RequireAuth";
import AdminVista from "./pages/admin/AdminVista";
import AdminHome from "./pages/admin/AdminHome";
import UsuarioVista from "./pages/UsuarioVista";   // ⬅️ layout con sidebar
const StockAdmin = lazy(() => import("./pages/admin/Stock"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ===== VENTAS: protegido + con sidebar ===== */}
        <Route
          path="/ventas"
          element={
            <RequireAuth>
              <UsuarioVista />     {/* ⬅️ acá vive la Sidebar */}
            </RequireAuth>
          }
        >
          <Route index element={<VentasPage />} />     {/* /ventas */}
          <Route path="nueva" element={<div>Nueva venta</div>} />
          <Route path="historial" element={<div>Historial</div>} />
          <Route path="cierres" element={<div>Cierres de caja</div>} />
        </Route>

        {/* ===== ADMIN (como ya lo tenías) ===== */}
        <Route
          path="/admin"
          element={
            <RequireAuth roles={["admin"]}>
              <AdminVista />
            </RequireAuth>
          }
        >
          <Route index element={<AdminHome />} />
          <Route
            path="stock"
            element={
              <Suspense fallback={<div style={{ padding: 16 }}>Cargando Stock…</div>}>
                <StockAdmin />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
