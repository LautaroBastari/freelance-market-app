-- ===========================
-- ÍNDICES DE USUARIO
-- ===========================
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_nombre_usuario ON usuario(nombre_usuario);
CREATE INDEX        IF NOT EXISTS ix_usuario_rol           ON usuario(rol_tipo); -- usa rol_tipo si hiciste el ALTER
CREATE INDEX        IF NOT EXISTS ix_usuario_activo        ON usuario(activo);

-- ===========================
-- ÍNDICES DE CAJA
-- ===========================
CREATE INDEX IF NOT EXISTS ix_caja_abierta_por ON caja(abierta_por);
CREATE INDEX IF NOT EXISTS ix_caja_estado      ON caja(estado);
CREATE UNIQUE INDEX IF NOT EXISTS ux_caja_abierta
ON caja(estado) WHERE estado='abierta';

-- ===========================
-- ÍNDICES DE PRODUCTO
-- ===========================
CREATE UNIQUE INDEX IF NOT EXISTS ux_producto_codigo ON producto(codigo_producto);
CREATE INDEX        IF NOT EXISTS ix_producto_nombre ON producto(nombre);
CREATE INDEX        IF NOT EXISTS ix_producto_activo ON producto(activo);

-- ===========================
-- ÍNDICES DE PRODUCTO_STOCK
-- ===========================
CREATE INDEX IF NOT EXISTS ix_prod_stock_actualizado ON producto_stock(actualizado_en);

-- ===========================
-- ÍNDICES DE STOCK_MOV
-- ===========================
CREATE INDEX IF NOT EXISTS ix_stock_mov_prod_fecha ON stock_mov(id_producto, fecha_hora);

-- ===========================
-- ÍNDICES DE PRECIO_HISTORIAL
-- ===========================
CREATE INDEX IF NOT EXISTS ix_precio_hist_busqueda ON precio_historial(id_producto, tipo, vigente_desde);
-- Un SOLO vigente por (producto,tipo)
CREATE UNIQUE INDEX IF NOT EXISTS precio_hist_vigente_unico
ON precio_historial(id_producto, tipo)
WHERE vigente_hasta IS NULL;

-- ===========================
-- ÍNDICES DE VENTA
-- ===========================
CREATE INDEX IF NOT EXISTS ix_venta_usuario ON venta(id_usuario);
CREATE INDEX IF NOT EXISTS ix_venta_caja    ON venta(id_caja);
CREATE INDEX IF NOT EXISTS ix_venta_fecha   ON venta(fecha_hora);

-- ===========================
-- ÍNDICES DE VENTA_ITEM
-- ===========================
CREATE INDEX IF NOT EXISTS ix_venta_item_venta    ON venta_item(id_venta);
CREATE INDEX IF NOT EXISTS ix_venta_item_producto ON venta_item(id_producto);
