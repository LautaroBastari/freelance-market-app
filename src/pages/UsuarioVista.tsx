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
            label: "Ventas",
            icon: (
              // Ícono: bolsa / tienda (más “ventas” que casa)
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 7l1-3h10l1 3" />
                <path d="M5 7h14l-1 14H6L5 7z" />
                <path d="M9 10a3 3 0 0 0 6 0" />
              </svg>
            ),
            activeWhen: (p) => p === "/ventas" || p === "/ventas/",
            title: "Inicio",
          },
          {
            to: "historial",
            label: "Historial del día",
            icon: (
              // Ícono: reloj + documento (historial)
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3h8v4H8z" />
                <path d="M6 7h12v14H6z" />
                <path d="M9 11h6" />
                <path d="M9 14h5" />
                <path d="M12 18a3 3 0 1 0-3-3" />
                <path d="M12 15v2l1 1" />
              </svg>
            ),
            activeWhen: (p) => p.startsWith("/ventas/historial"),
            title: "Historial",
          },
        ]}
        footerTip={
          <>
            Atajos: <span className="font-mono">G</span>→
            <span className="font-mono">V</span> Nueva venta
          </>
        }
      />

      <div className="flex-1 flex flex-col">
        <div className="p-5">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
