PRAGMA foreign_keys = ON;

-- 1) Añadir quién cierra (sin rebuild)
ALTER TABLE caja ADD COLUMN cerrada_por INTEGER REFERENCES usuario(id_usuario);

-- 2) Índice útil para consultas por quien cerró
CREATE INDEX IF NOT EXISTS ix_caja_cerrada_por ON caja(cerrada_por);

-- 3) Log de acciones de caja
CREATE TABLE IF NOT EXISTS caja_log (
  id_log      INTEGER PRIMARY KEY,
  id_caja     INTEGER NOT NULL REFERENCES caja(id_caja),
  accion      TEXT NOT NULL CHECK (accion IN ('abrir','cerrar')),
  quien       INTEGER NOT NULL REFERENCES usuario(id_usuario),
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle     TEXT
);

CREATE INDEX IF NOT EXISTS ix_caja_log_caja_fecha ON caja_log(id_caja, fecha_hora);
CREATE INDEX IF NOT EXISTS ix_caja_log_quien      ON caja_log(quien);

-- 4) Triggers de auditoría (auto-registro)
-- Log al abrir (INSERT en caja con estado='abierta')
CREATE TRIGGER IF NOT EXISTS trg_caja_log_abrir
AFTER INSERT ON caja
WHEN NEW.estado = 'abierta'
BEGIN
  INSERT INTO caja_log(id_caja, accion, quien, detalle)
  VALUES (NEW.id_caja, 'abrir', NEW.abierta_por,
          'abierta_en=' || COALESCE(NEW.abierta_en, CURRENT_TIMESTAMP));
END;

-- Log al cerrar (UPDATE a 'cerrada')
CREATE TRIGGER IF NOT EXISTS trg_caja_log_cerrar
AFTER UPDATE OF estado, cerrada_en, cerrada_por ON caja
WHEN NEW.estado = 'cerrada' AND OLD.estado <> 'cerrada'
BEGIN
  INSERT INTO caja_log(id_caja, accion, quien, detalle)
  VALUES (NEW.id_caja, 'cerrar', COALESCE(NEW.cerrada_por, NEW.abierta_por),
          'cerrada_en=' || COALESCE(NEW.cerrada_en, CURRENT_TIMESTAMP));
END;
