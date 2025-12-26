INSERT OR IGNORE INTO usuario (
  id_usuario,
  nombre,
  nombre_usuario,
  rol_tipo,
  clave_hash,
  activo
) VALUES
(
  1,
  'Thiago',
  'tsk',
  'admin',
  '$argon2id$v=19$m=19456,t=2,p=1$zoSQE0VDZT3Mhd1LGAbRkw$0sOeaRcLqzV40A3m4EBgtklhfkmSHFofguEjSUa12pY',
  1
),
(
  2,
  'Lucia Levatti',
  'lucia',
  'operador',
  '$argon2id$v=19$m=19456,t=2,p=1$dy1HgZkxsGLWcL8JUBnrlA$2rlPjwCKcNYPaZ7MA3j1+No/sgFvzTydWKmTXCdKLO0',
  1
),
(
  3,
  'Thiago Ortelli',
  'thiago',
  'operador',
  '$argon2id$v=19$m=19456,t=2,p=1$zoSQE0VDZT3Mhd1LGAbRkw$0sOeaRcLqzV40A3m4EBgtklhfkmSHFofguEjSUa12pY',
  1
);