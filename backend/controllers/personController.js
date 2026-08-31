const personService = require("../services/personService");

async function listarPersonas(req, res, next) {
  try {
    const people = await personService.listPeople(req.user, req.query.search);
    return res.json({ people });
  } catch (error) {
    return next(error);
  }
}

async function obtenerPersona(req, res, next) {
  try {
    const person = await personService.getPerson(req.user, req.params.id);
    return res.json({ person });
  } catch (error) {
    return next(error);
  }
}

async function crearPersona(req, res, next) {
  try {
    const person = await personService.createPerson(req.user, req.body);
    return res.status(201).json({ person });
  } catch (error) {
    return next(error);
  }
}

async function actualizarPersona(req, res, next) {
  try {
    const person = await personService.updatePerson(req.user, req.params.id, req.body);
    return res.json({ person });
  } catch (error) {
    return next(error);
  }
}

async function cambiarEstadoPersona(req, res, next) {
  try {
    const person = await personService.setPersonActive(req.user, req.params.id, req.body.activo);
    return res.json({ person });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarPersonas,
  obtenerPersona,
  crearPersona,
  actualizarPersona,
  cambiarEstadoPersona
};
