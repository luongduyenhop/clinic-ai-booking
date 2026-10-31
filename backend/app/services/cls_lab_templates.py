"""Bộ chỉ số mẫu cho kết quả xét nghiệm máu (công thức máu, sinh hóa, mỡ máu...).

Để dạng cấu hình trong code (không cần bảng/migration mới). Khoảng tham chiếu dành cho người trưởng thành;
chỉ số khác nhau theo giới tính khai báo trong `theo_gioi_tinh`, khi chưa rõ giới tính thì dùng khoảng gộp của hai giới.
Ngưỡng nguy kịch (`nguy_kich_thap` / `nguy_kich_cao`) là giá trị biên: vượt qua (không tính bằng) mới là nguy hiểm.

Dịch vụ được ghép với mẫu theo `ma_dich_vu`, nếu không có thì theo từ khóa trong tên dịch vụ
(để dịch vụ do admin tự thêm như "Công thức máu", "Glucose máu" vẫn có mẫu).
"""
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

NAM = "NAM"
NU = "NU"

Range = Tuple[Optional[Decimal], Optional[Decimal]]


def _d(value) -> Optional[Decimal]:
    return None if value is None else Decimal(str(value))


@dataclass(frozen=True)
class LabIndicator:
    ma: str
    ten: str
    don_vi: str
    thap: Optional[Decimal] = None
    cao: Optional[Decimal] = None
    nguy_kich_thap: Optional[Decimal] = None
    nguy_kich_cao: Optional[Decimal] = None
    theo_gioi_tinh: Dict[str, Range] = field(default_factory=dict)

    def khoang(self, gioi_tinh: Optional[str]) -> Range:
        """Khoảng tham chiếu áp dụng cho giới tính; chưa rõ giới tính thì gộp khoảng của hai giới"""
        if not self.theo_gioi_tinh:
            return self.thap, self.cao
        if gioi_tinh in self.theo_gioi_tinh:
            return self.theo_gioi_tinh[gioi_tinh]
        lows = [lo for lo, _ in self.theo_gioi_tinh.values() if lo is not None]
        highs = [hi for _, hi in self.theo_gioi_tinh.values() if hi is not None]
        return (min(lows) if lows else None, max(highs) if highs else None)


def _ind(ma, ten, don_vi, thap=None, cao=None, nk_thap=None, nk_cao=None, nam=None, nu=None) -> LabIndicator:
    by_sex = {}
    if nam:
        by_sex[NAM] = (_d(nam[0]), _d(nam[1]))
    if nu:
        by_sex[NU] = (_d(nu[0]), _d(nu[1]))
    return LabIndicator(ma, ten, don_vi, _d(thap), _d(cao), _d(nk_thap), _d(nk_cao), by_sex)


@dataclass(frozen=True)
class LabTemplate:
    ma_mau: str
    ten_mau: str
    chi_so: List[LabIndicator]


_GLU = _ind("GLU", "Glucose máu lúc đói", "mmol/L", 3.9, 6.4, nk_thap=2.8, nk_cao=22.2)
_LIPID = [
    _ind("CHOL", "Cholesterol toàn phần", "mmol/L", cao=5.2),
    _ind("TG", "Triglycerid", "mmol/L", cao=1.7),
    _ind("HDL", "HDL-C", "mmol/L", thap=0.9),
    _ind("LDL", "LDL-C", "mmol/L", cao=3.4),
]

LAB_TEMPLATES: Dict[str, LabTemplate] = {
    "CTM": LabTemplate("CTM", "Tổng phân tích tế bào máu ngoại vi", [
        _ind("WBC", "Bạch cầu", "G/L", 4.0, 10.0, nk_thap=2.0, nk_cao=30.0),
        _ind("NEU%", "Bạch cầu trung tính", "%", 40, 75),
        _ind("LYM%", "Bạch cầu lympho", "%", 20, 40),
        _ind("RBC", "Hồng cầu", "T/L", nam=(4.2, 5.4), nu=(3.8, 5.0)),
        _ind("HGB", "Huyết sắc tố", "g/L", nk_thap=70, nk_cao=200, nam=(130, 170), nu=(120, 150)),
        _ind("HCT", "Hematocrit", "L/L", nk_thap=0.20, nk_cao=0.60, nam=(0.40, 0.50), nu=(0.36, 0.46)),
        _ind("MCV", "Thể tích trung bình hồng cầu", "fL", 80, 100),
        _ind("MCH", "Lượng Hb trung bình hồng cầu", "pg", 27, 32),
        _ind("PLT", "Tiểu cầu", "G/L", 150, 400, nk_thap=50, nk_cao=1000),
    ]),
    "SINH_HOA": LabTemplate("SINH_HOA", "Sinh hóa máu cơ bản", [
        _GLU,
        _ind("URE", "Ure", "mmol/L", 2.5, 7.5, nk_cao=30),
        _ind("CREA", "Creatinin", "µmol/L", nk_cao=500, nam=(62, 120), nu=(53, 100)),
        _ind("AST", "AST (GOT)", "U/L", cao=37, nk_cao=1000),
        _ind("ALT", "ALT (GPT)", "U/L", cao=40, nk_cao=1000),
        *_LIPID,
    ]),
    "GLUCOSE": LabTemplate("GLUCOSE", "Glucose máu", [_GLU]),
    "MO_MAU": LabTemplate("MO_MAU", "Bộ mỡ máu", list(_LIPID)),
    "CRP": LabTemplate("CRP", "CRP định lượng", [_ind("CRP", "CRP định lượng", "mg/L", cao=5)]),
}

_MA_DICH_VU_TO_TEMPLATE = {
    "DV_XN_MAU": "CTM",
    "DV_XN_SINH_HOA": "SINH_HOA",
    "DV_XN_GLUCOSE": "GLUCOSE",
    "DV_XN_MO_MAU": "MO_MAU",
    "DV_XN_CRP": "CRP",
}

# Từ khóa (không dấu, chữ thường) trong tên dịch vụ -> mẫu; xét theo thứ tự, "sinh hóa" đứng trước "glucose"
_TEN_KEYWORDS = (
    (("te bao mau", "cong thuc mau", "huyet do"), "CTM"),
    (("sinh hoa",), "SINH_HOA"),
    (("mo mau", "lipid"), "MO_MAU"),
    (("glucose", "duong huyet", "duong mau"), "GLUCOSE"),
    (("crp",), "CRP"),
)


def _khong_dau(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower()).replace("đ", "d")
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def find_lab_template(ma_dich_vu: Optional[str], ten_dich_vu: Optional[str]) -> Optional[LabTemplate]:
    key = _MA_DICH_VU_TO_TEMPLATE.get((ma_dich_vu or "").strip().upper())
    if key:
        return LAB_TEMPLATES[key]
    ten = _khong_dau(ten_dich_vu or "")
    for keywords, template_key in _TEN_KEYWORDS:
        if any(k in ten for k in keywords):
            return LAB_TEMPLATES[template_key]
    return None


def normalize_gioi_tinh(gioi_tinh: Optional[str]) -> Optional[str]:
    value = _khong_dau((gioi_tinh or "").strip())
    if value in ("nam", "m", "male"):
        return NAM
    if value in ("nu", "f", "female"):
        return NU
    return None
