# EduLite Backend

Proyecto Node.js + Express + PostgreSQL (driver pg, sin ORM) + JWT. API REST de una plataforma
educativa offline y de bajo consumo de datos para zonas rurales y de bajos recursos.

## Reglas fijas del proyecto
- Cada módulo de negocio sigue: routes -> validators (express-validator) -> controller -> service.
- Nunca lógica de negocio ni SQL en el controller. El SQL vive en el service.
- Todo SQL con parámetros ($1, $2). Jamás concatenar strings en una consulta.
- Todas las rutas bajo el prefijo /api.
- Roles: ESTUDIANTE, TUTOR, ADMIN vía authMiddleware + permitirRoles().
- Respuestas envueltas: { success, data, message } (utils/respuesta.js).
- Errores uniformes vía error.middleware.js y la clase AppError.
- Nunca devolver password_hash ni respuesta_correcta al cliente.
- El registro público solo permite los roles ESTUDIANTE y TUTOR, nunca ADMIN.
- Endpoints que reciben datos del modo offline (progreso, resultados, sync) DEBEN ser
  idempotentes: INSERT ... ON CONFLICT. Reenviar el mismo dato nunca duplica registros.
- Nombres de tablas y columnas en español, snake_case, como en db/schema.sql:
  usuarios, cursos, inscripciones, lecciones, evaluaciones, progreso, resultados, tutorias.
- Fechas en UTC en la base de datos.
- Listados paginados (?pagina=&limite=) y respuestas livianas (bajo consumo de datos).
- Documentar cada endpoint nuevo con Swagger (swagger-jsdoc).
- No agregar dependencias sin avisar y justificarlo.
- Código y comentarios en español. Entregar archivos completos, no fragmentos.

## Referencias
Arquitectura y modelo de datos: docs/00-arquitectura-y-base-de-datos.md
Plan de sprints: docs/01-guia-de-sprints.md

## Convención de commits
Conventional Commits (feat/fix/docs/chore/test) + scope del módulo. Ej: feat(sync): ...
