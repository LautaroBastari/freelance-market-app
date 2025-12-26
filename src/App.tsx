import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Login from "./pages/Login";
import RegistrarUsuario from "./pages/RegistrarUsuario";
import VentasPage from "./pages/Venta";
import RequireAuth from "./components/RequireAuth";
import AdminVista from "./pages/admin/AdminVista";
import AdminHome from "./pages/admin/AdminHome";
import Historial from "./pages/Historial";
import UsuarioVista from "./pages/UsuarioVista";
import ReportesAdminPage from "./pages/admin/ReportesAdmin";
import RentabilidadPage from "./pages/admin/Rentabilidad";
import ComprasPage from "./pages/admin/Compras";
import StockReporte from "./pages/admin/StockReporte";
import RentabilidadNegocioPage from "./pages/admin/RentabilidadNegocio";
import Gastos from "./pages/admin/Gastos";
import StockReposicion from "./pages/admin/StockReposicion";
import VentasAdmin from "./pages/admin/VentasAdmin";

import PNL from "./pages/admin/PnL";

const StockAdmin = lazy(() => import("./pages/admin/Stock"));


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/" element={<Login />} />
        <Route path="/registrar" element={<RegistrarUsuario />} />

        {/* VENTAS: protegido + sidebar de usuario */}
        <Route
          path="/ventas"
          element={
            <RequireAuth>
              <UsuarioVista />
            </RequireAuth>
          }
        >
          <Route index element={<VentasPage />} />
          <Route path="historial" element={<Historial />} />
          <Route path="cierres" element={<div>Cierres de caja</div>} />
          
        </Route>

        {/*  ADMIN: protegido + AdminVista  */}
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

          <Route path="StockReporte" element={<StockReporte />} />
          <Route path="reportes" element={<ReportesAdminPage />} />
          <Route path="rentabilidad" element={<RentabilidadPage />} />
          <Route path="ganancia" element={<RentabilidadNegocioPage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="gastos" element={<Gastos  />} />
          <Route path="stock-reposicion" element={<StockReposicion  />} />
          <Route path="ventas-admin" element={<VentasAdmin  />} />
          <Route path="pnl" element={<PNL  />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Cualquier otra ruta → login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
