import sqlite3
from pathlib import Path

db_path = Path(__file__).resolve().parents[1] / "clinic_local.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

def get_cols(table):
    c.execute(f"PRAGMA table_info({table});")
    return [r[1] for r in c.fetchall()]

# 1. benh_nhan: nguoi_lien_he, sdt_nguoi_lien_he
bn_cols = get_cols("benh_nhan")
if "nguoi_lien_he" not in bn_cols:
    c.execute("ALTER TABLE benh_nhan ADD COLUMN nguoi_lien_he VARCHAR(100);")
    print("Added nguoi_lien_he to benh_nhan")
if "sdt_nguoi_lien_he" not in bn_cols:
    c.execute("ALTER TABLE benh_nhan ADD COLUMN sdt_nguoi_lien_he VARCHAR(20);")
    print("Added sdt_nguoi_lien_he to benh_nhan")

# 2. luot_kham: ma_kcb
lk_cols = get_cols("luot_kham")
if "ma_kcb" not in lk_cols:
    c.execute("ALTER TABLE luot_kham ADD COLUMN ma_kcb VARCHAR(50);")
    c.execute("CREATE INDEX IF NOT EXISTS ix_luot_kham_ma_kcb ON luot_kham(ma_kcb);")
    print("Added ma_kcb to luot_kham")

conn.commit()
conn.close()
print("Migration 008 applied to SQLite clinic_local.db successfully!")
