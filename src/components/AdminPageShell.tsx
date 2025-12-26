// src/components/adminpageshell.tsx
import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

type AdminShellProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;

  /** Fuerza re-montaje del main para re-ejecutar la animación al entrar */
  pageKey?: string;

  /** Permite apagar animación en pantallas críticas si querés. */
  animate?: boolean;

  /** Clases extra para el <main> (padding, etc.) sin duplicar el componente. */
  className?: string;
};

export default function AdminShell({
  title,
  subtitle,
  actions,
  children,
  pageKey,
  animate = true,
  className = "",
}: AdminShellProps) {
  const reduce = useReducedMotion();

  const motionProps =
    animate && !reduce
      ? {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22, ease: "easeOut" as const },
        }
      : {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
      <motion.main
        key={pageKey} // CLAVE: si cambia, se re-monta y re-anima
        {...motionProps}
        className={[
          "mx-auto w-full max-w-[1600px] px-5 py-5 md:px-7 md:py-7 space-y-6",
          className,
        ].join(" ")}
      >
        {(title || actions) && (
          <div className="flex items-start justify-between">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
              )}
            </div>

            {actions && <div>{actions}</div>}
          </div>
        )}

        {children}
      </motion.main>
    </div>
  );
}
