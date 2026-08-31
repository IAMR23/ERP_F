const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { prisma } = require("../config/db");
const { mapUserPermissions } = require("../services/permissionService");

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const payload = jwt.verify(token, env.jwtAccessSecret);
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        tenantId: payload.tenantId,
        status: "ACTIVE"
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        },
        companyScopes: true,
        branchScopes: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: "Sesion invalida" });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      name: user.name,
      permissions: mapUserPermissions(user),
      companyIds: user.companyScopes.map((scope) => scope.companyId),
      branchIds: user.branchScopes.map((scope) => scope.branchId)
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Sesion invalida" });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ message: "Permiso insuficiente", permission });
    }

    return next();
  };
}

module.exports = {
  authMiddleware,
  requirePermission
};
