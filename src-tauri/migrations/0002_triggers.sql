PRAGMA foreign_keys = ON;
-- CAJA: validación de estado
DROP TRIGGER IF EXISTS caja_estado_insert_chk;
CREATE TRIGGER caja_estado_insert_chk
BEFORE INSERT ON caja
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.estado NOT IN ('abierta','cerrada')
    THEN RAISE(ABORT, 'estado inválido (abierta|cerrada)') END;
END;

DROP TRIGGER IF EXISTS caja_estado_update_chk;
CREATE TRIGGER caja_estado_update_chk
BEFORE UPDATE OF estado ON caja
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.estado NOT IN ('abierta','cerrada')
    THEN RAISE(ABORT, 'estado inválido (abierta|cerrada)') END;
END;

-- PRODUCTO → PRODUCTO_STOCK seed
DROP TRIGGER IF EXISTS producto_ai_stock;
CREATE TRIGGER producto_ai_stock
AFTER INSERT ON producto
FOR EACH ROW
BEGIN
  INSERT INTO producto_stock(id_producto, stock_actual, actualizado_en)
  VALUES (NEW.id_producto, 0, CURRENT_TIMESTAMP);
END;

-- PRECIO_HISTORIAL (cerrar vigente y normalizar producto)
DROP TRIGGER IF EXISTS precio_hist_bi_cerrar_anterior;
CREATE TRIGGER precio_hist_bi_cerrar_anterior
BEFORE INSERT ON precio_historial
FOR EACH ROW
BEGIN
  UPDATE precio_historial
     SET vigente_hasta = COALESCE(NEW.vigente_desde, CURRENT_TIMESTAMP)
   WHERE id_producto = NEW.id_producto
     AND tipo        = NEW.tipo
     AND vigente_hasta IS NULL;
END;

DROP TRIGGER IF EXISTS precio_hist_ai_normalizar;
CREATE TRIGGER precio_hist_ai_normalizar
AFTER INSERT ON precio_historial
FOR EACH ROW
BEGIN
  UPDATE producto
     SET precio_venta_actual = COALESCE((
           SELECT precio FROM precio_historial
           WHERE id_producto = NEW.id_producto AND tipo='venta' AND vigente_hasta IS NULL
         ), precio_venta_actual),
         costo_actual = COALESCE((
           SELECT precio FROM precio_historial
           WHERE id_producto = NEW.id_producto AND tipo='costo' AND vigente_hasta IS NULL
         ), costo_actual)
   WHERE id_producto = NEW.id_producto;
END;

-- STOCK_MOV ↔ PRODUCTO_STOCK
DROP TRIGGER IF EXISTS trg_stock_mov_ins;
CREATE TRIGGER trg_stock_mov_ins
AFTER INSERT ON stock_mov
FOR EACH ROW
BEGIN
  INSERT INTO producto_stock(id_producto, stock_actual, actualizado_en)
  VALUES (NEW.id_producto, NEW.cantidad_delta, CURRENT_TIMESTAMP)
  ON CONFLICT(id_producto) DO UPDATE
    SET stock_actual   = stock_actual + NEW.cantidad_delta,
        actualizado_en = CURRENT_TIMESTAMP;
END;

DROP TRIGGER IF EXISTS trg_stock_mov_upd;
CREATE TRIGGER trg_stock_mov_upd
AFTER UPDATE OF cantidad_delta ON stock_mov
FOR EACH ROW
BEGIN
  UPDATE producto_stock
  SET stock_actual   = stock_actual - OLD.cantidad_delta + NEW.cantidad_delta,
      actualizado_en = CURRENT_TIMESTAMP
  WHERE id_producto = NEW.id_producto;
END;

DROP TRIGGER IF EXISTS trg_stock_mov_del;
CREATE TRIGGER trg_stock_mov_del
AFTER DELETE ON stock_mov
FOR EACH ROW
BEGIN
  UPDATE producto_stock
  SET stock_actual   = stock_actual - OLD.cantidad_delta,
      actualizado_en = CURRENT_TIMESTAMP
  WHERE id_producto = OLD.id_producto;
END;

-- VENTA: validación de estados
DROP TRIGGER IF EXISTS venta_estado_insert_chk;
CREATE TRIGGER venta_estado_insert_chk
BEFORE INSERT ON venta
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.estado NOT IN ('en_curso','finalizada','anulada')
    THEN RAISE(ABORT,'estado inválido (en_curso|finalizada|anulada)') END;
END;

DROP TRIGGER IF EXISTS venta_estado_upd_chk;
CREATE TRIGGER venta_estado_upd_chk
BEFORE UPDATE OF estado ON venta
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.estado NOT IN ('en_curso','finalizada','anulada')
    THEN RAISE(ABORT,'estado inválido (en_curso|finalizada|anulada)') END;
END;

-- VENTA_ITEM: subtotal y total de venta
DROP TRIGGER IF EXISTS trg_item_ins;
DROP TRIGGER IF EXISTS trg_item_upd;
DROP TRIGGER IF EXISTS trg_item_del;

CREATE TRIGGER trg_item_ins
AFTER INSERT ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta_item
     SET subtotal = NEW.cantidad * NEW.precio_unitario
   WHERE id_item = NEW.id_item;

  UPDATE venta
     SET total = (SELECT COALESCE(SUM(subtotal),0)
                    FROM venta_item
                   WHERE id_venta = NEW.id_venta)
   WHERE id_venta = NEW.id_venta;
END;

CREATE TRIGGER trg_item_upd
AFTER UPDATE OF cantidad, precio_unitario ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta_item
     SET subtotal = NEW.cantidad * NEW.precio_unitario
   WHERE id_item = NEW.id_item;

  UPDATE venta
     SET total = (SELECT COALESCE(SUM(subtotal),0)
                    FROM venta_item
                   WHERE id_venta = NEW.id_venta)
   WHERE id_venta = NEW.id_venta;
END;

CREATE TRIGGER trg_item_del
AFTER DELETE ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta
     SET total = (SELECT COALESCE(SUM(subtotal),0)
                    FROM venta_item
                   WHERE id_venta = OLD.id_venta)
   WHERE id_venta = OLD.id_venta;
END;

-- VENTA_PAGO: pagos = total al finalizar
DROP TRIGGER IF EXISTS trg_venta_check_pagos_total;
CREATE TRIGGER trg_venta_check_pagos_total
BEFORE UPDATE OF estado ON venta
WHEN NEW.estado = 'finalizada'
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT IFNULL(SUM(monto), 0)
        FROM venta_pago
        WHERE id_venta = NEW.id_venta
      ) <> NEW.total
      THEN RAISE(ABORT, 'Total de pagos distinto al total de la venta')
    END;
END;

-- GASTO_NEGOCIO / SUELDO_PAGO: validaciones (las que ya tenías)
DROP TRIGGER IF EXISTS sueldo_pago_insert_chk;
CREATE TRIGGER sueldo_pago_insert_chk
BEFORE INSERT ON sueldo_pago
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.descripcion IS NULL OR length(trim(NEW.descripcion)) = 0
    THEN RAISE(ABORT, 'descripcion obligatoria') END;

  SELECT CASE WHEN NEW.monto IS NULL OR NEW.monto <= 0
    THEN RAISE(ABORT, 'monto inválido (> 0)') END;

  SELECT CASE WHEN NEW.fecha_hora IS NULL OR length(trim(NEW.fecha_hora)) = 0
    THEN RAISE(ABORT, 'fecha_hora obligatoria') END;
END;

DROP TRIGGER IF EXISTS sueldo_pago_update_chk;
CREATE TRIGGER sueldo_pago_update_chk
BEFORE UPDATE ON sueldo_pago
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.descripcion IS NULL OR length(trim(NEW.descripcion)) = 0
    THEN RAISE(ABORT, 'descripcion obligatoria') END;

  SELECT CASE WHEN NEW.monto IS NULL OR NEW.monto <= 0
    THEN RAISE(ABORT, 'monto inválido (> 0)') END;

  SELECT CASE WHEN NEW.fecha_hora IS NULL OR length(trim(NEW.fecha_hora)) = 0
    THEN RAISE(ABORT, 'fecha_hora obligatoria') END;
END;

DROP TRIGGER IF EXISTS gasto_negocio_insert_chk;
CREATE TRIGGER gasto_negocio_insert_chk
BEFORE INSERT ON gasto_negocio
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.categoria IS NULL OR length(trim(NEW.categoria)) = 0
    THEN RAISE(ABORT, 'categoria obligatoria') END;

  SELECT CASE WHEN NEW.monto IS NULL OR NEW.monto <= 0
    THEN RAISE(ABORT, 'monto inválido (> 0)') END;

  SELECT CASE WHEN NEW.fecha_hora IS NULL OR length(trim(NEW.fecha_hora)) = 0
    THEN RAISE(ABORT, 'fecha_hora obligatoria') END;
END;

DROP TRIGGER IF EXISTS gasto_negocio_update_chk;
CREATE TRIGGER gasto_negocio_update_chk
BEFORE UPDATE ON gasto_negocio
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.categoria IS NULL OR length(trim(NEW.categoria)) = 0
    THEN RAISE(ABORT, 'categoria obligatoria') END;

  SELECT CASE WHEN NEW.monto IS NULL OR NEW.monto <= 0
    THEN RAISE(ABORT, 'monto inválido (> 0)') END;

  SELECT CASE WHEN NEW.fecha_hora IS NULL OR length(trim(NEW.fecha_hora)) = 0
    THEN RAISE(ABORT, 'fecha_hora obligatoria') END;
END;

-- PROMOS: checks (negativos)
DROP TRIGGER IF EXISTS venta_item_promo_chk_ins;
CREATE TRIGGER venta_item_promo_chk_ins
BEFORE INSERT ON venta_item
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.precio_unitario_efectivo IS NOT NULL AND NEW.precio_unitario_efectivo < 0
      THEN RAISE(ABORT, 'precio_unitario_efectivo no puede ser negativo')
  END;

  SELECT CASE
    WHEN NEW.promo_precio_total IS NOT NULL AND NEW.promo_precio_total < 0
      THEN RAISE(ABORT, 'promo_precio_total no puede ser negativo')
  END;
END;

DROP TRIGGER IF EXISTS venta_item_promo_chk_upd;
CREATE TRIGGER venta_item_promo_chk_upd
BEFORE UPDATE ON venta_item
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NEW.precio_unitario_efectivo IS NOT NULL AND NEW.precio_unitario_efectivo < 0
      THEN RAISE(ABORT, 'precio_unitario_efectivo no puede ser negativo')
  END;

  SELECT CASE
    WHEN NEW.promo_precio_total IS NOT NULL AND NEW.promo_precio_total < 0
      THEN RAISE(ABORT, 'promo_precio_total no puede ser negativo')
  END;
END;

-- imputación automática a gasto_rentabilidad
-- gasto_negocio -> gasto_rentabilidad (origen='manual')
DROP TRIGGER IF EXISTS gasto_negocio_ai_rent;
CREATE TRIGGER gasto_negocio_ai_rent
AFTER INSERT ON gasto_negocio
FOR EACH ROW
BEGIN
  INSERT INTO gasto_rentabilidad (
    fecha, categoria, tipo, origen, origen_id, descripcion, monto, referencia
  ) VALUES (
    DATE(NEW.fecha_hora),
    CASE lower(trim(NEW.categoria))
      WHEN 'alquiler'   THEN 'alquiler'
      WHEN 'servicios'  THEN 'servicios'
      WHEN 'sueldos'    THEN 'sueldos'
      WHEN 'impuestos'  THEN 'impuestos'
      ELSE 'otros'
    END,
    'egreso',
    'manual',
    NEW.id_gasto_negocio,
    NEW.descripcion,
    NEW.monto,
    NULL
  );
END;

DROP TRIGGER IF EXISTS gasto_negocio_au_rent;
CREATE TRIGGER gasto_negocio_au_rent
AFTER UPDATE ON gasto_negocio
FOR EACH ROW
BEGIN
  UPDATE gasto_rentabilidad
  SET
    fecha = DATE(NEW.fecha_hora),
    categoria = CASE lower(trim(NEW.categoria))
      WHEN 'alquiler'   THEN 'alquiler'
      WHEN 'servicios'  THEN 'servicios'
      WHEN 'sueldos'    THEN 'sueldos'
      WHEN 'impuestos'  THEN 'impuestos'
      ELSE 'otros'
    END,
    descripcion = NEW.descripcion,
    monto = NEW.monto
  WHERE origen = 'manual'
    AND origen_id = OLD.id_gasto_negocio;
END;

DROP TRIGGER IF EXISTS gasto_negocio_ad_rent;
CREATE TRIGGER gasto_negocio_ad_rent
AFTER DELETE ON gasto_negocio
FOR EACH ROW
BEGIN
  DELETE FROM gasto_rentabilidad
  WHERE origen = 'manual'
    AND origen_id = OLD.id_gasto_negocio;
END;

-- sueldo_pago -> gasto_rentabilidad (origen='sueldo', categoria='sueldos')
DROP TRIGGER IF EXISTS sueldo_pago_ai_rent;
CREATE TRIGGER sueldo_pago_ai_rent
AFTER INSERT ON sueldo_pago
FOR EACH ROW
BEGIN
  INSERT INTO gasto_rentabilidad (
    fecha, categoria, tipo, origen, origen_id, descripcion, monto, referencia
  ) VALUES (
    DATE(NEW.fecha_hora),
    'sueldos',
    'egreso',
    'sueldo',
    NEW.id_sueldo_pago,
    NEW.descripcion,
    NEW.monto,
    NULL
  );
END;

DROP TRIGGER IF EXISTS sueldo_pago_au_rent;
CREATE TRIGGER sueldo_pago_au_rent
AFTER UPDATE ON sueldo_pago
FOR EACH ROW
BEGIN
  UPDATE gasto_rentabilidad
  SET
    fecha = DATE(NEW.fecha_hora),
    descripcion = NEW.descripcion,
    monto = NEW.monto
  WHERE origen = 'sueldo'
    AND origen_id = OLD.id_sueldo_pago;
END;

DROP TRIGGER IF EXISTS sueldo_pago_ad_rent;
CREATE TRIGGER sueldo_pago_ad_rent
AFTER DELETE ON sueldo_pago
FOR EACH ROW
BEGIN
  DELETE FROM gasto_rentabilidad
  WHERE origen = 'sueldo'
    AND origen_id = OLD.id_sueldo_pago;
END;
