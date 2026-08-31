const catalogService = require("../services/catalogService");

async function listarCategorias(req, res, next) {
  try {
    const categories = await catalogService.listCategories(req.user.tenantId);
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
}

async function crearCategoria(req, res, next) {
  try {
    const category = await catalogService.createCategory(req.user.tenantId, req.body);
    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
}

async function actualizarCategoria(req, res, next) {
  try {
    const category = await catalogService.updateCategory(req.user.tenantId, req.params.id, req.body);
    return res.json({ category });
  } catch (error) {
    return next(error);
  }
}

async function desactivarCategoria(req, res, next) {
  try {
    const category = await catalogService.updateCategory(req.user.tenantId, req.params.id, {
      status: "INACTIVE"
    });
    return res.json({ category });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria
};
