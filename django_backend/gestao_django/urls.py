from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

admin.site.site_header = "GestãoPro ERP — Administração Django"
admin.site.site_title = "GestãoPro Admin"
admin.site.index_title = "Gerenciamento do Banco de Dados e Módulos Empresariais"

urlpatterns = [
    path("", RedirectView.as_view(url="/api/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/", include("erp.urls")),
]
