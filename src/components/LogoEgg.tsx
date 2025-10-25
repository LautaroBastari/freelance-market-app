export default function LogoEgg({
  className = "h-10 w-10",
}: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Santo Huevo"
    >
      {/* HALO (aro) */}
      <ellipse
        cx="48" cy="20" rx="18" ry="7"
        fill="#FBBF24" /* amarillo cálido */
        stroke="#111" strokeWidth="4" />

      {/* SOMBRERITO / CASQUETE DEL HUEVO (línea superior) */}
      <path
        d="M36 20c2-7 7-11 12-11s10 4 12 11"
        stroke="#111" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* HUEVO */}
      <ellipse
        cx="48" cy="55" rx="20" ry="26"
        fill="#FFFFFF" stroke="#111" strokeWidth="4" />

      {/* ALA IZQUIERDA */}
      <path
        d="M28 56
           c-9 0 -15 7 -15 14
           c0 5 3 9 7 11
           c5 3 11 2 16 -1
           l5 -3"
        fill="#FBBF24"
        stroke="#111" strokeWidth="4"
        strokeLinejoin="round" />

      {/* Plumas ala izq */}
      <path d="M18 68c3 0 5 1 7 2" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 75c3 1 6 1 8 0" stroke="#111" strokeWidth="4" strokeLinecap="round" />

      {/* ALA DERECHA (simétrica) */}
      <path
        d="M68 56
           c9 0 15 7 15 14
           c0 5 -3 9 -7 11
           c-5 3 -11 2 -16 -1
           l-5 -3"
        fill="#FBBF24"
        stroke="#111" strokeWidth="4"
        strokeLinejoin="round" />

      {/* Plumas ala der */}
      <path d="M78 68c-3 0 -5 1 -7 2" stroke="#111" strokeWidth="4" strokeLinecap="round" />
      <path d="M80 75c-3 1 -6 1 -8 0" stroke="#111" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
