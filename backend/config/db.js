const { PrismaClient } = require("@prisma/client");

const prisma =
  global.__erpPrismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__erpPrismaClient = prisma;
}

async function conectarDB() {
  await prisma.$connect();
  return prisma;
}

module.exports = {
  prisma,
  conectarDB
};
