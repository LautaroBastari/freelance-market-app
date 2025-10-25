PRAGMA foreign_keys = OFF;

ALTER TABLE usuario RENAME COLUMN rol TO rol_tipo;

PRAGMA foreign_keys = ON;
