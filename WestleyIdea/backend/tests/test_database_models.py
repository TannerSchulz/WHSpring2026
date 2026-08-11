import unittest

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.orm import configure_mappers

from app.database import get_database_url
from app.models import Base


EXPECTED_TABLES = {
    "affordability_scenarios",
    "audit_events",
    "borrower_links",
    "borrower_notes",
    "borrower_submissions",
    "branding_settings",
    "lead_activities",
    "loan_officer_profiles",
    "organization_memberships",
    "organizations",
    "users",
}

TENANT_TABLES = {
    "audit_events",
    "borrower_links",
    "borrower_notes",
    "borrower_submissions",
    "branding_settings",
    "lead_activities",
    "loan_officer_profiles",
    "organization_memberships",
}


class DatabaseModelTests(unittest.TestCase):
    def test_all_relationships_configure(self):
        configure_mappers()

    def test_expected_crm_tables_are_registered(self):
        tables = {table.name for table in Base.metadata.tables.values() if table.schema == "crm"}
        self.assertEqual(tables, EXPECTED_TABLES)

    def test_tenant_tables_include_organization_id(self):
        for table_name in TENANT_TABLES:
            table = Base.metadata.tables[f"crm.{table_name}"]
            self.assertIn("organization_id", table.columns, table_name)

    def test_database_url_contains_no_username_or_password(self):
        url = get_database_url(require_configured=False)
        self.assertIsNone(url.username)
        self.assertIsNone(url.password)
        self.assertEqual(url.drivername, "mssql+pyodbc")

    def test_alembic_has_one_initial_head(self):
        config = Config("alembic.ini")
        script = ScriptDirectory.from_config(config)
        self.assertEqual(script.get_heads(), ["0001_initial_crm"])


if __name__ == "__main__":
    unittest.main()
