PRAGMA foreign_keys = ON;

-- USUARIO
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      INTEGER PRIMARY KEY,
  nombre          TEXT NOT NULL,
  nombre_usuario  TEXT NOT NULL UNIQUE,
  rol_tipo        TEXT NOT NULL DEFAULT 'operador',
  clave_hash      TEXT NOT NULL,
  activo          INTEGER NOT NULL DEFAULT 1
);


-- CAJA
CREATE TABLE IF NOT EXISTS caja (
  id_caja     INTEGER PRIMARY KEY,
  abierta_por INTEGER NOT NULL REFERENCES usuario(id_usuario),
  abierta_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrada_en  DATETIME,
  estado      TEXT NOT NULL
);

-- PRODUCTO (incluye reposición)
CREATE TABLE IF NOT EXISTS producto (
  id_producto           INTEGER PRIMARY KEY,
  codigo_producto       TEXT NOT NULL UNIQUE,
  nombre                TEXT NOT NULL,
  precio_venta_actual   INTEGER NOT NULL CHECK (precio_venta_actual >= 0),
  costo_actual          INTEGER NOT NULL CHECK (costo_actual >= 0),
  activo                INTEGER NOT NULL DEFAULT 1,

  reposicion_modo       TEXT NOT NULL DEFAULT 'unitario'
    CHECK (reposicion_modo IN ('unitario','cajon')),
  reposicion_factor     INTEGER NOT NULL DEFAULT 12
    CHECK (reposicion_factor > 0)
);

-- PRODUCTO_STOCK
CREATE TABLE IF NOT EXISTS producto_stock (
  id_producto    INTEGER PRIMARY KEY REFERENCES producto(id_producto),
  stock_actual   INTEGER NOT NULL DEFAULT 0,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- STOCK_MOV (incluye costo histórico)
CREATE TABLE IF NOT EXISTS stock_mov (
  id_movimiento   INTEGER PRIMARY KEY,
  id_producto     INTEGER NOT NULL REFERENCES producto(id_producto),
  cantidad_delta  INTEGER NOT NULL CHECK (cantidad_delta <> 0),
  motivo          TEXT NOT NULL,
  referencia      TEXT,

  costo_unitario  INTEGER NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  total_costo     INTEGER NOT NULL DEFAULT 0 CHECK (total_costo >= 0),

  fecha_hora      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PRECIO_HISTORIAL
CREATE TABLE IF NOT EXISTS precio_historial (
  id_precio      INTEGER PRIMARY KEY,
  id_producto    INTEGER NOT NULL REFERENCES producto(id_producto),
  tipo           TEXT NOT NULL,              -- 'venta' | 'costo'
  precio         INTEGER NOT NULL CHECK (precio >= 0),
  vigente_desde  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vigente_hasta  DATETIME
);

-- VENTA
CREATE TABLE IF NOT EXISTS venta (
  id_venta    INTEGER PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario),
  id_caja     INTEGER NOT NULL REFERENCES caja(id_caja),
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total       INTEGER NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'en_curso'   -- 'en_curso' | 'finalizada' | 'anulada'
);

-- VENTA_ITEM (incluye promos)
CREATE TABLE IF NOT EXISTS venta_item (
  id_item                   INTEGER PRIMARY KEY,
  id_venta                  INTEGER NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  id_producto               INTEGER NOT NULL REFERENCES producto(id_producto),
  cantidad                  INTEGER NOT NULL CHECK (cantidad > 0),

  precio_unitario           INTEGER NOT NULL CHECK (precio_unitario >= 0),
  costo_unitario_en_venta   INTEGER NOT NULL CHECK (costo_unitario_en_venta >= 0),
  fuente_precio             TEXT NOT NULL,             -- 'catalogo' | 'manual' | 'promo'

  subtotal                  INTEGER NOT NULL DEFAULT 0,

  -- promos / packs
  precio_unitario_efectivo  INTEGER,                   -- NULL => usar precio_unitario
  promo_combo_id            INTEGER REFERENCES promo_combo(id_combo),
  promo_grupo_id            TEXT,
  promo_precio_total        INTEGER
);

-- VENTA_PAGO
CREATE TABLE IF NOT EXISTS venta_pago (
  id_pago    INTEGER PRIMARY KEY,
  id_venta   INTEGER NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  medio      TEXT NOT NULL CHECK (medio IN ('efectivo','debito','credito','transferencia')),
  monto      INTEGER NOT NULL CHECK (monto > 0),
  referencia TEXT
);

-- PROMO_COMBO
CREATE TABLE IF NOT EXISTS promo_combo (
  id_combo         INTEGER PRIMARY KEY,
  nombre           TEXT NOT NULL,
  precio_min_total INTEGER NOT NULL DEFAULT 0 CHECK (precio_min_total >= 0),
  precio_pack      INTEGER NOT NULL DEFAULT 0 CHECK (precio_pack >= 0),
  activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en        DATETIME NOT NULL DEFAULT (DATETIME('now','localtime'))
);

CREATE TABLE IF NOT EXISTS promo_combo_item (
  id_combo     INTEGER NOT NULL REFERENCES promo_combo(id_combo) ON DELETE CASCADE,
  id_producto  INTEGER NOT NULL REFERENCES producto(id_producto),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (id_combo, id_producto)
);

-- GASTOS / SUELDOS (operativo)
CREATE TABLE IF NOT EXISTS sueldo_pago (
  id_sueldo_pago      INTEGER PRIMARY KEY,
  fecha_hora          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descripcion         TEXT NOT NULL,
  monto               INTEGER NOT NULL CHECK (monto > 0),
  id_usuario_destino  INTEGER REFERENCES usuario(id_usuario),
  id_usuario          INTEGER NOT NULL REFERENCES usuario(id_usuario)
);

CREATE TABLE IF NOT EXISTS gasto_negocio (
  id_gasto_negocio    INTEGER PRIMARY KEY,
  fecha_hora          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  categoria           TEXT NOT NULL,
  descripcion         TEXT,
  monto               INTEGER NOT NULL CHECK (monto > 0),
  id_usuario          INTEGER NOT NULL REFERENCES usuario(id_usuario)
);

-- GASTO_RENTABILIDAD (ledger PNL)
CREATE TABLE IF NOT EXISTS gasto_rentabilidad (
  id_gasto_rent   INTEGER PRIMARY KEY,
  fecha           DATE NOT NULL DEFAULT (DATE('now','localtime')),

  categoria       TEXT NOT NULL CHECK (categoria IN (
    'alquiler','servicios','sueldos','impuestos','otros'
  )),

  tipo            TEXT NOT NULL CHECK (tipo IN ('egreso','ingreso')),
  origen          TEXT NOT NULL CHECK (origen IN (
    'manual','venta','compra','sueldo','impuesto','ajuste'
  )),
  origen_id       INTEGER,

  descripcion     TEXT,
  monto           INTEGER NOT NULL,
  referencia      TEXT
);
