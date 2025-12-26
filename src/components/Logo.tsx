// src/components/Logo.tsx
import miIcono from '../assets/icon.ico';

export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <img 
        src={miIcono} 
        alt="Huevo Santo Logo" 
        className="w-8 h-8 md:w-12 md:h-12 object-contain" 
      />
      <span className="font-bold text-xl tracking-tight text-gray-900">
        Huevo Santo
      </span>
    </div>
  );
};