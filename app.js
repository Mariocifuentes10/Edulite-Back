/**
 * app.js
 * Configuración de la aplicación Express. NO levanta el servidor
 * (eso lo hace server.js) para poder usarla en tests con supertest.
 */
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const env = require('./config/env');
const { montarSwagger } = require('./config/swagger');

const noEncontrado = require('./middlewares/not-found.middleware');
const manejarErrores = require('./middlewares/error.middleware');

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

const app = express();

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
app.use('/api/estudiantes', estudiantesRoutes);

// ---------- 404 y manejo de errores (siempre al final) ----------
app.use('/api', noEncontrado);
app.use(manejarErrores);

module.exports = app;
