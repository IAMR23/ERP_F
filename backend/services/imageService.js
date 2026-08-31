const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const uploadsRoot = path.resolve(__dirname, "../uploads");
const privateUploadsRoot = path.resolve(__dirname, "../private-uploads");
const productUploads = path.join(uploadsRoot, "products");

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function storedFilePath(objectKey) {
  const normalized = path.normalize(objectKey || "").replace(/^(\.\.(\\|\/|$))+/, "");
  const absolutePath = path.resolve(uploadsRoot, normalized);

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw validationError("Archivo almacenado invalido");
  }

  return absolutePath;
}

function storedPrivateFilePath(objectKey) {
  const normalized = path.normalize(objectKey || "").replace(/^(\.\.(\\|\/|$))+/, "");
  const absolutePath = path.resolve(privateUploadsRoot, normalized);

  if (!absolutePath.startsWith(`${privateUploadsRoot}${path.sep}`)) {
    throw validationError("Archivo almacenado invalido");
  }

  return absolutePath;
}

async function compressImage(file, folder, options = {}) {
  if (!file) {
    return null;
  }

  const uploadFolder = path.join(uploadsRoot, folder);
  await fs.mkdir(uploadFolder, { recursive: true });

  const image = sharp(file.buffer).rotate().resize({
    width: options.width || 900,
    height: options.height || 900,
    fit: "inside",
    withoutEnlargement: true
  });

  const metadata = await image.metadata();
  const fileName = `${Date.now()}-${cryptoRandom()}.webp`;
  const absolutePath = path.join(uploadFolder, fileName);
  const relativePath = `${folder}/${fileName}`;

  await image.webp({ quality: options.quality || 72, effort: 4 }).toFile(absolutePath);
  const stat = await fs.stat(absolutePath);

  return {
    objectKey: relativePath,
    url: `/uploads/${relativePath}`,
    mimeType: "image/webp",
    sizeBytes: stat.size,
    width: metadata.width || 0,
    height: metadata.height || 0,
    originalFileName: file.originalname
  };
}

async function compressProductImage(file) {
  return compressImage(file, "products", { width: 900, height: 900, quality: 72 });
}

async function compressCompanyImage(file, options = {}) {
  return compressImage(file, "companies", options);
}

async function storeCompanyProformaSignature(file) {
  if (!file) {
    return null;
  }

  if (path.extname(file.originalname || "").toLowerCase() !== ".p12") {
    throw validationError("El certificado SRI debe ser un archivo con extension .p12");
  }

  const uploadFolder = path.join(privateUploadsRoot, "certificates");
  await fs.mkdir(uploadFolder, { recursive: true });

  const fileName = `${Date.now()}-${cryptoRandom()}.p12`;
  const absolutePath = path.join(uploadFolder, fileName);
  const relativePath = `certificates/${fileName}`;

  await fs.writeFile(absolutePath, file.buffer);
  const stat = await fs.stat(absolutePath);

  return {
    objectKey: relativePath,
    mimeType: file.mimetype || "application/x-pkcs12",
    sizeBytes: stat.size,
    originalFileName: file.originalname
  };
}

async function removeStoredImage(objectKey) {
  if (!objectKey) {
    return;
  }

  if (String(objectKey).startsWith("certificates/")) {
    try {
      await fs.unlink(storedPrivateFilePath(objectKey));
      return;
    } catch {
      // Fall back to the legacy public uploads location below.
    }
  }

  try {
    await fs.unlink(storedFilePath(objectKey));
  } catch {
    // Best effort cleanup for replaced uploads.
  }
}

async function readStoredFile(objectKey) {
  if (String(objectKey || "").startsWith("certificates/")) {
    try {
      return await fs.readFile(storedPrivateFilePath(objectKey));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return fs.readFile(storedFilePath(objectKey));
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10);
}

module.exports = {
  compressCompanyImage,
  compressProductImage,
  readStoredFile,
  removeStoredImage,
  storeCompanyProformaSignature
};
