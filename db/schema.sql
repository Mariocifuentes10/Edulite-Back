-- ============================================================================
-- EduLite — Esquema de base de datos (Sprint 1)
-- Base de datos: edulite | PostgreSQL 14+
--
-- ⚠️ NOTA: esquema RECONSTRUIDO a partir de las restricciones explícitas de
-- docs/01-guia-de-sprints.md (tablas, PK, UNIQUE, índices y reglas de idempotencia).
-- Pendiente de validación contra docs/00-arquitectura-y-base-de-datos.md sección 5.2
-- cuando el documento esté disponible. Si hay diferencias, manda la sección 5.2.
--
-- Convenciones del proyecto:
--   • Tablas y columnas en español, snake_case.
--   • Fechas en UTC (TIMESTAMPTZ).
--   • Nunca exponer password_hash ni respuesta_correcta al cliente.
-- ============================================================================

-- ---------- Tipos enumerados ----------

CREATE TYPE rol_usuario AS ENUM ('ESTUDIANTE', 'TUTOR', 'ADMIN');

CREATE TYPE estado_tutoria AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REALIZADA');

-- ============================================================================
-- usuarios — cuentas de la plataforma (Sprint 1)
-- ============================================================================
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120)  NOT NULL,
  email         VARCHAR(160)  NOT NULL UNIQUE,
  password_hash VARCHAR(100)  NOT NULL,          -- bcrypt; NUNCA salir en JSON
  rol           rol_usuario    NOT NULL,
  telefono      VARCHAR(30),
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,  -- FALSE = suspendido (admin, Sprint 6)
  creado_en     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Cuentas de usuarios. password_hash jamás se devuelve al cliente.';

-- ============================================================================
-- cursos — creado por un TUTOR (Sprint 2)
-- ============================================================================
CREATE TABLE cursos (
  id          SERIAL PRIMARY KEY,
  id_tutor    INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo      VARCHAR(160) NOT NULL,
  descripcion TEXT,
  nivel       VARCHAR(40),                      -- ej: 'inicial', 'secundaria', 'universitario'
  publicado   BOOLEAN      NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_tutor, titulo)                     -- un tutor no repite título (seed idempotente)
);

CREATE INDEX idx_cursos_tutor ON cursos(id_tutor);
CREATE INDEX idx_cursos_publicado ON cursos(publicado) WHERE publicado = TRUE;

COMMENT ON COLUMN cursos.publicado IS 'El catálogo público solo lista cursos con publicado = TRUE.';

-- ============================================================================
-- lecciones — contenido de un curso, en orden (Sprint 2)
-- Contenido liviano (texto/Markdown simple): base del bajo consumo de datos.
-- ============================================================================
CREATE TABLE lecciones (
  id          SERIAL PRIMARY KEY,
  id_curso    INTEGER      NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  orden       INTEGER      NOT NULL CHECK (orden >= 1),
  titulo      VARCHAR(160) NOT NULL,
  contenido   TEXT         NOT NULL DEFAULT '',
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id_curso, orden)                      -- el orden no se repite dentro del curso
);

CREATE INDEX idx_lecciones_curso ON lecciones(id_curso);

-- ============================================================================
-- inscripciones — estudiante a un curso (Sprint 2)
-- UNIQUE(id_curso, id_estudiante) permite ON CONFLICT DO NOTHING (idempotente).
-- ============================================================================
CREATE TABLE inscripciones (
  id            SERIAL PRIMARY KEY,
  id_curso      INTEGER     NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  id_estudiante INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_curso, id_estudiante)
);

CREATE INDEX idx_inscripciones_estudiante ON inscripciones(id_estudiante);

-- ============================================================================
-- evaluaciones — pregunta de opción múltiple de una lección (Sprint 3)
-- ============================================================================
CREATE TABLE evaluaciones (
  id                 SERIAL PRIMARY KEY,
  id_leccion         INTEGER     NOT NULL REFERENCES lecciones(id) ON DELETE CASCADE,
  pregunta           VARCHAR(500) NOT NULL,
  opciones           JSONB       NOT NULL,      -- array de 2 a 4 textos
  respuesta_correcta VARCHAR(500) NOT NULL,      -- NUNCA salir en JSON al estudiante
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT opciones_minimas CHECK (jsonb_array_length(opciones) >= 2),
  CONSTRAINT opciones_maximas CHECK (jsonb_array_length(opciones) <= 4)
);

CREATE INDEX idx_evaluaciones_leccion ON evaluaciones(id_leccion);

COMMENT ON COLUMN evaluaciones.respuesta_correcta IS 'Prohibido en respuestas al cliente (regla del proyecto).';

-- ============================================================================
-- resultados — respuesta de un estudiante a una evaluación (Sprint 3 / offline S4)
-- id_cliente (UUID generado en el navegador) es UNIQUE: garantiza idempotencia
-- al sincronizar el modo offline (ON CONFLICT (id_cliente) DO NOTHING).
-- ============================================================================
CREATE TABLE resultados (
  id             SERIAL PRIMARY KEY,
  id_evaluacion  INTEGER     NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  id_usuario     INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_cliente     UUID        NOT NULL UNIQUE,   -- UUID v4 generado en el cliente
  respuesta      VARCHAR(500) NOT NULL,
  correcta       BOOLEAN     NOT NULL,
  respondida_en  TIMESTAMPTZ NOT NULL,          -- fecha generada por el cliente (se valida)
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resultados_usuario ON resultados(id_usuario);
CREATE INDEX idx_resultados_evaluacion ON resultados(id_evaluacion);

COMMENT ON COLUMN resultados.id_cliente IS 'UUID v4 del cliente; UNIQUE para que la sync sea idempotente.';

-- ============================================================================
-- progreso — lección completada por estudiante (Sprint 3 / offline S4)
-- PK(id_usuario, id_leccion): reenviar el mismo dato nunca duplica filas
-- (INSERT ... ON CONFLICT (id_usuario, id_leccion) DO UPDATE).
-- ============================================================================
CREATE TABLE progreso (
  id_usuario     INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_leccion     INTEGER     NOT NULL REFERENCES lecciones(id) ON DELETE CASCADE,
  completada     BOOLEAN     NOT NULL DEFAULT TRUE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_usuario, id_leccion)
);

CREATE INDEX idx_progreso_usuario ON progreso(id_usuario);

-- ============================================================================
-- tutorias — solicitud de tutoría estudiante → tutor (Sprint 5)
-- ============================================================================
CREATE TABLE tutorias (
  id            SERIAL PRIMARY KEY,
  id_estudiante INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_tutor      INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  id_curso      INTEGER      REFERENCES cursos(id) ON DELETE SET NULL,
  fecha         TIMESTAMPTZ  NOT NULL,          -- debe ser futura al crearla
  tema          VARCHAR(300) NOT NULL,
  estado        estado_tutoria NOT NULL DEFAULT 'PENDIENTE',
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT fecha_futura CHECK (fecha > creado_en)
);

CREATE INDEX idx_tutorias_tutor ON tutorias(id_tutor, estado);
CREATE INDEX idx_tutorias_estudiante ON tutorias(id_estudiante, estado);

COMMENT ON TABLE tutorias IS 'Sprint 5. Transiciones de estado válidas se validan en la aplicación.';
