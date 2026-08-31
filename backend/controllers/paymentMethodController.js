const paymentMethodService = require("../services/paymentMethodService");

async function listarFormasPago(req, res, next) {
  try {
    const paymentMethods = await paymentMethodService.listPaymentMethods(req.user.tenantId);
    return res.json({ paymentMethods });
  } catch (error) {
    return next(error);
  }
}

async function obtenerFormaPago(req, res, next) {
  try {
    const paymentMethod = await paymentMethodService.getPaymentMethod(
      req.user.tenantId,
      req.params.id
    );
    return res.json({ paymentMethod });
  } catch (error) {
    return next(error);
  }
}

async function crearFormaPago(req, res, next) {
  try {
    const paymentMethod = await paymentMethodService.createPaymentMethod(req.user.tenantId, req.body);
    return res.status(201).json({ paymentMethod });
  } catch (error) {
    return next(error);
  }
}

async function actualizarFormaPago(req, res, next) {
  try {
    const paymentMethod = await paymentMethodService.updatePaymentMethod(
      req.user.tenantId,
      req.params.id,
      req.body
    );
    return res.json({ paymentMethod });
  } catch (error) {
    return next(error);
  }
}

async function desactivarFormaPago(req, res, next) {
  try {
    const paymentMethod = await paymentMethodService.disablePaymentMethod(
      req.user.tenantId,
      req.params.id
    );
    return res.json({ paymentMethod });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarFormasPago,
  obtenerFormaPago,
  crearFormaPago,
  actualizarFormaPago,
  desactivarFormaPago
};
