import Sidebar from "../components/SideBar";
import huevo from "../assets/santo_huevo_logo_transparent.png";
import { Outlet } from "react-router-dom";

export default function UsuarioVista() {
  return (
    <div className="min-h-screen text-neutral-900 flex bg-gradient-to-b from-yellow-50 via-white to-white">
      <Sidebar
        logoSrc={huevo}
        title="Ventas"
        subtitle="Punto de venta"
        items={[
          {
            to: "",
            label: "Inicio",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M9 21V12h6v9" />
              </svg>
            ),
            activeWhen: (p) => p === "/ventas" || p === "/ventas/",
            title: "Inicio",
          },
          {
            to: "nueva",
            label: "Nueva venta",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            ),
            activeWhen: (p) => p.startsWith("/ventas/nueva"),
            title: "Nueva venta",
          },
          {
            to: "historial",
            label: "Historial",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M7 13h8" />
                <path d="M7 17h5" />
                <path d="M7 9h12" />
              </svg>
            ),
            activeWhen: (p) => p.startsWith("/ventas/historial"),
            title: "Historial",
          },
          {
            to: "cierres",
            label: "Cierres de caja",
            icon: (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 15h.01" />
              </svg>
            ),
            activeWhen: (p) => p.startsWith("/ventas/cierres"),
            title: "Cierres de caja",
          },
        ]}
        footerTip={
          <>
            Atajos: <span className="font-mono">G</span>→<span className="font-mono">V</span> Nueva venta
          </>
        }
      />

      <div className="flex-1 flex flex-col">
        {/* Header opcional pegajoso (idéntico estilo a AdminVista si lo querés) */}
        {/*
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-gradient-to-b from-yellow-100 to-yellow-50">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold tracking-tight">Ventas</h1>
            <span className="hidden sm:inline-flex items-center rounded-full border border-yellow-300 bg-white/70 px-2 py-0.5 text-xs text-yellow-800">
              {new Date().toLocaleDateString("es-AR")}
            </span>
          </div>
        </header>
        */}

        <div className="p-5">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
