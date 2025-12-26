export type GananciasMesRow = {
  mes: string;            // "YYYY-MM"
  ventas: number;
  cogs: number;
  gastos: number;
  ganancia_neta: number;
};

export type RentabilidadNegocioReporte = {
  fecha_desde: string;
  fecha_hasta: string;

  rentabilidad_neta: number;
  rentabilidad_mes_anterior: number;

  tendencia_mensual: GananciasMesRow[];
  margen_neto_pct: number; 
};