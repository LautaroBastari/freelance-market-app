import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import huevo from "../../assets/santo_huevo_logo_transparent.png";

export default function AdminVista() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // 🔧 links: sin fondo negro por defecto; fondo aparece solo al expandir
  const linkBase =
  "group/item flex items-center gap-0 px-2.5 py-2 rounded-xl transition-all";
const linkInactive =
  "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900";
// Importante: el link activo NO cambia colores aquí (evitamos que el SVG herede blanco).
const linkActive = "text-neutral-900";

  const title =
    pathname.startsWith("/admin/stock") ? "Stock" :
    pathname.startsWith("/admin/ventas") ? "Ventas" :
    "Panel Admin";

  // helper para la pill del ícono (se ve bien colapsado)
  const iconPill = (active: boolean) =>
  [
    "flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors",
    active
      ? "border-neutral-900 bg-neutral-900 text-white" // activo → pill negra + icono blanco
      : "border-neutral-200 bg-white text-neutral-800", // inactivo → pill blanca + icono negro
  ].join(" ");

  return (
    <div className="min-h-screen text-neutral-900 flex bg-gradient-to-b from-yellow-50 via-white to-white">
      {/* Sidebar: hover expand SOLO sobre el aside */}
      <aside
        className="
          group relative
          border-r border-neutral-200 bg-white/80 backdrop-blur-sm
          w-16 hover:w-60 transition-[width] duration-300 ease-out
          overflow-hidden
        "
      >
        {/* rail sutil */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-b from-white/60 to-yellow-50/40 border-r border-white/50" />

        {/* Header */}
        <div className="relative px-2 py-4 border-b border-neutral-200 flex items-center justify-center hover:justify-start">
  <img
    src={huevo}
    alt="Santo Huevo"
    className="h-10 w-10 object-contain drop-shadow-md bg-transparent"
  />
        <div className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200">
            <div className="font-bold tracking-tight">Administrador</div>
            <div className="text-xs text-neutral-500">Gestión</div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="relative p-2 text-sm space-y-1">
          <NavLink
            to=""
            end
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            title="Inicio"
          >
            <div className={iconPill(/* isActive */ location.pathname === "/admin")}>
              {/* Home Icon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
              Inicio
            </span>
          </NavLink>

          <NavLink
            to="stock"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
            title="Stock"
          >
            <div className={iconPill(/* isActive */ location.pathname.startsWith("/admin/stock"))}>
              {/* Boxes Icon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
                <path d="M3.3 7L12 12l8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
              Stock
            </span>
          </NavLink>

          <NavLink
            to="ventas"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
            title="Ventas"
          >
            <div className={iconPill(pathname.startsWith("/admin/ventas"))}>
              {/* Cart Icon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
              Ventas
            </span>
          </NavLink>
        </nav>

        {/* Tip al pie */}
        <div className="mt-auto p-3 text-[11px] text-neutral-500 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="rounded-lg border border-neutral-200 p-3 bg-white/70">
            Atajo: <span className="font-mono">G</span> → <span className="font-mono">S</span> para Stock.
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
