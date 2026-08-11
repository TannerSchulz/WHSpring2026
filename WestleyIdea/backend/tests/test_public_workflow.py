import unittest
from uuid import uuid4

from pydantic import ValidationError
from starlette.routing import Match

from app.public import SubmissionCreate, router


def valid_payload() -> dict:
    return {
        "submission_reference": str(uuid4()),
        "first_name": "Taylor",
        "last_name": "Borrower",
        "email": "Taylor@example.com",
        "phone": None,
        "state": "ut",
        "county": "Salt Lake County",
        "employment_path": "employment",
        "employment_years": 3,
        "annual_income": 85000,
        "credit_range": "660+",
        "monthly_debts": 500,
        "available_funds": 25000,
        "loan_type": "conventional",
        "consent": True,
        "website": None,
        "scenarios": [
            {
                "label": label,
                "target_income_ratio": ratio,
                "home_price": 350000,
                "monthly_payment": 2200,
                "principal_and_interest": 1800,
                "property_tax": 180,
                "homeowners_insurance": 120,
                "pmi": 100,
                "interest_rate": 6.5,
            }
            for label, ratio in (("low", .25), ("average", .33), ("stretch", .40))
        ],
    }


class PublicWorkflowTests(unittest.TestCase):
    def test_submission_normalizes_identity_and_state(self):
        payload = valid_payload()
        payload["email"] = " Borrower@Example.COM "
        submission = SubmissionCreate.model_validate(payload)
        self.assertEqual(submission.email, "borrower@example.com")
        self.assertEqual(submission.state, "UT")

    def test_submission_requires_consent(self):
        payload = valid_payload()
        payload["consent"] = False
        with self.assertRaises(ValidationError):
            SubmissionCreate.model_validate(payload)

    def test_submission_requires_all_three_scenarios(self):
        payload = valid_payload()
        payload["scenarios"][2]["label"] = "average"
        with self.assertRaises(ValidationError):
            SubmissionCreate.model_validate(payload)

    def test_honeypot_rejects_automated_submission(self):
        payload = valid_payload()
        payload["website"] = "https://spam.invalid"
        with self.assertRaises(ValidationError):
            SubmissionCreate.model_validate(payload)

    def test_nested_slug_submission_route_matches_post(self):
        scope = {
            "type": "http",
            "path": "/api/public/links/advisor/campaign/submissions",
            "root_path": "",
            "method": "POST",
            "query_string": b"",
            "headers": [],
        }
        full_matches = [route for route in router.routes if route.matches(scope)[0] == Match.FULL]
        self.assertEqual(len(full_matches), 1)
        self.assertIn("POST", full_matches[0].methods)


if __name__ == "__main__":
    unittest.main()
