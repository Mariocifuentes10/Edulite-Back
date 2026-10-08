/**
 * utils/async-handler.js
 * Envuelve los controladores async para pasar cualquier rechazo a next()
 * y evitar try/catch repetido en cada ruta.
 */

/**
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 * @returns {import('express').RequestHandler}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
