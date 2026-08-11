import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.config import get_portal_settings
from app.portal import require_portal_identity, slugify


class PortalConfigurationTests(unittest.TestCase):
    def test_portal_key_is_required(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "PORTAL_API_KEY"):
                get_portal_settings().require_api_key()

    def test_portal_identity_requires_matching_service_key(self):
        with patch.dict(os.environ, {"PORTAL_API_KEY": "test-secret"}, clear=True):
            with self.assertRaises(HTTPException) as context:
                require_portal_identity(
                    api_key="wrong-secret",
                    subject="user-1",
                    email="officer@example.com",
                    display_name="Loan Officer",
                    provider="externalid",
                )
        self.assertEqual(context.exception.status_code, 401)

    def test_portal_identity_normalizes_verified_email(self):
        with patch.dict(os.environ, {"PORTAL_API_KEY": "test-secret"}, clear=True):
            identity = require_portal_identity(
                api_key="test-secret",
                subject="user-1",
                email=" Officer@Example.COM ",
                display_name="Loan Officer",
                provider="externalid",
            )
        self.assertEqual(identity.email, "officer@example.com")
        self.assertEqual(identity.external_subject, "externalid:user-1")

    def test_slugify_produces_url_safe_value(self):
        self.assertEqual(slugify("First-Time Buyer Seminar!", fallback="link"), "first-time-buyer-seminar")


if __name__ == "__main__":
    unittest.main()
