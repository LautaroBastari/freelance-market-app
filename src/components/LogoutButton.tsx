// components/LogoutButton.tsx
import { cerrarSesion } from "../api/sesion";

type Props = {
  cajaAbierta?: boolean;
};

export default function LogoutButton({ cajaAbierta = false }: Props) {
  const solicitarLogout = () => {
    if (cajaAbierta) return;
    cerrarSesion();
  };

  return (
    <button
      onClick={solicitarLogout}
      disabled={cajaAbierta}
      className={`h-10 rounded-lg border border-gray-300 bg-white/80 px-4 text-base shadow-sm ${
        cajaAbierta ? "opacity-50 cursor-not-allowed" : "hover:bg-white"
      }`}
    >
      Cerrar sesión
    </button>
  );
}
