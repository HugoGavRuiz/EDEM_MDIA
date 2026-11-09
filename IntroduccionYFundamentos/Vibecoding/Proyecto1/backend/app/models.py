"""Modelos de la base de datos."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TipoInteres(Base):
    """Caché de una serie mensual de tipos de interés (una fila por serie y mes)."""

    __tablename__ = "tipos_interes"
    __table_args__ = (
        CheckConstraint("valor >= 0 AND valor <= 30", name="ck_tipos_interes_valor"),
        CheckConstraint("periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'", name="ck_tipos_interes_periodo"),
    )

    serie: Mapped[str] = mapped_column(String(64), primary_key=True)
    periodo: Mapped[str] = mapped_column(String(7), primary_key=True)  # "2026-09"
    valor: Mapped[Decimal] = mapped_column(Numeric(6, 3))  # porcentaje anual
    descargado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
