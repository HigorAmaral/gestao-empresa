from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AppUserViewSet,
    AuditLogViewSet,
    ClientViewSet,
    CompanySettingsViewSet,
    EmployeeViewSet,
    FinancialEntryViewSet,
    ProductViewSet,
    PurchaseViewSet,
    SaleViewSet,
    ServiceOrderViewSet,
    StockMovementViewSet,
    StockLocationViewSet,
    ProductStockLocationViewSet,
    SupplierViewSet,
    dashboard_summary,
)

router = DefaultRouter()
router.register(r"empresa", CompanySettingsViewSet, basename="empresa")
router.register(r"usuarios", AppUserViewSet, basename="usuarios")
router.register(r"clientes", ClientViewSet, basename="clientes")
router.register(r"fornecedores", SupplierViewSet, basename="fornecedores")
router.register(r"produtos", ProductViewSet, basename="produtos")
router.register(r"funcionarios", EmployeeViewSet, basename="funcionarios")
router.register(r"vendas", SaleViewSet, basename="vendas")
router.register(r"compras", PurchaseViewSet, basename="compras")
router.register(r"os", ServiceOrderViewSet, basename="os")
router.register(r"estoque", StockMovementViewSet, basename="estoque")
router.register(r"enderecos", StockLocationViewSet, basename="enderecos")
router.register(r"enderecamento-itens", ProductStockLocationViewSet, basename="enderecamento-itens")
router.register(r"financeiro", FinancialEntryViewSet, basename="financeiro")
router.register(r"auditoria", AuditLogViewSet, basename="auditoria")

urlpatterns = [
    path("resumo/", dashboard_summary, name="dashboard-summary"),
    path("", include(router.urls)),
]
