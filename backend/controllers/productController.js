const catalogService = require("../services/catalogService");

async function listarEmpresas(req, res, next) {
  try {
    const companies = await catalogService.listCompanies(req.user.tenantId);
    return res.json({ companies });
  } catch (error) {
    return next(error);
  }
}

async function listarProductos(req, res, next) {
  try {
    const products = await catalogService.listProducts(req.user.tenantId);
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
}

async function obtenerProducto(req, res, next) {
  try {
    const product = await catalogService.getProduct(req.user.tenantId, req.params.id);
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
}

async function crearProducto(req, res, next) {
  try {
    const product = await catalogService.createProduct(
      req.user.tenantId,
      req.user.id,
      req.body,
      req.file
    );
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
}

async function actualizarProducto(req, res, next) {
  try {
    const product = await catalogService.updateProduct(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      req.body,
      req.file
    );
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
}

async function desactivarProducto(req, res, next) {
  try {
    const product = await catalogService.deleteProduct(req.user.tenantId, req.params.id);
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarEmpresas,
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  desactivarProducto
};
