import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import huevo from "../../assets/santo_huevo_logo_transparent.png";

export default function AdminVista() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Links base (mantenemos tu estructura; solo ajusto hover a amarillo suave y timings consistentes)
  const linkBase =
    "group/item flex items-center gap-0 px-2.5 py-2 rounded-xl transition-colors duration-400 ease-out";
  const linkInactive =
    "text-neutral-700 hover:bg-yellow-50/50 hover:text-neutral-900";
  // Activo: no forzamos negro; dejamos texto normal y la “selección” la marca el aura del ícono.
  const linkActive = "text-neutral-900";

  const title =
    pathname.startsWith("/admin/stock")
      ? "Stock"
      : pathname.startsWith("/admin/ventas")
      ? "Ventas"
      : "Panel Admin";

  // Aura: SOLO el activo. Amarillo + aura.
  // Importante: el SVG usa currentColor -> acá controlamos el color del ícono.
  const iconPill = (active: boolean) =>
    [
      "flex h-9 w-9 items-center justify-center rounded-xl border bg-white",
      "transition-[box-shadow,ring-color,border-color,color] duration-400 ease-out",
      active
        ? [
            "border-transparent",
            "text-yellow-700",
            "ring-2 ring-yellow-300/60",
            "shadow-[0_0_0_7px_rgba(253,224,71,0.14)]",
          ].join(" ")
        : [
            "border-neutral-200",
            "text-neutral-800",
            "group-hover:text-neutral-900",
          ].join(" "),
    ].join(" ");

  return (
    <div className="min-h-screen text-neutral-900 flex bg-gradient-to-b from-yellow-50 via-white to-white">
      {/* Sidebar: hover expand SOLO sobre el aside */}
      <aside
        className="
          group relative
          border-r border-yellow-200/50
          bg-yellow-50/30 backdrop-blur-sm
          w-16 hover:w-60 transition-[width] duration-400 ease-out
          overflow-hidden
        "
      >



        {/* Header */}
        <div className="relative px-2 py-4 border-b border-yellow-200/50 flex items-center justify-center hover:justify-start">
          {/* Logo abierto (huevo) */}
          <img
            src={huevo}
            alt="Santo Huevo"
            draggable={false}
            className="
              h-10 w-10 object-contain drop-shadow-sm bg-transparent
              opacity-0 group-hover:opacity-100
              transition-opacity duration-400 ease-out
            "
          />

          {/* Logo cerrado (final2) - desde /public -> /final2.png */}
          <img
            src="/final2.png"
            alt="final2"
            draggable={false}
            className="
              h-10 w-10 object-contain drop-shadow-sm bg-transparent
              absolute
              opacity-100 group-hover:opacity-0
              transition-opacity duration-400 ease-out
            "
          />

          <div className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out">
            <div className="font-bold tracking-tight">Administrador</div>
            <div className="text-xs text-neutral-500">Gestión</div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="relative p-2 text-sm space-y-1">
          {/* INICIO */}
          <NavLink
            to=""
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Inicio"
          >
            <div className={iconPill(pathname === "/admin")}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Inicio
            </span>
          </NavLink>

          {/* STOCK */}
          <NavLink
            to="stock"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Stock"
          >
            <div className={iconPill(pathname.startsWith("/admin/stock"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                <path d="M3.3 7L12 12l8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Stock
            </span>
          </NavLink>

          {/* COMPRAS */}
          <NavLink
            to="compras"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Compras"
          >
            <div className={iconPill(pathname.startsWith("/admin/compras"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3h2l3 12h11" />
                <circle cx="9" cy="19" r="2" />
                <circle cx="17" cy="19" r="2" />
                <path d="M13 6h8l-1 5h-7z" />
              </svg>
            </div>

            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Compras
            </span>
          </NavLink>

          {/* VENTAS (ADMIN) */}
          <NavLink
            to="ventas-admin"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Historial de ventas"
          >
            <div className={iconPill(pathname.startsWith("/admin/ventas-admin"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 3h10v18l-5-3-5 3z" />
                <path d="M9 7h6" />
                <path d="M9 11h6" />
                <path d="M9 15h4" />
              </svg>
            </div>

            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Ventas
            </span>
          </NavLink>

          {/* REPORTES */}
          <NavLink
            to="reportes"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Reportes de ventas"
          >
            <div className={iconPill(pathname.startsWith("/admin/reportes"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v18h18" />
                <rect x="5" y="10" width="3" height="7" />
                <rect x="11" y="6" width="3" height="11" />
                <rect x="17" y="13" width="3" height="4" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Cajas
            </span>
          </NavLink>

          {/* RENTABILIDAD */}
          <NavLink
            to="rentabilidad"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Rentabilidad"
          >
            <div className={iconPill(pathname.startsWith("/admin/rentabilidad"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M7 12h1M16 12h1" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Rentabilidad por producto
            </span>
          </NavLink>

          {/* GASTOS Y SUELDOS */}
          <NavLink
            to="gastos"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Gastos y Sueldos"
          >
            <div className={iconPill(pathname.startsWith("/admin/gastos"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 3h10v18l-5-3-5 3z" />
                <path d="M9 7h6M9 11h6M9 15h4" />
              </svg>
            </div>

            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Gastos y Sueldos
            </span>
          </NavLink>

          {/* PNL */}
          <NavLink
            to="pnl"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Pérdidas y Ganancias"
          >
            <div className={iconPill(pathname.startsWith("/admin/pnl"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v18h18" />
                <rect x="6" y="11" width="3" height="6" />
                <rect x="11" y="7" width="3" height="10" />
                <rect x="16" y="13" width="3" height="4" />
                <path d="M6 10l4-4 4 3 5-6" />
              </svg>
            </div>

            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              PNL
            </span>
          </NavLink>

          {/* GANANCIA */}
          <NavLink
            to="ganancia"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Ganancia del negocio"
          >
            <div className={iconPill(pathname.startsWith("/admin/ganancia"))}>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 17l6-6 4 4 8-8" />
                <path d="M14 7h7v7" />
              </svg>
            </div>

            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
              Ganancias del negocio
            </span>
          </NavLink>
        </nav>

        {/* Tip al pie */}
        <div className="mt-auto p-3 text-[11px] text-neutral-500 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-400 ease-out">
          <div className="rounded-lg border border-neutral-200 p-3 bg-white/70">
            Atajo: <span className="font-mono">G</span> →{" "}
            <span className="font-mono">S</span> para Stock.
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="hidden sticky top-0 z-20 flex items-center justify-between px-5 py-3 border-b border-neutral-200 bg-gradient-to-b from-yellow-100 to-yellow-50">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold tracking-tight">{title}</h1>
            <span className="hidden sm:inline-flex items-center rounded-full border border-yellow-300 bg-white/70 px-2 py-0.5 text-xs text-yellow-800">
              {new Date().toLocaleDateString("es-AR")}
            </span>
          </div>
          <button
            onClick={() => navigate("stock")}
            className="text-sm bg-white/90 border border-yellow-300 rounded-lg px-3 py-1.5 hover:bg-white shadow-sm"
          >
            Ir a Stock
          </button>
        </header>

        <div className="p-5">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
