import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminVista from "./pages/admin/AdminVista";
import AdminHome from "./pages/admin/AdminHome";
import Stock from "./pages/admin/Stock";

import UsuarioVista from "./pages/UsuarioVista"; // ✅ layout shell de ventas
import VentasPage from "./pages/Venta";              // ✅ contenido principal

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ========== ADMIN ========== */}
        <Route path="/admin" element={<AdminVista />}>
          <Route index element={<AdminHome />} />     {/* /admin */}
          <Route path="stock" element={<Stock />} />  {/* /admin/stock */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* ========== VENTAS (USUARIO) ========== */}
        <Route path="/ventas" element={<UsuarioVista />}>
          <Route index element={<VentasPage />} />        {/* /ventas */}
          <Route path="nueva" element={<div>Nueva venta</div>} />
          <Route path="historial" element={<div>Historial</div>} />
          <Route path="cierres" element={<div>Cierres de caja</div>} />
        </Route>

        {/* ========== REDIRECCIÓN GLOBAL ========== */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}