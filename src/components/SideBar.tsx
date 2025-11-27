import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export type SidebarItem = {
  to: string;
  label: string;
  icon: ReactNode;
  activeWhen?: (pathname: string) => boolean;
  title?: string;
};

export type SidebarProps = {
  logoSrc: string;
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  footerTip?: ReactNode;
  className?: string;
};

export default function Sidebar({
  logoSrc,
  title,
  subtitle,
  items,
  footerTip,
  className = "",
}: SidebarProps) {
  const { pathname } = useLocation();

  const linkBase =
    "group/item flex items-center gap-0 px-2.5 py-2 rounded-xl transition-all";
  const linkInactive =
    "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900";
  const linkActive = "text-neutral-900";

  const iconPill = (active: boolean) =>
    [
      "flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors",
      active
        ? "border-neutral-900 bg-neutral-900 text-white"
        : "border-neutral-200 bg-white text-neutral-800",
    ].join(" ");

  return (
    <aside
      className={`
        group relative
        border-r border-neutral-200 bg-white/80 backdrop-blur-sm
        w-16 hover:w-60 transition-[width] duration-300 ease-out
        overflow-hidden
        ${className}
      `}
    >
      {/* rail sutil */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-b from-white/60 to-yellow-50/40 border-r border-white/50" />

      {/* Header */}
      <div className="relative px-2 py-4 border-b border-neutral-200 flex items-center justify-center hover:justify-start">
        <img
          src={logoSrc}
          alt="logo"
          className="h-10 w-10 object-contain drop-shadow-md bg-transparent"
        />
        <div className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200">
          <div className="font-bold tracking-tight">{title}</div>
          {subtitle && (
            <div className="text-xs text-neutral-500">{subtitle}</div>
          )}
        </div>
      </div>

      {/* Navegación */}
      <nav className="relative p-2 text-sm space-y-1">
        {items.map((item, idx) => {
          const active =
            item.activeWhen?.(pathname) || pathname === item.to;
          return (
            <NavLink
              key={idx}
              to={item.to}
              title={item.title || item.label}
              end
              className={({ isActive }) =>
                `${linkBase} ${
                  active || isActive ? linkActive : linkInactive
                }`
              }
            >
              <div className={iconPill(active)}>{item.icon}</div>
              <span className="ml-0 opacity-0 group-hover:ml-3 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Tip al pie */}
      {footerTip && (
        <div className="mt-auto p-3 text-[11px] text-neutral-500 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="rounded-lg border border-neutral-200 p-3 bg-white/70">
            {footerTip}
          </div>
        </div>
      )}
    </aside>
  );
}
