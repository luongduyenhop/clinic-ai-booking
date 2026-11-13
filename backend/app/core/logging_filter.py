import logging
import re
import traceback


_PHI_KEYS = {
    "phone", "phonenumber", "sdt", "sodienthoai", "dienthoai",
    "cccd", "citizenid", "identitynumber", "email",
    "name", "fullname", "patientname", "hoten", "tenbenhnhan",
    "symptom", "symptoms", "trieuchung", "benh su", "benhsu",
    "clinicalpayload", "clinicaldata", "freetext", "ghichu",
    "medicalhistory", "historyofpresentillness", "chiefcomplaint",
    "lydokham", "lydodenkham", "mota", "tiensubenh", "tiensubenhly",
    "benhsuhientai", "ketluan", "ghichubacsi",
}
_KEY_VALUE = re.compile(
    r"(?i)(\b(?:phone(?:_number)?|sdt|so_dien_thoai|dien_thoai|cccd|"
    r"citizen_id|identity_number|email|full_name|patient_name|ho_ten|"
    r"ten_benh_nhan|symptoms?|trieu_chung|benh_su|clinical_payload|"
    r"clinical_data|free_text|ghi_chu|medical_history|history_of_present_illness|"
    r"chief_complaint|ly_do_kham|ly_do_den_kham|mo_ta|tien_su_benh|"
    r"tien_su_benh_ly|benh_su_hien_tai|ket_luan|ghi_chu_bac_si)\b"
    r"\s*[=:]\s*)([^,|;}\]]+)")


def _key_name(key):
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def _sanitize(value):
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if _key_name(key) in _PHI_KEYS else _sanitize(item)
            for key, item in value.items()
        }
    if isinstance(value, (tuple, list)):
        return type(value)(_sanitize(item) for item in value)
    return value


def _redact_text(value):
    return _KEY_VALUE.sub(r"\1[REDACTED]", value)


class PHIRedactionFilter(logging.Filter):
    """Redact known structured PHI fields in application log records."""

    def filter(self, record):
        record.msg = _sanitize(record.msg)
        record.args = _sanitize(record.args)
        record.message = _redact_text(record.getMessage())
        record.msg, record.args = record.message, ()
        if record.exc_info:
            record.exc_text = _redact_text("".join(traceback.format_exception(*record.exc_info)))
            record.exc_info = None
        return True


def install_phi_redaction_filter():
    handlers = logging.getLogger().handlers[:]
    for name in ("uvicorn.access", "uvicorn.error"):
        handlers.extend(logging.getLogger(name).handlers)
    for handler in handlers:
        if not any(isinstance(item, PHIRedactionFilter) for item in handler.filters):
            handler.addFilter(PHIRedactionFilter())

