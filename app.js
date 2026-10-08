/**
 * app.js
 * Configuración de la aplicación Express. NO levanta el servidor
 * (eso lo hace server.js) para poder usarla en tests con supertest.
 */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const env = require('./config/env');
const { montarSwagger } = require('./config/swagger');

const noEncontrado = require('./middlewares/not-found.middleware');
const manejarErrores = require('./middlewares/error.middleware');
const { limitadorGlobal } = require('./middlewares/rate-limit.middleware');

const authRoutes = require('./modulos/auth/auth.routes');
const cursosRoutes = require('./modulos/cursos/cursos.routes');
const inscripcionesRoutes = require('./modulos/inscripciones/inscripciones.routes');
const leccionesRoutes = require('./modulos/lecciones/lecciones.routes');
const tutoresRoutes = require('./modulos/tutores/tutores.routes');
const estudiantesRoutes = require('./modulos/estudiantes/estudiantes.routes');
const {
  rutasAnidadas: evaluacionesAnidadas,
  rutasPropias: evaluacionesPropias,
} = require('./modulos/evaluaciones/evaluaciones.routes');
const progresoRoutes = require('./modulos/progreso/progreso.routes');
const syncRoutes = require('./modulos/sync/sync.routes');
const tutoriasRoutes = require('./modulos/tutorias/tutorias.routes');
const adminRoutes = require('./modulos/admin/admin.routes');

const app = express();

// ---------- Seguridad ----------
// Cabeceras seguras. Se desactiva la CSP porque la UI de Swagger
// (swagger-ui-express) usa scripts/estilos inline y una CSP por defecto la rompe.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
// Detrás de proxy/contenedor: confiar en X-Forwarded-For para contar por IP real.
if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// ---------- Middlewares globales ----------
app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
// Compresión gzip: el proyecto prioriza bajo consumo de datos.
app.use(compression());
// 200kb: un lote sync de 200 ítems de 500 caracteres ronda los 120kb.
app.use(express.json({ limit: '200kb' }));

// Deshabilita cabeceras que filjan información del stack.
app.disable('x-powered-by');

// ---------- Documentación ----------
montarSwagger(app);

// ---------- Rutas de la API ----------
// Límite global por IP para toda la API (desactivado en tests).
app.use('/api', limitadorGlobal);

app.get('/api/salud', (req, res) => {
  res.json({ success: true, data: { estado: 'ok' }, message: 'API EduLite funcionando' });
});

app.use('/api/auth', authRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/cursos', inscripcionesRoutes);
app.use('/api/lecciones', leccionesRoutes);
app.use('/api/lecciones', evaluacionesAnidadas);
app.use('/api/evaluaciones', evaluacionesPropias);
app.use('/api/progreso', progresoRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/tutores', tutoresRoutes);
app.use('/api/tutorias', tutoriasRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/admin', adminRoutes);

// ---------- 404 y manejo de errores (siempre al final) ----------
app.use('/api', noEncontrado);
app.use(manejarErrores);

module.exports = app;
