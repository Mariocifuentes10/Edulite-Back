# EduLite — Guía de Sprints (6 sprints × 1 semana)

Cada sprint indica: objetivo, historias de usuario, tareas de backend, tareas de frontend, tareas de base de datos, criterios de aceptación (Definition of Done) y riesgos a vigilar. Ambos repos (`edulite-backend` y `edulite-frontend`) avanzan en paralelo cada semana. La duración de 1 semana es sugerida: ajústala a tu fecha de entrega.

**Diseño:** las tareas de frontend usan los nombres de componente y comportamientos de `00-arquitectura-y-base-de-datos.md` (secciones 2.1, 4.1 y 4.2: tokens visuales, mapeo de componentes y comportamientos obligatorios). No se rediseña nada por fuera de esos tokens.

**Prioridad:** los Sprints 1 al 4 son el MVP obligatorio (el corazón es el modo offline del Sprint 4). Los Sprints 5 y 6 son de valor agregado y cierre; si el tiempo aprieta, se recorta el Sprint 5 antes que el hardening del Sprint 6.

---

## Sprint 1 — Fundaciones + Autenticación (Login/Register)

**Objetivo:** dejar ambos repos inicializados, conectados entre sí, y con autenticación funcional end-to-end para los 3 roles.

### Historias de usuario
- Como usuario nuevo quiero registrarme como Estudiante o Tutor para poder usar la plataforma.
- Como usuario registrado quiero iniciar sesión y mantener mi sesión activa.
- Como sistema quiero proteger endpoints según el rol del usuario autenticado.

### Backend
1. Inicializar proyecto (`npm init`), instalar `express`, `pg`, `cors`, `dotenv`, `jsonwebtoken`, `bcrypt`, `express-validator`, `swagger-jsdoc`, `swagger-ui-express` y dev: `nodemon`, `jest`, `supertest`.
2. `config/env.js` (valida variables al arrancar) y `config/db.js` (Pool de `pg`).
3. Middlewares globales: `cors`, `express.json`, `error.middleware`, `not-found.middleware`; utilidades `respuesta.js`, `app-error.js`, `async-handler.js`; Swagger en `/api/docs`.
4. Módulo `usuarios`: `crear()`, `buscarPorEmail()`, `buscarPorId()` (nunca devolver `password_hash`).
5. Módulo `auth`:
   - `POST /api/auth/register` → valida (`nombre`, `email`, `password` mínimo 8, `rol` solo ESTUDIANTE o TUTOR, `telefono?`), hashea con `bcrypt`, crea usuario, retorna JWT.
   - `POST /api/auth/login` → valida credenciales, retorna `{ accessToken, usuario: { id, nombre, email, rol } }`.
   - `GET /api/auth/me` → protegido con `authMiddleware`.
   - `authMiddleware` (verifica JWT, adjunta `req.user`) y `permitirRoles(...)`.
6. Manejo de errores: email duplicado (409), credenciales inválidas (401), usuario inactivo (403).

### Frontend
1. Inicializar Angular standalone (`ng new edulite-frontend --standalone --routing`), definir los **tokens de diseño oficiales** en `styles.css` (sección 2.1).
2. `app.config.ts`: `provideHttpClient(withInterceptors([authInterceptor]))`, `provideRouter(routes)`.
3. `AuthService` (`BehaviorSubject<Usuario | null>` para `currentUser`, métodos `login()`, `register()`, `logout()`, `cargarSesion()`, guarda el token en `localStorage`).
4. `auth.interceptor.ts`: agrega `Authorization: Bearer <token>`.
5. `auth.guard.ts` y `role.guard.ts` (reemplazan cualquier selector manual de vista, ver 2.2).
6. `LoginComponent` y `RegisterComponent` (formularios reactivos, errores inline, selección de rol Estudiante/Tutor).
7. Redirección post-login: Estudiante → `/estudiante/cursos`, Tutor → `/tutor/mis-cursos`, Admin → `/admin`.

### Base de datos
- Crear la base `edulite` y ejecutar `db/schema.sql` completo (sección 5.2).
- `db/seed.sql` con 1 admin, 1 tutor demo, 1 estudiante demo.

### Definition of Done
- Un usuario puede registrarse como Estudiante o Tutor, cerrar sesión y volver a iniciar sesión.
- Un endpoint protegido rechaza peticiones sin token (401) y con rol incorrecto (403).
- Swagger documenta `auth`.
- Existe un test de `auth.service` (registro, email duplicado, login inválido).

### Riesgos
- No usar `bcrypt` con costo bajo (mínimo 10 rounds).
- Nunca permitir que el registro público cree usuarios ADMIN.
- No subir `.env` al repositorio (revisar `.gitignore`).

---

## Sprint 2 — Cursos, Lecciones e Inscripciones

**Objetivo:** que un Tutor pueda crear cursos y lecciones, y que un Estudiante pueda explorarlos e inscribirse.

### Historias de usuario
- Como Tutor quiero crear y editar mis cursos y lecciones.
- Como Estudiante quiero ver los cursos publicados e inscribirme.
- Como Estudiante quiero leer las lecciones de un curso en orden.

### Backend
1. Módulo `cursos`:
   - `GET /api/cursos` (público, solo `publicado = true`, con paginación y filtro `?nivel=&q=`).
   - `GET /api/cursos/:id` (detalle con lista de lecciones sin el contenido completo).
   - `POST/PATCH/DELETE /api/cursos` (rol TUTOR, solo sobre sus propios cursos; 403 si no es dueño).
   - `GET /api/tutores/me/cursos` (todos los cursos del tutor, publicados o no).
2. Módulo `lecciones`:
   - `GET /api/cursos/:id/lecciones` (contenido completo, solo estudiantes inscritos, el tutor dueño o admin).
   - `GET /api/lecciones/:id`.
   - `POST/PATCH/DELETE /api/cursos/:id/lecciones` (TUTOR dueño; validar que `orden` no se repita).
3. Inscripciones: `POST /api/cursos/:id/inscribirse` (ESTUDIANTE, idempotente con `ON CONFLICT DO NOTHING`), `GET /api/estudiantes/me/cursos`.
4. Verificación de pertenencia reutilizable (curso pertenece al tutor autenticado) como middleware o función de servicio.

### Frontend
1. `EstudianteShellComponent` y `TutorShellComponent` con navegación por rol y `IndicadorConexionComponent` (su lógica completa llega en el Sprint 4, aquí solo la estructura).
2. Estudiante: `ListaCursosComponent` + `CursoCardComponent`, `DetalleCursoComponent` (botón Inscribirme), `LeccionComponent` (lectura del contenido).
3. Tutor: `MisCursosPageComponent` + `CursoFormComponent`, `LeccionesPageComponent` + `LeccionFormComponent`.
4. Servicios `CursosService` y `LeccionesService` (HttpClient + `BehaviorSubject` para los listados).
5. Estados de carga y estado vacío en todos los listados.

### Base de datos
- Usar `cursos`, `lecciones` e `inscripciones` (ya creadas). Seed con 2 cursos demo y 4 lecciones cada uno.

### Definition of Done
- Un Tutor crea un curso con lecciones y lo publica; el Estudiante lo ve en el catálogo, se inscribe y lee las lecciones.
- Un tutor no puede editar el curso de otro (403, con test).
- Las lecciones no son accesibles sin inscripción (403).

### Riesgos
- Mantener el contenido de las lecciones **liviano** (texto/Markdown simple); es la base del bajo consumo de datos.
- El endpoint de detalle de curso no debe devolver el contenido de todas las lecciones (respuestas grandes).

---

## Sprint 3 — Evaluaciones y Progreso

**Objetivo:** que el Estudiante complete lecciones, responda evaluaciones y vea su avance; que el Tutor cree las preguntas.

### Historias de usuario
- Como Tutor quiero crear preguntas de opción múltiple para mis lecciones.
- Como Estudiante quiero responder una evaluación y saber si acerté.
- Como Estudiante quiero marcar lecciones como completadas y ver mi porcentaje de avance.

### Backend
1. Módulo `evaluaciones`:
   - `POST/PATCH/DELETE /api/lecciones/:id/evaluaciones` (TUTOR dueño). `opciones` mínimo 2, `respuesta_correcta` debe estar dentro de `opciones`.
   - `GET /api/lecciones/:id/evaluaciones` (estudiantes inscritos): devuelve `id, pregunta, opciones` **sin** `respuesta_correcta`.
   - `POST /api/evaluaciones/:id/responder` (ESTUDIANTE): recibe `{ idCliente, respuesta }`, califica en el servidor, guarda en `resultados` con `ON CONFLICT (id_cliente) DO NOTHING`, responde `{ correcta }`.
2. Módulo `progreso`:
   - `POST /api/progreso` → `{ idLeccion, completada }` con `INSERT ... ON CONFLICT (id_usuario, id_leccion) DO UPDATE` (idempotente).
   - `GET /api/estudiantes/me/progreso?cursoId=` → lecciones completadas y porcentaje por curso (agregación SQL).
3. `GET /api/estudiantes/me/estadisticas` (sección 5.4).

### Frontend
1. Tutor: `EvaluacionesPageComponent` + `PreguntaFormComponent` (2 a 4 opciones, selección de la correcta).
2. Estudiante: `EvaluacionComponent` (una pregunta por pantalla, resultado al final), botón "Marcar como completada" en `LeccionComponent`.
3. `ProgresoService` con `BehaviorSubject` para el avance por curso.
4. `PorcentajeAvancePipe` y `BarraProgresoComponent` usados en `CursoCardComponent` y `MiProgresoComponent`.
5. `MiProgresoComponent` conectado a `GET /api/estudiantes/me/estadisticas`.

### Base de datos
- Usar `evaluaciones`, `progreso` y `resultados` (ya creadas). Índices `idx_progreso_usuario` e `idx_resultados_usuario`.

### Definition of Done
- Un estudiante completa una lección y su porcentaje de avance se actualiza al instante.
- Responder dos veces con el mismo `idCliente` no crea dos resultados (con test).
- El endpoint de evaluaciones nunca expone `respuesta_correcta` (con test).

### Riesgos
- Definir el porcentaje de avance en un solo lugar (SQL o servicio) para que back y front muestren el mismo número.
- Diseñar `idCliente` (UUID v4 generado en el navegador) **ahora**; el Sprint 4 depende de él.

---

## Sprint 4 — Modo Offline y Sincronización

**Objetivo:** el corazón del proyecto. Que un estudiante descargue un curso, estudie sin internet y sincronice al reconectarse, sin perder ni duplicar datos.

### Historias de usuario
- Como Estudiante quiero descargar un curso con buena conexión para estudiarlo sin internet.
- Como Estudiante quiero marcar lecciones y responder evaluaciones sin conexión y que se guarden.
- Como Estudiante quiero que mi progreso se sincronice solo al volver la conexión.

### Backend
1. `POST /api/sync` (ESTUDIANTE): recibe `{ items: [...] }` (tipos `PROGRESO` y `RESPUESTA`, ver sección 5.5), procesa cada ítem de forma idempotente y responde `{ aceptados, rechazados }`. Un ítem inválido no debe tumbar el lote completo.
2. Calificación en servidor de las `RESPUESTA` recibidas (con `respondida_en` del cliente).
3. Compresión de respuestas con `compression` y `Cache-Control` adecuado en los `GET` de cursos/lecciones.
4. Límite razonable de ítems por lote (ej. 200).
5. Tests: reenviar el mismo lote dos veces no genera duplicados; un lote con un ítem inválido acepta los demás.

### Frontend
1. Agregar PWA: `ng add @angular/pwa`. Configurar `ngsw-config.json`:
   - `assetGroups`: app shell (prefetch).
   - `dataGroups`: `/api/cursos/**` y `/api/lecciones/**` con estrategia `freshness` con `timeout` corto o `performance`, `maxAge` largo.
2. `ConexionService` (`online$` con los eventos `online`/`offline`) y `IndicadorConexionComponent` completo (barra "Sin conexión").
3. `ColaSyncService`: cola en **localStorage** (`edulite_cola`), métodos `encolar()`, `pendientes$`, `sincronizar()`. Sincroniza en el evento `online` y al iniciar la app. Elimina de la cola solo lo confirmado.
4. `ProgresoService` y `EvaluacionComponent` usan la cola cuando no hay conexión o la petición falla.
5. `DescargaService` + botón **Descargar curso** (pide todas las lecciones del curso para que el Service Worker las guarde, con barra de avance) y `DescargasComponent`.
6. Badges "Descargado" y "Pendiente de sincronizar (N)" con `BadgeEstadoComponent`.
7. Mensaje claro al abrir contenido no descargado sin conexión.

### Base de datos
- Verificar la restricción `UNIQUE` de `resultados.id_cliente` y la PK de `progreso`. Sin cambios de esquema si se respetó la sección 5.2.

### Definition of Done
- Con el navegador en modo "Offline" (DevTools), un curso descargado se abre, se marcan lecciones y se responde una evaluación.
- Al volver la conexión, la cola se sincroniza sola y el badge "Pendiente" desaparece.
- Sincronizar dos veces la misma cola no duplica registros.
- Build de producción probado con un servidor estático (`npx http-server -p 8080 -c-1 dist/edulite-frontend/browser`), porque el Service Worker **solo funciona en producción**.

### Riesgos
- **Este es el sprint de mayor riesgo técnico.** Probar siempre con la build de producción, no con `ng serve`.
- Al actualizar la app, el Service Worker puede servir una versión vieja: definir cómo se avisa de la actualización (`SwUpdate`).
- localStorage es síncrono y limitado (~5 MB): guardar solo la cola (texto), nunca las lecciones.
- No guardar el token JWT en la cola; se toma al momento de sincronizar. Manejar token vencido (401) sin borrar la cola.

---

## Sprint 5 — Tutorías y Panel del Tutor

**Objetivo:** conectar a estudiantes con tutores y darle al tutor visibilidad del avance.

### Historias de usuario
- Como Estudiante quiero solicitar una tutoría a un tutor de mi curso.
- Como Tutor quiero confirmar, cancelar o marcar como realizadas mis tutorías.
- Como Tutor quiero ver el avance de mis estudiantes.

### Backend
1. Módulo `tutorias`:
   - `POST /api/tutorias` (ESTUDIANTE): `{ idTutor, idCurso?, fecha, tema }`, solo con tutores de cursos en los que está inscrito; la fecha debe ser futura.
   - `GET /api/tutorias` (ESTUDIANTE ve las suyas, TUTOR ve las que le piden), filtro `?estado=`.
   - `PATCH /api/tutorias/:id/estado` (TUTOR dueño: PENDIENTE → CONFIRMADA / CANCELADA → REALIZADA; el estudiante solo puede cancelar). Validar transiciones permitidas (409 si no).
2. `GET /api/tutores/me/estudiantes` → estudiante, curso, % avance, último acceso (agregación sobre `inscripciones` y `progreso`).
3. `GET /api/tutores/me/estadisticas` (sección 5.4).

### Frontend
1. Estudiante: `MisTutoriasComponent` + `SolicitarTutoriaComponent` (formulario con curso, fecha y tema).
2. Tutor: `TutoriasTutorComponent` (acciones por estado), `AvanceEstudiantesComponent` (tabla con estado vacío).
3. Panel inicial del tutor con `GET /api/tutores/me/estadisticas`.
4. `BadgeEstadoComponent` con los colores de tutoría (sección 2.1).

### Base de datos
- Usar `tutorias` con sus índices. Seed con 3 tutorías de ejemplo.

### Definition of Done
- Un estudiante solicita una tutoría y el tutor la confirma; el estado se refleja en ambos lados.
- Una transición inválida (ej. REALIZADA → PENDIENTE) es rechazada.
- El tutor solo ve el avance de estudiantes inscritos en **sus** cursos.

### Riesgos
- Las tutorías necesitan conexión: mostrar un mensaje claro si el estudiante intenta solicitar una estando offline (no encolarlas, para no complicar el alcance).

---

## Sprint 6 — Panel Admin, Hardening, QA y Despliegue

**Objetivo:** cerrar el MVP con panel administrativo, seguridad, pruebas y despliegue.

### Historias de usuario
- Como Admin quiero ver estadísticas globales y gestionar usuarios.
- Como equipo queremos entregar una app segura, probada y desplegable.

### Backend
1. Módulo `admin`: `GET /api/admin/usuarios` (listar/filtrar por rol, suspender o activar con `PATCH activo`), `GET /api/admin/estadisticas` (sección 5.4).
2. Seguridad: `helmet`, `express-rate-limit` (ej. 100 req/min por IP en rutas públicas, más estricto en `/auth/login`), CORS restringido a `CORS_ORIGIN`, revisión de que ningún endpoint sensible quede sin `authMiddleware` / `permitirRoles`.
3. Tests: unit tests de `auth.service`, `progreso`/`sync` y al menos 1 e2e con Supertest (registro → login → inscribirse → sync).
4. `Dockerfile` y `docker-compose.yml` (API + PostgreSQL con `schema.sql` cargado al iniciar).
5. Swagger completo. Opcional: workflow de GitHub Actions que corra `npm ci` + `npm test`.

### Frontend
1. `AdminDashboardComponent`: tabla de usuarios con suspender/activar y estadísticas globales (números clave; una gráfica simple en SVG, sin librerías pesadas).
2. Pulido: estados de carga y error consistentes (`LoadingSpinnerComponent` y un patrón único de manejo de errores HTTP), estados vacíos en todos los listados, accesibilidad básica (labels, contraste, foco).
3. `environment.prod.ts` apuntando al backend desplegado; revisar el peso de la build (`ng build` sin advertencias de budget).
4. Pruebas E2E (Playwright o Cypress) de: registro/login, inscribirse y descargar, marcar progreso offline y sincronizar.
5. Opcional: workflow de GitHub Actions que corra `npm ci` + `npm run build -- --configuration production`.

### Base de datos
- Revisión de índices con `EXPLAIN` de las consultas más usadas (catálogo de cursos, progreso por curso, sync).
- Script de datos demo para la presentación final.

### Definition of Done
- MVP completo, sin endpoints desprotegidos, con rate limiting activo.
- Suite de tests pasando, con instrucciones documentadas de cómo correrlos.
- `docker-compose up` levanta API + PostgreSQL de un solo comando.
- README de ambos repos actualizados y demo lista.

### Riesgos
- No dejar el hardening para "el final del final": si el tiempo aprieta, priorizar guards de roles + rate limiting sobre las gráficas del admin.
- Verificar que el Service Worker no interfiera con el despliegue (versión vieja en caché tras publicar).
