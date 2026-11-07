
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


def _diacritic_tokens(value: str) -> list[str]:
    value = unicodedata.normalize("NFC", value or "").lower()
    value = re.sub(r"[^\w\s]", " ", value)
    return value.split()


def _tone_marks(word: str) -> frozenset[str]:
    return frozenset(
        char for char in unicodedata.normalize("NFD", word)
        if unicodedata.combining(char)
    )


def _tones_compatible(original_word: str, alias_word: str) -> bool:
    original_marks = _tone_marks(original_word)
    alias_marks = _tone_marks(alias_word)
    if not original_marks or not alias_marks:
        return True
    return original_marks == alias_marks


def _span_tones_match(
    original_tokens: list[str],
    token_spans: list[tuple[int, int]],
    alias: str,
    start: int,
    end: int,
) -> bool:
    first = last = None
    for index, (token_start, token_end) in enumerate(token_spans):
        if token_start == start:
            first = index
        if token_end == end:
            last = index
            break
    if first is None or last is None:
        return True
    alias_tokens = _diacritic_tokens(alias)
    original_slice = original_tokens[first:last + 1]
    if len(original_slice) != len(alias_tokens):
        return True
    return all(
        _tones_compatible(original, alias_word)
        for original, alias_word in zip(original_slice, alias_tokens)
    )



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


FEATURE_ALIASES = {
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

    "eye_redness": ["đỏ mắt", "mắt đỏ", "mắt đỏ ngầu"],
    "bilateral_eye_redness": ["đỏ cả hai mắt", "hai mắt đỏ", "đỏ hai bên mắt"],
    "painless_red_eye": ["đỏ mắt không đau", "mắt đỏ nhưng không đau"],
    "acute_eye_pain": ["đau mắt", "mắt đau", "đau nhức mắt", "đau trong mắt"],
    "severe_eye_pain": ["đau mắt dữ dội", "đau mắt rất nhiều"],
    "sharp_eye_pain": ["đau nhói mắt", "đau xé trong mắt"],
    "deep_eye_pain": ["đau sâu trong mắt", "đau nhức sâu trong mắt"],
    "eye_pain_with_movement": ["đau mắt khi liếc", "đau khi đảo mắt", "đau mắt khi nhìn qua lại"],
    "corneal_pain": ["đau giác mạc", "đau ở giác mạc"],
    "photophobia": ["sợ ánh sáng", "chói mắt", "không chịu được ánh sáng", "nhạy cảm với ánh sáng"],
    "glare_sensitivity": ["chói mắt khi ra nắng", "lóa mắt", "ánh sáng làm chói"],
    "excessive_tearing": ["chảy nước mắt nhiều", "chảy nước mắt liên tục", "mắt đầm đìa nước"],
    "tearing": ["chảy nước mắt", "mắt chảy nước"],
    "watery_eyes": ["mắt ướt", "mắt đẫm nước"],
    "itchy_eyes": ["ngứa mắt", "mắt ngứa"],
    "itchy_watery_eyes": ["ngứa mắt chảy nước mắt", "mắt ngứa và chảy nước"],
    "severe_itchy_eyes": ["ngứa mắt dữ dội", "mắt ngứa rất nhiều"],
    "dry_eyes": ["khô mắt", "mắt khô", "mắt khô rát"],
    "dry_itchy_eye": ["mắt khô ngứa", "khô và ngứa mắt"],
    "eye_burning": ["mắt rát", "rát mắt", "nóng rát mắt"],
    "severe_eye_burning": ["mắt rát dữ dội", "bỏng rát mắt"],
    "eye_fatigue": ["mỏi mắt", "mắt mỏi"],
    "eye_strain": ["căng mắt", "mắt căng"],
    "eye_fatigue_reading": ["mỏi mắt khi đọc", "đọc sách bị mỏi mắt"],
    "binocular_discomfort": ["khó chịu hai mắt", "hai mắt không thoải mái"],
    "foreign_body_in_eye": ["dị vật trong mắt", "bụi vào mắt", "có dị vật trong mắt", "cát vào mắt"],
    "eye_trauma_history": ["chấn thương mắt", "bị đánh vào mắt", "va đập vào mắt"],
    "periorbital_bruising": ["bầm quanh mắt", "quầng thâm quanh mắt", "bầm tím quanh mắt"],
    "eyelid_edema": ["sưng mi mắt", "sưng mí mắt", "phù mi mắt"],
    "eyelid_erythema": ["mi mắt đỏ", "mí mắt đỏ"],
    "eyelid_heaviness": ["nặng mi mắt", "mi mắt nặng", "sụp mi"],
    "eyelid_sticking": ["dính mi mắt", "mi mắt dính"],
    "morning_eye_sticking": ["dính mắt buổi sáng", "ghèn dính mắt khi ngủ dậy"],
    "crusting_eyelids": ["đóng vảy mi mắt", "mi mắt đóng vảy"],
    "crusty_eyelids": ["ghèn khô ở mi mắt", "vảy khô mi mắt"],
    "purulent_eye_discharge": ["chảy mủ mắt", "mắt chảy mủ", "ghèn mủ", "dử mắt màu vàng xanh"],
    "conjunctival_discharge": ["chảy dịch kết mạc", "tiết dịch ở mắt"],
    "itchy_eyelids": ["ngứa mi mắt", "ngứa mí mắt"],
    "burning_eyelids": ["mi mắt rát", "rát mi mắt"],
    "red_eyelid_margins": ["bờ mi mắt đỏ", "viền mi mắt đỏ"],
    "flaky_eyelashes": ["lông mi có vảy", "vảy ở lông mi"],
    "eyelid_tenderness": ["ấn mi mắt đau", "mi mắt đau khi chạm"],
    "painful_eyelid_lump": ["cục đau ở mi mắt", "u mi mắt đau"],
    "localized_eyelid_swelling": ["sưng một bên mi mắt", "sưng khu trú mi mắt"],
    "chronic_eyelid_lump": ["cục mi mắt lâu ngày", "u mi mắt kéo dài"],
    "painless_eyelid_nodule": ["cục ở mi mắt không đau", "hạt ở mi mắt"],
    "painful_swelling_inner_eye": ["sưng đau góc mắt", "sưng đau khóe mắt"],
    "misaligned_eyes": ["lé mắt", "mắt lác", "hai mắt lệch"],
    "wandering_eye": ["mắt lác dao động", "mắt di chuyển bất thường"],
    "double_vision": ["nhìn đôi", "song thị", "nhìn thấy hai hình"],
    "cloudy_vision": ["nhìn như có mây", "nhìn mờ như sương", "mắt như có màng"],
    "distorted_blurred_vision": ["nhìn méo hình", "hình ảnh biến dạng"],
    "fluctuating_vision": ["thị lực lúc rõ lúc mờ", "nhìn lúc rõ lúc mờ"],
    "decreased_vision": ["giảm thị lực", "thị lực giảm", "nhìn kém"],
    "reduced_vision": ["suy giảm thị lực", "thị lực kém"],
    "poor_vision_in_one_eye": ["một mắt nhìn kém", "mắt một bên nhìn kém"],
    "sudden_vision_loss": ["mất thị lực đột ngột", "đột ngột mất thị lực", "nhìn không thấy đột ngột"],
    "painless_vision_loss": ["mất thị lực không đau", "mất thị lực mà không đau"],
    "painless_progressive_vision_loss": ["mất thị lực từ từ không đau", "giảm thị lực dần không đau"],
    "gradual_vision_loss": ["mất thị lực từ từ", "thị lực giảm dần"],
    "peripheral_vision_loss": ["mất thị lực ngoại vi", "thu hẹp thị trường"],
    "sudden_peripheral_vision_loss": ["mất thị lực ngoại vi đột ngột", "thu hẹp thị trường đột ngột"],
    "central_vision_loss": ["mất thị lực trung tâm", "không nhìn thấy ở giữa"],
    "tunnel_vision": ["nhìn như qua ống", "thị trường thu hẹp như đường hầm"],
    "shadow_curtain_over_vision": ["bóng đen như màn che trước mắt", "màn che trước mắt"],
    "dark_areas_in_vision": ["vùng tối trong tầm nhìn", "mảng tối trong mắt"],
    "dark_spot_central_vision": ["đốm đen trước mắt", "chấm đen giữa tầm nhìn"],
    "difficulty_night_vision": ["khó nhìn ban đêm", "nhìn kém khi tối"],
    "impaired_color_vision": ["nhìn sai màu", "mù màu", "khó phân biệt màu"],
    "colored_halos": ["quầng sáng quanh đèn", "thấy quầng sáng", "quầng màu quanh đèn"],
    "halo_around_lights": ["quầng sáng quanh nguồn sáng", "vòng sáng quanh đèn"],
    "bright_red_eye_patch": ["mảng đỏ ở mắt", "đốm đỏ trong mắt"],
    "subconjunctival_hemorrhage": ["xuất huyết dưới kết mạc", "máu đỏ trong lòng trắng mắt"],
    "corneal_redness": ["giác mạc đỏ"],
    "corneal_clouding": ["giác mạc mờ", "giác mạc đục"],
    "corneal_opacity": ["vết đục giác mạc", "sẹo giác mạc"],
    "corneal_arcus": ["vòng cung giác mạc", "vòng trắng quanh mống mắt"],
    "follicular_conjunctivitis": ["viêm kết mạc hạt", "kết mạc nổi hạt"],
    "conjunctival_blanching": ["kết mạc mất màu khi ấn"],
    "elevated_intraocular_pressure": ["tăng nhãn áp"],
    "pupil_dilation": ["đồng tử giãn"],
    "small_irregular_pupil": ["đồng tử nhỏ không đều"],
    "afferent_pupillary_defect": ["phản xạ đồng tử bất thường"],
    "exam_conjunctival_injection": ["kết mạc xung huyết", "xung huyết kết mạc"],
    "exam_corneal_opacity": ["soi thấy giác mạc đục"],
    "exam_pupil_abnormal": ["đồng tử bất thường"],
    "exam_intraocular_pressure_high": ["nhãn áp cao"],
    "emergency_eye_sign": ["dấu hiệu mắt cấp cứu"],
    "red_chemical_eye_burn": ["bỏng mắt do hóa chất", "hóa chất vào mắt"],
    "red_severe_eye_pain_with_headache": ["đau mắt dữ dội kèm đau đầu"],

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

    "toothache": ["đau răng", "nhức răng"],
    "severe_tooth_pain": ["đau răng dữ dội", "nhức răng dữ dội", "đau răng rất nhiều"],
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
    "facial_swelling": ["sưng mặt", "sưng hàm", "sưng má do răng"],
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
    "facial_swelling": "neg_no_facial_swelling",
    "abdominal_guarding": "neg_no_abdominal_guarding",
    "rash": "neg_no_rash",
    "pus_discharge": "neg_no_pus_discharge",
    "eye_redness": "neg_no_eye_redness",
    "acute_eye_pain": "neg_no_eye_pain",
    "decreased_vision": "neg_no_vision_loss",
}

NEGATORS = ("khong", "chua", "chang", "het", "khong co", "khong bi")

ALIAS_TRAILING_EXCLUSIONS = {"dau mat": {"ca"}, "nga": {"ba", "tu", "gia"}}

ORGAN_TRAUMA_KEYWORDS = (
    ("Mắt", ("chấn thương mắt", "va đập mắt", "bị đánh vào mắt", "tai nạn mắt", "dị vật trong mắt")),
    ("Răng Hàm Mặt", ("chấn thương răng", "gãy răng", "răng bị va đập", "tai nạn răng")),
    ("Tai Mũi Họng", ("chấn thương tai", "chấn thương mũi", "dị vật trong tai", "dị vật trong mũi")),
)

SURGERY_KEYWORDS = (
    "chấn thương", "tai nạn", "bị ngã", "ngã", "ngã xe", "té ngã", "ngã cầu thang",
    "va đập", "đập đầu", "gãy xương", "gãy",
    "hố chậu phải", "hố chậu", "cứng bụng", "bụng cứng",
    "đau dữ dội vùng bụng", "đau bụng dữ dội",
)

ORGAN_KEYWORD_ROUTES = (
    (
        "Mắt",
        (
            "đau mắt", "mắt đỏ", "đỏ mắt", "mờ mắt", "nhìn mờ", "sưng mí",
            "sưng mi", "cộm mắt", "ngứa mắt", "chảy nước mắt", "sợ ánh sáng",
            "nhức mắt", "đau nhức mắt",
        ),
    ),
    (
        "Răng Hàm Mặt",
        (
            "răng", "nướu", "sưng lợi", "đau lợi", "lợi sưng", "lợi đau",
            "chảy máu lợi", "viêm lợi", "mọc răng khôn", "sưng má", "răng hàm",
            "khớp hàm", "đau hàm", "sưng hàm", "hàm răng", "cứng hàm",
        ),
    ),
    (
        "Tai Mũi Họng",
        (
            "họng", "nuốt vướng", "amidan", "đau tai", "tai đau", "ù tai", "tai ù",
            "tai chảy mủ", "chảy mủ tai", "nghe kém", "ngứa tai", "nhức tai",
            "xoang", "nghẹt mũi", "chảy nước mũi", "sổ mũi",
        ),
    ),
)


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


AMBIGUOUS_RED_FLAG_ALIASES = {
    "Co giật": {"co giat": "co giật", "len con giat": "lên cơn giật"},
    "Rối loạn ý thức": {"hon me": "hôn mê"},
}


def _span_tones_match_strict(
    original_tokens: list[str],
    token_spans: list[tuple[int, int]],
    canonical: str,
    start: int,
    end: int,
) -> bool:
    first = last = None
    for index, (token_start, token_end) in enumerate(token_spans):
        if token_start == start:
            first = index
        if token_end == end:
            last = index
            break
    if first is None or last is None:
        return True
    canonical_tokens = _diacritic_tokens(canonical)
    original_slice = original_tokens[first:last + 1]
    if len(original_slice) != len(canonical_tokens):
        return True
    return all(
        not _tone_marks(original) or _tone_marks(original) == _tone_marks(expected)
        for original, expected in zip(original_slice, canonical_tokens)
    )


def detect_red_flags(text: str) -> list[str]:
    normalized = normalize_text(text)
    original_tokens = _diacritic_tokens(text)
    token_spans = [
        (match.start(), match.end()) for match in re.finditer(r"\S+", normalized)
    ]
    flags = []
    for label, patterns in RED_FLAG_PATTERNS.items():
        canonical_aliases = AMBIGUOUS_RED_FLAG_ALIASES.get(label, {})
        for pattern in patterns:
            if any(
                not _is_negated(normalized, match.start())
                and (
                    pattern not in canonical_aliases
                    or _span_tones_match_strict(
                        original_tokens,
                        token_spans,
                        canonical_aliases[pattern],
                        *match.span(),
                    )
                )
                for match in re.finditer(
                    rf"(?<!\w){re.escape(pattern)}(?!\w)", normalized
                )
            ):
                flags.append(label)
                break
    temperatures = _extract_temperatures(text)
    if temperatures and max(temperatures) >= 40.0:
        flags.append("Sốt rất cao (≥40°C)")

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


_CLAUSE_BOUNDARY_WORDS = {"nhung", "tuy", "nhien", "va", "roi", "sau", "do", "chi"}
_NEGATION_WORDS = {"khong", "chua", "chang", "het"}


def _is_negated_in_clause(text: str, start: int) -> bool:
    window: list[str] = []
    for token in reversed(text[max(0, start - 40):start].split()):
        if token in _CLAUSE_BOUNDARY_WORDS:
            break
        window.append(token)
        if len(window) >= 6:
            break
    return any(token in _NEGATION_WORDS for token in window)


def _find_keyword_hits(
    normalized: str,
    original_tokens: list[str],
    token_spans: list[tuple[int, int]],
    phrases,
) -> list[str]:
    hits: list[str] = []
    for phrase in phrases:
        alias = normalize_text(phrase)
        if not alias:
            continue
        for match in re.finditer(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized):
            start, end = match.span()
            if any(
                re.match(rf"\s+{re.escape(word)}(?!\w)", normalized[end:])
                for word in ALIAS_TRAILING_EXCLUSIONS.get(alias, ())
            ):
                continue
            if not _span_tones_match(original_tokens, token_spans, phrase, start, end):
                continue
            if _is_negated_in_clause(normalized, start):
                continue
            hits.append(phrase)
            break
    return hits


def route_by_keywords(text: str):
    normalized = normalize_text(text)
    if not normalized:
        return None
    original_tokens = _diacritic_tokens(text)
    token_spans = [
        (match.start(), match.end()) for match in re.finditer(r"\S+", normalized)
    ]

    for specialty, phrases in ORGAN_TRAUMA_KEYWORDS:
        hits = _find_keyword_hits(normalized, original_tokens, token_spans, phrases)
        if hits:
            return {"specialty": specialty, "keywords": hits, "rule": "organ_trauma"}

    surgery_hits = _find_keyword_hits(
        normalized, original_tokens, token_spans, SURGERY_KEYWORDS
    )
    if surgery_hits:
        return {
            "specialty": "Ngoại",
            "keywords": surgery_hits,
            "rule": "trauma_or_acute_abdomen",
        }

    organ_hits = []
    for specialty, phrases in ORGAN_KEYWORD_ROUTES:
        hits = _find_keyword_hits(normalized, original_tokens, token_spans, phrases)
        if hits:
            organ_hits.append(
                {"specialty": specialty, "keywords": hits, "rule": "organ_keyword"}
            )
    if len(organ_hits) == 1:
        return organ_hits[0]
    return None



def _fuzzy_matches(
    text: str,
    alias_index,
    already: set[str],
    blocked_spans=(),
    original_tokens=(),
):
    words = list(re.finditer(r"\S+", text))
    tokens = [match.group() for match in words]
    matches = []
    for size in (4, 3, 2, 1):
        for start in range(len(tokens) - size + 1):
            phrase_words = tokens[start:start + size]
            phrase = " ".join(phrase_words)
            if len(phrase) < 5:
                continue
            phrase_start = words[start].start()
            phrase_end = words[start + size - 1].end()
            if any(
                phrase_start < span_end and phrase_end > span_start
                for span_start, span_end in blocked_spans
            ):
                continue
            for alias, feature, original in alias_index:
                if feature in already or abs(len(alias) - len(phrase)) > 3:
                    continue
                alias_words = alias.split()
                if len(alias_words) != size:
                    continue
                tone_alias_words = _diacritic_tokens(original)
                if (
                    len(original_tokens) == len(tokens)
                    and len(tone_alias_words) == size
                    and any(
                        not _tones_compatible(
                            original_tokens[start + index], tone_alias_words[index]
                        )
                        for index in range(size)
                    )
                ):
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
    original_tokens = _diacritic_tokens(text)
    token_spans = [
        (match.start(), match.end()) for match in re.finditer(r"\S+", normalized)
    ]
    alias_index, display_names = _alias_index(valid)
    active: set[str] = set()
    negated_positive: set[str] = set()
    detections = []

    matched_spans: list[tuple[int, int]] = []
    for alias, feature, original in alias_index:
        for match in re.finditer(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized):
            start, end = match.span()
            if any(
                re.match(rf"\s+{re.escape(word)}(?!\w)", normalized[end:])
                for word in ALIAS_TRAILING_EXCLUSIONS.get(alias, ())
            ):
                matched_spans.append((start, end))
                continue
            if any(
                span_start <= start and end <= span_end
                for span_start, span_end in matched_spans
            ):
                continue
            if not _span_tones_match(original_tokens, token_spans, original, start, end):
                matched_spans.append((start, end))
                continue
            negated = _is_negated(normalized, start)
            matched_spans.append((start, end))
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

    fuzzy_blocked = active | negated_positive
    for feature, original, score in _fuzzy_matches(
        normalized, alias_index, fuzzy_blocked, matched_spans, original_tokens
    ):
        active.add(feature)
        detections.append((feature, original, "fuzzy", score))

    plausible_temperatures = _extract_temperatures(text)
    if plausible_temperatures:
        temperature = max(plausible_temperatures)
        if temperature >= 38.0 and "fever" in valid and "fever" not in active:
            active.add("fever")
            detections.append(("fever", f"nhiệt độ {temperature:g}°C", "numeric", 1.0))
        if temperature >= 39.0 and "high_fever" in valid and "high_fever" not in active:
            active.add("high_fever")
            detections.append(("high_fever", f"nhiệt độ {temperature:g}°C", "numeric", 1.0))

    age_match = re.search(r"\b(\d{1,3})\s*(tuoi|thang tuoi|ngay tuoi)\b", normalized)
    if age_match:
        age = int(age_match.group(1))
        unit = age_match.group(2)
        if unit == "ngay tuoi" and age <= 28:
            active.update({"age_newborn", "newborn_patient", "age_child"} & valid)
        elif unit in {"ngay tuoi", "thang tuoi"} and age < 24:
            active.update({"age_infant", "child_patient", "age_child"} & valid)
        elif unit == "tuoi":
            if age < 1:
                active.update({"age_infant", "child_patient", "age_child"} & valid)
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
