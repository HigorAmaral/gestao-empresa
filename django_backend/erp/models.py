from django.db import models
from django.utils import timezone
from .fields import PrismaDateTimeField


class AppUser(models.Model):
    ROLES = [
        ("ADMIN", "Administrador"),
        ("FUNCIONARIO", "Funcionário"),
    ]

    id = models.AutoField(primary_key=True)
    name = models.CharField("Nome", max_length=200)
    email = models.EmailField("E-mail", unique=True, max_length=200)
    password_hash = models.CharField("Hash da Senha (bcrypt)", max_length=255, db_column="passwordHash")
    role = models.CharField("Perfil", max_length=30, choices=ROLES, default="FUNCIONARIO")
    active = models.BooleanField("Ativo", default=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "User"
        verbose_name = "Usuário do Sistema"
        verbose_name_plural = "Usuários do Sistema"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.email})"


class CompanySettings(models.Model):
    id = models.IntegerField("ID", primary_key=True, default=1)
    name = models.CharField("Razão Social", max_length=255, default="GestãoPro Empresarial Ltda")
    trade_name = models.CharField("Nome Fantasia", max_length=255, blank=True, null=True, db_column="tradeName")
    logo_url = models.TextField("URL ou Base64 da Logo", blank=True, null=True, db_column="logoUrl")
    primary_color = models.CharField("Cor Primária", max_length=50, blank=True, null=True, default="#09090b", db_column="primaryColor")
    sidebar_color = models.CharField("Cor da Barra Lateral", max_length=50, blank=True, null=True, default="#09090b", db_column="sidebarColor")
    accent_color = models.CharField("Cor de Destaque", max_length=50, blank=True, null=True, default="#2563eb", db_column="accentColor")
    document = models.CharField("CNPJ", max_length=40, blank=True, null=True)
    state_registration = models.CharField("Inscrição Estadual", max_length=60, blank=True, null=True, db_column="stateRegistration")
    email = models.EmailField("E-mail", max_length=200, blank=True, null=True)
    phone = models.CharField("Telefone", max_length=50, blank=True, null=True)
    website = models.CharField("Site", max_length=200, blank=True, null=True)
    address = models.CharField("Endereço", max_length=255, blank=True, null=True)
    city = models.CharField("Cidade", max_length=120, blank=True, null=True)
    state = models.CharField("UF", max_length=5, blank=True, null=True)
    zip_code = models.CharField("CEP", max_length=20, blank=True, null=True, db_column="zipCode")
    receipt_footer = models.TextField("Rodapé de Recibos/OS", blank=True, null=True, db_column="receiptFooter")
    updated_at = PrismaDateTimeField("Atualizado em", default=timezone.now, db_column="updatedAt")

    class Meta:
        db_table = "CompanySettings"
        verbose_name = "Configuração da Empresa"
        verbose_name_plural = "Configurações da Empresa"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.trade_name or self.name


class AuditLog(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        AppUser,
        verbose_name="Usuário",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="audit_logs",
    )
    user_name = models.CharField("Nome do Usuário", max_length=200, db_column="userName")
    module = models.CharField("Módulo", max_length=50)
    action = models.CharField("Ação", max_length=50)
    entity_id = models.CharField("ID do Registro", max_length=50, blank=True, null=True, db_column="entityId")
    details = models.TextField("Detalhes")
    created_at = PrismaDateTimeField("Data/Hora", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "AuditLog"
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"
        ordering = ["-id"]

    def __str__(self):
        return f"[{self.module}/{self.action}] {self.details[:50]}"


class Client(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField("Nome / Razão Social", max_length=255)
    document = models.CharField("CPF / CNPJ", max_length=40, blank=True, null=True)
    email = models.EmailField("E-mail", max_length=200, blank=True, null=True)
    phone = models.CharField("Telefone", max_length=50, blank=True, null=True)
    address = models.CharField("Endereço", max_length=255, blank=True, null=True)
    city = models.CharField("Cidade", max_length=120, blank=True, null=True)
    state = models.CharField("UF", max_length=5, blank=True, null=True)
    notes = models.TextField("Observações", blank=True, null=True)
    active = models.BooleanField("Ativo", default=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Client"
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Supplier(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField("Nome / Razão Social", max_length=255)
    document = models.CharField("CNPJ / CPF", max_length=40, blank=True, null=True)
    email = models.EmailField("E-mail", max_length=200, blank=True, null=True)
    phone = models.CharField("Telefone", max_length=50, blank=True, null=True)
    address = models.CharField("Endereço", max_length=255, blank=True, null=True)
    city = models.CharField("Cidade", max_length=120, blank=True, null=True)
    state = models.CharField("UF", max_length=5, blank=True, null=True)
    notes = models.TextField("Observações", blank=True, null=True)
    active = models.BooleanField("Ativo", default=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Supplier"
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    id = models.AutoField(primary_key=True)
    sku = models.CharField("Código (SKU)", max_length=80, unique=True)
    name = models.CharField("Nome do Produto", max_length=255)
    description = models.TextField("Descrição", blank=True, null=True)
    category = models.CharField("Categoria", max_length=120, blank=True, null=True)
    unit = models.CharField("Unidade", max_length=15, default="UN")
    cost_price = models.FloatField("Preço de Custo (R$)", default=0, db_column="costPrice")
    sale_price = models.FloatField("Preço de Venda (R$)", default=0, db_column="salePrice")
    stock = models.FloatField("Estoque Atual", default=0)
    min_stock = models.FloatField("Estoque Mínimo", default=0, db_column="minStock")
    active = models.BooleanField("Ativo", default=True)
    supplier = models.ForeignKey(
        Supplier,
        verbose_name="Fornecedor Principal",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="supplierId",
        related_name="products",
    )
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Product"
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        ordering = ["name"]

    def __str__(self):
        return f"{self.sku} — {self.name}"


class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField("Nome Completo", max_length=255)
    document = models.CharField("CPF", max_length=30, blank=True, null=True)
    email = models.EmailField("E-mail", max_length=200, blank=True, null=True)
    phone = models.CharField("Telefone", max_length=50, blank=True, null=True)
    position = models.CharField("Cargo", max_length=120)
    department = models.CharField("Departamento", max_length=120, blank=True, null=True)
    salary = models.FloatField("Salário (R$)", default=0)
    hire_date = PrismaDateTimeField("Data de Admissão", default=timezone.now, db_column="hireDate")
    active = models.BooleanField("Ativo", default=True)
    notes = models.TextField("Observações", blank=True, null=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Employee"
        verbose_name = "Funcionário"
        verbose_name_plural = "Funcionários"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.position})"


class Sale(models.Model):
    STATUS_CHOICES = [
        ("ORCAMENTO", "Orçamento"),
        ("CONFIRMADA", "Confirmada"),
        ("CANCELADA", "Cancelada"),
    ]

    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(
        Client,
        verbose_name="Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="clientId",
        related_name="sales",
    )
    user = models.ForeignKey(
        AppUser,
        verbose_name="Vendedor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="sales",
    )
    date = PrismaDateTimeField("Data da Venda", default=timezone.now)
    status = models.CharField("Status", max_length=30, choices=STATUS_CHOICES, default="ORCAMENTO")
    payment_method = models.CharField("Forma de Pagamento", max_length=60, blank=True, null=True, db_column="paymentMethod")
    subtotal = models.FloatField("Subtotal (R$)", default=0)
    discount = models.FloatField("Desconto (R$)", default=0)
    total = models.FloatField("Total (R$)", default=0)
    notes = models.TextField("Observações", blank=True, null=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Sale"
        verbose_name = "Venda / Orçamento"
        verbose_name_plural = "Vendas & Orçamentos"
        ordering = ["-id"]

    def __str__(self):
        return f"Venda #{self.id} — R$ {self.total:.2f}"


class SaleItem(models.Model):
    id = models.AutoField(primary_key=True)
    sale = models.ForeignKey(Sale, verbose_name="Venda", on_delete=models.CASCADE, db_column="saleId", related_name="items")
    product = models.ForeignKey(Product, verbose_name="Produto", on_delete=models.PROTECT, db_column="productId", related_name="sale_items")
    quantity = models.FloatField("Quantidade")
    unit_price = models.FloatField("Preço Unitário (R$)", db_column="unitPrice")
    total = models.FloatField("Total do Item (R$)")

    class Meta:
        db_table = "SaleItem"
        verbose_name = "Item da Venda"
        verbose_name_plural = "Itens da Venda"

    def save(self, *args, **kwargs):
        self.total = round((self.quantity or 0) * (self.unit_price or 0), 2)
        super().save(*args, **kwargs)


class Purchase(models.Model):
    STATUS_CHOICES = [
        ("PENDENTE", "Pendente"),
        ("RECEBIDA", "Recebida"),
        ("CANCELADA", "Cancelada"),
    ]

    id = models.AutoField(primary_key=True)
    supplier = models.ForeignKey(
        Supplier,
        verbose_name="Fornecedor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="supplierId",
        related_name="purchases",
    )
    user = models.ForeignKey(
        AppUser,
        verbose_name="Responsável",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="purchases",
    )
    date = PrismaDateTimeField("Data do Pedido", default=timezone.now)
    due_date = PrismaDateTimeField("Vencimento", null=True, blank=True, db_column="dueDate")
    received_at = PrismaDateTimeField("Recebida em", null=True, blank=True, db_column="receivedAt")
    status = models.CharField("Status", max_length=30, choices=STATUS_CHOICES, default="PENDENTE")
    total = models.FloatField("Total (R$)", default=0)
    notes = models.TextField("Observações", blank=True, null=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Purchase"
        verbose_name = "Compra"
        verbose_name_plural = "Compras"
        ordering = ["-id"]

    def __str__(self):
        return f"Compra #{self.id} — R$ {self.total:.2f}"


class PurchaseItem(models.Model):
    id = models.AutoField(primary_key=True)
    purchase = models.ForeignKey(Purchase, verbose_name="Compra", on_delete=models.CASCADE, db_column="purchaseId", related_name="items")
    product = models.ForeignKey(Product, verbose_name="Produto", on_delete=models.PROTECT, db_column="productId", related_name="purchase_items")
    quantity = models.FloatField("Quantidade")
    unit_cost = models.FloatField("Custo Unitário (R$)", db_column="unitCost")
    total = models.FloatField("Total do Item (R$)")

    class Meta:
        db_table = "PurchaseItem"
        verbose_name = "Item da Compra"
        verbose_name_plural = "Itens da Compra"

    def save(self, *args, **kwargs):
        self.total = round((self.quantity or 0) * (self.unit_cost or 0), 2)
        super().save(*args, **kwargs)


class ServiceOrder(models.Model):
    PRIORITY_CHOICES = [
        ("BAIXA", "Baixa"),
        ("NORMAL", "Normal"),
        ("ALTA", "Alta"),
        ("URGENTE", "Urgente"),
    ]
    STATUS_CHOICES = [
        ("ABERTA", "Aberta"),
        ("EM_ANDAMENTO", "Em andamento"),
        ("AGUARDANDO_PECA", "Aguardando peça"),
        ("CONCLUIDA", "Concluída"),
        ("CANCELADA", "Cancelada"),
    ]

    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(
        Client,
        verbose_name="Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="clientId",
        related_name="service_orders",
    )
    technician = models.ForeignKey(
        Employee,
        verbose_name="Técnico Responsável",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="technicianId",
        related_name="service_orders",
    )
    user = models.ForeignKey(
        AppUser,
        verbose_name="Aberto por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="service_orders",
    )
    equipment = models.CharField("Equipamento / Objeto", max_length=255)
    serial_number = models.CharField("Nº de Série / Patrimônio", max_length=120, blank=True, null=True, db_column="serialNumber")
    reported_issue = models.TextField("Defeito / Solicitação Relatada", db_column="reportedIssue")
    diagnosis = models.TextField("Diagnóstico / Serviço Executado", blank=True, null=True)
    priority = models.CharField("Prioridade", max_length=30, choices=PRIORITY_CHOICES, default="NORMAL")
    status = models.CharField("Status", max_length=30, choices=STATUS_CHOICES, default="ABERTA")
    payment_method = models.CharField("Forma de Pagamento", max_length=60, blank=True, null=True, db_column="paymentMethod")
    opened_at = PrismaDateTimeField("Data de Abertura", default=timezone.now, db_column="openedAt")
    expected_date = PrismaDateTimeField("Previsão de Entrega", null=True, blank=True, db_column="expectedDate")
    completed_at = PrismaDateTimeField("Concluída em", null=True, blank=True, db_column="completedAt")
    labor_cost = models.FloatField("Mão de Obra (R$)", default=0, db_column="laborCost")
    parts_subtotal = models.FloatField("Subtotal Peças (R$)", default=0, db_column="partsSubtotal")
    discount = models.FloatField("Desconto (R$)", default=0)
    total = models.FloatField("Total da OS (R$)", default=0)
    notes = models.TextField("Observações", blank=True, null=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "ServiceOrder"
        verbose_name = "Ordem de Serviço"
        verbose_name_plural = "Ordens de Serviço"
        ordering = ["-id"]

    def __str__(self):
        return f"OS #{self.id} — {self.equipment}"


class ServiceOrderItem(models.Model):
    id = models.AutoField(primary_key=True)
    service_order = models.ForeignKey(
        ServiceOrder,
        verbose_name="Ordem de Serviço",
        on_delete=models.CASCADE,
        db_column="serviceOrderId",
        related_name="items",
    )
    product = models.ForeignKey(Product, verbose_name="Peça / Produto", on_delete=models.PROTECT, db_column="productId", related_name="os_items")
    quantity = models.FloatField("Quantidade")
    unit_price = models.FloatField("Preço Unitário (R$)", db_column="unitPrice")
    total = models.FloatField("Total (R$)")

    class Meta:
        db_table = "ServiceOrderItem"
        verbose_name = "Peça / Item da OS"
        verbose_name_plural = "Peças / Itens da OS"

    def save(self, *args, **kwargs):
        self.total = round((self.quantity or 0) * (self.unit_price or 0), 2)
        super().save(*args, **kwargs)


class StockMovement(models.Model):
    TYPE_CHOICES = [
        ("ENTRADA", "Entrada"),
        ("SAIDA", "Saída"),
        ("AJUSTE", "Ajuste"),
    ]

    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, verbose_name="Produto", on_delete=models.CASCADE, db_column="productId", related_name="movements")
    type = models.CharField("Tipo", max_length=20, choices=TYPE_CHOICES)
    quantity = models.FloatField("Quantidade")
    reason = models.CharField("Motivo", max_length=255, blank=True, null=True)
    user = models.ForeignKey(
        AppUser,
        verbose_name="Usuário",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="movements",
    )
    created_at = PrismaDateTimeField("Data/Hora", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "StockMovement"
        verbose_name = "Movimentação de Estoque"
        verbose_name_plural = "Movimentações de Estoque"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.type} ({self.quantity}) — {self.product.name}"


class FinancialEntry(models.Model):
    TYPE_CHOICES = [
        ("RECEITA", "Receita"),
        ("DESPESA", "Despesa"),
    ]
    STATUS_CHOICES = [
        ("PENDENTE", "Pendente"),
        ("PAGO", "Pago"),
        ("CANCELADO", "Cancelado"),
    ]

    id = models.AutoField(primary_key=True)
    type = models.CharField("Tipo", max_length=20, choices=TYPE_CHOICES)
    description = models.CharField("Descrição", max_length=255)
    category = models.CharField("Categoria", max_length=120, blank=True, null=True)
    amount = models.FloatField("Valor (R$)")
    due_date = PrismaDateTimeField("Vencimento", default=timezone.now, db_column="dueDate")
    paid_at = PrismaDateTimeField("Pago em", null=True, blank=True, db_column="paidAt")
    status = models.CharField("Status", max_length=30, choices=STATUS_CHOICES, default="PENDENTE")
    notes = models.TextField("Observações", blank=True, null=True)
    sale = models.ForeignKey(
        Sale,
        verbose_name="Venda vinculada",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="saleId",
        related_name="financial_entries",
    )
    purchase = models.ForeignKey(
        Purchase,
        verbose_name="Compra vinculada",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="purchaseId",
        related_name="financial_entries",
    )
    service_order = models.ForeignKey(
        ServiceOrder,
        verbose_name="OS vinculada",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="serviceOrderId",
        related_name="financial_entries",
    )
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "FinancialEntry"
        verbose_name = "Lançamento Financeiro"
        verbose_name_plural = "Lançamentos Financeiros"
        ordering = ["-due_date", "-id"]

    def __str__(self):
        return f"[{self.type}] {self.description} — R$ {self.amount:.2f}"


class StockLocation(models.Model):
    id = models.AutoField(primary_key=True)
    code = models.CharField("Código do Endereço", max_length=100, unique=True)
    aisle = models.CharField("Corredor / Rua / Galpão", max_length=100, blank=True, null=True)
    rack = models.CharField("Prateleira / Estante / Módulo", max_length=100, blank=True, null=True)
    shelf = models.CharField("Nível / Andar", max_length=100, blank=True, null=True)
    bin = models.CharField("Vão / Gaveta / Posição", max_length=100, blank=True, null=True)
    description = models.TextField("Descrição / Observações", blank=True, null=True)
    active = models.BooleanField("Ativo", default=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "StockLocation"
        verbose_name = "Endereço de Estoque"
        verbose_name_plural = "Endereços de Estoque"
        ordering = ["code"]

    def __str__(self):
        return self.code


class ProductStockLocation(models.Model):
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(
        Product,
        verbose_name="Produto",
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="stock_locations",
    )
    location = models.ForeignKey(
        StockLocation,
        verbose_name="Endereço de Estoque",
        on_delete=models.CASCADE,
        db_column="locationId",
        related_name="items",
    )
    quantity = models.FloatField("Quantidade no Endereço", default=0)
    notes = models.TextField("Observações", blank=True, null=True)
    updated_at = PrismaDateTimeField("Atualizado em", default=timezone.now, db_column="updatedAt")
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "ProductStockLocation"
        verbose_name = "Item Endereçado"
        verbose_name_plural = "Itens Endereçados"
        unique_together = [("product", "location")]
        ordering = ["location__code", "product__name"]

    def __str__(self):
        return f"{self.product.name} ({self.quantity} un) @ {self.location.code}"


class GoodsReceipt(models.Model):
    STATUS_CHOICES = [
        ("RECEBIDO", "Recebido"),
        ("PENDENTE", "Pendente"),
        ("CANCELADO", "Cancelado"),
    ]

    id = models.AutoField(primary_key=True)
    code = models.CharField("Código", max_length=100, unique=True)
    invoice_number = models.CharField("NF-e", max_length=100, blank=True, null=True, db_column="invoiceNumber")
    supplier = models.ForeignKey(
        Supplier,
        verbose_name="Fornecedor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="supplierId",
        related_name="goods_receipts",
    )
    purchase = models.ForeignKey(
        Purchase,
        verbose_name="Compra Vinculada",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="purchaseId",
        related_name="goods_receipts",
    )
    status = models.CharField("Status", max_length=50, choices=STATUS_CHOICES, default="RECEBIDO")
    received_at = PrismaDateTimeField("Recebido em", default=timezone.now, db_column="receivedAt")
    notes = models.TextField("Observações", blank=True, null=True)
    user = models.ForeignKey(
        AppUser,
        verbose_name="Recebido por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="goods_receipts",
    )
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "GoodsReceipt"
        verbose_name = "Recebimento de Mercadoria"
        verbose_name_plural = "Recebimentos de Mercadorias"
        ordering = ["-received_at", "-id"]

    def __str__(self):
        return f"{self.code} — NF {self.invoice_number or 'S/N'}"


class GoodsReceiptItem(models.Model):
    id = models.AutoField(primary_key=True)
    receipt = models.ForeignKey(
        GoodsReceipt,
        verbose_name="Recebimento",
        on_delete=models.CASCADE,
        db_column="receiptId",
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        verbose_name="Produto / Insumo",
        on_delete=models.PROTECT,
        db_column="productId",
        related_name="receipt_items",
    )
    quantity = models.FloatField("Quantidade Recebida")
    unit_cost = models.FloatField("Custo Unitário", default=0, db_column="unitCost")
    location = models.ForeignKey(
        StockLocation,
        verbose_name="Endereço no Estoque",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="locationId",
        related_name="receipt_items",
    )
    batch = models.CharField("Lote", max_length=100, blank=True, null=True)
    notes = models.TextField("Observações", blank=True, null=True)

    class Meta:
        db_table = "GoodsReceiptItem"
        verbose_name = "Item Recebido"
        verbose_name_plural = "Itens Recebidos"

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"


class ProductionOrder(models.Model):
    PRIORITY_CHOICES = [
        ("BAIXA", "Baixa"),
        ("NORMAL", "Normal"),
        ("ALTA", "Alta"),
        ("URGENTE", "Urgente"),
    ]
    STATUS_CHOICES = [
        ("PLANEJADA", "Planejada"),
        ("EM_PRODUCAO", "Em Produção"),
        ("CONCLUIDA", "Concluída"),
        ("CANCELADA", "Cancelada"),
    ]

    id = models.AutoField(primary_key=True)
    code = models.CharField("Código da OP", max_length=100, unique=True)
    product = models.ForeignKey(
        Product,
        verbose_name="Produto a Fabricar",
        on_delete=models.PROTECT,
        db_column="productId",
        related_name="production_orders",
    )
    quantity = models.FloatField("Quantidade Planejada")
    machine = models.CharField("Máquina / Posto de Entrega", max_length=150)
    operator_name = models.CharField("Operador Designado", max_length=150, blank=True, null=True, db_column="operatorName")
    priority = models.CharField("Prioridade", max_length=50, choices=PRIORITY_CHOICES, default="NORMAL")
    status = models.CharField("Status", max_length=50, choices=STATUS_CHOICES, default="PLANEJADA")
    start_date = PrismaDateTimeField("Início da Produção", blank=True, null=True, db_column="startDate")
    delivery_date = PrismaDateTimeField("Previsão de Entrega na Máquina", blank=True, null=True, db_column="deliveryDate")
    completed_at = PrismaDateTimeField("Concluída em", blank=True, null=True, db_column="completedAt")
    notes = models.TextField("Instruções Técnicas", blank=True, null=True)
    user = models.ForeignKey(
        AppUser,
        verbose_name="Criada por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="userId",
        related_name="production_orders",
    )
    created_at = PrismaDateTimeField("Criada em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "ProductionOrder"
        verbose_name = "Ordem de Produção (OP)"
        verbose_name_plural = "Ordens de Produção (OPs)"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.code} — {self.product.name} ({self.machine})"


class ProductionOrderItem(models.Model):
    id = models.AutoField(primary_key=True)
    production_order = models.ForeignKey(
        ProductionOrder,
        verbose_name="Ordem de Produção",
        on_delete=models.CASCADE,
        db_column="productionOrderId",
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        verbose_name="Insumo / Matéria-Prima",
        on_delete=models.PROTECT,
        db_column="productId",
        related_name="consumed_in_orders",
    )
    quantity_required = models.FloatField("Quantidade Necessária", db_column="quantityRequired")
    location = models.ForeignKey(
        StockLocation,
        verbose_name="Endereço de Retirada",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="locationId",
        related_name="production_order_items",
    )
    notes = models.TextField("Instruções do Insumo", blank=True, null=True)

    class Meta:
        db_table = "ProductionOrderItem"
        verbose_name = "Insumo da OP"
        verbose_name_plural = "Insumos da OP"

    def __str__(self):
        return f"{self.quantity_required}x {self.product.name} -> {self.production_order.code}"


class ProductRecipeItem(models.Model):
    id = models.AutoField(primary_key=True)
    product = models.ForeignKey(
        Product,
        verbose_name="Produto Acabado",
        on_delete=models.CASCADE,
        db_column="productId",
        related_name="recipe_items",
    )
    component = models.ForeignKey(
        Product,
        verbose_name="Insumo / Matéria-Prima",
        on_delete=models.PROTECT,
        db_column="componentId",
        related_name="used_in_recipes",
    )
    quantity = models.FloatField("Quantidade por Unidade", default=1)
    notes = models.TextField("Especificação Técnica", blank=True, null=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "ProductRecipeItem"
        verbose_name = "Item da Ficha Técnica (BOM)"
        verbose_name_plural = "Itens da Ficha Técnica (BOM)"
        unique_together = [("product", "component")]

    def __str__(self):
        return f"{self.quantity}x {self.component.name} para 1x {self.product.name}"


class ProductionMachine(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField("Nome da Máquina / Posto", max_length=150, unique=True)
    code = models.CharField("Código / Tag", max_length=50, blank=True, null=True)
    category = models.CharField("Categoria / Setor", max_length=100, blank=True, null=True)
    location = models.CharField("Localização Física", max_length=150, blank=True, null=True)
    active = models.BooleanField("Ativo", default=True)
    created_at = PrismaDateTimeField("Criado em", default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "ProductionMachine"
        verbose_name = "Máquina / Posto de Trabalho"
        verbose_name_plural = "Máquinas & Postos de Trabalho"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code or 'Sem tag'})"



