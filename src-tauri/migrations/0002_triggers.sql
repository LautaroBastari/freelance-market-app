PRAGMA foreign_keys = ON;

/* ==========================
   STOCK_MOV ↔ PRODUCTO_STOCK
   ========================== */

-- Insertar movimiento → actualizar cache
DROP TRIGGER IF EXISTS trg_stock_mov_ins;
CREATE TRIGGER trg_stock_mov_ins
AFTER INSERT ON stock_mov
FOR EACH ROW
BEGIN
  INSERT INTO producto_stock(id_producto, stock_actual, actualizado_en)
  VALUES (NEW.id_producto, NEW.cantidad_delta, CURRENT_TIMESTAMP)
  ON CONFLICT(id_producto) DO
    UPDATE SET stock_actual = stock_actual + NEW.cantidad_delta,
               actualizado_en = CURRENT_TIMESTAMP;
END;

-- Actualizar movimiento → ajustar diferencia
DROP TRIGGER IF EXISTS trg_stock_mov_upd;
CREATE TRIGGER trg_stock_mov_upd
AFTER UPDATE OF cantidad_delta ON stock_mov
FOR EACH ROW
BEGIN
  UPDATE producto_stock
  SET stock_actual   = stock_actual - OLD.cantidad_delta + NEW.cantidad_delta,
      actualizado_en = CURRENT_TIMESTAMP
  WHERE id_producto = NEW.id_producto;

  SELECT CASE
    WHEN (SELECT COALESCE(stock_actual,0) FROM producto_stock WHERE id_producto = NEW.id_producto) < 0
    THEN RAISE(ABORT, 'Stock insuficiente (update)')
  END;
END;

-- Borrar movimiento → revertir
DROP TRIGGER IF EXISTS trg_stock_mov_del;
CREATE TRIGGER trg_stock_mov_del
AFTER DELETE ON stock_mov
FOR EACH ROW
BEGIN
  UPDATE producto_stock
  SET stock_actual   = stock_actual - OLD.cantidad_delta,
      actualizado_en = CURRENT_TIMESTAMP
  WHERE id_producto = OLD.id_producto;

  SELECT CASE
    WHEN (SELECT COALESCE(stock_actual,0) FROM producto_stock WHERE id_producto = OLD.id_producto) < 0
    THEN RAISE(ABORT, 'Stock insuficiente (delete)')
  END;
END;

-- Guardia: evitar stock negativo solo para salidas de negocio
DROP TRIGGER IF EXISTS trg_no_stock_neg_ins;
CREATE TRIGGER trg_no_stock_neg_ins
BEFORE INSERT ON stock_mov
FOR EACH ROW
WHEN (SELECT COALESCE(stock_actual,0)
      FROM producto_stock
      WHERE id_producto = NEW.id_producto) + NEW.cantidad_delta < 0
     AND NEW.motivo IN ('venta','merma','ajuste','egreso_manual','correccion_venta')
BEGIN
  SELECT RAISE(ABORT, 'Stock insuficiente');
END;

/* ==========================
   PRODUCTO → PRODUCTO_STOCK seed
   ========================== */

-- Autocrear fila de stock=0 para cada producto nuevo
DROP TRIGGER IF EXISTS producto_ai_stock;
CREATE TRIGGER producto_ai_stock
AFTER INSERT ON producto
FOR EACH ROW
BEGIN
  INSERT INTO producto_stock(id_producto, stock_actual, actualizado_en)
  VALUES (NEW.id_producto, 0, CURRENT_TIMESTAMP);
END;

/* ==========================
   PRECIO_HISTORIAL unificado
   ========================== */

-- ELIMINAR TRIGGERS VIEJOS QUE DUPLICAN HISTORIAL
DROP TRIGGER IF EXISTS trg_precio_hist_init;
DROP TRIGGER IF EXISTS trg_precio_hist_venta_upd;
DROP TRIGGER IF EXISTS trg_precio_hist_costo_upd;

-- NO USAR bloqueos en producto (se hace por capa app)
DROP TRIGGER IF EXISTS producto_bu_precio_venta_bloqueo;
DROP TRIGGER IF EXISTS producto_bu_costo_bloqueo;

-- Cerrar vigente ANTES de insertar nuevo precio
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

-- Sincronizar producto DESPUÉS del insert de historial
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

/* ==========================
   VENTA_ITEM: subtotal/total y stock
   ========================== */

-- Subtotal + total al insertar
DROP TRIGGER IF EXISTS trg_item_ins;
CREATE TRIGGER trg_item_ins
AFTER INSERT ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta_item SET subtotal = NEW.cantidad * NEW.precio_unitario
  WHERE id_item = NEW.id_item;

  UPDATE venta
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta = NEW.id_venta)
  WHERE id_venta = NEW.id_venta;

  -- reflejar salida de stock
  INSERT INTO stock_mov(id_producto, cantidad_delta, motivo, referencia)
  VALUES (NEW.id_producto, -NEW.cantidad, 'venta', CAST(NEW.id_venta AS TEXT));
END;

-- Subtotal + total al actualizar (cantidad/precio)
DROP TRIGGER IF EXISTS trg_item_upd;
CREATE TRIGGER trg_item_upd
AFTER UPDATE OF cantidad, precio_unitario ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta_item SET subtotal = NEW.cantidad * NEW.precio_unitario
  WHERE id_item = NEW.id_item;

  UPDATE venta
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta = NEW.id_venta)
  WHERE id_venta = NEW.id_venta;

  -- ajustar stock por cambio de cantidad
  INSERT INTO stock_mov(id_producto, cantidad_delta, motivo, referencia)
  VALUES (NEW.id_producto, (OLD.cantidad - NEW.cantidad) * -1, 'correccion_venta', CAST(NEW.id_venta AS TEXT));
END;

-- Subtotal + total al borrar + devolver stock
DROP TRIGGER IF EXISTS trg_item_del;
CREATE TRIGGER trg_item_del
AFTER DELETE ON venta_item
FOR EACH ROW
BEGIN
  UPDATE venta
  SET total = (SELECT COALESCE(SUM(subtotal),0) FROM venta_item WHERE id_venta = OLD.id_venta)
  WHERE id_venta = OLD.id_venta;

  INSERT INTO stock_mov(id_producto, cantidad_delta, motivo, referencia)
  VALUES (OLD.id_producto, +OLD.cantidad, 'anulacion_venta', CAST(OLD.id_venta AS TEXT));
END;

/* ==========================
   CAJA: validación de estado
   ========================== */

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
