"""Generate an expanded, auditable synthetic dataset for five specialties:
Nội tổng quát, Ngoại, Mắt, Răng Hàm Mặt, Tai Mũi Họng.

Educational/prototyping use only. The profiles are synthetic and require
specialist clinical review before any real-world healthcare use.
"""
from __future__ import annotations

import csv
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEED = 20261024
SAMPLES_PER_DISEASE = 100


def p(key, vi, specialty, symptoms):
    tokens = symptoms.split()
    return (key, vi, specialty, tokens[:2], tokens[2:])


PROFILES = [
    # ==========================================
    # 1. MẮT (Ophthalmology) - 32 diseases
    # ==========================================
    p("acute_conjunctivitis", "Viêm kết mạc cấp", "Mắt", "eye_redness conjunctival_discharge watery_eyes itchy_eyes foreign_body_sensation eyelid_sticking"),
    p("allergic_conjunctivitis", "Viêm kết mạc dị ứng", "Mắt", "severe_itchy_eyes watery_eyes bilateral_eye_redness eyelid_edema allergic_history seasonal_trigger"),
    p("bacterial_conjunctivitis", "Viêm kết mạc do vi khuẩn", "Mắt", "purulent_eye_discharge crusty_eyelids eye_redness eye_burning foreign_body_sensation morning_eye_sticking"),
    p("viral_conjunctivitis", "Viêm kết mạc do virus", "Mắt", "watery_discharge follicular_conjunctivitis eye_redness preauricular_node foreign_body_sensation recent_viral_illness"),
    p("dry_eye_syndrome", "Hội chứng khô mắt", "Mắt", "dry_eyes eye_burning foreign_body_sensation eye_fatigue prolonged_screen_use stringy_mucus"),
    p("cataract", "Đục thủy tinh thể", "Mắt", "painless_progressive_vision_loss cloudy_vision glare_sensitivity halo_around_lights faded_colors older_age"),
    p("acute_angle_closure_glaucoma", "Glôcôm góc đóng cấp", "Mắt", "severe_eye_pain one_sided_headache blurred_vision colored_halos nausea vomiting pupil_dilation"),
    p("open_angle_glaucoma", "Glôcôm góc mở", "Mắt", "peripheral_vision_loss gradual_vision_loss elevated_intraocular_pressure painless_vision_loss tunnel_vision family_glaucoma_risk"),
    p("corneal_ulcer", "Loét giác mạc", "Mắt", "severe_eye_pain corneal_opacity photophobia purulent_eye_discharge reduced_vision contact_lens_risk"),
    p("keratitis", "Viêm giác mạc", "Mắt", "corneal_pain photophobia watery_eyes foreign_body_sensation blurred_vision corneal_redness"),
    p("hordeolum_stye", "Lẹo mắt", "Mắt", "painful_eyelid_lump eyelid_erythema localized_eyelid_swelling pus_head eyelid_tenderness"),
    p("chalazion", "Chắp mắt", "Mắt", "painless_eyelid_nodule chronic_eyelid_lump blurred_vision eyelid_heaviness non_tender_mass"),
    p("blepharitis", "Viêm bờ mi", "Mắt", "flaky_eyelashes burning_eyelids red_eyelid_margins itchy_eyelids crusting_eyelids foreign_body_sensation"),
    p("subconjunctival_hemorrhage", "Xuất huyết dưới kết mạc", "Mắt", "bright_red_eye_patch painless_red_eye no_vision_change coughing_straining_risk no_discharge"),
    p("myopia_progression", "Cận thị tiến triển", "Mắt", "blurred_distance_vision squinting_to_see eye_strain headache near_vision_clear"),
    p("astigmatism", "Loạn thị", "Mắt", "distorted_blurred_vision eye_strain headache squinting difficulty_night_vision"),
    p("hyperopia", "Viễn thị", "Mắt", "blurred_near_vision eye_fatigue_reading frontal_headache eye_strain binocular_discomfort"),
    p("presbyopia", "Lão thị", "Mắt", "difficulty_reading_fine_print holding_reading_material_farther eye_fatigue headache_after_reading older_age"),
    p("age_related_macular_degeneration", "Thoái hóa hoàng điểm tuổi già", "Mắt", "central_vision_loss distorted_straight_lines dark_spot_central_vision difficulty_recognizing_faces older_age"),
    p("retinal_detachment", "Bong võng mạc", "Mắt", "sudden_floaters light_flashes shadow_curtain_over_vision sudden_peripheral_vision_loss painless_vision_loss"),
    p("diabetic_retinopathy", "Bệnh võng mạc đái tháo đường", "Mắt", "fluctuating_vision floaters blurred_vision dark_areas_in_vision diabetes_history"),
    p("hypertensive_retinopathy", "Bệnh võng mạc tăng huyết áp", "Mắt", "blurred_vision headache double_vision flame_shaped_hemorrhages hypertension_history"),
    p("dacryocystitis", "Viêm túi lệ", "Mắt", "painful_swelling_inner_eye pus_reflux_from_puncta excessive_tearing inner_canthus_erythema fever"),
    p("anterior_uveitis", "Viêm màng bồ đào trước", "Mắt", "deep_eye_pain ciliary_flush photophobia blurred_vision small_irregular_pupil autoimmune_risk"),
    p("posterior_uveitis", "Viêm màng bồ đào sau", "Mắt", "painless_floaters blurred_vision decreased_vision visual_distortion vitreous_haze"),
    p("corneal_abrasion", "Trầy xước giác mạc", "Mắt", "severe_foreign_body_sensation acute_eye_pain excessive_tearing photophobia eye_trauma_history"),
    p("ocular_chemical_burn", "Bỏng mắt do hóa chất", "Mắt", "chemical_exposure_history severe_eye_burning conjunctival_blanching corneal_clouding intense_pain emergency_eye_sign"),
    p("ocular_foreign_body", "Dị vật kết giác mạc", "Mắt", "foreign_body_in_eye sharp_eye_pain tearing scratchy_sensation history_of_grinding_metal"),
    p("pterygium", "Mộng thịt", "Mắt", "fibrovascular_tissue_growth dry_itchy_eye foreign_body_sensation reduced_vision outdoor_uv_risk"),
    p("amblyopia", "Nhược thị", "Mắt", "poor_vision_in_one_eye lack_of_depth_perception wandering_eye squinting childhood_onset"),
    p("strabismus", "Lác mắt", "Mắt", "misaligned_eyes double_vision head_tilting eye_strain lack_of_coordination"),
    p("optic_neuritis", "Viêm thị thần kinh", "Mắt", "eye_pain_with_movement sudden_vision_loss impaired_color_vision afferent_pupillary_defect young_female_risk"),

    # ==========================================
    # 2. NỘI TỔNG QUÁT (Internal Medicine) - 32 diseases
    # ==========================================
    p("gerd", "Trào ngược dạ dày thực quản", "Nội tổng quát", "heartburn acid_regurgitation chest_discomfort difficulty_swallowing chronic_cough nausea"),
    p("hypertension", "Tăng huyết áp", "Nội tổng quát", "high_blood_pressure palpitations headache dizziness blurred_vision chest_discomfort fatigue"),
    p("type_2_diabetes", "Đái tháo đường típ 2", "Nội tổng quát", "excessive_thirst frequent_urination increased_hunger fatigue blurred_vision slow_wound_healing weight_loss"),
    p("viral_gastroenteritis", "Viêm dạ dày ruột do virus", "Nội tổng quát", "diarrhea abdominal_cramps nausea vomiting mild_fever dehydration loss_of_appetite"),
    p("migraine", "Đau nửa đầu", "Nội tổng quát", "one_sided_headache throbbing_headache nausea vomiting light_sensitivity sound_sensitivity visual_aura"),
    p("community_acquired_pneumonia", "Viêm phổi cộng đồng", "Nội tổng quát", "cough fever productive_cough breathing_difficulty chest_pain chills crackles low_oxygen"),
    p("bronchial_asthma", "Hen phế quản", "Nội tổng quát", "wheezing episodic_breathlessness chest_tightness cough nighttime_symptoms allergen_trigger prolonged_expiration"),
    p("copd_exacerbation", "Đợt cấp COPD", "Nội tổng quát", "chronic_cough worsening_breathlessness increased_sputum purulent_sputum wheezing smoking_history low_oxygen"),
    p("influenza", "Cúm", "Nội tổng quát", "acute_fever myalgia dry_cough headache fatigue sore_throat chills"),
    p("dengue", "Sốt xuất huyết Dengue", "Nội tổng quát", "high_fever severe_myalgia headache pain_behind_eyes rash bleeding_gums abdominal_pain warning_lethargy"),
    p("iron_deficiency_anemia", "Thiếu máu thiếu sắt", "Nội tổng quát", "fatigue pallor exertional_breathlessness dizziness palpitations brittle_nails pica heavy_menses"),
    p("hyperthyroidism", "Cường giáp", "Nội tổng quát", "weight_loss palpitations heat_intolerance tremor sweating anxiety increased_appetite goiter"),
    p("hypothyroidism", "Suy giáp", "Nội tổng quát", "fatigue cold_intolerance weight_gain constipation dry_skin slow_heart_rate puffy_face hoarse_voice"),
    p("gout", "Gút", "Nội tổng quát", "acute_joint_pain red_swollen_joint big_toe_joint_pain severe_tenderness recurrent_attacks high_purine_risk"),
    p("rheumatoid_arthritis", "Viêm khớp dạng thấp", "Nội tổng quát", "symmetric_joint_pain morning_stiffness swollen_small_joints fatigue reduced_grip joint_warmth"),
    p("chronic_kidney_disease", "Bệnh thận mạn", "Nội tổng quát", "leg_swelling fatigue reduced_urine nausea itchy_skin high_blood_pressure nocturia pallor"),
    p("urinary_tract_infection", "Nhiễm trùng đường tiết niệu", "Nội tổng quát", "painful_urination frequent_urination urinary_urgency lower_abdominal_pain cloudy_urine foul_smelling_urine fever"),
    p("hepatitis", "Viêm gan", "Nội tổng quát", "jaundice dark_urine fatigue loss_of_appetite nausea right_upper_abdominal_pain pale_stool"),
    p("peptic_ulcer", "Loét dạ dày tá tràng", "Nội tổng quát", "epigastric_pain meal_related_pain nausea bloating black_stool vomiting_blood nsaid_risk"),
    p("heart_failure", "Suy tim", "Nội tổng quát", "exertional_breathlessness leg_swelling orthopnea nighttime_breathlessness fatigue lung_crackles rapid_heart_rate"),
    p("tension_headache", "Đau đầu căng thẳng", "Nội tổng quát", "band_like_headache bilateral_headache neck_muscle_tightness mild_to_moderate_pain stress_trigger no_nausea"),
    p("irritable_bowel_syndrome", "Hội chứng ruột kích thích", "Nội tổng quát", "recurrent_abdominal_pain bloating relief_after_defecation alternating_diarrhea_constipation mucus_in_stool stress_related"),
    p("osteoarthritis", "Thoái hóa khớp", "Nội tổng quát", "joint_pain_with_movement crepitus morning_stiffness_under_30min limited_joint_flexibility knee_pain joint_enlargement"),
    p("systemic_lupus_erythematosus", "Lupus ban đỏ hệ thống", "Nội tổng quát", "malar_rash photosensitivity polyarthritis oral_ulcers unexplained_fever fatigue kidney_involvement"),
    p("dyslipidemia", "Rối loạn lipid máu", "Nội tổng quát", "asymptomatic_presentation xanthoma corneal_arcus chest_discomfort high_cholesterol_risk obesity_risk"),
    p("angina_pectoris", "Cơn đau thắt ngực ổn định", "Nội tổng quát", "substernal_chest_pressure pain_radiates_to_left_arm exertional_chest_pain relief_with_rest shortness_of_breath coronary_risk"),
    p("acute_bronchitis", "Viêm phế quản cấp", "Nội tổng quát", "acute_cough sputum_production mild_fever chest_soreness wheezing fatigue recent_cold"),
    p("chronic_pancreatitis", "Viêm tụy mạn", "Nội tổng quát", "chronic_epigastric_pain greasy_smelly_stools weight_loss malabsorption alcohol_abuse_history diabetes_onset"),
    p("non_alcoholic_fatty_liver", "Gan nhiễm mỡ không do rượu", "Nội tổng quát", "mild_right_upper_abdominal_discomfort fatigue hepatomegaly metabolic_syndrome obesity_risk elevated_liver_enzymes"),
    p("cushing_syndrome", "Hội chứng Cushing", "Nội tổng quát", "moon_face buffalo_hump central_obesity purple_abdominal_striae easy_bruising proximal_muscle_weakness hypertension"),
    p("addison_disease", "Bệnh suy thượng thận mạn", "Nội tổng quát", "chronic_fatigue skin_hyperpigmentation weight_loss low_blood_pressure salt_craving dizziness nausea"),
    p("osteoporosis", "Loãng xương", "Nội tổng quát", "loss_of_height dowager_hump back_pain fragility_fracture older_age postmenopausal_female"),

    # ==========================================
    # 3. NGOẠI (Surgery) - 32 diseases
    # ==========================================
    p("appendicitis", "Viêm ruột thừa", "Ngoại", "right_lower_abdominal_pain sudden_onset_abdominal_pain loss_of_appetite nausea vomiting fever abdominal_tenderness"),
    p("hemorrhoids", "Bệnh trĩ", "Ngoại", "rectal_bleeding perianal_pain anal_itching painful_bowel_movement anal_lump constipation"),
    p("inguinal_hernia", "Thoát vị bẹn", "Ngoại", "groin_lump groin_pain pain_when_coughing pain_when_lifting abdominal_pressure nausea"),
    p("acute_cholecystitis", "Viêm túi mật cấp", "Ngoại", "right_upper_abdominal_pain severe_epigastric_pain fever nausea vomiting pain_to_right_shoulder abdominal_tenderness"),
    p("skin_abscess", "Áp xe da", "Ngoại", "painful_skin_lump skin_fluctuance skin_redness pus_discharge fever warm_skin"),
    p("bowel_obstruction", "Tắc ruột", "Ngoại", "colicky_abdominal_pain vomiting abdominal_distension no_stool_or_gas high_pitched_bowel_sounds dehydration prior_surgery_risk"),
    p("perforated_peptic_ulcer", "Thủng ổ loét dạ dày tá tràng", "Ngoại", "sudden_severe_abdominal_pain board_like_abdomen abdominal_guarding nausea shock_signs free_air_sign"),
    p("acute_pancreatitis", "Viêm tụy cấp", "Ngoại", "severe_epigastric_pain pain_to_back vomiting abdominal_tenderness alcohol_risk gallstone_risk fever"),
    p("diverticulitis", "Viêm túi thừa đại tràng", "Ngoại", "left_lower_abdominal_pain fever bowel_habit_change abdominal_tenderness nausea older_age"),
    p("perianal_abscess", "Áp xe hậu môn", "Ngoại", "severe_anal_pain perianal_swelling fever pus_discharge pain_when_sitting diabetes_risk"),
    p("anal_fissure", "Nứt kẽ hậu môn", "Ngoại", "sharp_pain_with_defecation bright_rectal_bleeding constipation anal_spasm fear_of_defecation"),
    p("pilonidal_sinus", "Nang lông vùng cùng cụt", "Ngoại", "painful_tailbone_lump pus_discharge skin_redness fever prolonged_sitting_risk recurrent_swelling"),
    p("varicose_veins", "Suy giãn tĩnh mạch", "Ngoại", "visible_leg_veins leg_heaviness leg_aching ankle_swelling worse_after_standing skin_discoloration"),
    p("diabetic_foot_infection", "Nhiễm trùng bàn chân đái tháo đường", "Ngoại", "foot_ulcer pus_discharge skin_redness foot_swelling fever diabetes_history reduced_foot_sensation"),
    p("breast_abscess", "Áp xe vú", "Ngoại", "painful_breast_lump breast_redness fever breast_warmth pus_discharge breastfeeding_risk"),
    p("thyroid_nodule", "Nhân tuyến giáp", "Ngoại", "neck_lump thyroid_nodule difficulty_swallowing hoarse_voice rapid_growth_sign enlarged_neck_nodes"),
    p("soft_tissue_tumor", "U mô mềm", "Ngoại", "growing_soft_tissue_lump painless_lump firm_mass fixed_mass large_mass_size unexplained_weight_loss"),
    p("lipoma", "U mỡ", "Ngoại", "soft_subcutaneous_lump mobile_lump painless_lump slow_growth normal_overlying_skin"),
    p("ganglion_cyst", "Nang hoạt dịch", "Ngoại", "wrist_hand_lump size_changes_with_activity joint_discomfort firm_cyst reduced_joint_motion"),
    p("traumatic_wound", "Vết thương phần mềm", "Ngoại", "open_wound active_bleeding wound_pain contaminated_wound foreign_body_sign numbness_near_wound"),
    p("umbilical_hernia", "Thoát vị rốn", "Ngoại", "umbilicus_bulge soft_umbilical_mass bulge_increases_with_coughing reducible_bulge abdominal_discomfort"),
    p("femoral_hernia", "Thoát vị đùi", "Ngoại", "upper_thigh_groin_lump groin_pain tender_femoral_bulge high_strangulation_risk female_prevalence"),
    p("biliary_colic_cholelithiasis", "Sỏi túi mật", "Ngoại", "episodic_right_upper_pain pain_after_fatty_meal nausea radiating_right_scapula no_fever gallstones_known"),
    p("choledocholithiasis", "Sỏi ống mật chủ", "Ngoại", "charcot_triad_pain jaundice fever chills dark_urine pruritus"),
    p("acute_mesenteric_ischemia", "Thiếu máu mạc treo cấp", "Ngoại", "pain_out_of_proportion sudden_severe_periumbilical_pain vomiting bloody_diarrhea cardiac_embolism_risk metabolic_acidosis"),
    p("incarcerated_hernia", "Thoát vị nghẹt", "Ngoại", "irreducible_painful_groin_bulge severe_groin_pain vomiting redness_over_hernia bowel_obstruction_signs emergency_surgery_sign"),
    p("lower_gi_bleeding", "Xuất huyết tiêu hóa dưới", "Ngoại", "hematochezia large_amount_red_blood dizziness pallor orthostatic_hypotension weakness"),
    p("renal_colic_nephrolithiasis", "Sỏi thận", "Ngoại", "flank_pain sudden_severe_colic radiating_to_groin hematuria nausea vomiting restlessness"),
    p("ureteral_calculus", "Sỏi niệu quản", "Ngoại", "severe_radiating_flank_pain painful_frequent_urination macroscopic_hematuria nausea fever_if_infected hydronephrosis"),
    p("breast_fibroadenoma", "U xơ tuyến vú", "Ngoại", "firm_rubbery_breast_lump well_defined_mobile_lump painless_breast_nodule young_female hormonal_fluctuation"),
    p("cellulitis", "Viêm mô tế bào", "Ngoại", "diffuse_spreading_skin_redness skin_warmth_swelling tenderness fever skin_breakdown_portal"),
    p("carbuncle", "Nhọt cụm", "Ngoại", "cluster_of_boils multiple_pus_draining_openings severe_throbbing_skin_pain fever chills posterior_neck_location"),

    # ==========================================
    # 4. RĂNG HÀM MẶT (Maxillofacial) - 32 diseases
    # ==========================================
    p("dental_caries", "Sâu răng", "Răng Hàm Mặt", "tooth_cavity pain_when_eating toothache pain_with_sweets pain_with_hot_cold bad_breath"),
    p("pulpitis", "Viêm tủy răng", "Răng Hàm Mặt", "throbbing_tooth_pain prolonged_cold_pain night_tooth_pain pain_when_biting pain_radiates_to_jaw tooth_sensitivity"),
    p("gingivitis", "Viêm nướu", "Răng Hàm Mặt", "bleeding_gums_brushing swollen_gums red_gums bad_breath gum_tenderness gum_recession"),
    p("periodontitis", "Viêm nha chu", "Răng Hàm Mặt", "loose_teeth deep_gum_pockets bleeding_gums swollen_gums bad_breath pain_when_chewing pus_between_teeth_gums"),
    p("dental_abscess", "Áp xe quanh chóp răng", "Răng Hàm Mặt", "severe_constant_tooth_pain facial_gum_swelling fever bad_taste_in_mouth pain_when_biting swollen_neck_nodes hot_cold_sensitivity"),
    p("pericoronitis", "Viêm lợi trùm răng khôn", "Răng Hàm Mặt", "wisdom_tooth_pain swollen_gum limited_mouth_opening bad_taste fever pain_when_swallowing"),
    p("temporomandibular_disorder", "Rối loạn khớp thái dương hàm", "Răng Hàm Mặt", "jaw_joint_pain jaw_clicking limited_mouth_opening pain_when_chewing facial_pain morning_jaw_stiffness"),
    p("recurrent_aphthous_ulcer", "Loét áp-tơ tái phát", "Răng Hàm Mặt", "painful_mouth_ulcer recurrent_oral_ulcer round_ulcer eating_pain no_fever healing_within_weeks"),
    p("oral_candidiasis", "Nấm miệng", "Răng Hàm Mặt", "white_oral_patches burning_mouth altered_taste removable_white_plaque immunosuppression_risk denture_risk"),
    p("oral_lichen_planus", "Lichen phẳng miệng", "Răng Hàm Mặt", "white_lacy_oral_patch burning_mouth oral_erosion bilateral_buccal_lesions chronic_course"),
    p("oral_cancer", "Ung thư khoang miệng", "Răng Hàm Mặt", "nonhealing_mouth_ulcer oral_lump unexplained_oral_bleeding difficulty_swallowing neck_lump tobacco_alcohol_risk weight_loss"),
    p("leukoplakia", "Bạch sản niêm mạc miệng", "Răng Hàm Mặt", "persistent_white_oral_patch non_scrapable_patch tobacco_risk painless_lesion rough_oral_patch"),
    p("dry_socket", "Viêm ổ răng khô", "Răng Hàm Mặt", "severe_pain_after_extraction empty_tooth_socket bad_breath bad_taste pain_to_ear exposed_bone"),
    p("impacted_wisdom_tooth", "Răng khôn mọc lệch", "Răng Hàm Mặt", "wisdom_tooth_pain jaw_swelling limited_mouth_opening food_trapping gum_inflammation recurrent_infection"),
    p("tooth_fracture", "Gãy răng", "Răng Hàm Mặt", "chipped_broken_tooth pain_when_biting tooth_sensitivity sharp_tooth_edge trauma_history visible_crack"),
    p("tooth_avulsion", "Răng bật khỏi ổ", "Răng Hàm Mặt", "missing_tooth_after_trauma bleeding_tooth_socket oral_trauma severe_tooth_pain lip_injury emergency_dental_sign"),
    p("malocclusion", "Sai khớp cắn", "Răng Hàm Mặt", "misaligned_teeth abnormal_bite chewing_difficulty speech_difficulty jaw_strain crowded_teeth"),
    p("bruxism", "Nghiến răng", "Răng Hàm Mặt", "tooth_wear morning_jaw_pain sleep_grinding tooth_sensitivity headache jaw_muscle_tenderness"),
    p("salivary_stone", "Sỏi tuyến nước bọt", "Răng Hàm Mặt", "meal_related_salivary_pain salivary_gland_swelling dry_mouth reduced_saliva gland_tenderness recurrent_swelling"),
    p("sialadenitis", "Viêm tuyến nước bọt", "Răng Hàm Mặt", "painful_salivary_swelling fever pus_from_salivary_duct dry_mouth meal_related_pain gland_redness"),
    p("ludwig_angina", "Viêm tấy sàn miệng", "Răng Hàm Mặt", "floor_of_mouth_swelling neck_swelling elevated_tongue breathing_difficulty difficulty_swallowing drooling fever"),
    p("alveolar_osteitis", "Viêm xương ổ răng", "Răng Hàm Mặt", "post_extraction_jaw_pain radiating_temple_pain foul_mouth_odor missing_blood_clot exposed_alveolar_bone"),
    p("dental_fluorosis", "Nhiễm fluor răng", "Răng Hàm Mặt", "white_chalky_streaks brown_discoloration_teeth enamel_pitting non_carious_enamel_defect history_high_fluoride"),
    p("tooth_erosion", "Mòn men răng", "Răng Hàm Mặt", "loss_of_enamel sensitivity_to_cold cupping_on_cusps smooth_yellow_dentine acid_reflux_risk acidic_diet"),
    p("geographic_tongue", "Viêm lưỡi bản đồ", "Răng Hàm Mặt", "smooth_red_tongue_patches white_borders_on_tongue migrating_tongue_lesions mild_stinging_spicy_food benign_course"),
    p("mucocele_oral", "Nang nhầy niêm mạc miệng", "Răng Hàm Mặt", "bluish_translucent_lip_nodule painless_fluctuant_nodule lower_lip_swelling history_of_lip_biting recurrent_burst_and_refill"),
    p("epulis", "U nướu răng", "Răng Hàm Mặt", "pedunculated_gum_mass bleeding_during_brushing interdental_papilla_growth painless_gum_nodule pregnancy_association"),
    p("glossitis", "Viêm lưỡi", "Răng Hàm Mặt", "swollen_sore_tongue smooth_beefy_red_tongue burning_tongue difficulty_speaking nutritional_deficiency_risk"),
    p("angular_cheilitis", "Viêm nứt kẽ mép", "Răng Hàm Mặt", "painful_corners_of_mouth cracked_red_lips crusting_at_mouth_angles stinging_when_opening_mouth denture_wearer_risk"),
    p("burning_mouth_syndrome", "Hội chứng bỏng rát miệng", "Răng Hàm Mặt", "scalding_sensation_tongue chronic_burning_sensation dry_mouth altered_taste normal_oral_mucosa postmenopausal_risk"),
    p("mandibular_fracture", "Gãy xương hàm dưới", "Răng Hàm Mặt", "jaw_pain_after_impact malocclusion_after_trauma inability_to_bite intraoral_bleeding chin_numbness facial_swelling"),
    p("zygomatic_fracture", "Gãy xương gò má", "Răng Hàm Mặt", "flattened_cheek_after_trauma periorbital_bruising trismus infraorbital_nerve_numbness diplopia subconjunctival_hemorrhage"),

    # ==========================================
    # 5. TAI MŨI HỌNG (ENT) - 32 diseases
    # ==========================================
    p("allergic_rhinitis", "Viêm mũi dị ứng", "Tai Mũi Họng", "sneezing_fits itchy_nose runny_nose nasal_congestion itchy_watery_eyes postnasal_drip"),
    p("acute_sinusitis", "Viêm xoang cấp", "Tai Mũi Họng", "facial_pain_pressure purulent_nasal_discharge thick_nasal_discharge reduced_smell headache fever tooth_pressure"),
    p("chronic_sinusitis", "Viêm xoang mạn", "Tai Mũi Họng", "chronic_nasal_congestion facial_pressure reduced_smell postnasal_drip thick_nasal_discharge symptoms_over_12_weeks"),
    p("tonsillitis", "Viêm amidan cấp", "Tai Mũi Họng", "severe_sore_throat swollen_red_tonsils painful_swallowing fever swollen_neck_nodes bad_breath earache"),
    p("acute_otitis_media", "Viêm tai giữa cấp", "Tai Mũi Họng", "acute_ear_pain sensation_ear_fullness fever ear_fullness ear_discharge irritability recent_cold"),
    p("otitis_externa", "Viêm ống tai ngoài", "Tai Mũi Họng", "tragus_tenderness ear_canal_itching_pain ear_itching ear_discharge ear_canal_swelling reduced_hearing"),
    p("chronic_otitis_media", "Viêm tai giữa mạn", "Tai Mũi Họng", "persistent_ear_discharge conductive_hearing_loss tympanic_perforation painless_drainage foul_smell_ear recurrent_ear_infection"),
    p("nasal_polyps", "Polyp mũi", "Tai Mũi Họng", "persistent_nasal_blockage reduced_smell mouth_breathing postnasal_drip snoring bilateral_nasal_mass"),
    p("deviated_nasal_septum", "Vẹo vách ngăn mũi", "Tai Mũi Họng", "one_sided_nasal_obstruction recurrent_nosebleed facial_pain snoring mouth_breathing trauma_history"),
    p("epistaxis", "Chảy máu mũi", "Tai Mũi Họng", "nosebleed anterior_nasal_bleeding recurrent_bleeding nasal_dryness anticoagulant_risk high_blood_pressure"),
    p("peritonsillar_abscess", "Áp xe quanh amidan", "Tai Mũi Họng", "severe_one_sided_sore_throat muffled_voice limited_mouth_opening uvula_deviation fever drooling swallowing_difficulty"),
    p("laryngitis", "Viêm thanh quản cấp", "Tai Mũi Họng", "hoarse_voice voice_loss sore_throat dry_cough throat_clearing recent_upper_respiratory_infection"),
    p("chronic_laryngitis", "Viêm thanh quản mạn", "Tai Mũi Họng", "persistent_hoarseness throat_dryness throat_tickle voice_fatigue chronic_cough smoking_or_reflux_risk"),
    p("vocal_cord_nodule", "Hạt xơ dây thanh", "Tai Mũi Họng", "persistent_hoarseness voice_fatigue voice_overuse throat_discomfort reduced_vocal_range no_fever"),
    p("vocal_cord_polyp", "Polyp dây thanh", "Tai Mũi Họng", "unilateral_vocal_strain breathy_hoarseness globus_sensation voice_pitch_break prolonged_throat_clearing"),
    p("benign_positional_vertigo", "Chóng mặt tư thế lành tính", "Tai Mũi Họng", "brief_positional_vertigo spinning_sensation nausea triggered_by_head_movement nystagmus no_hearing_loss"),
    p("menieres_disease", "Bệnh Ménière", "Tai Mũi Họng", "episodic_vertigo fluctuating_hearing_loss tinnitus ear_fullness nausea recurrent_attacks"),
    p("labyrinthitis", "Viêm mê nhĩ", "Tai Mũi Họng", "acute_prolonged_vertigo hearing_loss nausea vomiting imbalance recent_viral_illness"),
    p("vestibular_neuritis", "Viêm thần kinh tiền đình", "Tai Mũi Họng", "acute_prolonged_vertigo imbalance nausea vomiting no_hearing_loss recent_viral_illness"),
    p("sudden_hearing_loss", "Điếc đột ngột", "Tai Mũi Họng", "sudden_one_sided_hearing_loss tinnitus ear_fullness dizziness onset_under_72_hours urgent_hearing_red_flag"),
    p("earwax_impaction", "Nút ráy tai", "Tai Mũi Họng", "blocked_ear reduced_hearing ear_fullness tinnitus ear_itching visible_earwax"),
    p("eustachian_tube_dysfunction", "Rối loạn vòi nhĩ", "Tai Mũi Họng", "ear_fullness popping_ear muffled_hearing pressure_change_trigger ear_discomfort recent_cold"),
    p("obstructive_sleep_apnea", "Ngưng thở khi ngủ", "Tai Mũi Họng", "loud_snoring witnessed_apnea daytime_sleepiness morning_headache choking_during_sleep obesity_risk enlarged_tonsils"),
    p("pharyngitis", "Viêm họng cấp", "Tai Mũi Họng", "scratchy_sore_throat pharyngeal_redness painful_swallowing mild_fever cough headache neck_adenopathy"),
    p("adenoid_hypertrophy", "Phì đại VA", "Tai Mũi Họng", "mouth_breathing chronic_nasal_obstruction snoring nasal_speech recurrent_rhinitis daytime_fatigue"),
    p("tympanic_membrane_perforation", "Thủng màng nhĩ", "Tai Mũi Họng", "sudden_sharp_ear_pain hearing_loss buzzing_tinnitus bloody_or_clear_drainage history_loud_noise_or_trauma"),
    p("otomycosis", "Nhiễm nấm tai", "Tai Mũi Họng", "intense_ear_itching thick_ear_discharge black_white_ear_spores ear_fullness hearing_impairment water_exposure_risk"),
    p("foreign_body_ear", "Dị vật trong tai", "Tai Mũi Họng", "sensation_object_in_ear ear_pain bleeding_ear canal_obstruction insect_buzzing_in_ear"),
    p("foreign_body_nose", "Dị vật mũi", "Tai Mũi Họng", "unilateral_foul_nasal_discharge one_sided_nasal_blockage sneezing localized_nasal_pain blood_stained_mucus"),
    p("foreign_body_throat", "Dị vật họng", "Tai Mũi Họng", "sharp_throat_pain_after_eating sensation_bone_stuck swallowing_pain drooling neck_discomfort"),
    p("nasopharyngeal_carcinoma", "Ung thư vòm họng", "Tai Mũi Họng", "one_sided_ear_fullness blood_streaked_sputum persistent_neck_mass unilateral_headache cranial_nerve_palsy"),
    p("laryngeal_cancer", "Ung thư thanh quản", "Tai Mũi Họng", "progressive_hoarseness lasting_weeks throat_pain referred_ear_pain hemoptysis weight_loss stridor heavy_smoker_risk"),
]


CONTEXT = {
    "demographic": (
        "age_child age_adolescent age_adult age_older_adult "
        "sex_female sex_male pregnancy_possible"
    ).split(),
    "duration": (
        "duration_hours duration_1_3_days duration_4_7_days duration_1_4_weeks "
        "duration_over_4_weeks recurrent_course progressive_course intermittent_course"
    ).split(),
    "onset": (
        "onset_sudden onset_gradual onset_after_meal onset_after_trauma "
        "onset_after_infection onset_after_exposure"
    ).split(),
    "severity": (
        "severity_mild severity_moderate severity_severe limits_daily_activity wakes_from_sleep"
    ).split(),
    "exam": (
        "exam_fever exam_tachycardia exam_low_oxygen exam_dehydration exam_pallor "
        "exam_jaundice exam_edema exam_tenderness exam_guarding exam_swelling "
        "exam_redness exam_discharge exam_lump exam_enlarged_nodes "
        "exam_abnormal_breath_sounds exam_neurologic_deficit exam_oral_lesion "
        "exam_hearing_reduced exam_nasal_obstruction exam_rash "
        "exam_conjunctival_injection exam_corneal_opacity exam_pupil_abnormal "
        "exam_intraocular_pressure_high"
    ).split(),
    "risk": (
        "risk_smoking risk_alcohol risk_diabetes risk_hypertension risk_obesity "
        "risk_immunosuppression risk_recent_surgery risk_recent_antibiotics "
        "risk_sick_contact risk_travel risk_poor_oral_hygiene risk_denture "
        "risk_voice_overuse risk_allergy risk_family_history risk_anticoagulant "
        "risk_nsaid_use risk_high_fat_diet risk_contact_lens risk_eye_trauma "
        "risk_prolonged_screen_time risk_myopia risk_corticosteroid_use"
    ).split(),
    "red_flag": (
        "red_severe_breathing_difficulty red_low_oxygen red_unconsciousness "
        "red_new_seizure red_focal_weakness red_heavy_bleeding red_shock "
        "red_stiff_neck red_non_blanching_rash red_sudden_hearing_loss "
        "red_sudden_vision_loss red_severe_eye_pain_with_headache "
        "red_chemical_eye_burn red_airway_obstruction red_inability_to_swallow "
        "red_persistent_vomiting red_severe_dehydration red_rapidly_growing_mass "
        "red_unexplained_weight_loss red_vomiting_blood red_black_stool "
        "red_board_like_abdomen"
    ).split(),
    "negative": (
        "neg_no_fever neg_no_chest_pain neg_no_breathing_difficulty neg_no_vomiting "
        "neg_no_diarrhea neg_no_bleeding neg_no_weight_loss neg_no_neurologic_deficit "
        "neg_no_hearing_loss neg_no_vision_loss neg_no_eye_pain neg_no_eye_redness "
        "neg_no_ear_discharge neg_no_nasal_discharge neg_no_sore_throat "
        "neg_no_dental_trauma neg_no_facial_swelling neg_no_abdominal_guarding "
        "neg_no_dehydration neg_no_rash neg_no_pus_discharge "
        "neg_no_loss_of_consciousness neg_no_recent_infection"
    ).split(),
}


def specialty_context(specialty: str) -> list[str]:
    return {
        "Nội tổng quát": ["exam_fever", "exam_tachycardia", "risk_smoking", "risk_diabetes", "risk_hypertension"],
        "Ngoại": ["exam_tenderness", "exam_guarding", "exam_swelling", "risk_recent_surgery", "red_shock"],
        "Mắt": ["exam_conjunctival_injection", "exam_corneal_opacity", "risk_contact_lens", "risk_eye_trauma", "red_sudden_vision_loss"],
        "Răng Hàm Mặt": ["exam_oral_lesion", "exam_swelling", "risk_poor_oral_hygiene", "risk_diabetes", "red_airway_obstruction"],
        "Tai Mũi Họng": ["exam_hearing_reduced", "exam_nasal_obstruction", "exam_enlarged_nodes", "risk_allergy", "red_sudden_hearing_loss"],
    }[specialty]


def build():
    rng = random.Random(SEED)
    profiles = PROFILES
    core_features = {s for _, _, _, core, _ in profiles for s in core}
    optional_features = {s for _, _, _, _, optional in profiles for s in optional}
    context = {x for values in CONTEXT.values() for x in values}

    features = sorted(core_features | optional_features | context)
    rows = []

    for key, _, specialty, core, optional in profiles:
        seen = set()
        while len(seen) < SAMPLES_PER_DISEASE:
            active = {s for s in core if rng.random() < 0.93}
            active.update(s for s in optional if rng.random() < 0.50)
            while len(active & set(core)) < min(2, len(core)):
                active.add(rng.choice(core))

            # General demographic distributions
            active.add(rng.choices(["age_child", "age_adolescent", "age_adult", "age_older_adult"], [1, 2, 8, 4])[0])
            sex = rng.choice(["sex_female", "sex_male"])
            active.add(sex)
            if sex == "sex_female" and rng.random() < 0.08:
                active.add("pregnancy_possible")

            active.add(rng.choice(CONTEXT["duration"]))
            active.add(rng.choice(CONTEXT["onset"]))
            active.add(rng.choice(CONTEXT["severity"]))

            for item in specialty_context(specialty):
                if rng.random() < 0.28:
                    active.add(item)
            if rng.random() < 0.12:
                active.add(rng.choice(CONTEXT["exam"]))
            if rng.random() < 0.10:
                active.add(rng.choice(CONTEXT["risk"]))
            if rng.random() < 0.035:
                active.add(rng.choice(CONTEXT["red_flag"]))
            if rng.random() < 0.45:
                active.add(rng.choice(CONTEXT["negative"]))

            signature = tuple(int(f in active) for f in features)
            if signature in seen:
                continue
            seen.add(signature)
            row = dict(zip(features, signature))
            row["prognosis"] = key
            rows.append(row)

    rng.shuffle(rows)
    return profiles, features, rows


def main():
    print("Generating dataset v2 (5 specialties: Mat, Noi tong quat, Ngoai, Rang Ham Mat, Tai Mui Hong)...")
    profiles, features, rows = build()

    # 1. Output training data
    out_csv = ROOT / "training_data_5_specialties_v2.csv"
    with out_csv.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=features + ["prognosis"])
        w.writeheader()
        w.writerows(rows)

    # 2. Output disease specialty mapping
    map_csv = ROOT / "disease_specialty_map_v2.csv"
    with map_csv.open("w", encoding="utf-8-sig", newline="") as f:
        fields = ["disease_key", "disease_name_vi", "specialty", "data_status"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for key, vi, specialty, _, _ in profiles:
            w.writerow({
                "disease_key": key,
                "disease_name_vi": vi,
                "specialty": specialty,
                "data_status": "synthetic_requires_clinical_review"
            })

    # 3. Output feature dictionary
    clinical = {s for _, _, _, core, optional in profiles for s in core + optional}
    dict_csv = ROOT / "feature_dictionary_v2.csv"
    with dict_csv.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["feature", "feature_group", "value_definition"])
        for feature in features:
            if feature in clinical:
                group = "clinical_symptom_or_sign"
            else:
                group = next((k for k, v in CONTEXT.items() if feature in v), "other")
            w.writerow([feature, group, "1=explicitly present; 0=not recorded (not necessarily absent)"])

    print(f"Done! Diseases: {len(profiles)} (32 per specialty)")
    print("Specialties: 5 (Mat, Noi tong quat, Ngoai, Rang Ham Mat, Tai Mui Hong)")
    print(f"Features: {len(features)}")
    print(f"Rows: {len(rows)}")


if __name__ == "__main__":
    main()
