import pytest
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine
from app.models.user import TaiKhoan, VaiTroEnum
from scripts.seed_admin_demo import (
    validate_environment,
    seed_admin_demo,
    FORBIDDEN_ENVIRONMENTS,
)


def test_environment_guard_blocks_forbidden_environments():
    for forbidden in FORBIDDEN_ENVIRONMENTS:
        with pytest.raises(ValueError) as exc_info:
            validate_environment(forbidden)
        assert "Execution rejected" in str(exc_info.value)

    with pytest.raises(ValueError):
        validate_environment("PRODUCTION")

    with pytest.raises(ValueError):
        validate_environment(" STAGING ")


def test_environment_guard_allows_safe_environments():
    validate_environment("development")
    validate_environment("test")
    validate_environment("demo")


@pytest.mark.asyncio
async def test_seed_admin_demo_idempotency_and_preservation():
    # Engine dùng chung của app giữ kết nối từ event loop của test trước -> giải phóng trước khi dùng.
    await engine.dispose()
    first_run = await seed_admin_demo(mode="append", env="test")
    assert first_run["mode"] == "append"
    assert first_run["environment"] == "test"

    second_run = await seed_admin_demo(mode="append", env="test")
    assert second_run["departments_created"] == 0
    assert second_run["rooms_created"] == 0
    assert second_run["doctors_created"] == 0
    assert second_run["services_created"] == 0
    assert second_run["shifts_created"] == 0

    async with AsyncSessionLocal() as session:
        admin_stmt = select(TaiKhoan).where(TaiKhoan.vai_tro == VaiTroEnum.ADMIN.value)
        admin_accounts = (await session.execute(admin_stmt)).scalars().all()
        for account in admin_accounts:
            assert account.vai_tro == VaiTroEnum.ADMIN.value
            assert account.is_active is True
    await engine.dispose()
