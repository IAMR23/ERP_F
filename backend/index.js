const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { conectarDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const documentRoutes = require("./routes/documentRoutes");
const healthRoutes = require("./routes/healthRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const paymentMethodRoutes = require("./routes/paymentMethodRoutes");
const personRoutes = require("./routes/personRoutes");
const warehouseRoutes = require("./routes/warehouseRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const subcategoryRoutes = require("./routes/subcategoryRoutes");

const app = express();

const allowedOrigins = new Set([
  `http://localhost:${env.webPort}`,
  `http://127.0.0.1:${env.webPort}`,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  ...env.frontendOrigins
]);

function isLocalDevelopmentOrigin(origin) {
  return env.nodeEnv !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS no permitido: ${origin}`));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(documentRoutes);
app.use(organizationRoutes);
app.use(paymentMethodRoutes);
app.use(personRoutes);
app.use(warehouseRoutes);
app.use(healthRoutes);
app.use(categoryRoutes);
app.use(subcategoryRoutes);
app.use(productRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    message: statusCode >= 500 ? "Error interno" : error.message
  });
});

conectarDB()
  .then(() => {
    console.log("Base de datos conectada");

    app.listen(env.port, () => {
      console.log(`ERP API lista en http://localhost:${env.port}/api/v1`);
    });
  })
  .catch((error) => {
    console.error("No se pudo conectar a la base de datos", error);
    process.exit(1);
  });
