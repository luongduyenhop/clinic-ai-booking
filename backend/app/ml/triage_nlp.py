"""Vietnamese rule/fuzzy NLP for the 450-feature medical routing model.

This module is deliberately explainable: every detected feature is backed by
an alias or a structured regex. It is a routing aid, not a diagnostic system.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFC", value or "").lower().replace("đ", "d")
    value = "".join(
        char for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _extract_temperatures(text: str) -> list[float]:
    temperature_text = (text or "").lower().replace(",", ".")
    patterns = (
        r"(?:sốt|nhiệt\s*độ)\s*(\d{2}(?:\.\d)?)\s*(?:°\s*)?[cC]?",
        r"(\d{2}(?:\.\d)?)\s*(?:°\s*[cC]|độ(?:\s*[cC])?)",
    )
    values = []
    for pattern in patterns:
        values.extend(float(value) for value in re.findall(pattern, temperature_text))
    return [value for value in values if 34.0 <= value <= 43.0]


# Feature -> Vietnamese aliases. Aliases are normalized automatically, so each
# entry supports both accented and unaccented input.
FEATURE_ALIASES = {
    # General/internal medicine
    "fever": ["sốt", "nóng sốt"],
    "acute_fever": ["sốt cấp", "sốt đột ngột"],
    "high_fever": ["sốt cao", "sốt trên 39 độ"],
    "mild_fever": ["sốt nhẹ", "hơi sốt"],
    "chills": ["ớn lạnh", "rét run", "lạnh run"],
    "fatigue": ["mệt mỏi", "uể oải", "kiệt sức", "đuối sức"],
    "headache": ["đau đầu", "nhức đầu"],
    "severe_headache": ["đau đầu dữ dội", "nhức đầu dữ dội"],
    "one_sided_headache": ["đau nửa đầu", "đau đầu một bên"],
    "throbbing_headache": ["đau đầu theo nhịp", "đau đầu giật giật"],
    "dizziness": ["chóng mặt", "choáng váng", "xây xẩm"],
    "nausea": ["buồn nôn", "muốn ói"],
    "vomiting": ["nôn", "ói", "nôn mửa"],
    "persistent_vomiting": ["nôn liên tục", "nôn nhiều lần"],
    "loss_of_appetite": ["chán ăn", "ăn không ngon"],
    "weight_loss": ["sút cân", "giảm cân"],
    "weight_gain": ["tăng cân", "tăng cân nhanh"],
    "pallor": ["da xanh", "xanh xao", "nhợt nhạt"],
    "blurred_vision": ["nhìn mờ", "mờ mắt"],
    "palpitations": ["hồi hộp", "đánh trống ngực"],
    "rapid_heart_rate": ["tim đập nhanh", "mạch nhanh"],
    "high_blood_pressure": ["tăng huyết áp", "huyết áp cao"],
    "excessive_thirst": ["khát nhiều", "uống nhiều nước"],
    "frequent_urination": ["tiểu nhiều", "đi tiểu nhiều lần"],
    "increased_hunger": ["đói nhiều", "nhanh đói", "ăn nhiều"],
    "slow_wound_healing": ["vết thương lâu lành", "lâu lành vết thương"],
    "heat_intolerance": ["sợ nóng", "không chịu được nóng"],
    "cold_intolerance": ["sợ lạnh", "không chịu được lạnh"],
    "tremor": ["run tay", "tay run", "run rẩy"],
    "sweating": ["đổ mồ hôi", "vã mồ hôi"],
    "goiter": ["bướu cổ", "tuyến giáp to"],
    "brittle_nails": ["móng tay giòn", "móng dễ gãy"],
    "pica": ["ăn đất", "thèm ăn đồ không phải thức ăn"],
    "joint_pain": ["đau khớp", "nhức khớp"],
    "acute_joint_pain": ["đau khớp cấp", "đau khớp đột ngột"],
    "symmetric_joint_pain": ["đau khớp đối xứng", "đau hai bên khớp"],
    "morning_stiffness": ["cứng khớp buổi sáng", "khớp cứng khi ngủ dậy"],
    "swollen_small_joints": ["sưng khớp ngón tay", "sưng các khớp nhỏ"],
    "big_toe_joint_pain": ["đau khớp ngón chân cái", "đau ngón chân cái"],
    "red_swollen_joint": ["khớp sưng đỏ", "sưng đỏ khớp"],
    "leg_swelling": ["phù chân", "sưng chân"],
    "ankle_swelling": ["sưng mắt cá", "phù mắt cá chân"],
    "reduced_urine": ["tiểu ít", "giảm lượng nước tiểu"],
    "nocturia": ["tiểu đêm", "đi tiểu ban đêm"],
    "itchy_skin": ["ngứa da", "ngứa người"],
    "painful_urination": ["tiểu buốt", "đau khi tiểu"],
    "urinary_urgency": ["tiểu gấp", "mót tiểu"],
    "cloudy_urine": ["nước tiểu đục", "tiểu đục"],
    "foul_smelling_urine": ["nước tiểu hôi", "tiểu có mùi hôi"],
    "dark_urine": ["nước tiểu sẫm", "nước tiểu màu nâu"],
    "jaundice": ["vàng da", "vàng mắt"],
    "pale_stool": ["phân bạc màu", "phân trắng"],
    "heartburn": ["ợ nóng", "nóng rát sau xương ức"],
    "acid_regurgitation": ["ợ chua", "trào ngược", "dịch chua lên miệng"],
    "difficulty_swallowing": ["khó nuốt", "nuốt nghẹn"],
    "abdominal_pain": ["đau bụng", "đau vùng bụng"],
    "abdominal_cramps": ["đau quặn bụng", "bụng co thắt"],
    "epigastric_pain": ["đau thượng vị", "đau vùng trên rốn", "đau dạ dày"],
    "right_upper_abdominal_pain": ["đau hạ sườn phải", "đau bụng trên bên phải"],
    "right_lower_abdominal_pain": ["đau bụng dưới bên phải", "đau hố chậu phải"],
    "left_lower_abdominal_pain": ["đau bụng dưới bên trái", "đau hố chậu trái"],
    "abdominal_pain_migrates_right": ["đau bụng chuyển sang bên phải", "đau quanh rốn lan xuống phải"],
    "abdominal_tenderness": ["ấn bụng đau", "bụng đau khi ấn"],
    "abdominal_guarding": ["gồng cứng bụng", "phản ứng thành bụng"],
    "board_like_abdomen": ["bụng cứng như gỗ", "bụng cứng đờ"],
    "abdominal_distension": ["chướng bụng", "bụng trướng"],
    "bloating": ["đầy bụng", "đầy hơi"],
    "diarrhea": ["tiêu chảy", "đi ngoài lỏng", "đi phân lỏng"],
    "constipation": ["táo bón", "khó đi ngoài"],
    "black_stool": ["phân đen", "đi ngoài phân đen"],
    "blood_in_stool": ["phân có máu", "đi ngoài ra máu"],
    "vomiting_blood": ["nôn ra máu", "ói ra máu"],
    "cough": ["ho"],
    "dry_cough": ["ho khan"],
    "productive_cough": ["ho có đờm", "ho đờm"],
    "chronic_cough": ["ho kéo dài", "ho lâu ngày", "ho dai dẳng", "ho mãn tính"],
    "wheezing": ["khò khè", "thở khò khè"],
    "breathing_difficulty": ["khó thở", "hụt hơi"],
    "rapid_breathing": ["thở nhanh", "nhịp thở nhanh"],
    "chest_pain": ["đau ngực", "tức ngực"],
    "chest_tightness": ["nặng ngực", "thắt ngực"],
    "orthopnea": ["khó thở khi nằm", "phải ngồi để thở"],
    "low_oxygen": ["thiếu oxy", "saturation thấp", "spo2 thấp", "tím tái"],
    "pain_behind_eyes": ["đau sau hốc mắt", "nhức sau mắt"],
    "rash": ["phát ban", "nổi ban"],

    # General surgery
    "groin_bulge": ["khối phồng bẹn", "bẹn phồng", "u vùng bẹn"],
    "groin_discomfort": ["đau bẹn", "khó chịu vùng bẹn"],
    "pain_when_coughing": ["đau khi ho", "ho làm đau hơn"],
    "pain_when_lifting": ["đau khi nâng vật nặng", "đau khi mang nặng"],
    "pain_after_fatty_meal": ["đau sau ăn đồ dầu mỡ", "đau sau bữa ăn nhiều mỡ"],
    "pain_to_right_shoulder": ["đau lan vai phải", "đau lên bả vai phải"],
    "rectal_bleeding": ["chảy máu hậu môn", "đi cầu ra máu"],
    "bright_rectal_bleeding": ["máu đỏ tươi khi đi cầu", "đi ngoài máu đỏ tươi"],
    "anal_discomfort": ["khó chịu hậu môn", "đau rát hậu môn"],
    "anal_itching": ["ngứa hậu môn"],
    "anal_lump": ["búi trĩ", "cục ở hậu môn", "sa búi trĩ"],
    "painful_bowel_movement": ["đau khi đại tiện", "đi cầu đau"],
    "sharp_pain_with_defecation": ["đau nhói khi đi cầu", "đau xé hậu môn khi đại tiện"],
    "no_stool_or_gas": ["không trung tiện", "không đi cầu được", "bí trung đại tiện"],
    "colicky_abdominal_pain": ["đau bụng từng cơn", "đau quặn từng cơn"],
    "painful_skin_lump": ["cục sưng đau trên da", "khối da đau"],
    "skin_swelling": ["sưng da", "da bị sưng"],
    "skin_redness": ["da đỏ", "đỏ da"],
    "pus_discharge": ["chảy mủ", "có mủ"],
    "warm_skin": ["da nóng", "vùng da nóng"],
    "visible_leg_veins": ["nổi tĩnh mạch chân", "tĩnh mạch chân ngoằn ngoèo"],
    "leg_heaviness": ["nặng chân", "chân nặng"],
    "foot_ulcer": ["loét bàn chân", "vết loét chân"],
    "open_wound": ["vết thương hở", "rách da"],
    "active_bleeding": ["đang chảy máu", "máu chảy không cầm"],
    "neck_lump": ["khối ở cổ", "nổi cục ở cổ"],
    "breast_lump": ["khối ở vú", "cục ở vú"],

    # Pediatrics
    "child_patient": ["trẻ em", "bé", "em bé", "trẻ nhỏ"],
    "newborn_patient": ["trẻ sơ sinh", "bé sơ sinh"],
    "poor_feeding": ["bú kém", "bé bú kém", "trẻ bỏ bú", "bỏ bú", "ăn kém"],
    "feeding_difficulty": ["khó bú", "bú khó", "khó ăn"],
    "irritability": ["quấy khóc", "dễ cáu", "kích thích"],
    "lethargy": ["li bì", "lừ đừ", "khó đánh thức"],
    "chest_indrawing": ["rút lõm lồng ngực", "lõm ngực khi thở"],
    "mouth_ulcers": ["loét miệng", "nhiệt miệng"],
    "hand_foot_rash": ["nổi ban tay chân", "mụn nước lòng bàn tay bàn chân"],
    "barking_cough": ["ho ông ổng", "ho như chó sủa"],
    "hoarse_voice": ["khàn tiếng", "giọng khàn"],
    "noisy_breathing": ["thở rít", "thở có tiếng"],
    "high_fever_then_rash": ["sốt cao rồi phát ban", "hết sốt nổi ban"],
    "itchy_vesicular_rash": ["mụn nước ngứa", "ban phỏng nước ngứa"],
    "sandpaper_rash": ["ban nhám như giấy ráp", "ban đỏ sần"],
    "strawberry_tongue": ["lưỡi dâu tây", "lưỡi đỏ như dâu"],
    "seizure": ["co giật", "lên cơn co giật"],
    "generalized_shaking": ["co giật toàn thân", "giật toàn thân"],
    "non_blanching_rash": ["ban không mất khi ấn", "chấm xuất huyết không mất màu"],
    "neck_stiffness": ["cứng cổ", "cổ cứng"],
    "bulging_fontanelle": ["thóp phồng", "phồng thóp"],
    "parotid_swelling": ["sưng mang tai", "sưng tuyến mang tai"],
    "coughing_fits": ["ho thành cơn", "cơn ho liên tục"],
    "inspiratory_whoop": ["ho rít", "tiếng rít sau cơn ho"],
    "poor_weight_gain": ["chậm tăng cân", "không tăng cân"],
    "muscle_wasting": ["teo cơ", "gầy mòn"],
    "developmental_delay": ["chậm phát triển", "chậm biết đi nói"],

    # Dental/maxillofacial
    "toothache": ["đau răng", "nhức răng"],
    "severe_toothache": ["đau răng dữ dội", "nhức răng dữ dội"],
    "tooth_cavity": ["lỗ sâu răng", "răng bị sâu", "sâu răng"],
    "tooth_sensitivity": ["ê buốt răng", "răng nhạy cảm"],
    "pain_with_hot_cold": ["đau răng khi nóng lạnh", "ê buốt khi uống nóng lạnh"],
    "pain_when_biting": ["đau khi cắn", "nhai đau răng"],
    "night_tooth_pain": ["đau răng về đêm", "nhức răng ban đêm"],
    "bleeding_gums": ["chảy máu nướu", "chảy máu chân răng"],
    "swollen_gums": ["sưng nướu", "lợi sưng"],
    "red_gums": ["nướu đỏ", "lợi đỏ"],
    "gum_recession": ["tụt lợi", "tụt nướu", "chân răng lộ"],
    "loose_teeth": ["răng lung lay", "răng lỏng"],
    "bad_breath": ["hôi miệng", "hơi thở hôi"],
    "facial_jaw_swelling": ["sưng mặt", "sưng hàm", "sưng má do răng"],
    "bad_taste_in_mouth": ["miệng có vị hôi", "vị lạ trong miệng"],
    "wisdom_tooth_pain": ["đau răng khôn", "nhức răng số 8"],
    "limited_mouth_opening": ["há miệng hạn chế", "không há miệng được"],
    "jaw_joint_pain": ["đau khớp hàm", "đau khớp thái dương hàm"],
    "jaw_clicking": ["hàm kêu lục cục", "khớp hàm kêu"],
    "painful_mouth_ulcer": ["loét miệng đau", "vết loét trong miệng"],
    "white_oral_patches": ["mảng trắng trong miệng", "lưỡi có mảng trắng"],
    "nonhealing_mouth_ulcer": ["loét miệng lâu lành", "vết loét miệng không lành"],
    "oral_lump": ["khối trong miệng", "cục trong khoang miệng"],
    "chipped_broken_tooth": ["mẻ răng", "gãy răng", "răng bị vỡ"],
    "missing_tooth_after_trauma": ["răng bật khỏi ổ", "rụng răng do va đập"],
    "misaligned_teeth": ["răng lệch", "răng mọc không đều"],
    "abnormal_bite": ["sai khớp cắn", "cắn lệch"],
    "sleep_grinding": ["nghiến răng khi ngủ", "ngủ nghiến răng"],
    "meal_related_salivary_pain": ["đau tuyến nước bọt khi ăn", "ăn vào đau dưới hàm"],
    "salivary_gland_swelling": ["sưng tuyến nước bọt", "sưng dưới hàm khi ăn"],

    # ENT
    "sneezing": ["hắt hơi", "hắt xì"],
    "itchy_nose": ["ngứa mũi"],
    "runny_nose": ["sổ mũi", "chảy nước mũi"],
    "nasal_congestion": ["nghẹt mũi", "tắc mũi"],
    "chronic_nasal_congestion": ["nghẹt mũi kéo dài", "tắc mũi lâu ngày"],
    "thick_nasal_discharge": ["dịch mũi đặc", "mũi chảy dịch vàng xanh"],
    "facial_pain_pressure": ["đau căng mặt", "đau vùng xoang", "nặng mặt"],
    "reduced_smell": ["giảm ngửi", "mất khứu giác", "không ngửi thấy"],
    "postnasal_drip": ["dịch chảy xuống họng", "chảy dịch mũi sau"],
    "sore_throat": ["đau họng", "rát họng"],
    "swollen_tonsils": ["amidan sưng", "sưng amidan"],
    "painful_swallowing": ["nuốt đau", "đau khi nuốt"],
    "earache": ["đau tai", "nhức tai"],
    "ear_canal_pain": ["đau ống tai", "đau trong lỗ tai"],
    "pain_when_touching_ear": ["đau khi chạm tai", "kéo tai thấy đau"],
    "ear_discharge": ["chảy dịch tai", "tai chảy mủ"],
    "ear_itching": ["ngứa tai"],
    "reduced_hearing": ["nghe kém", "giảm thính lực", "lãng tai"],
    "sudden_one_sided_hearing_loss": ["đột ngột điếc một tai", "mất thính lực một bên đột ngột"],
    "tinnitus": ["ù tai", "tai kêu"],
    "ear_fullness": ["đầy tai", "cảm giác bịt tai"],
    "blocked_ear": ["tắc tai", "bít tai"],
    "ear_canal_swelling": ["sưng ống tai", "ống tai sưng"],
    "brief_positional_vertigo": ["chóng mặt khi đổi tư thế", "chóng mặt khi trở mình"],
    "acute_prolonged_vertigo": ["chóng mặt liên tục", "chóng mặt kéo dài"],
    "spinning_sensation": ["quay cuồng", "mọi thứ quay vòng"],
    "imbalance": ["mất thăng bằng", "đi không vững"],
    "nosebleed": ["chảy máu mũi", "chảy máu cam"],
    "one_sided_nasal_obstruction": ["nghẹt một bên mũi", "tắc một bên mũi"],
    "persistent_hoarseness": ["khàn tiếng kéo dài", "khàn giọng lâu ngày"],
    "voice_loss": ["mất tiếng", "không nói ra tiếng"],
    "muffled_voice": ["giọng ngậm hột thị", "giọng nói nghẹn"],
    "uvula_deviation": ["lưỡi gà lệch"],
    "drooling": ["chảy dãi", "chảy nước miếng không nuốt được"],
    "loud_snoring": ["ngáy to", "ngủ ngáy lớn"],
    "witnessed_apnea": ["ngưng thở khi ngủ", "đang ngủ ngừng thở"],
    "daytime_sleepiness": ["buồn ngủ ban ngày", "ngủ gật ban ngày"],
}


NEGATIVE_FEATURES = {
    "fever": "neg_no_fever",
    "chest_pain": "neg_no_chest_pain",
    "breathing_difficulty": "neg_no_breathing_difficulty",
    "vomiting": "neg_no_vomiting",
    "diarrhea": "neg_no_diarrhea",
    "weight_loss": "neg_no_weight_loss",
    "reduced_hearing": "neg_no_hearing_loss",
    "ear_discharge": "neg_no_ear_discharge",
    "sore_throat": "neg_no_sore_throat",
    "facial_jaw_swelling": "neg_no_facial_swelling",
    "abdominal_guarding": "neg_no_abdominal_guarding",
    "rash": "neg_no_rash",
    "pus_discharge": "neg_no_pus_discharge",
}

NEGATORS = ("khong", "chua", "chang", "het", "khong co", "khong bi")

RED_FLAG_PATTERNS = {
    "Khó thở nghiêm trọng": ["kho tho du doi", "khong tho duoc", "tim tai"],
    "Rối loạn ý thức": ["bat tinh", "hon me", "khong danh thuc duoc"],
    "Dấu hiệu đột quỵ": ["liet nua nguoi", "meo mieng", "noi ngong dot ngot"],
    "Co giật": ["co giat", "len con giat"],
    "Chảy máu nhiều": ["chay mau nhieu", "mau chay khong cam"],
    "Xuất huyết tiêu hóa": ["non ra mau", "di ngoai phan den", "di ngoai ra mau nhieu"],
    "Cứng cổ kèm sốt": ["sot cung co", "sot va cung co"],
    "Đau bụng cấp": ["dau bung du doi", "bung cung nhu go"],
    "Mất thính lực đột ngột": ["dot ngot diec mot tai", "mat thinh luc dot ngot"],
}


def _alias_index(valid_features: set[str]):
    index = []
    display = {}
    for feature, aliases in FEATURE_ALIASES.items():
        if feature not in valid_features:
            continue
        display[feature] = aliases[0]
        for alias in aliases:
            normalized = normalize_text(alias)
            if normalized:
                index.append((normalized, feature, alias))
    index.sort(key=lambda item: len(item[0]), reverse=True)
    return index, display


def detect_red_flags(text: str) -> list[str]:
    normalized = normalize_text(text)
    flags = [
        label for label, patterns in RED_FLAG_PATTERNS.items()
        if any(
            not _is_negated(normalized, match.start())
            for pattern in patterns
            for match in re.finditer(rf"(?<!\w){re.escape(pattern)}(?!\w)", normalized)
        )
    ]
    # Các cụm dễ trùng khi bỏ dấu (có giật/co giật, hôn mẹ/hôn mê)
    # đã được bộ lọc có phân biệt dấu của service xử lý trước đó.
    flags = [flag for flag in flags if flag not in {"Co giật", "Rối loạn ý thức"}]
    temperatures = _extract_temperatures(text)
    if temperatures and max(temperatures) >= 40.0:
        flags.append("Sốt rất cao (≥40°C)")

    # Fever in a baby younger than 3 months needs prompt medical assessment.
    age_in_days = re.search(r"\b(\d{1,2})\s*ngay tuoi\b", normalized)
    age_in_months = re.search(r"\b(\d{1,2})\s*thang tuoi\b", normalized)
    under_three_months = (
        bool(age_in_days and int(age_in_days.group(1)) <= 90)
        or bool(age_in_months and int(age_in_months.group(1)) < 3)
    )
    if temperatures and max(temperatures) >= 38.0 and under_three_months:
        flags.append("Trẻ dưới 3 tháng sốt ≥38°C")
    return list(dict.fromkeys(flags))


def _is_negated(text: str, start: int) -> bool:
    prefix = text[max(0, start - 22):start].strip()
    return any(prefix.endswith(negator) for negator in NEGATORS)


def _fuzzy_matches(text: str, alias_index, already: set[str]):
    words = text.split()
    matches = []
    for size in (4, 3, 2, 1):
        for start in range(len(words) - size + 1):
            phrase_words = words[start:start + size]
            phrase = " ".join(phrase_words)
            if len(phrase) < 5:
                continue
            for alias, feature, original in alias_index:
                if feature in already or abs(len(alias) - len(phrase)) > 3:
                    continue
                alias_words = alias.split()
                # Không so cụm khác số từ: điều này từng khiến "đau đầu,
                # chóng mặt" bị sửa sai thành "đau căng mặt".
                if len(alias_words) != size:
                    continue
                token_scores = [
                    SequenceMatcher(None, left, right).ratio()
                    for left, right in zip(phrase_words, alias_words)
                ]
                if any(
                    not left or not right or left[0] != right[0]
                    for left, right in zip(phrase_words, alias_words)
                ):
                    continue
                # Mọi từ ở cùng vị trí đều phải gần nhau. Nhờ đó "đau đầu"
                # không thể biến thành "đau họng" chỉ vì cùng có từ "đau".
                if size == 1:
                    if phrase_words[0][0] != alias_words[0][0] or token_scores[0] < 0.92:
                        continue
                elif token_scores[0] < 0.80 or min(token_scores) < 0.72:
                    continue
                score = SequenceMatcher(None, phrase, alias).ratio()
                if score >= 0.88:
                    matches.append((feature, original, score))
                    already.add(feature)
                    break
    return matches


def extract_features(
    text: str,
    feature_names: list[str],
    structured: dict[str, str] | None = None,
):
    valid = set(feature_names)
    normalized = normalize_text(text)
    alias_index, display_names = _alias_index(valid)
    active: set[str] = set()
    negated_positive: set[str] = set()
    detections = []

    # Exact, longest-phrase-first matching with explicit negation handling.
    for alias, feature, original in alias_index:
        for match in re.finditer(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized):
            negated = _is_negated(normalized, match.start())
            if negated:
                negated_positive.add(feature)
                negative = NEGATIVE_FEATURES.get(feature)
                if negative in valid:
                    active.add(negative)
                    detections.append((negative, f"không {original}", "negative", 1.0))
            elif feature not in active and feature not in negated_positive:
                active.add(feature)
                detections.append((feature, original, "exact", 1.0))
            break

    # Conservative fuzzy matching catches small typing errors without trying
    # to semantically invent symptoms that were not written.
    fuzzy_blocked = active | negated_positive
    for feature, original, score in _fuzzy_matches(normalized, alias_index, fuzzy_blocked):
        active.add(feature)
        detections.append((feature, original, "fuzzy", score))

    # Parse body temperature written as a number. Normalization removes the
    # degree symbol and punctuation, so accept both the original comma/dot
    # decimal form and the normalized integer form. A temperature context is
    # required to avoid treating unrelated numbers (age, dates, etc.) as fever.
    plausible_temperatures = _extract_temperatures(text)
    if plausible_temperatures:
        temperature = max(plausible_temperatures)
        if temperature >= 38.0 and "fever" in valid and "fever" not in active:
            active.add("fever")
            detections.append(("fever", f"nhiệt độ {temperature:g}°C", "numeric", 1.0))
        if temperature >= 39.0 and "high_fever" in valid and "high_fever" not in active:
            active.add("high_fever")
            detections.append(("high_fever", f"nhiệt độ {temperature:g}°C", "numeric", 1.0))

    # Text-derived demographic/context features.
    age_match = re.search(r"\b(\d{1,3})\s*(tuoi|thang tuoi|ngay tuoi)\b", normalized)
    if age_match:
        age = int(age_match.group(1))
        unit = age_match.group(2)
        if unit == "ngay tuoi" and age <= 28:
            active.update({"age_newborn", "newborn_patient"} & valid)
        elif unit == "thang tuoi" and age < 24:
            active.update({"age_infant", "child_patient"} & valid)
        elif unit == "tuoi":
            if age < 1:
                active.update({"age_infant", "child_patient"} & valid)
            elif age < 13:
                active.update({"age_child", "child_patient"} & valid)
            elif age < 18:
                active.add("age_adolescent") if "age_adolescent" in valid else None
            elif age < 60:
                active.add("age_adult") if "age_adult" in valid else None
            else:
                active.add("age_older_adult") if "age_older_adult" in valid else None

    structured = structured or {}
    for value in structured.values():
        if value in valid:
            active.add(value)

    # Common free-text context.
    context_patterns = {
        "onset_sudden": ["dot ngot", "bat ngo"],
        "onset_gradual": ["tu tu", "tang dan"],
        "onset_after_trauma": ["sau va dap", "sau chan thuong", "sau tai nan"],
        "onset_after_meal": ["sau khi an", "an xong"],
        "duration_hours": ["may gio", "vai gio"],
        "duration_1_3_days": ["mot ngay", "hai ngay", "ba ngay", "1 ngay", "2 ngay", "3 ngay"],
        "duration_4_7_days": ["mot tuan", "4 ngay", "5 ngay", "6 ngay", "7 ngay"],
        "duration_over_4_weeks": ["hon mot thang", "keo dai nhieu thang", "lau ngay"],
        "severity_mild": ["nhe", "hoi dau"],
        "severity_moderate": ["vua", "kha dau"],
        "severity_severe": ["nang", "du doi", "rat dau"],
        "sex_female": ["nu gioi", "phu nu", "be gai", "con gai"],
        "sex_male": ["nam gioi", "dan ong", "be trai", "con trai"],
        "pregnancy_possible": ["mang thai", "co bau", "thai phu"],
        "risk_smoking": ["hut thuoc", "nghien thuoc la"],
        "risk_alcohol": ["uong ruou", "nghien ruou"],
        "risk_diabetes": ["tieu duong", "dai thao duong"],
        "risk_hypertension": ["tang huyet ap", "huyet ap cao"],
        "risk_obesity": ["beo phi", "thua can"],
        "risk_allergy": ["co dia di ung", "tien su di ung"],
        "risk_poor_oral_hygiene": ["ve sinh rang mieng kem", "it danh rang"],
    }
    for feature, patterns in context_patterns.items():
        if feature in valid and any(pattern in normalized for pattern in patterns):
            active.add(feature)

    vector = {feature: int(feature in active) for feature in feature_names}
    clinical_detections = [d for d in detections if not d[0].startswith("neg_")]
    return {
        "vector": vector,
        "active_features": sorted(active),
        "detections": detections,
        "clinical_match_count": len({d[0] for d in clinical_detections}),
        "display_names": display_names,
        "normalized_text": normalized,
    }
