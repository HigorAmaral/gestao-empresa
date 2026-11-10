from django.db.models import F, Sum
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import (
    AppUser,
    AuditLog,
    Client,
    CompanySettings,
    Employee,
    FinancialEntry,
    Product,
    Purchase,
    Sale,
    ServiceOrder,
    StockMovement,
    StockLocation,
    ProductStockLocation,
    Supplier,
)
from .serializers import (
    AppUserSerializer,
    AuditLogSerializer,
    ClientSerializer,
    CompanySettingsSerializer,
    EmployeeSerializer,
    FinancialEntrySerializer,
    ProductSerializer,
    PurchaseSerializer,
    SaleSerializer,
    ServiceOrderSerializer,
    StockMovementSerializer,
    StockLocationSerializer,
    ProductStockLocationSerializer,
    SupplierSerializer,
)


@api_view(["GET"])
def dashboard_summary(request):
    """Resumo geral do banco de dados via Django ORM."""
    sales_confirmed = Sale.objects.filter(status="CONFIRMADA")
    total_sales = sales_confirmed.aggregate(total=Sum("total"))["total"] or 0
    rec_paid = FinancialEntry.objects.filter(type="RECEITA", status="PAGO").aggregate(total=Sum("amount"))["total"] or 0
    des_paid = FinancialEntry.objects.filter(type="DESPESA", status="PAGO").aggregate(total=Sum("amount"))["total"] or 0
    rec_pending = FinancialEntry.objects.filter(type="RECEITA", status="PENDENTE").aggregate(total=Sum("amount"))["total"] or 0
    des_pending = FinancialEntry.objects.filter(type="DESPESA", status="PENDENTE").aggregate(total=Sum("amount"))["total"] or 0
    low_stock = Product.objects.filter(active=True, stock__lte=F("min_stock")).count()
    open_os = ServiceOrder.objects.exclude(status__in=["CONCLUIDA", "CANCELADA"]).count()

    return Response(
        {
            "engine": "Django ORM + SQLite (integrado com Next.js)",
            "counts": {
                "clients": Client.objects.filter(active=True).count(),
                "suppliers": Supplier.objects.filter(active=True).count(),
                "products": Product.objects.filter(active=True).count(),
                "low_stock_products": low_stock,
                "employees": Employee.objects.filter(active=True).count(),
                "confirmed_sales": sales_confirmed.count(),
                "open_service_orders": open_os,
            },
            "financials": {
                "total_sales_revenue": round(total_sales, 2),
                "received_paid": round(rec_paid, 2),
                "expenses_paid": round(des_paid, 2),
                "cash_balance": round(rec_paid - des_paid, 2),
                "receivables_pending": round(rec_pending, 2),
                "payables_pending": round(des_pending, 2),
            },
        }
    )


class CompanySettingsViewSet(viewsets.ModelViewSet):
    queryset = CompanySettings.objects.all()
    serializer_class = CompanySettingsSerializer


class AppUserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AppUser.objects.all()
    serializer_class = AppUserSerializer


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("supplier").all()
    serializer_class = ProductSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related("client", "user").prefetch_related("items__product").all()
    serializer_class = SaleSerializer


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier", "user").prefetch_related("items__product").all()
    serializer_class = PurchaseSerializer


class ServiceOrderViewSet(viewsets.ModelViewSet):
    queryset = ServiceOrder.objects.select_related("client", "technician").prefetch_related("items__product").all()
    serializer_class = ServiceOrderSerializer


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("product", "user").all()
    serializer_class = StockMovementSerializer


class FinancialEntryViewSet(viewsets.ModelViewSet):
    queryset = FinancialEntry.objects.all()
    serializer_class = FinancialEntrySerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer


class StockLocationViewSet(viewsets.ModelViewSet):
    queryset = StockLocation.objects.prefetch_related("items__product").all()
    serializer_class = StockLocationSerializer


class ProductStockLocationViewSet(viewsets.ModelViewSet):
    queryset = ProductStockLocation.objects.select_related("product", "location").all()
    serializer_class = ProductStockLocationSerializer

