import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

type SidebarItem = {
  to: string;
  label: string;
  title?: string;
  icon: React.ReactNode;
  activeWhen?: (pathname: string) => boolean;
};

type SidebarProps = {
  logoSrc: string;           // logo abierto
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  footerTip?: React.ReactNode;
};

export default function Sidebar({
  logoSrc,
  title,
  subtitle,
  items,
  footerTip,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const { pathname } = useLocation();

  const isActive = useMemo(() => {
    return (it: SidebarItem) => {
      if (it.activeWhen) return it.activeWhen(pathname);
      const full = it.to.startsWith("/") ? it.to : `/${it.to}`;
      return pathname === full;
    };
  }, [pathname]);

  // Public assets se referencian así:
  const collapsedLogo = "/final2.png";

  // Activo = amarillo + aura. Inactivo = neutro.
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
    <aside
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      className={[
        "group", // <-- ESTA ES LA LÍNEA QUE TE FALTABA
        "sticky top-0 h-screen shrink-0",
        "border-r border-yellow-200/50",
        "bg-yellow-50/30 backdrop-blur-sm",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.02)]",
        "transition-[width] duration-400 ease-out",
        collapsed ? "w-[56px]" : "w-[276px]",
        "overflow-hidden",
      ].join(" ")}
    >
      {/* Header */}
      <div className="relative h-[68px] border-b border-yellow-200/50 px-2 flex items-center justify-center hover:justify-start">
        {/* Logo abierto */}
        <img
          src={logoSrc}
          alt="Logo"
          draggable={false}
          className={[
            "h-12 w-12 object-contain drop-shadow-sm bg-transparent",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-400 ease-out",
          ].join(" ")}
        />

        {/* Logo cerrado */}
        <img
          src={collapsedLogo}
          alt="final2"
          draggable={false}
          className={[
            "h-10 w-10 object-contain drop-shadow-sm bg-transparent",
            "absolute",
            "opacity-100 group-hover:opacity-0",
            "transition-opacity duration-400 ease-out",
          ].join(" ")}
        />

        {/* Textos */}
        <div className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out">
          <div className="font-bold tracking-tight">{title}</div>
          {subtitle ? (
            <div className="text-xs text-neutral-500">{subtitle}</div>
          ) : null}
        </div>
      </div>

      {/* Navegación */}
      <nav className={["relative p-2 text-sm space-y-1", collapsed ? "px-1" : "px-2"].join(" ")}>
        {items.map((it) => {
          const active = isActive(it);

          return (
            <div key={it.to} className="relative group">
              <NavLink
                to={it.to}
                className={[
                  "group/item flex items-center gap-0 px-2.5 py-2 rounded-xl",
                  "transition-colors duration-400 ease-out",
                  active
                    ? "text-neutral-900"
                    : "text-neutral-700 hover:bg-yellow-50/50 hover:text-neutral-900",
                ].join(" ")}
                title={it.label}
              >
                <div className={iconPill(active)}>{it.icon}</div>

                <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-400 ease-out whitespace-nowrap">
                  {it.label}
                </span>
              </NavLink>

              {/* Tooltip cuando está cerrada */}
              {collapsed && (
                <div
                  className={[
                    "pointer-events-none",
                    "absolute left-[74px] top-1/2 -translate-y-1/2",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-150",
                    "bg-gray-900 text-white",
                    "text-xs font-medium",
                    "px-3 py-2 rounded-xl shadow-lg",
                    "whitespace-nowrap",
                  ].join(" ")}
                >
                  {it.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Tip al pie */}
      <div className="mt-auto p-3 text-[11px] text-neutral-500 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-400 ease-out">
        {!collapsed && (
          <div className="rounded-lg border border-neutral-200 p-3 bg-white/70">
            {footerTip}
          </div>
        )}
      </div>
    </aside>
  );
}
