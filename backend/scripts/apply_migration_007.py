import sqlite3
from pathlib import Path

db_path = Path(__file__).resolve().parents[1] / "clinic_local.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

def get_cols(table):
    c.execute(f"PRAGMA table_info({table});")
    return [r[1] for r in c.fetchall()]

# 1. luot_kham
lk_cols = get_cols("luot_kham")
add_lk = [
    ("trieu_chung", "TEXT"),
    ("chan_doan_so_bo", "VARCHAR(255)"),
    ("tien_su_di_ung", "TEXT"),
    ("spo2", "NUMERIC(4, 1)"),
    ("bmi", "NUMERIC(4, 1)"),
    ("loi_dan_tai_kham", "TEXT")
]
for col_name, col_type in add_lk:
    if col_name not in lk_cols:
        c.execute(f"ALTER TABLE luot_kham ADD COLUMN {col_name} {col_type};")
        print(f"Added {col_name} to luot_kham")

# 2. don_thuoc
dt_cols = get_cols("don_thuoc")
if "so_ngay_dung" not in dt_cols:
    c.execute("ALTER TABLE don_thuoc ADD COLUMN so_ngay_dung INTEGER NOT NULL DEFAULT 5;")
    print("Added so_ngay_dung to don_thuoc")

# 3. chi_tiet_don_thuoc
ct_cols = get_cols("chi_tiet_don_thuoc")
add_ct = [
    ("lieu_sang", "VARCHAR(20) DEFAULT ''"),
    ("lieu_trua", "VARCHAR(20) DEFAULT ''"),
    ("lieu_chieu", "VARCHAR(20) DEFAULT ''"),
    ("lieu_toi", "VARCHAR(20) DEFAULT ''")
]
for col_name, col_type in add_ct:
    if col_name not in ct_cols:
        c.execute(f"ALTER TABLE chi_tiet_don_thuoc ADD COLUMN {col_name} {col_type};")
        print(f"Added {col_name} to chi_tiet_don_thuoc")

# 4. chi_dinh
cd_cols = get_cols("chi_dinh")
add_cd = [
    ("giam_gia", "NUMERIC(12, 2) NOT NULL DEFAULT 0.00"),
    ("thanh_tien", "NUMERIC(12, 2) NOT NULL DEFAULT 0.00")
]
for col_name, col_type in add_cd:
    if col_name not in cd_cols:
        c.execute(f"ALTER TABLE chi_dinh ADD COLUMN {col_name} {col_type};")
        print(f"Added {col_name} to chi_dinh")

conn.commit()
conn.close()
print("Migration 007 applied to SQLite clinic_local.db successfully!")
