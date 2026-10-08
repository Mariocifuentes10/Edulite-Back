/**
 * middlewares/cache.middleware.js
 * cacheControl(segundos, alcance): establece Cache-Control en las respuestas
 * EXITOSAS (status < 400) de rutas GET. Los errores nunca se cachean.
 *
 * • Catálogo público (GET /api/cursos) → public: los proxies pueden servirlo.
 * • Recursos que varían con Authorization (detalle, lecciones) → private:
 *   cada estudiante/tutor ve contenido distinto, jamás en caché compartida.
 */
function cacheControl(segundos, alcance = 'public') {
  return function aplicarCache(req, res, next) {
    const jsonOriginal = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode < 400) {
        res.setHeader('Cache-Control', `${alcance}, max-age=${segundos}`);
      }
      return jsonOriginal(payload);
    };
    next();
  };
}

module.exports = { cacheControl };
