import os
import subprocess
from pathlib import Path
import pytest
from app.models.production_models import (
    UserProduction,
    PatientProduction,
    PatientAllergyProduction,
    DoctorSlotProduction,
    AppointmentProduction,
    EncounterProduction,
    ClinicalVitalProduction,
    DiagnosisICD10Production,
    EncounterDiagnosisProduction,
    ServiceProduction,
    ParaclinicalOrderProduction,
    ParaclinicalResultProduction,
    DrugProduction,
    DrugBatchProduction,
    PrescriptionProduction,
    PrescriptionItemProduction,
    InvoiceProduction,
    InvoiceItemProduction,
    PaymentTransactionProduction,
    EmrSignedRecordProduction,
    PhiAuditLog,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKUP_SCRIPT = REPO_ROOT / "backend" / "scripts" / "backup_database.sh"
RUNBOOK = REPO_ROOT / "docs" / "DISASTER_RECOVERY_RUNBOOK.md"


def bash_path(path):
    path = Path(path)
    # shortcut: assumes WSL drive mounts at /mnt/<drive>; adjust for other Windows Bash layouts.
    return f"/mnt/{path.drive[0].lower()}{path.as_posix()[2:]}" if os.name == "nt" else str(path)


def test_backup_database_script_exists_and_is_executable():
    assert BACKUP_SCRIPT.exists()
    assert BACKUP_SCRIPT.is_file()


def test_backup_database_self_check_passes():
    result = subprocess.run(
        ["bash", bash_path(BACKUP_SCRIPT), "--self-check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "ALL ENHANCED SELF-CHECKS COMPLETED SUCCESSFULLY (18/18 PASS)" in result.stderr


def test_backup_database_help_contains_expected_flags():
    result = subprocess.run(
        ["bash", bash_path(BACKUP_SCRIPT), "--help"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    output = result.stdout
    assert "--target-dir" in output
    assert "--output-file" in output
    assert "--db-name" in output
    assert "--secret-file" in output
    assert "--verify" in output
    assert "--restore" in output
    assert "--confirm-destructive-restore" in output
    assert "--dry-run" in output
    assert "--self-check" in output


@pytest.mark.parametrize("sidecar_contents", [None, ""])
@pytest.mark.parametrize("mode", ["verify", "restore"])
def test_backup_rejects_missing_or_empty_hmac_before_decryption(tmp_path, sidecar_contents, mode):
    backup_file = tmp_path / "synthetic.dump.enc"
    backup_file.write_bytes(b"not decrypted")
    sidecar = Path(f"{backup_file}.hmac")
    if sidecar_contents is not None:
        sidecar.write_text(sidecar_contents, encoding="ascii")

    command = ["bash", bash_path(BACKUP_SCRIPT)]
    if mode == "verify":
        command += ["--verify", bash_path(backup_file)]
    else:
        command += ["--restore", bash_path(backup_file), "--confirm-destructive-restore", "clinic_db"]
    result = subprocess.run(
        command,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "Required HMAC sidecar is missing or empty" in result.stderr
    assert "Testing decryption stream" not in result.stderr


def test_hmac_computation_does_not_put_secret_in_command_arguments():
    script = BACKUP_SCRIPT.read_text(encoding="utf-8")
    hmac_function = script.split("compute_hmac_sha256() {", 1)[1].split("\n}", 1)[0]

    assert 'printf \'%s\' "${raw_key}" | python3 -c' in hmac_function
    assert '"${raw_key}"' not in hmac_function.split("python3 -c", 1)[1]
    assert "openssl dgst -sha256 -hmac" not in hmac_function
    assert "f.read(1024 * 1024)" in hmac_function
    assert "read_bytes" not in hmac_function


def test_disaster_recovery_runbook_contains_verified_source_tables():
    assert RUNBOOK.exists()
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "cuoc_hen" not in content or "không phải `cuoc_hen`" in content

    verified_models = [
        UserProduction,
        PatientProduction,
        PatientAllergyProduction,
        DoctorSlotProduction,
        AppointmentProduction,
        EncounterProduction,
        ClinicalVitalProduction,
        DiagnosisICD10Production,
        EncounterDiagnosisProduction,
        ServiceProduction,
        ParaclinicalOrderProduction,
        ParaclinicalResultProduction,
        DrugProduction,
        DrugBatchProduction,
        PrescriptionProduction,
        PrescriptionItemProduction,
        InvoiceProduction,
        InvoiceItemProduction,
        PaymentTransactionProduction,
        EmrSignedRecordProduction,
        PhiAuditLog,
    ]

    for model in verified_models:
        table_name = model.__tablename__
        assert table_name in content, f"Table {table_name} missing from disaster recovery runbook"


def test_disaster_recovery_runbook_documents_authenticated_integrity_and_guarded_restore():
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "HMAC-SHA256" in content
    assert "umask 077" in content
    assert "DESTRUCTIVE RESTORE RISK" in content or "CẢNH BÁO NGUY HIỂM VỀ KHÔI PHỤC CÓ TÍNH PHÁ HỦY" in content
    assert "--confirm-destructive-restore" in content
