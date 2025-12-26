PRAGMA foreign_keys = ON;

-- USUARIO
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_nombre_usuario ON usuario(nombre_usuario);
CREATE INDEX        IF NOT EXISTS ix_usuario_rol           ON usuario(rol_tipo);
CREATE INDEX        IF NOT EXISTS ix_usuario_activo        ON usuario(activo);

-- CAJA
CREATE INDEX IF NOT EXISTS ix_caja_abierta_por  ON caja(abierta_por);
CREATE INDEX IF NOT EXISTS ix_caja_estado       ON caja(estado);
CREATE INDEX IF NOT EXISTS ix_caja_abierta_en   ON caja(abierta_en);
CREATE INDEX IF NOT EXISTS ix_caja_cerrada_en   ON caja(cerrada_en);

-- PRODUCTO
CREATE UNIQUE INDEX IF NOT EXISTS ux_producto_codigo ON producto(codigo_producto);
CREATE INDEX        IF NOT EXISTS ix_producto_nombre ON producto(nombre);
CREATE INDEX        IF NOT EXISTS ix_producto_activo ON producto(activo);
CREATE INDEX IF NOT EXISTS idx_producto_reposicion_modo ON producto(reposicion_modo);

-- PRODUCTO_STOCK
CREATE INDEX IF NOT EXISTS ix_prod_stock_actualizado ON producto_stock(actualizado_en);

-- STOCK_MOV
DROP INDEX IF EXISTS idx_stock_mov_prod_fecha;
CREATE INDEX IF NOT EXISTS ix_stock_mov_prod_fecha ON stock_mov(id_producto, fecha_hora);

-- PRECIO_HISTORIAL
CREATE INDEX IF NOT EXISTS ix_precio_hist_busqueda ON precio_historial(id_producto, tipo, vigente_desde);
CREATE UNIQUE INDEX IF NOT EXISTS precio_hist_vigente_unico
ON precio_historial(id_producto, tipo)
WHERE vigente_hasta IS NULL;

-- VENTA / VENTA_ITEM
CREATE INDEX IF NOT EXISTS ix_venta_usuario ON venta(id_usuario);
CREATE INDEX IF NOT EXISTS ix_venta_caja    ON venta(id_caja);
CREATE INDEX IF NOT EXISTS ix_venta_fecha   ON venta(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_venta_estado_fecha ON venta(estado, fecha_hora);

CREATE INDEX IF NOT EXISTS venta_item_ix_venta    ON venta_item(id_venta);
CREATE INDEX IF NOT EXISTS venta_item_ix_producto ON venta_item(id_producto);

-- VENTA_PAGO
CREATE INDEX IF NOT EXISTS idx_venta_pago_id_venta ON venta_pago(id_venta);
CREATE INDEX IF NOT EXISTS idx_venta_pago_medio    ON venta_pago(medio);

-- PROMOS
CREATE INDEX IF NOT EXISTS idx_promo_combo_activo ON promo_combo(activo);
CREATE INDEX IF NOT EXISTS idx_promo_combo_item_combo ON promo_combo_item(id_combo);
CREATE INDEX IF NOT EXISTS idx_promo_combo_item_producto ON promo_combo_item(id_producto);

CREATE INDEX IF NOT EXISTS idx_venta_item_promo_combo ON venta_item(promo_combo_id);
CREATE INDEX IF NOT EXISTS idx_venta_item_promo_grupo ON venta_item(promo_grupo_id);

-- SUELDOS / GASTOS
CREATE INDEX IF NOT EXISTS idx_sueldo_pago_fecha    ON sueldo_pago(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_sueldo_pago_usuario  ON sueldo_pago(id_usuario);
CREATE INDEX IF NOT EXISTS idx_sueldo_pago_destino  ON sueldo_pago(id_usuario_destino);

CREATE INDEX IF NOT EXISTS idx_gasto_negocio_fecha      ON gasto_negocio(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_gasto_negocio_categoria  ON gasto_negocio(categoria);
CREATE INDEX IF NOT EXISTS idx_gasto_negocio_usuario    ON gasto_negocio(id_usuario);

-- RENTABILIDAD
CREATE INDEX IF NOT EXISTS idx_gasto_rent_fecha ON gasto_rentabilidad(fecha);
CREATE INDEX IF NOT EXISTS idx_gasto_rent_categoria_fecha ON gasto_rentabilidad(categoria, fecha);
