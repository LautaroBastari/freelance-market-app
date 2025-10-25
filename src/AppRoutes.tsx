import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminVista from "./pages/admin/AdminVista";
import AdminHome from "./pages/admin/AdminHome"; // <-- agregá este import
import Stock from "./pages/admin/Stock";
import Ventas from "./pages/Venta"; // si tu archivo está en pages/Venta.tsx está bien

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout Admin: sidebar + header + <Outlet /> */}
        <Route path="/admin" element={<AdminVista />}>
          <Route index element={<AdminHome />} />     {/* <-- /admin */}
          <Route path="stock" element={<Stock />} />  {/* <-- /admin/stock */}
          <Route path="ventas" element={<Ventas />} />{/* <-- /admin/ventas */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Redirección global */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
