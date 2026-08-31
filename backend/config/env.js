const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
dotenv.config();

const required = ["DATABASE_URL", "JWT_ACCESS_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variable de entorno requerida: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || process.env.API_PORT || 3100),
  webPort: Number(process.env.WEB_PORT || 5175),
  frontendOrigins: (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  sriP12Password: process.env.FirmaPrueba || process.env.SRI_P12_PASSWORD || ""
};
