const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { prisma } = require("../config/db");
const { mapUserPermissions } = require("../services/permissionService");

function toPublicUser(user) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    email: user.email,
    name: user.name,
    permissions: mapUserPermissions(user),
    companyIds: user.companyScopes.map((scope) => scope.companyId),
    branchIds: user.branchScopes.map((scope) => scope.branchId)
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Usuario/email y password son requeridos" });
    }

    const loginId = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: loginId }, { username: loginId }],
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

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Credenciales invalidas" });
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId
      },
      env.jwtAccessSecret,
      { expiresIn: env.accessTokenTtl }
    );

    return res.json({
      accessToken,
      user: toPublicUser(user)
    });
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  login,
  me
};
