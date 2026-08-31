const multer = require("multer");
const path = require("path");

function uploadError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      return callback(uploadError("Solo se permiten imagenes"));
    }

    return callback(null, true);
  }
});

const companySettingsUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    if (file.fieldname === "logo") {
      if (!file.mimetype.startsWith("image/")) {
        return callback(uploadError("El logo debe ser una imagen"));
      }

      return callback(null, true);
    }

    if (file.fieldname === "proformaSignature") {
      if (path.extname(file.originalname || "").toLowerCase() !== ".p12") {
        return callback(uploadError("El certificado SRI debe ser un archivo con extension .p12"));
      }

      return callback(null, true);
    }

    return callback(uploadError("Archivo no permitido"));
  }
});

module.exports = {
  companySettingsUpload,
  imageUpload
};
