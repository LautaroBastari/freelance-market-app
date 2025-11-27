PRAGMA foreign_keys = ON;

-- ===========================
-- USUARIO
-- ===========================
CREATE TABLE usuario (
  id_usuario      INTEGER PRIMARY KEY,
  nombre          TEXT NOT NULL,
  nombre_usuario  TEXT NOT NULL UNIQUE,
  rol_tipo        TEXT NOT NULL DEFAULT 'operador',
  clave_hash      TEXT NOT NULL,
  activo          INTEGER NOT NULL DEFAULT 1
);

-- ===========================
-- CAJA (sin cerrada_por)
-- ===========================
CREATE TABLE caja (
  id_caja     INTEGER PRIMARY KEY,
  abierta_por INTEGER NOT NULL REFERENCES usuario(id_usuario),
  abierta_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrada_en  DATETIME,
  estado      TEXT NOT NULL
);

-- ===========================
-- PRODUCTO
-- ===========================
CREATE TABLE producto (
  id_producto           INTEGER PRIMARY KEY,
  codigo_producto       TEXT NOT NULL UNIQUE,
  nombre                TEXT NOT NULL,
  precio_venta_actual   INTEGER NOT NULL CHECK (precio_venta_actual >= 0),
  costo_actual          INTEGER NOT NULL CHECK (costo_actual >= 0),
  activo                INTEGER NOT NULL DEFAULT 1
);

-- ===========================
-- PRODUCTO_STOCK (SIN CHECK >= 0)
-- ===========================
CREATE TABLE producto_stock (
  id_producto    INTEGER PRIMARY KEY REFERENCES producto(id_producto),
  stock_actual   INTEGER NOT NULL DEFAULT 0,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- STOCK_MOV
-- ===========================
CREATE TABLE stock_mov (
  id_movimiento   INTEGER PRIMARY KEY,
  id_producto     INTEGER NOT NULL REFERENCES producto(id_producto),
  cantidad_delta  INTEGER NOT NULL CHECK (cantidad_delta <> 0),
  motivo          TEXT NOT NULL,
  referencia      TEXT,
  fecha_hora      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- PRECIO_HISTORIAL (unificado)
-- ===========================
CREATE TABLE precio_historial (
  id_precio      INTEGER PRIMARY KEY,
  id_producto    INTEGER NOT NULL REFERENCES producto(id_producto),
  tipo           TEXT NOT NULL,              -- 'venta' | 'costo'
  precio         INTEGER NOT NULL CHECK (precio >= 0),
  vigente_desde  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vigente_hasta  DATETIME
);

-- ===========================
-- VENTA  (DEFAULT 'en_curso')
-- ===========================
CREATE TABLE venta (
  id_venta    INTEGER PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario),
  id_caja     INTEGER NOT NULL REFERENCES caja(id_caja),
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total       INTEGER NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'en_curso'   -- ← crítico para carrito
);

-- ===========================
-- VENTA_ITEM (snapshot de precio)
-- ===========================
CREATE TABLE venta_item (
  id_item         INTEGER PRIMARY KEY,
  id_venta        INTEGER NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  id_producto     INTEGER NOT NULL REFERENCES producto(id_producto),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
  fuente_precio   TEXT NOT NULL,             -- 'catalogo' | 'manual' | 'promo'
  subtotal        INTEGER NOT NULL DEFAULT 0
);
