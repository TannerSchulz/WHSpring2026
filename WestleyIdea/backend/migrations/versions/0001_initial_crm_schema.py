"""Create the initial multi-tenant CRM schema.

Revision ID: 0001_initial_crm
Revises:
Create Date: 2026-08-10
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mssql


revision: str = "0001_initial_crm"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "crm"


def uuid_id() -> sa.Column:
    return sa.Column("id", mssql.UNIQUEIDENTIFIER(), server_default=sa.text("NEWSEQUENTIALID()"), nullable=False)


def created_at() -> sa.Column:
    return sa.Column("created_at", mssql.DATETIMEOFFSET(), server_default=sa.text("SYSDATETIMEOFFSET()"), nullable=False)


def updated_at() -> sa.Column:
    return sa.Column("updated_at", mssql.DATETIMEOFFSET(), server_default=sa.text("SYSDATETIMEOFFSET()"), nullable=False)


def upgrade() -> None:
    op.execute("IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'crm') EXEC(N'CREATE SCHEMA [crm]')")

    op.create_table(
        "organizations",
        uuid_id(),
        sa.Column("name", sa.Unicode(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'active'"), nullable=False),
        created_at(),
        updated_at(),
        sa.CheckConstraint("[status] IN ('active', 'suspended', 'closed')", name="status_values"),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
        schema=SCHEMA,
    )

    op.create_table(
        "users",
        uuid_id(),
        sa.Column("external_subject", sa.String(255), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.Unicode(200), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'invited'"), nullable=False),
        created_at(),
        updated_at(),
        sa.CheckConstraint("[status] IN ('invited', 'active', 'disabled')", name="status_values"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("external_subject", name="uq_users_external_subject"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        schema=SCHEMA,
    )

    op.create_table(
        "organization_memberships",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("user_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("role", sa.String(30), server_default=sa.text("'loan_officer'"), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'invited'"), nullable=False),
        created_at(),
        updated_at(),
        sa.CheckConstraint("[role] IN ('owner', 'admin', 'loan_officer', 'reviewer')", name="role_values"),
        sa.CheckConstraint("[status] IN ('invited', 'active', 'disabled')", name="status_values"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_memberships_organization"),
        sa.ForeignKeyConstraint(["user_id"], ["crm.users.id"], name="fk_memberships_user"),
        sa.PrimaryKeyConstraint("id", name="pk_organization_memberships"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_membership_organization_user"),
        schema=SCHEMA,
    )
    op.create_index("ix_organization_memberships_organization_id", "organization_memberships", ["organization_id"], schema=SCHEMA)
    op.create_index("ix_organization_memberships_user_id", "organization_memberships", ["user_id"], schema=SCHEMA)

    op.create_table(
        "loan_officer_profiles",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("membership_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("public_slug", sa.String(100), nullable=False),
        sa.Column("nmls_id", sa.String(50)),
        sa.Column("title", sa.Unicode(150)),
        sa.Column("phone", sa.String(40)),
        sa.Column("branch_name", sa.Unicode(200)),
        created_at(),
        updated_at(),
        sa.ForeignKeyConstraint(["membership_id"], ["crm.organization_memberships.id"], name="fk_loan_officer_membership"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_loan_officer_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_loan_officer_profiles"),
        sa.UniqueConstraint("membership_id", name="uq_loan_officer_membership"),
        sa.UniqueConstraint("organization_id", "public_slug", name="uq_loan_officer_organization_slug"),
        schema=SCHEMA,
    )
    op.create_index("ix_loan_officer_profiles_organization_id", "loan_officer_profiles", ["organization_id"], schema=SCHEMA)

    op.create_table(
        "branding_settings",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("company_display_name", sa.Unicode(200), nullable=False),
        sa.Column("primary_color", sa.String(7), server_default=sa.text("'#103d37'"), nullable=False),
        sa.Column("secondary_color", sa.String(7), server_default=sa.text("'#d9f36f'"), nullable=False),
        sa.Column("logo_asset_key", sa.String(500)),
        sa.Column("call_to_action_label", sa.Unicode(120)),
        sa.Column("disclosure_text", sa.Unicode(2000)),
        created_at(),
        updated_at(),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_branding_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_branding_settings"),
        sa.UniqueConstraint("organization_id", name="uq_branding_organization"),
        schema=SCHEMA,
    )

    op.create_table(
        "borrower_links",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("loan_officer_profile_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("name", sa.Unicode(200), nullable=False),
        sa.Column("slug", sa.String(160), nullable=False),
        sa.Column("source", sa.Unicode(120)),
        sa.Column("is_active", mssql.BIT(), server_default=sa.text("1"), nullable=False),
        sa.Column("expires_at", mssql.DATETIMEOFFSET()),
        sa.Column("visit_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("submission_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        created_at(),
        updated_at(),
        sa.ForeignKeyConstraint(["loan_officer_profile_id"], ["crm.loan_officer_profiles.id"], name="fk_borrower_links_profile"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_borrower_links_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_borrower_links"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_borrower_link_organization_slug"),
        schema=SCHEMA,
    )
    op.create_index("ix_borrower_links_organization_id", "borrower_links", ["organization_id"], schema=SCHEMA)
    op.create_index("ix_borrower_links_profile_active", "borrower_links", ["loan_officer_profile_id", "is_active"], schema=SCHEMA)

    op.create_table(
        "borrower_submissions",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("borrower_link_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("assigned_loan_officer_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("public_reference", mssql.UNIQUEIDENTIFIER(), server_default=sa.text("NEWID()"), nullable=False),
        sa.Column("first_name", sa.Unicode(100), nullable=False),
        sa.Column("last_name", sa.Unicode(100), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40)),
        sa.Column("state", sa.String(2), nullable=False),
        sa.Column("county", sa.Unicode(150), nullable=False),
        sa.Column("employment_path", sa.String(30), nullable=False),
        sa.Column("employment_years", sa.SmallInteger()),
        sa.Column("annual_income", sa.Numeric(19, 2)),
        sa.Column("schooling_program", sa.Unicode(200)),
        sa.Column("graduation_date", mssql.DATE()),
        sa.Column("gpa", sa.Numeric(3, 2)),
        sa.Column("expected_income", sa.Numeric(19, 2)),
        sa.Column("credit_range", sa.String(20), nullable=False),
        sa.Column("monthly_debts", sa.Numeric(19, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("available_funds", sa.Numeric(19, 2), server_default=sa.text("0"), nullable=False),
        sa.Column("consent_at", mssql.DATETIMEOFFSET(), nullable=False),
        sa.Column("consent_text_version", sa.String(50), nullable=False),
        sa.Column("raw_answers", mssql.JSON()),
        sa.Column("status", sa.String(20), server_default=sa.text("'new'"), nullable=False),
        created_at(),
        updated_at(),
        sa.CheckConstraint("[status] IN ('new', 'contacted', 'reviewing', 'closed', 'archived')", name="status_values"),
        sa.CheckConstraint("[employment_path] IN ('employment', 'specialized_schooling')", name="employment_path_values"),
        sa.CheckConstraint("[credit_range] IN ('500-580', '580-620', '620-660', '660+')", name="credit_range_values"),
        sa.CheckConstraint("[employment_years] IS NULL OR [employment_years] >= 0", name="employment_years_nonnegative"),
        sa.CheckConstraint("[gpa] IS NULL OR ([gpa] >= 0 AND [gpa] <= 4.00)", name="gpa_range"),
        sa.CheckConstraint("[raw_answers] IS NULL OR ISJSON([raw_answers]) = 1", name="raw_answers_json"),
        sa.ForeignKeyConstraint(["assigned_loan_officer_id"], ["crm.loan_officer_profiles.id"], name="fk_submissions_assignee"),
        sa.ForeignKeyConstraint(["borrower_link_id"], ["crm.borrower_links.id"], name="fk_submissions_link"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_submissions_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_borrower_submissions"),
        sa.UniqueConstraint("public_reference", name="uq_borrower_submissions_public_reference"),
        schema=SCHEMA,
    )
    op.create_index("ix_borrower_submissions_organization_id", "borrower_submissions", ["organization_id"], schema=SCHEMA)
    op.create_index("ix_borrower_submissions_org_status_created", "borrower_submissions", ["organization_id", "status", "created_at"], schema=SCHEMA)
    op.create_index("ix_borrower_submissions_assignee_status", "borrower_submissions", ["assigned_loan_officer_id", "status"], schema=SCHEMA)

    op.create_table(
        "affordability_scenarios",
        uuid_id(),
        sa.Column("borrower_submission_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("label", sa.String(20), nullable=False),
        sa.Column("target_income_ratio", sa.Numeric(6, 5), nullable=False),
        sa.Column("home_price", sa.Numeric(19, 2), nullable=False),
        sa.Column("monthly_payment", sa.Numeric(19, 2), nullable=False),
        sa.Column("principal_and_interest", sa.Numeric(19, 2), nullable=False),
        sa.Column("property_tax", sa.Numeric(19, 2), nullable=False),
        sa.Column("homeowners_insurance", sa.Numeric(19, 2), nullable=False),
        sa.Column("pmi", sa.Numeric(19, 2)),
        sa.Column("interest_rate", sa.Numeric(7, 4), nullable=False),
        sa.Column("assumptions", mssql.JSON()),
        sa.Column("calculated_at", mssql.DATETIMEOFFSET(), server_default=sa.text("SYSDATETIMEOFFSET()"), nullable=False),
        sa.CheckConstraint("[label] IN ('low', 'average', 'stretch')", name="label_values"),
        sa.CheckConstraint("[assumptions] IS NULL OR ISJSON([assumptions]) = 1", name="assumptions_json"),
        sa.ForeignKeyConstraint(["borrower_submission_id"], ["crm.borrower_submissions.id"], name="fk_scenarios_submission"),
        sa.PrimaryKeyConstraint("id", name="pk_affordability_scenarios"),
        sa.UniqueConstraint("borrower_submission_id", "label", name="uq_scenario_submission_label"),
        schema=SCHEMA,
    )
    op.create_index("ix_affordability_scenarios_borrower_submission_id", "affordability_scenarios", ["borrower_submission_id"], schema=SCHEMA)

    op.create_table(
        "lead_activities",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("borrower_submission_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("actor_user_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("activity_type", sa.String(60), nullable=False),
        sa.Column("from_status", sa.String(20)),
        sa.Column("to_status", sa.String(20)),
        sa.Column("details", mssql.JSON()),
        created_at(),
        sa.CheckConstraint("[details] IS NULL OR ISJSON([details]) = 1", name="details_json"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["crm.users.id"], name="fk_lead_activities_actor"),
        sa.ForeignKeyConstraint(["borrower_submission_id"], ["crm.borrower_submissions.id"], name="fk_lead_activities_submission"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_lead_activities_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_lead_activities"),
        schema=SCHEMA,
    )
    op.create_index("ix_lead_activities_organization_id", "lead_activities", ["organization_id"], schema=SCHEMA)
    op.create_index("ix_lead_activities_submission_created", "lead_activities", ["borrower_submission_id", "created_at"], schema=SCHEMA)

    op.create_table(
        "borrower_notes",
        uuid_id(),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("borrower_submission_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("author_user_id", mssql.UNIQUEIDENTIFIER(), nullable=False),
        sa.Column("body", sa.Unicode(4000), nullable=False),
        created_at(),
        updated_at(),
        sa.ForeignKeyConstraint(["author_user_id"], ["crm.users.id"], name="fk_borrower_notes_author"),
        sa.ForeignKeyConstraint(["borrower_submission_id"], ["crm.borrower_submissions.id"], name="fk_borrower_notes_submission"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_borrower_notes_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_borrower_notes"),
        schema=SCHEMA,
    )
    op.create_index("ix_borrower_notes_organization_id", "borrower_notes", ["organization_id"], schema=SCHEMA)
    op.create_index("ix_borrower_notes_submission_created", "borrower_notes", ["borrower_submission_id", "created_at"], schema=SCHEMA)

    op.create_table(
        "audit_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("organization_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("actor_user_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", mssql.UNIQUEIDENTIFIER()),
        sa.Column("request_id", sa.String(100)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("event_data", mssql.JSON()),
        created_at(),
        sa.CheckConstraint("[event_data] IS NULL OR ISJSON([event_data]) = 1", name="event_data_json"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["crm.users.id"], name="fk_audit_events_actor"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm.organizations.id"], name="fk_audit_events_organization"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
        schema=SCHEMA,
    )
    op.create_index("ix_audit_events_org_created", "audit_events", ["organization_id", "created_at"], schema=SCHEMA)
    op.create_index("ix_audit_events_entity", "audit_events", ["entity_type", "entity_id"], schema=SCHEMA)


def downgrade() -> None:
    for table in (
        "audit_events",
        "borrower_notes",
        "lead_activities",
        "affordability_scenarios",
        "borrower_submissions",
        "borrower_links",
        "branding_settings",
        "loan_officer_profiles",
        "organization_memberships",
        "users",
        "organizations",
    ):
        op.drop_table(table, schema=SCHEMA)

    op.execute("IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'crm') EXEC(N'DROP SCHEMA [crm]')")
