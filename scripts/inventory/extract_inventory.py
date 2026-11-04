"""Build a reviewable, deterministic BioMedGest inventory import package.

The source workbook is opened read-only and is never modified. The generated SQL
is a proposal: it must be reviewed and explicitly executed later.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit, urlunsplit

from openpyxl import load_workbook


INVENTORY_SHEET = "Hoja1"
RISK_SHEET = "Hoja2"
IMPORT_NAMESPACE = uuid.UUID("7d46db2b-b775-4c70-98b6-3e92320ad787")
SERIAL_PLACEHOLDERS = {"s n", "sn", "n a", "na", "sin serie", "no aplica"}


@dataclass(frozen=True)
class Issue:
    source_sheet: str
    source_row: int
    inventory_code: str
    issue_code: str
    severity: str
    field_name: str
    source_value: str
    details: str


def clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def normalized_key(value: Any) -> str:
    text = unicodedata.normalize("NFD", clean_text(value))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def normalize_procedure(value: Any) -> str:
    return "\n".join(line.strip() for line in clean_text(value).splitlines() if line.strip())


def normalize_url(value: Any) -> str:
    raw = clean_text(value)
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, flags=re.IGNORECASE):
        return raw
    parts = urlsplit(raw)
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path, parts.query, parts.fragment))


def is_http_url(value: str) -> bool:
    return bool(re.match(r"^https?://", value, flags=re.IGNORECASE))


def risk_key(value: Any) -> str:
    key = normalized_key(value)
    return {"bajo riesgo": "bajo", "medio riesgo": "medio", "alto riesgo": "alto"}.get(key, key)


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def write_csv(path: Path, rows: Iterable[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def load_source(source: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    workbook_values = load_workbook(source, read_only=True, data_only=True)
    workbook_formulas = load_workbook(source, read_only=True, data_only=False)
    if INVENTORY_SHEET not in workbook_values.sheetnames or RISK_SHEET not in workbook_values.sheetnames:
        raise ValueError(f"El archivo debe contener {INVENTORY_SHEET} y {RISK_SHEET}")

    inventory_ws = workbook_values[INVENTORY_SHEET]
    risk_ws = workbook_values[RISK_SHEET]
    risk_formula_ws = workbook_formulas[RISK_SHEET]
    headers = [clean_text(cell.value) for cell in next(inventory_ws.iter_rows(min_row=1, max_row=1))]
    expected_headers = [
        "#", "Equipo", "Marca", "Modelo", "SN", "Fabricación", "Adquisición",
        "Ubicación", "Guarda de equipo", "Tipo de riesgo", "Manual usuario",
        "Manual mantenimiento", "Rutina de mantenimiento",
    ]
    if headers != expected_headers:
        raise ValueError(f"Encabezados inesperados en {INVENTORY_SHEET}: {headers}")

    inventory: list[dict[str, Any]] = []
    for row_number, row in enumerate(inventory_ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(value is not None and clean_text(value) for value in row):
            continue
        record = dict(zip(headers, row))
        record["source_row"] = row_number
        inventory.append(record)

    risk: list[dict[str, Any]] = []
    for row_number in range(4, risk_ws.max_row + 1):
        identifier = risk_ws.cell(row_number, 1).value
        if not isinstance(identifier, (int, float)) or not (1 <= int(identifier) <= 100):
            continue
        total_formula = risk_formula_ws.cell(row_number, 6).value
        risk.append({
            "#": int(identifier),
            "Equipo": risk_ws.cell(row_number, 2).value,
            "Función": risk_ws.cell(row_number, 3).value,
            "Aplicación clínica": risk_ws.cell(row_number, 4).value,
            "Requerimiento de mantenimiento": risk_ws.cell(row_number, 5).value,
            "Total": risk_ws.cell(row_number, 6).value,
            "Categoría": risk_ws.cell(row_number, 7).value,
            "source_row": row_number,
            "total_is_formula": isinstance(total_formula, str) and total_formula.startswith("="),
        })

    metadata = {
        "sheet_names": workbook_values.sheetnames,
        "inventory_headers": headers,
        "inventory_max_row": inventory_ws.max_row,
        "inventory_max_column": inventory_ws.max_column,
        "risk_max_row": risk_ws.max_row,
        "risk_max_column": risk_ws.max_column,
    }
    workbook_values.close()
    workbook_formulas.close()
    return inventory, risk, metadata


def build_inventory_package(source: Path, output_dir: Path) -> dict[str, Any]:
    source = source.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    before_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    inventory, risks, workbook_metadata = load_source(source)
    after_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if before_hash != after_hash:
        raise RuntimeError("El archivo fuente cambió durante la extracción")
    if len(inventory) != 100 or len(risks) != 100:
        raise ValueError(f"Se esperaban 100 equipos y 100 riesgos; se obtuvieron {len(inventory)} y {len(risks)}")

    batch_id = str(uuid.uuid5(IMPORT_NAMESPACE, before_hash))
    risk_by_id = {int(row["#"]): row for row in risks}
    ids = [int(row["#"]) for row in inventory]
    if sorted(ids) != list(range(1, 101)):
        raise ValueError("Los identificadores del inventario no son exactamente 1..100")

    issues: list[Issue] = []
    serial_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    signature_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    location_case_groups: dict[tuple[str, str], set[str]] = defaultdict(set)

    for row in inventory:
        serial_key = normalized_key(row["SN"])
        if serial_key and serial_key not in SERIAL_PLACEHOLDERS:
            serial_groups[serial_key].append(row)
        signature = "|".join(normalized_key(row[field]) for field in ("Equipo", "Marca", "Modelo", "SN"))
        signature_groups[signature].append(row)
        if clean_text(row["Guarda de equipo"]):
            location_case_groups[(normalized_key(row["Ubicación"]), normalized_key(row["Guarda de equipo"]))].add(clean_text(row["Guarda de equipo"]))

    duplicate_serial_ids = {int(row["#"]) for group in serial_groups.values() if len(group) > 1 for row in group}
    duplicate_signature_ids = {int(row["#"]) for group in signature_groups.values() if len(group) > 1 for row in group}
    case_collision_keys = {key for key, variants in location_case_groups.items() if len(variants) > 1}

    assets: list[dict[str, Any]] = []
    risk_rows: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    programs_by_hash: dict[str, dict[str, Any]] = {}
    asset_programs: list[dict[str, Any]] = []

    for row in inventory:
        legacy_id = int(row["#"])
        inventory_code = f"EQ-{legacy_id:06d}"
        source_row = int(row["source_row"])
        risk = risk_by_id[legacy_id]
        serial = clean_text(row["SN"])
        serial_placeholder = normalized_key(serial) in SERIAL_PLACEHOLDERS
        requires_review = False

        def add_issue(code: str, severity: str, field: str, value: Any, details: str, sheet: str = INVENTORY_SHEET, issue_row: int = source_row) -> None:
            nonlocal requires_review
            if severity in {"advertencia", "error"}:
                requires_review = True
            issues.append(Issue(sheet, issue_row, inventory_code, code, severity, field, clean_text(value), details))

        if not clean_text(row["Guarda de equipo"]):
            add_issue("missing_specific_location", "advertencia", "Guarda de equipo", "", "Falta ubicación específica; se conserva el área hospitalaria.")
        if not clean_text(row["Manual usuario"]):
            add_issue("missing_user_manual", "advertencia", "Manual usuario", "", "No se proporcionó manual de usuario.")
        if serial_placeholder:
            add_issue("serial_placeholder", "advertencia", "SN", serial, "El número de serie es un marcador y requiere verificación física.")
        if legacy_id in duplicate_serial_ids:
            add_issue("duplicate_serial", "error", "SN", serial, "El mismo número de serie aparece en más de un activo.")
        if legacy_id in duplicate_signature_ids:
            add_issue("duplicate_asset_signature", "advertencia", "Equipo/Marca/Modelo/SN", serial, "La firma completa del activo se repite; no se eliminó ningún registro.")
        if normalized_key(row["Equipo"]) == "tomograffo":
            add_issue("spelling_candidate", "advertencia", "Equipo", row["Equipo"], "Posible error ortográfico; confirmar antes de cambiar el catálogo.")
        location_key = (normalized_key(row["Ubicación"]), normalized_key(row["Guarda de equipo"]))
        if clean_text(row["Guarda de equipo"]) and location_key in case_collision_keys:
            add_issue("location_case_variant", "advertencia", "Guarda de equipo", row["Guarda de equipo"], "Existen variantes que solo difieren en mayúsculas/minúsculas.")

        for document_type, field in (("manual_usuario", "Manual usuario"), ("manual_servicio", "Manual mantenimiento")):
            raw_url = clean_text(row[field])
            if not raw_url:
                continue
            normalized_url = normalize_url(raw_url)
            valid_url = is_http_url(raw_url)
            if not valid_url:
                add_issue("invalid_document_url", "advertencia", field, raw_url, "El enlace no incluye un esquema HTTP/HTTPS válido.")
            documents.append({
                "inventory_code": inventory_code,
                "document_type": document_type,
                "url": raw_url,
                "normalized_url": normalized_url,
                "review_status": "confirmado" if valid_url else "pendiente",
            })
        if clean_text(row["Manual usuario"]) and clean_text(row["Manual usuario"]) == clean_text(row["Manual mantenimiento"]):
            add_issue("same_manual_url", "informativo", "Manuales", row["Manual usuario"], "El mismo enlace se usa como manual de usuario y de servicio.")

        function_score = int(risk["Función"])
        clinical_score = int(risk["Aplicación clínica"])
        maintenance_score = int(risk["Requerimiento de mantenimiento"])
        total = function_score + clinical_score + maintenance_score
        source_total = int(risk["Total"])
        category = risk_key(risk["Categoría"])
        expected_category = "bajo" if total <= 6 else "medio" if total <= 12 else "alto"
        if normalized_key(row["Equipo"]) != normalized_key(risk["Equipo"]):
            add_issue("risk_equipment_mismatch", "error", "Equipo", risk["Equipo"], "El tipo de equipo no coincide entre hojas.", RISK_SHEET, int(risk["source_row"]))
        if total != source_total or category != expected_category or risk_key(row["Tipo de riesgo"]) != expected_category:
            add_issue("risk_calculation_mismatch", "error", "Riesgo", risk["Categoría"], "La suma o categoría de riesgo no coincide con las reglas del libro.", RISK_SHEET, int(risk["source_row"]))
        if not risk["total_is_formula"]:
            add_issue("risk_total_hardcoded", "informativo", "Total", source_total, "El total está guardado como valor; la base lo recalculará.", RISK_SHEET, int(risk["source_row"]))

        procedure_text = normalize_procedure(row["Rutina de mantenimiento"])
        procedure_hash = hashlib.sha256(procedure_text.encode("utf-8")).hexdigest()
        programs_by_hash.setdefault(procedure_hash, {
            "name": f"Programa preventivo - {clean_text(row['Equipo'])}",
            "procedure_text": procedure_text,
            "procedure_sha256": procedure_hash,
            "interval_months": None,
            "periodicity_basis": "Pendiente de definir según fabricante y evaluación de riesgo",
            "requires_review": True,
        })
        asset_programs.append({"inventory_code": inventory_code, "procedure_sha256": procedure_hash})
        add_issue("maintenance_periodicity_missing", "advertencia", "Periodicidad", "", "El Excel contiene la rutina, pero no la frecuencia preventiva.")

        asset_id = str(uuid.uuid5(IMPORT_NAMESPACE, f"{before_hash}:{legacy_id}"))
        assets.append({
            "id": asset_id,
            "legacy_id": legacy_id,
            "inventory_code": inventory_code,
            "equipment_type": clean_text(row["Equipo"]),
            "manufacturer": clean_text(row["Marca"]),
            "model": clean_text(row["Modelo"]),
            "serial_number": serial,
            "serial_is_placeholder": serial_placeholder,
            "manufacture_year": int(row["Fabricación"]),
            "acquisition_year": int(row["Adquisición"]),
            "hospital_area": clean_text(row["Ubicación"]),
            "specific_location": clean_text(row["Guarda de equipo"]),
            "status": "desconocido",
            "source_row": source_row,
            "requires_review": requires_review,
        })
        risk_rows.append({
            "inventory_code": inventory_code,
            "function_score": function_score,
            "clinical_application_score": clinical_score,
            "maintenance_requirement_score": maintenance_score,
            "total_score": total,
            "category": expected_category,
            "source_row": int(risk["source_row"]),
        })

    # Recompute review flags after all issues have been collected.
    review_codes = {issue.inventory_code for issue in issues if issue.severity in {"advertencia", "error"}}
    for asset in assets:
        asset["requires_review"] = asset["inventory_code"] in review_codes

    manifest = {
        "source_file": source.name,
        "source_sha256": before_hash,
        "source_unchanged": before_hash == after_hash,
        "batch_id": batch_id,
        "workbook": workbook_metadata,
        "counts": {
            "assets": len(assets),
            "equipment_types": len({row["equipment_type"] for row in assets}),
            "manufacturers": len({row["manufacturer"] for row in assets}),
            "models": len({(row["equipment_type"], row["manufacturer"], row["model"]) for row in assets}),
            "hospital_areas": len({row["hospital_area"] for row in assets}),
            "specific_locations": len({(row["hospital_area"], row["specific_location"]) for row in assets if row["specific_location"]}),
            "documents": len(documents),
            "maintenance_programs": len(programs_by_hash),
            "risk_assessments": len(risk_rows),
            "issues": len(issues),
            "assets_requiring_review": len(review_codes),
        },
        "issues_by_code": dict(sorted(Counter(issue.issue_code for issue in issues).items())),
        "issues_by_severity": dict(sorted(Counter(issue.severity for issue in issues).items())),
    }

    write_csv(output_dir / "inventory_assets.csv", assets, list(assets[0].keys()))
    write_csv(output_dir / "inventory_risk_assessments.csv", risk_rows, list(risk_rows[0].keys()))
    write_csv(output_dir / "inventory_documents.csv", documents, list(documents[0].keys()))
    write_csv(output_dir / "inventory_maintenance_programs.csv", programs_by_hash.values(), list(next(iter(programs_by_hash.values())).keys()))
    write_csv(output_dir / "inventory_asset_programs.csv", asset_programs, list(asset_programs[0].keys()))
    issue_rows = [asdict(issue) for issue in issues]
    write_csv(output_dir / "inventory_review_issues.csv", issue_rows, list(issue_rows[0].keys()))
    (output_dir / "inventory_import_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "inventory_import.sql").write_text(
        build_import_sql(batch_id, source.name, before_hash, assets, risk_rows, documents, list(programs_by_hash.values()), asset_programs, issues),
        encoding="utf-8",
    )
    return manifest


def build_import_sql(batch_id: str, source_name: str, source_hash: str, assets: list[dict[str, Any]], risks: list[dict[str, Any]], documents: list[dict[str, Any]], programs: list[dict[str, Any]], asset_programs: list[dict[str, Any]], issues: list[Issue]) -> str:
    lines = [
        "-- Generated from Final.xlsx. Review inventory_review_issues.csv before execution.",
        "-- This file has not been executed by Codex.",
        "begin;",
        f"insert into public.inventory_import_batches (id, source_file_name, source_sha256, source_sheet_inventory, source_sheet_risk, row_count)",
        f"values ({sql_literal(batch_id)}::uuid, {sql_literal(source_name)}, {sql_literal(source_hash)}, {sql_literal(INVENTORY_SHEET)}, {sql_literal(RISK_SHEET)}, {len(assets)})",
        "on conflict (source_sha256) do nothing;",
    ]
    for area in sorted({row["hospital_area"] for row in assets}):
        lines.append(f"insert into public.hospital_areas (name) values ({sql_literal(area)}) on conflict (name) do nothing;")
    for equipment_type in sorted({row["equipment_type"] for row in assets}):
        lines.append(f"insert into public.equipment_types (name) values ({sql_literal(equipment_type)}) on conflict (name) do nothing;")
    for manufacturer in sorted({row["manufacturer"] for row in assets}):
        lines.append(f"insert into public.manufacturers (name) values ({sql_literal(manufacturer)}) on conflict (name) do nothing;")
    for equipment_type, manufacturer, model in sorted({(row["equipment_type"], row["manufacturer"], row["model"]) for row in assets}):
        lines.append(
            "insert into public.equipment_models (equipment_type_id, manufacturer_id, name) "
            f"select et.id, mf.id, {sql_literal(model)} from public.equipment_types et cross join public.manufacturers mf "
            f"where et.name = {sql_literal(equipment_type)} and mf.name = {sql_literal(manufacturer)} "
            "on conflict (equipment_type_id, manufacturer_id, name) do nothing;"
        )
    for area, location in sorted({(row["hospital_area"], row["specific_location"]) for row in assets if row["specific_location"]}):
        lines.append(
            "insert into public.equipment_locations (hospital_area_id, name) "
            f"select id, {sql_literal(location)} from public.hospital_areas where name = {sql_literal(area)} "
            "on conflict (hospital_area_id, name) do nothing;"
        )
    for asset in assets:
        location_expr = "null" if not asset["specific_location"] else (
            "(select el.id from public.equipment_locations el join public.hospital_areas ha on ha.id = el.hospital_area_id "
            f"where ha.name = {sql_literal(asset['hospital_area'])} and el.name = {sql_literal(asset['specific_location'])})"
        )
        lines.append(
            "insert into public.equipment_assets (id, inventory_code, equipment_model_id, serial_number, serial_is_placeholder, manufacture_year, acquisition_year, hospital_area_id, location_id, custodian_location_text, status, source_batch_id, source_sheet, source_row, requires_review) "
            f"select {sql_literal(asset['id'])}::uuid, {sql_literal(asset['inventory_code'])}, em.id, {sql_literal(asset['serial_number'])}, {sql_literal(asset['serial_is_placeholder'])}, {asset['manufacture_year']}, {asset['acquisition_year']}, ha.id, {location_expr}, {sql_literal(asset['specific_location'])}, {sql_literal(asset['status'])}::public.equipment_status, {sql_literal(batch_id)}::uuid, {sql_literal(INVENTORY_SHEET)}, {asset['source_row']}, {sql_literal(asset['requires_review'])} "
            "from public.equipment_models em join public.equipment_types et on et.id = em.equipment_type_id join public.manufacturers mf on mf.id = em.manufacturer_id cross join public.hospital_areas ha "
            f"where et.name = {sql_literal(asset['equipment_type'])} and mf.name = {sql_literal(asset['manufacturer'])} and em.name = {sql_literal(asset['model'])} and ha.name = {sql_literal(asset['hospital_area'])} "
            "on conflict (inventory_code) do nothing;"
        )
    for document in documents:
        lines.append(
            "insert into public.equipment_documents (document_type, url, normalized_url, review_status) "
            f"values ({sql_literal(document['document_type'])}, {sql_literal(document['url'])}, {sql_literal(document['normalized_url'])}, {sql_literal(document['review_status'])}::public.inventory_review_status) "
            "on conflict (document_type, normalized_url) do nothing;"
        )
        lines.append(
            "insert into public.equipment_document_links (equipment_id, document_id, source_batch_id) "
            f"select ea.id, d.id, {sql_literal(batch_id)}::uuid from public.equipment_assets ea cross join public.equipment_documents d "
            f"where ea.inventory_code = {sql_literal(document['inventory_code'])} and d.document_type = {sql_literal(document['document_type'])} and d.normalized_url = {sql_literal(document['normalized_url'])} "
            "on conflict do nothing;"
        )
    for program in programs:
        lines.append(
            "insert into public.maintenance_programs (name, procedure_text, procedure_sha256, interval_months, periodicity_basis, requires_review) "
            f"values ({sql_literal(program['name'])}, {sql_literal(program['procedure_text'])}, {sql_literal(program['procedure_sha256'])}, null, {sql_literal(program['periodicity_basis'])}, true) "
            "on conflict (procedure_sha256) do nothing;"
        )
    for link in asset_programs:
        lines.append(
            "insert into public.equipment_maintenance_programs (equipment_id, maintenance_program_id, source_batch_id) "
            f"select ea.id, mp.id, {sql_literal(batch_id)}::uuid from public.equipment_assets ea cross join public.maintenance_programs mp "
            f"where ea.inventory_code = {sql_literal(link['inventory_code'])} and mp.procedure_sha256 = {sql_literal(link['procedure_sha256'])} "
            "on conflict do nothing;"
        )
    for risk in risks:
        lines.append(
            "insert into public.risk_assessments (equipment_id, function_score, clinical_application_score, maintenance_requirement_score, category, source_batch_id, source_sheet, source_row) "
            f"select id, {risk['function_score']}, {risk['clinical_application_score']}, {risk['maintenance_requirement_score']}, {sql_literal(risk['category'])}::public.risk_level, {sql_literal(batch_id)}::uuid, {sql_literal(RISK_SHEET)}, {risk['source_row']} from public.equipment_assets where inventory_code = {sql_literal(risk['inventory_code'])} "
            "on conflict (equipment_id, methodology_name, methodology_version) do nothing;"
        )
    for issue in issues:
        lines.append(
            "insert into public.inventory_import_issues (source_batch_id, equipment_id, source_sheet, source_row, issue_code, severity, field_name, source_value, details) "
            f"select {sql_literal(batch_id)}::uuid, ea.id, {sql_literal(issue.source_sheet)}, {issue.source_row}, {sql_literal(issue.issue_code)}, {sql_literal(issue.severity)}, {sql_literal(issue.field_name)}, {sql_literal(issue.source_value)}, {sql_literal(issue.details)} from public.equipment_assets ea where ea.inventory_code = {sql_literal(issue.inventory_code)} "
            "on conflict do nothing;"
        )
    lines.extend([
        f"update public.inventory_import_batches set status = 'validado' where id = {sql_literal(batch_id)}::uuid;",
        "commit;",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Ruta a Final.xlsx")
    parser.add_argument("--output-dir", type=Path, default=Path("data/inventory/generated"))
    args = parser.parse_args()
    manifest = build_inventory_package(args.source, args.output_dir)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
