from datetime import date, datetime, timezone
from django.db import models
from django.utils.dateparse import parse_datetime


class PrismaDateTimeField(models.DateTimeField):
    """
    Campo DateTime compatível com o formato de milissegundos Unix (epoch ms)
    utilizado pelo Prisma ORM no SQLite, além de aceitar strings ISO-8601.
    Isso permite que Django e Next.js/Prisma leiam, filtrem e gravem na mesma
    base SQLite sem conflito de tipo.
    """

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
        if isinstance(value, str):
            raw = value.strip()
            if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
                return datetime.fromtimestamp(float(raw) / 1000.0, tz=timezone.utc)
            parsed = parse_datetime(raw)
            if parsed:
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        return None

    def to_python(self, value):
        if value is None or isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
        return super().to_python(value)

    def get_db_prep_value(self, value, connection, prepared=False):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            value = self.to_python(value)
        if isinstance(value, date) and not isinstance(value, datetime):
            value = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return int(value.timestamp() * 1000)
        return super().get_db_prep_value(value, connection, prepared)
