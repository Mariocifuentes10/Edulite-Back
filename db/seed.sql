-- ============================================================================
-- EduLite — Datos semilla (Sprints 1, 2 y 5)
-- 1 ADMIN + 1 TUTOR + 1 ESTUDIANTE demo, 2 cursos publicados, 4 lecciones
-- por curso y 3 tutorías de ejemplo (Sprint 5).
--
-- Contraseña de los 3 usuarios demo: EduLite123!
-- (bcrypt cost 10 — regenerar hashes con:
--   node -e "console.log(require('bcrypt').hashSync('EduLite123!', 10))" )
--
-- Ejecutar DESPUÉS de db/schema.sql:
--   psql -d edulite -f db/schema.sql
--   psql -d edulite -f db/seed.sql
--
-- Idempotente: re-ejecutar nunca duplica usuarios (ON CONFLICT sobre email),
-- cursos (UNIQUE id_tutor+titulo), lecciones (UNIQUE id_curso+orden) ni
-- tutorías (WHERE NOT EXISTS sobre tema, que es único en el seed).
-- ============================================================================

-- ---------- Usuarios demo ----------
INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, activo) VALUES
  (
    'Admin Demo',
    'admin@edulite.test',
    '$2b$10$gjyf8rfqtutS7nqnGvZ5WOyT6GnZv3CsBDuJR5JPBpOB5xZs.H0Rq',
    'ADMIN',
    NULL,
    TRUE
  ),
  (
    'Tutor Demo',
    'tutor@edulite.test',
    '$2b$10$LNc/qV1hVqda1pY/vDjPHuJP0prsPQ6ovG5.hbxytZbwCJ3jaQUVO',
    'TUTOR',
    '+56 9 1111 1111',
    TRUE
  ),
  (
    'Estudiante Demo',
    'estudiante@edulite.test',
    '$2b$10$sw/yr1c7lC/piRiYocPxXOiX7v1y44ZVteGHybjJHCCHa/fdppGr.',
    'ESTUDIANTE',
    '+56 9 2222 2222',
    TRUE
  )
ON CONFLICT (email) DO NOTHING;

-- ---------- Cursos demo (del tutor demo, publicados) ----------
INSERT INTO cursos (id_tutor, titulo, descripcion, nivel, publicado)
SELECT u.id,
       v.titulo,
       v.descripcion,
       v.nivel,
       TRUE
FROM usuarios u
JOIN (
  VALUES
    (
      'Matemáticas básicas',
      'Curso introductorio de matemáticas con problemas de la vida diaria. Contenido liviano para trabajar con poca conexión.',
      'secundaria'
    ),
    (
      'Lectura y comprensión',
      'Comprensión lectora y redacción de párrafos con textos cortos. Pensado para bajo consumo de datos.',
      'secundaria'
    )
) AS v(titulo, descripcion, nivel) ON TRUE
WHERE u.email = 'tutor@edulite.test'
ON CONFLICT (id_tutor, titulo) DO NOTHING;

-- ---------- Lecciones demo: 4 por curso ----------
INSERT INTO lecciones (id_curso, orden, titulo, contenido)
SELECT c.id, v.orden, v.titulo, v.contenido
FROM cursos c
JOIN (
  VALUES
    -- Lecciones de "Matemáticas básicas"
    (1, 'Números naturales', E'## Números naturales\n\nLos números naturales sirven para contar: 1, 2, 3, 4... Se usan todos los días al contar objetos, personas o pasos.'),
    (2, 'Operaciones básicas', E'## Operaciones básicas\n\nSuma, resta, multiplicación y división. Ejemplo: 12 + 7 = 19; 20 - 6 = 14; 5 x 4 = 20; 18 / 3 = 6.'),
    (3, 'Fracciones', E'## Fracciones\n\nUna fracción representa una parte de un todo: 1/2, 3/4. Si tu mitad de la cosecha se vende, vendiste 1/2.'),
    (4, 'Problemas de la vida diaria', E'## Problemas de la vida diaria\n\n1. En una bolsa hay 8 manzanas y se comen 3. ¿Cuántas quedan? 2. Si cada kilo cuesta $2 y compras 4 kilos, ¿cuánto pagas?')
) AS v(orden, titulo, contenido) ON TRUE
WHERE c.titulo = 'Matemáticas básicas'
  AND c.id_tutor = (SELECT id FROM usuarios WHERE email = 'tutor@edulite.test')
ON CONFLICT (id_curso, orden) DO NOTHING;

INSERT INTO lecciones (id_curso, orden, titulo, contenido)
SELECT c.id, v.orden, v.titulo, v.contenido
FROM cursos c
JOIN (
  VALUES
    -- Lecciones de "Lectura y comprensión"
    (1, 'Comprensión lectora', E'## Comprensión lectora\n\nLeer el texto completo y responder: ¿Quién participa? ¿Dónde ocurre? ¿Qué pasó al final?'),
    (2, 'Vocabulario', E'## Vocabulario\n\nBuscar el significado de palabras nuevas por el contexto. Ejemplo: "la cosecha fue abundante" significa que se recolectó mucho.'),
    (3, 'Textos cortos', E'## Textos cortos\n\nUn texto corto tiene idea principal y detalles. Marca la idea principal con un subrayado.'),
    (4, 'Redacción de párrafos', E'## Redacción de párrafos\n\nUn párrafo = una idea + dos o tres oraciones que la explican. Empieza con una idea clara y termina con un cierre.')
) AS v(orden, titulo, contenido) ON TRUE
WHERE c.titulo = 'Lectura y comprensión'
  AND c.id_tutor = (SELECT id FROM usuarios WHERE email = 'tutor@edulite.test')
ON CONFLICT (id_curso, orden) DO NOTHING;

-- ---------- Tutorías demo (Sprint 5): una por estado operativo ----------
-- Todas con fecha futura (CHECK fecha_futura) y entre los usuarios demo.
-- Idempotente: NOT EXISTS sobre el tema, único en este seed.
INSERT INTO tutorias (id_estudiante, id_tutor, id_curso, fecha, tema, estado)
SELECT e.id,
       t.id,
       c.id,
       v.fecha,
       v.tema,
       v.estado
FROM (
  VALUES
    ('Repaso de fracciones', 'Matemáticas básicas', now() + interval '3 days', 'PENDIENTE'::estado_tutoria),
    ('Preparación de la prueba de lectura', 'Lectura y comprensión', now() + interval '5 days', 'CONFIRMADA'::estado_tutoria),
    ('Dudas con problemas de la vida diaria', 'Matemáticas básicas', now() + interval '7 days', 'REALIZADA'::estado_tutoria)
) AS v(tema, titulo_curso, fecha, estado)
JOIN usuarios e ON e.email = 'estudiante@edulite.test'
JOIN usuarios t ON t.email = 'tutor@edulite.test'
JOIN cursos c ON c.id_tutor = t.id AND c.titulo = v.titulo_curso
WHERE NOT EXISTS (SELECT 1 FROM tutorias WHERE tema = v.tema);
