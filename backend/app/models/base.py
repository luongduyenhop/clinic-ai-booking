from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime
from app.core.database import Base


class BaseModelWithTimestamp(Base):
    """Lớp thực thể trừu tượng chứa khóa chính và dấu thời gian cho mọi bảng trong CSDL"""
    __abstract__ = True

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
