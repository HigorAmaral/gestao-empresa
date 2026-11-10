from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone
from .models import (
    AppUser,
    AuditLog,
    Client,
    CompanySettings,
    Employee,
    FinancialEntry,
    Product,
    Purchase,
    PurchaseItem,
    Sale,
    SaleItem,
    ServiceOrder,
    ServiceOrderItem,
    StockMovement,
    Supplier,
)

INSTANT_PAYMENTS = {"Dinheiro", "PIX", "Cartão de Débito"}


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ("name", "trade_name", "document", "phone", "email", "city", "state")


@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "role", "active", "created_at")
    list_filter = ("role", "active")
    search_fields = ("name", "email")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "document", "email", "phone", "city", "state", "active")
    list_filter = ("active", "state")
    search_fields = ("name", "document", "email", "city")


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "document", "email", "phone", "city", "state", "active")
    list_filter = ("active", "state")
    search_fields = ("name", "document", "email", "city")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "unit", "cost_price", "sale_price", "stock", "min_stock", "supplier", "active")
    list_filter = ("active", "category", "unit")
    search_fields = ("sku", "name", "description")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "position", "department", "salary", "hire_date", "active")
    list_filter = ("active", "department")
    search_fields = ("name", "position", "email", "document")


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 1


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "client", "user", "payment_method", "subtotal", "discount", "total", "status")
    list_filter = ("status", "payment_method")
    search_fields = ("id", "client__name", "notes")
    inlines = [SaleItemInline]
    actions = ["confirm_selected_sales"]

    @admin.action(description="Confirmar vendas selecionadas (baixa estoque + gera financeiro)")
    def confirm_selected_sales(self, request, queryset):
        confirmed = 0
        for sale in queryset.prefetch_related("items__product"):
            if sale.status != "ORCAMENTO":
                continue
            with transaction.atomic():
                for item in sale.items.all():
                    if item.product.stock < item.quantity:
                        self.message_user(
                            request,
                            f"Estoque insuficiente para {item.product.name} na venda #{sale.id}.",
                            level=messages.ERROR,
                        )
                        return
                for item in sale.items.all():
                    item.product.stock -= item.quantity
                    item.product.save(update_fields=["stock"])
                    StockMovement.objects.create(
                        product=item.product,
                        type="SAIDA",
                        quantity=item.quantity,
                        reason=f"Venda #{sale.id} (via Django Admin)",
                    )
                paid_now = sale.payment_method in INSTANT_PAYMENTS
                FinancialEntry.objects.create(
                    type="RECEITA",
                    description=f"Venda #{sale.id}",
                    category="Vendas",
                    amount=sale.total,
                    due_date=sale.date,
                    status="PAGO" if paid_now else "PENDENTE",
                    paid_at=timezone.now() if paid_now else None,
                    sale=sale,
                )
                sale.status = "CONFIRMADA"
                sale.save(update_fields=["status"])
                confirmed += 1
        self.message_user(request, f"{confirmed} venda(s) confirmada(s) com sucesso.")


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 1


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("id", "date", "supplier", "due_date", "received_at", "total", "status")
    list_filter = ("status",)
    search_fields = ("id", "supplier__name", "notes")
    inlines = [PurchaseItemInline]
    actions = ["receive_selected_purchases"]

    @admin.action(description="Receber mercadoria das compras selecionadas (soma estoque)")
    def receive_selected_purchases(self, request, queryset):
        received = 0
        for purchase in queryset.prefetch_related("items__product"):
            if purchase.status != "PENDENTE":
                continue
            with transaction.atomic():
                for item in purchase.items.all():
                    item.product.stock += item.quantity
                    item.product.cost_price = item.unit_cost
                    item.product.save(update_fields=["stock", "cost_price"])
                    StockMovement.objects.create(
                        product=item.product,
                        type="ENTRADA",
                        quantity=item.quantity,
                        reason=f"Compra #{purchase.id} (via Django Admin)",
                    )
                purchase.status = "RECEBIDA"
                purchase.received_at = timezone.now()
                purchase.save(update_fields=["status", "received_at"])
                received += 1
        self.message_user(request, f"{received} compra(s) recebida(s) e somada(s) ao estoque.")


class ServiceOrderItemInline(admin.TabularInline):
    model = ServiceOrderItem
    extra = 1


@admin.register(ServiceOrder)
class ServiceOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "opened_at", "client", "equipment", "technician", "priority", "status", "total")
    list_filter = ("status", "priority")
    search_fields = ("id", "equipment", "serial_number", "client__name", "reported_issue")
    inlines = [ServiceOrderItemInline]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "product", "type", "quantity", "reason", "user")
    list_filter = ("type",)
    search_fields = ("product__name", "product__sku", "reason")


@admin.register(FinancialEntry)
class FinancialEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "due_date", "type", "description", "category", "amount", "status", "paid_at")
    list_filter = ("type", "status", "category")
    search_fields = ("description", "category", "notes")
    actions = ["mark_as_paid"]

    @admin.action(description="Baixar lançamentos selecionados como PAGO")
    def mark_as_paid(self, request, queryset):
        updated = queryset.filter(status="PENDENTE").update(status="PAGO", paid_at=timezone.now())
        self.message_user(request, f"{updated} lançamento(s) baixado(s) como PAGO.")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "user_name", "module", "action", "entity_id", "details")
    list_filter = ("module", "action")
    search_fields = ("user_name", "details", "entity_id")
    readonly_fields = ("created_at",)
