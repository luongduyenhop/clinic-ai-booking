import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

def _parse_date_safe(val: Any, default: Optional[date] = None) -> date:
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, str) and val.strip():
        s = val.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                pass
    return default or date.today()

def _parse_decimal_safe(val: Any) -> Decimal:
    try:
        if val is None or val == "":
            return Decimal("0")
        return Decimal(str(val).replace(",", "").strip())
    except Exception:
        return Decimal("0")

def _normalize_voucher_code(val: Any) -> str:
    s = str(val or "").strip().upper()
    while s.startswith("HD-"):
        s = s[3:]
    return s

def _build_role_permissions(role_seed: dict, total_modules: int = 23) -> list[dict]:
    perms = role_seed.get("permissions")
    if isinstance(perms, list) and len(perms) == total_modules:
        return perms

    result = []
    full_access = bool(role_seed.get("fullAccess"))
    view_up_to = role_seed.get("viewUpTo")
    view_indices = set(role_seed.get("viewIndices") or [])
    add_indices = set(role_seed.get("addIndices") or [])
    edit_indices = set(role_seed.get("editIndices") or [])
    delete_indices = set(role_seed.get("deleteIndices") or [])
    print_indices = set(role_seed.get("printIndices") or [])

    for idx in range(total_modules):
        stt = idx + 1
        if full_access:
            result.append({"stt": stt, "xem": True, "them": True, "sua": True, "xoa": True, "inXuat": True})
        else:
            xem = (idx < view_up_to) if view_up_to is not None else (stt in view_indices)
            result.append({
                "stt": stt,
                "xem": bool(xem),
                "them": stt in add_indices,
                "sua": stt in edit_indices,
                "xoa": stt in delete_indices,
                "inXuat": stt in print_indices,
            })
    return result

def _classify_drug_group(name: str, active: str, code: str) -> str:
    s = f"{name or ''} {active or ''} {code or ''}".lower()
    if any(k in s for k in ["augmentin", "amoxicillin", "zinnat", "cefuroxime", "ciprofloxacin", "levofloxacin", "azithromycin", "klacid", "clarithromycin", "metronidazol", "kháng sinh"]):
        return "Kháng sinh kê đơn"
    if any(k in s for k in ["paracetamol", "panadol", "hapacol", "efferalgan", "hạ sốt"]):
        return "Giảm đau - Hạ sốt"
    if any(k in s for k in ["ibuprofen", "meloxicam", "celecoxib", "voltaren", "diclofenac"]):
        return "Kháng viêm không steroid (NSAID)"
    if any(k in s for k in ["chymotrypsin", "alphachymotrypsin", "medrol", "methylprednisolone"]):
        return "Kháng viêm - Giảm phù nề"
    if any(k in s for k in ["nexium", "omeprazol", "pantoprazol", "gaviscon", "yumangel", "dạ dày", "esomeprazole"]):
        return "Thuốc Dạ dày - Tiêu hóa"
    if any(k in s for k in ["motilium", "domperidone", "duspatalin", "debridat", "smecta", "hidrasec", "oresol", "enterogermina", "bioflora"]):
        return "Thuốc Tiêu hóa - Đường ruột"
    if any(k in s for k in ["amlodipin", "bisoprolol", "concor", "micardis", "telmisartan", "losartan", "coveram", "perindopril"]):
        return "Thuốc Tim mạch - Huyết áp"
    if any(k in s for k in ["lipitor", "atorvastatin", "crestor", "rosuvastatin", "mỡ máu", "lipid"]):
        return "Thuốc Tim mạch - Hạ lipid máu"
    if any(k in s for k in ["glucophage", "metformin", "diamicron", "gliclazide", "jardiance", "empagliflozin", "tiểu đường"]):
        return "Thuốc Điều trị Đái tháo đường"
    if any(k in s for k in ["telfast", "fexofenadine", "loratadin", "cetirizin", "aerius", "desloratadine", "singulair", "montelukast"]):
        return "Thuốc Chống dị ứng - Kháng Histamin"
    if any(k in s for k in ["ventolin", "salbutamol", "acemuc", "acetylcysteine", "prospan", "long đờm"]):
        return "Thuốc Hô hấp - Giảm ho & Giãn phế quản"
    if any(k in s for k in ["betaserc", "betahistine", "sibelium", "flunarizine", "tanakan", "ginkgo", "tiền đình"]):
        return "Thuốc Thần kinh - Tuần hoàn não & Tiền đình"
    if any(k in s for k in ["calci", "canxi", "vitamin", "3b", "kẽm", "gluconate", "khoáng chất"]):
        return "Vitamin & Khoáng chất"
    return "Thuốc kê đơn"

def _normalize_service_group(raw_group: Optional[str]) -> str:
    g = (raw_group or "").strip()
    mapping = {
        "KHAM": "Khám bệnh",
        "XN": "Xét nghiệm",
        "CDHA": "Chẩn đoán hình ảnh",
        "TDCN": "Thăm dò chức năng",
        "NS": "Nội soi",
        "TT": "Thủ thuật - VLTL",
        "CLS": "Cận lâm sàng",
    }
    return mapping.get(g, g or "Khám bệnh")

def _get_icd_chapter(code: str) -> str:
    c = (code or "").strip().upper()
    if not c:
        return "Chương khác"
    ch = c[0]
    if ch in ("A", "B"):
        return "Chương I: Bệnh nhiễm trùng và ký sinh trùng"
    if ch == "C" or (ch == "D" and len(c) > 1 and c[1] in "01234"):
        return "Chương II: Tân sinh (Khối u)"
    if ch == "D":
        return "Chương III: Bệnh của máu và cơ quan tạo máu"
    if ch == "E":
        return "Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa"
    if ch == "F":
        return "Chương V: Rối loạn tâm thần và hành vi"
    if ch == "G":
        return "Chương VI: Bệnh hệ thần kinh"
    if ch == "H" and len(c) > 1 and c[1] in "012345":
        return "Chương VII: Bệnh của mắt và phần phụ"
    if ch == "H":
        return "Chương VIII: Bệnh của tai và xương chũm"
    if ch == "I":
        return "Chương IX: Bệnh hệ tuần hoàn"
    if ch == "J":
        return "Chương X: Bệnh hệ hô hấp"
    if ch == "K":
        return "Chương XI: Bệnh hệ tiêu hóa"
    if ch == "L":
        return "Chương XII: Bệnh của da và mô dưới da"
    if ch == "M":
        return "Chương XIII: Bệnh hệ cơ-xương-khớp"
    if ch == "N":
        return "Chương XIV: Bệnh hệ sinh dục - tiết niệu"
    if ch == "O":
        return "Chương XV: Thai nghén, sinh đẻ và hậu sản"
    if ch == "P":
        return "Chương XVI: Một số tình trạng trong chu sinh"
    if ch == "Q":
        return "Chương XVII: Dị tật bẩm sinh, biến dạng"
    if ch == "R":
        return "Chương XVIII: Triệu chứng & dấu hiệu bất thường"
    if ch in ("S", "T"):
        return "Chương XIX: Tổn thương, ngộ độc"
    if ch in ("V", "W", "X", "Y"):
        return "Chương XX: Nguyên nhân ngoại lai của bệnh tật"
    if ch == "Z":
        return "Chương XXI: Yếu tố tiếp xúc dịch vụ y tế"
    if ch == "U":
        return "Chương XXII: Mã dùng cho mục đích đặc biệt"
    return "Chương khác"

def _is_infectious_icd(code: str, name: str) -> bool:
    c = (code or "").strip().upper()
    n = (name or "").lower()
    return c.startswith(("A", "B")) or any(k in n for k in ["truyền nhiễm", "dengue", "thủy đậu", "sốt rét", "lao", "dịch tả"])

def _make_dvt_code(name: str) -> str:
    nfd = unicodedata.normalize("NFD", name)
    ascii_str = "".join(c for c in nfd if unicodedata.category(c) != "Mn").replace("đ", "d").replace("Đ", "D")
    code = re.sub(r"[^A-Za-z0-9]+", "_", ascii_str).strip("_").upper()
    return code[:30] or "DVT"
