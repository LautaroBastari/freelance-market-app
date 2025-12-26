# Freelance Market App

Sistema de gestión de ventas, stock y caja para comercios minoristas.
Aplicación de escritorio offline-first orientada a pequeños y medianos negocios.

## Descripción

El sistema permite registrar ventas, controlar el stock y gestionar la caja diaria
de forma local, sin dependencia de conexión a internet, priorizando simplicidad
operativa, trazabilidad de movimientos y consistencia contable.

Está diseñado para entornos donde se requiere rapidez en la operación diaria y
una lectura clara del resultado económico del negocio.

## Funcionalidades

- Sistema de autenticación con usuarios y roles (administrador / operador)
- Gestión de productos y control de stock
- Registro de ventas con actualización automática de stock
- Apertura y cierre de caja con control de movimientos
- Control de ingresos y egresos diarios
- Reportes diarios, mensuales y por período
- Cálculo de costos, márgenes y rentabilidad
- Gestión de gastos y sueldos

## Lógica del sistema

- El stock se actualiza automáticamente al registrar una venta.
- El costo de cada producto se guarda como snapshot al momento de la venta.
- El resultado del negocio se calcula a partir de ventas, costos y gastos.
- La caja registra los movimientos asociados a cada jornada.
- Los reportes distinguen entre flujo de caja y rentabilidad real.

## Stack tecnológico

- Backend: Rust + Tauri
- Frontend: React + TypeScript + Tailwind CSS
- Base de datos: SQLite (SQLx)

## Estado del proyecto

Sistema finalizado y en uso en un comercio real.  
Actualmente se encuentra en operación diaria y mantenimiento evolutivo.

## Capturas de pantalla

![Login](docs/screenshots/01_login.png)
![Ventas](docs/screenshots/02_venta.png)
![Stock](docs/screenshots/03_stock.png)
![Resultados (PnL)](docs/screenshots/04_pnl.png)
![Ganancias](docs/screenshots/05_ganancias.png)
![Caja](docs/screenshots/06_cajas.png)

## Nota

Las capturas y los datos mostrados corresponden a un entorno de demostración.
El autor cuenta con autorización expresa del cliente para mostrar el sistema
con fines ilustrativos y de portfolio.