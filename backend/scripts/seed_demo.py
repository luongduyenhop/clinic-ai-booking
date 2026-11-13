import argparse
import asyncio
import sys
from app.core.config import settings
from seed_data import seed_database


def main():
    parser = argparse.ArgumentParser(description="Explicit CLI for demo database seeding")
    parser.add_argument("--confirm-seed-demo", action="store_true", help="Confirm seeding demo data")
    args = parser.parse_args()

    if not args.confirm_seed_demo:
        sys.stderr.write("THAO TÁC BỊ CHẶN: Bắt buộc truyền cờ --confirm-seed-demo để nạp dữ liệu mẫu!\n")
        sys.exit(1)

    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        sys.stderr.write("THAO TÁC BỊ CHẶN: Tuyệt đối không nạp dữ liệu demo trên môi trường PRODUCTION!\n")
        sys.exit(1)

    if not settings.ENABLE_DEMO_SEED:
        sys.stderr.write("THAO TÁC BỊ CHẶN: Cần bật ENABLE_DEMO_SEED=true trong môi trường demo/staging để nạp dữ liệu!\n")
        sys.exit(1)

    asyncio.run(seed_database(confirm_seed_demo=True))
    sys.stdout.write("Nạp dữ liệu mẫu demo thành công.\n")


if __name__ == "__main__":
    main()
