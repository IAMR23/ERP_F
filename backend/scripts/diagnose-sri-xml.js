const { prisma } = require("../config/db");
const { buildSriInvoiceXml } = require("../services/sriInvoiceXmlService");
const { validateInvoiceXml } = require("../services/sriXsdValidationService");

async function main() {
  const id = process.argv[2];
  const documents = await prisma.sale.findMany({
    where: {
      documentType: "INVOICE",
      ...(id ? { id } : {})
    },
    orderBy: { createdAt: "desc" },
    take: id ? 1 : 25,
    select: {
      id: true,
      documentNumber: true,
      issueDate: true,
      establishmentCode: true,
      emissionPoint: true,
      sequential: true,
      subtotal: true,
      discountTotal: true,
      taxableSubtotal: true,
      taxTotal: true,
      total: true,
      dueDays: true,
      company: {
        select: {
          legalName: true,
          tradeName: true,
          ruc: true,
          mainAddress: true,
          accountingRequired: true,
          sriEnvironment: true,
          currency: true,
          specialContributor: true,
          specialContributorResolution: true,
          largeTaxpayer: true,
          largeTaxpayerResolution: true,
          rimpe: true,
          withholdingAgent: true,
          withholdingAgentResolution: true,
          sriSoftwareProviderRuc: true
        }
      },
      branch: { select: { address: true } },
      customer: {
        select: {
          tipoIdentificacion: true,
          identificacion: true,
          nombre: true,
          direccion: true,
          email: true,
          telefono: true
        }
      },
      payments: {
        select: {
          amount: true,
          paymentMethod: { select: { code: true, name: true } }
        }
      },
      lines: {
        select: {
          quantity: true,
          unitPrice: true,
          unit: true,
          discountAmount: true,
          netSubtotal: true,
          taxRatePercent: true,
          taxAmount: true,
          lineTotal: true,
          catalogItem: {
            select: {
              id: true,
              internalCode: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { id: "asc" }
      }
    }
  });

  if (!documents.length) {
    console.log("No hay factura para diagnosticar");
    return;
  }

  for (const document of documents) {
    console.log(`Documento: ${document.documentNumber || document.id}`);

    try {
      const { xml, accessKey } = buildSriInvoiceXml(document);
      validateInvoiceXml(xml);
      console.log(`XML valido contra XSD. Clave: ${accessKey}`);
    } catch (error) {
      console.log(error.message);
      for (const detail of error.details || []) {
        console.log(`- ${detail}`);
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
