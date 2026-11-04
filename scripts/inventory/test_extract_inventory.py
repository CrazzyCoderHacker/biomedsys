import tempfile
import unittest
import hashlib
import os
from pathlib import Path

from extract_inventory import build_inventory_package


class InventoryExtractionTest(unittest.TestCase):
    source = Path(os.environ.get("BIOMEDGEST_INVENTORY_XLSX", "Final.xlsx"))

    def setUp(self):
        if not self.source.exists():
            self.skipTest("Define BIOMEDGEST_INVENTORY_XLSX con la ruta al archivo fuente")

    def test_source_and_expected_counts(self):
        source_before = self.source.read_bytes()
        with tempfile.TemporaryDirectory() as temporary_directory:
            manifest = build_inventory_package(self.source, Path(temporary_directory))
            self.assertEqual(manifest["counts"]["assets"], 100)
            self.assertEqual(manifest["counts"]["equipment_types"], 37)
            self.assertEqual(manifest["counts"]["hospital_areas"], 15)
            self.assertEqual(manifest["counts"]["risk_assessments"], 100)
            self.assertTrue(manifest["source_unchanged"])
            self.assertGreater(manifest["counts"]["issues"], 0)
        self.assertEqual(source_before, self.source.read_bytes())

    def test_generation_is_deterministic_and_non_destructive(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_path = Path(first)
            second_path = Path(second)
            first_manifest = build_inventory_package(self.source, first_path)
            second_manifest = build_inventory_package(self.source, second_path)
            self.assertEqual(first_manifest["batch_id"], second_manifest["batch_id"])
            for name in (
                "inventory_assets.csv",
                "inventory_risk_assessments.csv",
                "inventory_documents.csv",
                "inventory_maintenance_programs.csv",
                "inventory_asset_programs.csv",
                "inventory_review_issues.csv",
                "inventory_import_manifest.json",
                "inventory_import.sql",
            ):
                first_hash = hashlib.sha256((first_path / name).read_bytes()).hexdigest()
                second_hash = hashlib.sha256((second_path / name).read_bytes()).hexdigest()
                self.assertEqual(first_hash, second_hash, name)
            sql = (first_path / "inventory_import.sql").read_text(encoding="utf-8").lower()
            self.assertEqual(sql.count("insert into public.equipment_assets"), 100)
            self.assertEqual(sql.count("insert into public.risk_assessments"), 100)
            self.assertNotIn("drop table", sql)
            self.assertNotIn("delete from", sql)


if __name__ == "__main__":
    unittest.main()
