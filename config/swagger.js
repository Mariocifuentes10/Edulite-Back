/**
 * config/swagger.js
 * Documentación OpenAPI generada con swagger-jsdoc a partir de los
 * bloques @swagger de cada archivo *.routes.js.
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const opciones = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EduLite API',
      version: '1.0.0',
      description:
        'API REST de EduLite: plataforma educativa offline y de bajo consumo de datos. ' +
        'Todas las respuestas usan el envelope { success, data, message }; los errores ' +
        'usan { success:false, message, errors? }.',
    },
    servers: [
      {
        url: '/api',
        description: 'API local',
      },
    ],
    tags: [
      { name: 'Autenticación', description: 'Registro, login y sesión' },
      { name: 'Cursos', description: 'Catálogo y gestión de cursos' },
      { name: 'Lecciones', description: 'Contenido de los cursos' },
      { name: 'Inscripciones', description: 'Inscripción de estudiantes a cursos' },
      { name: 'Evaluaciones', description: 'Preguntas de opción múltiple' },
      { name: 'Progreso', description: 'Avance del estudiante' },
      { name: 'Sync', description: 'Sincronización idempotente del modo offline' },
      { name: 'Tutores', description: 'Panel y estadísticas del tutor' },
      { name: 'Tutorias', description: 'Solicitudes de tutoría y sus estados' },
      { name: 'Admin', description: 'Panel de administración (solo rol ADMIN)' },
    ],
    paths: {
      '/salud': {
        get: {
          tags: ['Autenticación'],
          summary: 'Comprueba que la API está operativa',
          security: [],
          responses: {
            '200': {
              description: 'API funcionando',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: { estado: { type: 'string', example: 'ok' } },
                      },
                      message: { type: 'string', example: 'API EduLite funcionando' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT devuelto por POST /auth/login',
        },
      },
      schemas: {
        Usuario: {
          type: 'object',
          description: 'Datos públicos del usuario (nunca incluye password_hash)',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Estudiante Demo' },
            email: { type: 'string', format: 'email', example: 'estudiante@edulite.test' },
            rol: { type: 'string', enum: ['ESTUDIANTE', 'TUTOR', 'ADMIN'], example: 'ESTUDIANTE' },
            telefono: { type: 'string', nullable: true, example: '+56 9 2222 2222' },
            activo: { type: 'boolean', example: true },
          },
        },
        RespuestaAuth: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Inicio de sesión exitoso' },
            data: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  description: 'JWT firmado (payload: sub=id, rol)',
                  example: 'eyJhbGciOiJIUzI1NiJ9...',
                },
                usuario: { $ref: '#/components/schemas/Usuario' },
              },
            },
          },
        },
        Curso: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            id_tutor: { type: 'integer', example: 3 },
            titulo: { type: 'string', maxLength: 160, example: 'Matemáticas básicas' },
            descripcion: { type: 'string', nullable: true, example: 'Curso introductorio...' },
            nivel: { type: 'string', nullable: true, example: 'secundaria' },
            publicado: { type: 'boolean', example: true },
            nombre_tutor: { type: 'string', example: 'Tutor Demo' },
            total_lecciones: { type: 'integer', example: 4 },
            creado_en: { type: 'string', format: 'date-time' },
            actualizado_en: { type: 'string', format: 'date-time' },
          },
        },
        LeccionResumen: {
          type: 'object',
          description: 'Versión liviana de lección: NUNCA incluye contenido',
          properties: {
            id: { type: 'integer', example: 1 },
            id_curso: { type: 'integer', example: 1 },
            orden: { type: 'integer', example: 1 },
            titulo: { type: 'string', example: 'Números naturales' },
          },
        },
        Leccion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            id_curso: { type: 'integer', example: 1 },
            orden: { type: 'integer', example: 1 },
            titulo: { type: 'string', example: 'Números naturales' },
            contenido: {
              type: 'string',
              example: '## Números naturales\nEl conjunto de los números naturales...',
            },
            creado_en: { type: 'string', format: 'date-time' },
          },
        },
        EvaluacionEstudiante: {
          type: 'object',
          description:
            'Pregunta para el estudiante. NUNCA incluye respuesta_correcta',
          properties: {
            id: { type: 'integer', example: 1 },
            id_leccion: { type: 'integer', example: 1 },
            pregunta: { type: 'string', maxLength: 500, example: '¿Cuánto es 12 + 7?' },
            opciones: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
              example: ['19', '15', '21', '24'],
            },
            creado_en: { type: 'string', format: 'date-time' },
          },
        },
        Evaluacion: {
          type: 'object',
          description:
            'Pregunta gestionada por el tutor. La respuesta correcta jamás se devuelve al cliente',
          properties: {
            id: { type: 'integer', example: 1 },
            id_leccion: { type: 'integer', example: 1 },
            pregunta: { type: 'string', maxLength: 500, example: '¿Cuánto es 12 + 7?' },
            opciones: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: { type: 'string' },
              example: ['19', '15', '21', '24'],
            },
            creado_en: { type: 'string', format: 'date-time' },
          },
        },
        Progreso: {
          type: 'object',
          description: 'Lección completada por el estudiante (idempotente por PK compuesta)',
          properties: {
            id_usuario: { type: 'integer', example: 3 },
            id_leccion: { type: 'integer', example: 1 },
            completada: { type: 'boolean', example: true },
            actualizado_en: { type: 'string', format: 'date-time' },
          },
        },
        CursoResumen: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            titulo: { type: 'string', example: 'Matemáticas básicas' },
          },
        },
        LeccionProgreso: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            orden: { type: 'integer', example: 1 },
            titulo: { type: 'string', example: 'Números naturales' },
            completada: { type: 'boolean', example: true },
          },
        },
        Avance: {
          type: 'object',
          description: 'Porcentaje calculado con agregación SQL (0-100, entero redondeado)',
          properties: {
            leccionesCompletadas: { type: 'integer', example: 3 },
            leccionesTotales: { type: 'integer', example: 4 },
            porcentaje: { type: 'integer', minimum: 0, maximum: 100, example: 75 },
          },
        },
        EstadisticasEstudiante: {
          type: 'object',
          properties: {
            progreso: { $ref: '#/components/schemas/Avance' },
            porCurso: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 1 },
                  titulo: { type: 'string', example: 'Matemáticas básicas' },
                  leccionesCompletadas: { type: 'integer', example: 3 },
                  leccionesTotales: { type: 'integer', example: 4 },
                  porcentaje: { type: 'integer', minimum: 0, maximum: 100, example: 75 },
                },
              },
            },
            evaluaciones: {
              type: 'object',
              properties: {
                respondidas: { type: 'integer', example: 10 },
                correctas: { type: 'integer', example: 8 },
                precision: { type: 'integer', minimum: 0, maximum: 100, example: 80 },
              },
            },
            rachaDias: { type: 'integer', minimum: 0, example: 3 },
          },
        },
        Tutoria: {
          type: 'object',
          description:
            'Solicitud de tutoría. Estados: PENDIENTE → CONFIRMADA/REALIZADA/CANCELADA ' +
            'según la tabla de transiciones del módulo (409 si no está permitida).',
          properties: {
            id: { type: 'integer', example: 1 },
            id_estudiante: { type: 'integer', example: 5 },
            id_tutor: { type: 'integer', example: 3 },
            id_curso: { type: 'integer', nullable: true, example: 1 },
            fecha: { type: 'string', format: 'date-time', example: '2026-12-01T15:00:00Z' },
            tema: { type: 'string', maxLength: 300, example: 'Repaso de fracciones' },
            estado: {
              type: 'string',
              enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'REALIZADA'],
              example: 'PENDIENTE',
            },
            creado_en: { type: 'string', format: 'date-time' },
            nombre_estudiante: { type: 'string', example: 'Estudiante Demo' },
            nombre_tutor: { type: 'string', example: 'Tutor Demo' },
            curso: { type: 'string', nullable: true, example: 'Matemáticas básicas' },
          },
        },
        EstudianteAvance: {
          type: 'object',
          description:
            'Fila par estudiante-curso del panel del tutor. porcentaje calculado ' +
            'con agregación SQL; ultimoAcceso = última actividad en progreso (null si no hubo).',
          properties: {
            idEstudiante: { type: 'integer', example: 5 },
            nombre: { type: 'string', example: 'Estudiante Demo' },
            email: { type: 'string', format: 'email', example: 'estudiante@edulite.test' },
            idCurso: { type: 'integer', example: 1 },
            curso: { type: 'string', example: 'Matemáticas básicas' },
            leccionesCompletadas: { type: 'integer', example: 3 },
            leccionesTotales: { type: 'integer', example: 4 },
            porcentaje: { type: 'integer', minimum: 0, maximum: 100, example: 75 },
            ultimoAcceso: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        EstadisticasTutor: {
          type: 'object',
          description: 'Sección 5.4 agregada sobre los cursos y estudiantes del tutor',
          properties: {
            progreso: { $ref: '#/components/schemas/Avance' },
            porCurso: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 1 },
                  titulo: { type: 'string', example: 'Matemáticas básicas' },
                  estudiantes: { type: 'integer', example: 12 },
                  leccionesCompletadas: { type: 'integer', example: 30 },
                  leccionesTotales: { type: 'integer', example: 48 },
                  porcentaje: { type: 'integer', minimum: 0, maximum: 100, example: 63 },
                },
              },
            },
            evaluaciones: {
              type: 'object',
              properties: {
                respondidas: { type: 'integer', example: 40 },
                correctas: { type: 'integer', example: 32 },
                precision: { type: 'integer', minimum: 0, maximum: 100, example: 80 },
              },
            },
            tutorias: {
              type: 'object',
              properties: {
                pendientes: { type: 'integer', example: 2 },
                confirmadas: { type: 'integer', example: 1 },
                realizadas: { type: 'integer', example: 5 },
                canceladas: { type: 'integer', example: 1 },
              },
            },
          },
        },
        PaginaCursos: {
          type: 'object',
          properties: {
            cursos: { type: 'array', items: { $ref: '#/components/schemas/Curso' } },
            pagina: { type: 'integer', example: 1 },
            limite: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 2 },
            totalPaginas: { type: 'integer', example: 1 },
          },
        },
        PaginaUsuarios: {
          type: 'object',
          description: 'Listado paginado de usuarios (sin password_hash)',
          properties: {
            usuarios: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } },
            pagina: { type: 'integer', example: 1 },
            limite: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 12 },
            totalPaginas: { type: 'integer', example: 1 },
          },
        },
        EstadisticasAdmin: {
          type: 'object',
          description: 'Métricas globales del panel de administración',
          properties: {
            usuariosPorRol: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rol: {
                    type: 'string',
                    enum: ['ESTUDIANTE', 'TUTOR', 'ADMIN'],
                    example: 'ESTUDIANTE',
                  },
                  total: { type: 'integer', example: 12 },
                },
              },
            },
            cursosPublicados: { type: 'integer', example: 5 },
            leccionesCompletadas: { type: 'integer', example: 240 },
            topCursos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 1 },
                  titulo: { type: 'string', example: 'Matemáticas básicas' },
                  nombre_tutor: { type: 'string', example: 'Tutor Demo' },
                  inscripciones: { type: 'integer', example: 30 },
                },
              },
            },
          },
        },
        ResultadoSync: {
          type: 'object',
          description:
            'Resultado de un lote sincizado. Aceptación PARCIAL: los ítems ' +
            'válidos entran en aceptados y los inválidos en rechazados con su motivo.',
          properties: {
            aceptados: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              example: ['3f1a9c0e-6f4b-4a52-9d21-1c8e5b7a2d90'],
            },
            rechazados: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idCliente: {
                    type: 'string',
                    nullable: true,
                    description: 'UUID del ítem rechazado (null si no era un UUID)',
                    example: '8b6d2f14-9c3a-4e7b-b0d5-2a4f6e8c1a33',
                  },
                  motivo: {
                    type: 'string',
                    example: 'Lección no encontrada',
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Se escanean los JSDoc de las rutas registradas en la API.
  apis: ['./modulos/**/*.routes.js'],
};

const especificacion = swaggerJsdoc(opciones);

/**
 * Monta la UI de Swagger en la ruta indicada.
 * @param {import('express').Application} app
 */
function montarSwagger(app) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(especificacion, {
      customSiteTitle: 'EduLite API - Documentación',
      explorer: true,
    })
  );
}

module.exports = { montarSwagger, especificacion };
