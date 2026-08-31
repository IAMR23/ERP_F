const { prisma } = require("../config/db");

async function health(req, res, next) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", database: "ok" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  health
};
