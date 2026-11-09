import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.financialEntry.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.serviceOrderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "GestãoPro Soluções Empresariais Ltda",
      tradeName: "GestãoPro",
      document: "18.234.567/0001-89",
      stateRegistration: "110.042.490.114",
      email: "contato@gestaopro.com.br",
      phone: "(11) 3090-4500",
      website: "www.gestaopro.com.br",
      address: "Av. Paulista, 1374 — 11º andar",
      city: "São Paulo",
      state: "SP",
      zipCode: "01310-100",
      receiptFooter: "Obrigado pela preferência! Garantia de 90 dias para serviços técnicos conforme legislação vigente.",
    },
  });

  const [adminHash, funcHash] = await Promise.all([bcrypt.hash("admin123", 10), bcrypt.hash("func123", 10)]);

  const admin = await prisma.user.create({
    data: { name: "Carlos Mendes (Admin)", email: "admin@empresa.com", passwordHash: adminHash, role: "ADMIN" },
  });
  const seller = await prisma.user.create({
    data: { name: "Juliana Rocha", email: "func@empresa.com", passwordHash: funcHash, role: "FUNCIONARIO" },
  });

  // Fornecedores
  const [supTech, supOffice, supMob] = await Promise.all([
    prisma.supplier.create({
      data: {
        name: "TechBrasil Distribuidora Ltda",
        document: "12.345.678/0001-90",
        email: "vendas@techbrasil.com.br",
        phone: "(11) 3322-4455",
        address: "Av. das Nações Unidas, 12901",
        city: "São Paulo",
        state: "SP",
      },
    }),
    prisma.supplier.create({
      data: {
        name: "Suprimax Papelaria e Suprimentos",
        document: "23.456.789/0001-01",
        email: "contato@suprimax.com.br",
        phone: "(19) 3456-7890",
        address: "Rua Barão de Jaguara, 850",
        city: "Campinas",
        state: "SP",
      },
    }),
    prisma.supplier.create({
      data: {
        name: "ErgoDesign Móveis Corporativos",
        document: "34.567.890/0001-12",
        email: "comercial@ergodesign.com.br",
        phone: "(41) 3012-9988",
        address: "Rua XV de Novembro, 420",
        city: "Curitiba",
        state: "PR",
      },
    }),
  ]);

  // Produtos
  const products = await Promise.all([
    prisma.product.create({
      data: {
        sku: "NB-PRO15",
        name: "Notebook Pro 15\" i7 16GB 512GB SSD",
        category: "Informática",
        unit: "UN",
        costPrice: 3400,
        salePrice: 4890,
        stock: 12,
        minStock: 4,
        supplierId: supTech.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "MON-27IPS",
        name: "Monitor 27\" IPS QuadHD 75Hz",
        category: "Informática",
        unit: "UN",
        costPrice: 950,
        salePrice: 1490,
        stock: 18,
        minStock: 5,
        supplierId: supTech.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "KIT-WL01",
        name: "Kit Teclado e Mouse Sem Fio ABNT2",
        category: "Periféricos",
        unit: "KIT",
        costPrice: 95,
        salePrice: 179.9,
        stock: 3,
        minStock: 10,
        supplierId: supTech.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "HEAD-ANC",
        name: "Headset USB com Cancelamento de Ruído",
        category: "Periféricos",
        unit: "UN",
        costPrice: 160,
        salePrice: 299,
        stock: 4,
        minStock: 6,
        supplierId: supTech.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "CAD-ERG01",
        name: "Cadeira Ergonômica Presidente Tela Mesh",
        category: "Mobiliário",
        unit: "UN",
        costPrice: 680,
        salePrice: 1190,
        stock: 9,
        minStock: 3,
        supplierId: supMob.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "MES-EST140",
        name: "Mesa de Escritório 140x70cm Carvalho",
        category: "Mobiliário",
        unit: "UN",
        costPrice: 420,
        salePrice: 780,
        stock: 7,
        minStock: 2,
        supplierId: supMob.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "PAP-A4CX",
        name: "Caixa Papel A4 75g (10 resmas)",
        category: "Papelaria",
        unit: "CX",
        costPrice: 185,
        salePrice: 269,
        stock: 25,
        minStock: 8,
        supplierId: supOffice.id,
      },
    }),
    prisma.product.create({
      data: {
        sku: "SSD-NVME1T",
        name: "SSD NVMe M.2 1TB Gen4",
        category: "Peças & Upgrade",
        unit: "UN",
        costPrice: 290,
        salePrice: 480,
        stock: 8,
        minStock: 3,
        supplierId: supTech.id,
      },
    }),
  ]);

  // Clientes
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: "Alfa Contabilidade S/S",
        document: "45.678.901/0001-23",
        email: "compras@alfacontabil.com.br",
        phone: "(11) 98877-6655",
        address: "Rua Vergueiro, 2100",
        city: "São Paulo",
        state: "SP",
      },
    }),
    prisma.client.create({
      data: {
        name: "Clínica Vida & Saúde Ltda",
        document: "56.789.012/0001-34",
        email: "adm@clinicavida.com.br",
        phone: "(11) 97766-5544",
        address: "Av. Paulista, 900",
        city: "São Paulo",
        state: "SP",
      },
    }),
    prisma.client.create({
      data: {
        name: "Studio Criativo Horizonte",
        document: "67.890.123/0001-45",
        email: "financeiro@studiohorizonte.com.br",
        phone: "(21) 99881-2233",
        address: "Rua Visconde de Pirajá, 330",
        city: "Rio de Janeiro",
        state: "RJ",
      },
    }),
    prisma.client.create({
      data: {
        name: "Mariana Albuquerque",
        document: "321.654.987-00",
        email: "mariana.alb@gmail.com",
        phone: "(31) 99123-4567",
        city: "Belo Horizonte",
        state: "MG",
      },
    }),
  ]);

  // Funcionários
  const [empJu, empRafa, empFer] = await Promise.all([
    prisma.employee.create({
      data: {
        name: "Juliana Rocha",
        document: "123.456.789-10",
        email: "juliana@empresa.com",
        phone: "(11) 99111-2233",
        position: "Consultora Comercial",
        department: "Comercial",
        salary: 3800,
        hireDate: new Date("2024-03-10T00:00:00.000Z"),
      },
    }),
    prisma.employee.create({
      data: {
        name: "Rafael Oliveira",
        document: "234.567.890-20",
        email: "rafael@empresa.com",
        phone: "(11) 99222-3344",
        position: "Analista de Estoque e Compras",
        department: "Logística",
        salary: 3500,
        hireDate: new Date("2024-07-01T00:00:00.000Z"),
      },
    }),
    prisma.employee.create({
      data: {
        name: "Fernanda Lima",
        document: "345.678.901-30",
        email: "fernanda@empresa.com",
        phone: "(11) 99333-4455",
        position: "Especialista em Suporte Técnico",
        department: "Assistência Técnica",
        salary: 4200,
        hireDate: new Date("2023-11-15T00:00:00.000Z"),
      },
    }),
  ]);

  async function createConfirmedSale({ clientId, userId, days, paymentMethod, discount = 0, paid = true, items }) {
    const date = daysAgo(days);
    const rows = items.map(([prod, qty]) => ({
      productId: prod.id,
      quantity: qty,
      unitPrice: prod.salePrice,
      total: Math.round(qty * prod.salePrice * 100) / 100,
    }));
    const subtotal = rows.reduce((s, r) => s + r.total, 0);
    const total = subtotal - discount;

    const sale = await prisma.sale.create({
      data: {
        clientId,
        userId,
        date,
        status: "CONFIRMADA",
        paymentMethod,
        subtotal,
        discount,
        total,
        items: { create: rows },
        financial: {
          create: {
            type: "RECEITA",
            description: `Venda — ${paymentMethod}`,
            category: "Vendas",
            amount: total,
            dueDate: date,
            status: paid ? "PAGO" : "PENDENTE",
            paidAt: paid ? date : null,
          },
        },
      },
    });
    for (const r of rows) {
      await prisma.stockMovement.create({
        data: { productId: r.productId, type: "SAIDA", quantity: r.quantity, reason: `Venda #${sale.id}`, userId, createdAt: date },
      });
    }
  }

  await createConfirmedSale({
    clientId: clients[0].id,
    userId: seller.id,
    days: 95,
    paymentMethod: "PIX",
    items: [
      [products[0], 2],
      [products[1], 2],
    ],
  });
  await createConfirmedSale({
    clientId: clients[1].id,
    userId: admin.id,
    days: 65,
    paymentMethod: "Cartão de Crédito",
    items: [
      [products[4], 4],
      [products[5], 4],
      [products[6], 5],
    ],
  });
  await createConfirmedSale({
    clientId: clients[2].id,
    userId: seller.id,
    days: 35,
    paymentMethod: "Boleto",
    discount: 150,
    items: [
      [products[0], 1],
      [products[1], 2],
      [products[3], 3],
    ],
  });
  await createConfirmedSale({
    clientId: clients[0].id,
    userId: seller.id,
    days: 12,
    paymentMethod: "PIX",
    items: [
      [products[0], 1],
      [products[4], 2],
      [products[7], 2],
    ],
  });
  await createConfirmedSale({
    clientId: clients[3].id,
    userId: admin.id,
    days: 3,
    paymentMethod: "Boleto",
    paid: false,
    items: [
      [products[1], 1],
      [products[2], 2],
    ],
  });

  // Orçamento em aberto
  await prisma.sale.create({
    data: {
      clientId: clients[2].id,
      userId: seller.id,
      date: daysAgo(1),
      status: "ORCAMENTO",
      paymentMethod: "Boleto",
      subtotal: products[0].salePrice * 2,
      total: products[0].salePrice * 2,
      notes: "Cliente pediu validade de 7 dias para aprovação da diretoria.",
      items: {
        create: [{ productId: products[0].id, quantity: 2, unitPrice: products[0].salePrice, total: products[0].salePrice * 2 }],
      },
    },
  });

  // Ordens de Serviço (1 concluída com peça e mão de obra + 1 em andamento)
  const os1Date = daysAgo(7);
  await prisma.serviceOrder.create({
    data: {
      clientId: clients[0].id,
      technicianId: empFer.id,
      userId: admin.id,
      equipment: "Workstation Dell Precision 3660",
      serialNumber: "DL-99812-BR",
      reportedIssue: "Lentidão extrema na inicialização do sistema e falha intermitente no disco principal.",
      diagnosis: "Substituição por SSD NVMe 1TB Gen4, clonagem de volume, limpeza térmica e atualização de BIOS.",
      priority: "ALTA",
      status: "CONCLUIDA",
      paymentMethod: "PIX",
      openedAt: os1Date,
      expectedDate: daysAgo(5),
      completedAt: daysAgo(5),
      laborCost: 280,
      partsSubtotal: 480,
      discount: 0,
      total: 760,
      items: {
        create: [{ productId: products[7].id, quantity: 1, unitPrice: 480, total: 480 }],
      },
      financial: {
        create: {
          type: "RECEITA",
          description: "OS #1 — Workstation Dell Precision 3660",
          category: "Serviços",
          amount: 760,
          dueDate: daysAgo(5),
          paidAt: daysAgo(5),
          status: "PAGO",
        },
      },
    },
  });

  await prisma.serviceOrder.create({
    data: {
      clientId: clients[1].id,
      technicianId: empFer.id,
      userId: seller.id,
      equipment: "Notebook Lenovo ThinkPad E14",
      serialNumber: "TP-44210-SP",
      reportedIssue: "Equipamento aquece e desliga após 30 minutos de uso contínuo.",
      diagnosis: "Em bancada para troca de pasta térmica de alta condutividade e revisão do cooler.",
      priority: "URGENTE",
      status: "EM_ANDAMENTO",
      paymentMethod: "Boleto",
      openedAt: daysAgo(1),
      expectedDate: daysAgo(-2),
      laborCost: 220,
      partsSubtotal: 0,
      discount: 0,
      total: 220,
    },
  });

  // Compras
  const pur1Date = daysAgo(25);
  await prisma.purchase.create({
    data: {
      supplierId: supTech.id,
      userId: admin.id,
      date: pur1Date,
      dueDate: daysAgo(10),
      receivedAt: pur1Date,
      status: "RECEBIDA",
      total: 5 * 3400 + 6 * 950,
      items: {
        create: [
          { productId: products[0].id, quantity: 5, unitCost: 3400, total: 17000 },
          { productId: products[1].id, quantity: 6, unitCost: 950, total: 5700 },
        ],
      },
      financial: {
        create: {
          type: "DESPESA",
          description: `Compra #1 — ${supTech.name}`,
          category: "Compras",
          amount: 22700,
          dueDate: daysAgo(10),
          status: "PAGO",
          paidAt: daysAgo(10),
        },
      },
    },
  });

  await prisma.purchase.create({
    data: {
      supplierId: supTech.id,
      userId: admin.id,
      date: daysAgo(2),
      dueDate: daysAgo(-15),
      status: "PENDENTE",
      total: 20 * 95 + 10 * 160,
      notes: "Reposição dos periféricos com estoque baixo.",
      items: {
        create: [
          { productId: products[2].id, quantity: 20, unitCost: 95, total: 1900 },
          { productId: products[3].id, quantity: 10, unitCost: 160, total: 1600 },
        ],
      },
      financial: {
        create: {
          type: "DESPESA",
          description: `Compra #2 — ${supTech.name}`,
          category: "Compras",
          amount: 3500,
          dueDate: daysAgo(-15),
          status: "PENDENTE",
        },
      },
    },
  });

  // Despesas operacionais
  await prisma.financialEntry.createMany({
    data: [
      {
        type: "DESPESA",
        description: "Aluguel do escritório",
        category: "Aluguel",
        amount: 3200,
        dueDate: daysAgo(40),
        paidAt: daysAgo(40),
        status: "PAGO",
      },
      {
        type: "DESPESA",
        description: "Aluguel do escritório",
        category: "Aluguel",
        amount: 3200,
        dueDate: daysAgo(10),
        paidAt: daysAgo(10),
        status: "PAGO",
      },
      {
        type: "DESPESA",
        description: "Energia elétrica e internet fibra",
        category: "Energia",
        amount: 640,
        dueDate: daysAgo(5),
        paidAt: daysAgo(5),
        status: "PAGO",
      },
      {
        type: "DESPESA",
        description: "Licenças de software e nuvem",
        category: "Internet/Telefone",
        amount: 420,
        dueDate: daysAgo(2),
        status: "PENDENTE",
      },
    ],
  });

  // Registros iniciais de auditoria
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        userName: admin.name,
        module: "CONFIG",
        action: "EDITAR",
        entityId: "1",
        details: "Configurou dados cadastrais da empresa GestãoPro Soluções Empresariais Ltda",
      },
      {
        userId: admin.id,
        userName: admin.name,
        module: "OS",
        action: "CONFIRMAR",
        entityId: "1",
        details: "Concluiu OS #1 (Workstation Dell Precision 3660) — R$ 760,00",
      },
      {
        userId: seller.id,
        userName: seller.name,
        module: "VENDAS",
        action: "CRIAR",
        entityId: "6",
        details: "Criou orçamento de venda #6 para Studio Criativo Horizonte",
      },
    ],
  });

  console.log("✔ Banco atualizado e populado com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
