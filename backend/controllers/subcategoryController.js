const catalogService = require("../services/catalogService");

async function listarSubcategorias(req, res, next) {
  try {
    const subcategories = await catalogService.listSubcategories(
      req.user.tenantId,
      req.query.categoryId
    );
    return res.json({ subcategories });
  } catch (error) {
    return next(error);
  }
}

async function crearSubcategoria(req, res, next) {
  try {
    const subcategory = await catalogService.createSubcategory(req.user.tenantId, req.body);
    return res.status(201).json({ subcategory });
  } catch (error) {
    return next(error);
  }
}

async function actualizarSubcategoria(req, res, next) {
  try {
    const subcategory = await catalogService.updateSubcategory(
      req.user.tenantId,
      req.params.id,
      req.body
    );
    return res.json({ subcategory });
  } catch (error) {
    return next(error);
  }
}

async function desactivarSubcategoria(req, res, next) {
  try {
    const subcategory = await catalogService.updateSubcategory(req.user.tenantId, req.params.id, {
      status: "INACTIVE"
    });
    return res.json({ subcategory });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarSubcategorias,
  crearSubcategoria,
  actualizarSubcategoria,
  desactivarSubcategoria
};
