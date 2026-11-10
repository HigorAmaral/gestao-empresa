from rest_framework import serializers
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
    StockLocation,
    ProductStockLocation,
    Supplier,
)


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        fields = "__all__"


class AppUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppUser
        fields = ["id", "name", "email", "role", "active", "created_at"]


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = "__all__"


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Product
        fields = "__all__"


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = "__all__"


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_sku", "product_name", "quantity", "unit_price", "total"]


class SaleSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)
    items = SaleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = "__all__"


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = ["id", "product", "product_name", "quantity", "unit_cost", "total"]


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    items = PurchaseItemSerializer(many=True, read_only=True)

    class Meta:
        model = Purchase
        fields = "__all__"


class ServiceOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = ServiceOrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "total"]


class ServiceOrderSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    technician_name = serializers.CharField(source="technician.name", read_only=True)
    items = ServiceOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceOrder
        fields = "__all__"


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = "__all__"


class FinancialEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialEntry
        fields = "__all__"


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = "__all__"


class ProductStockLocationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = ProductStockLocation
        fields = "__all__"


class StockLocationSerializer(serializers.ModelSerializer):
    items = ProductStockLocationSerializer(many=True, read_only=True)

    class Meta:
        model = StockLocation
        fields = "__all__"

