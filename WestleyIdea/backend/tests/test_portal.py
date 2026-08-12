import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.config import get_portal_settings
from app.portal import require_portal_identity, slugify, validate_hex_color, validate_logo_url


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

    def test_brand_color_is_normalized(self):
        self.assertEqual(validate_hex_color(" #A1B2C3 "), "#a1b2c3")

    def test_brand_color_rejects_invalid_values(self):
        with self.assertRaises(HTTPException) as context:
            validate_hex_color("green")
        self.assertEqual(context.exception.status_code, 422)

    def test_logo_url_requires_https(self):
        with self.assertRaises(HTTPException) as context:
            validate_logo_url("http://example.com/logo.png")
        self.assertEqual(context.exception.status_code, 422)

    def test_empty_logo_url_is_removed(self):
        self.assertIsNone(validate_logo_url("  "))


if __name__ == "__main__":
    unittest.main()
