import unittest

from main import app


class ApiSurfaceTests(unittest.TestCase):
    def test_active_routes_remain_and_retired_ai_routes_are_absent(self):
        paths = {route.path for route in app.routes}

        self.assertIn("/api/utah-rates", paths)
        self.assertIn("/api/health", paths)
        self.assertIn("/api/health/database", paths)
        self.assertIn("/api/portal/team/invitations", paths)
        self.assertIn("/api/portal/team/members/{membership_id}", paths)
        self.assertIn("/api/portal/branding", paths)
        self.assertIn("/api/portal/settings/workspace", paths)
        self.assertIn("/api/portal/settings/profile", paths)
        self.assertNotIn("/api/assess", paths)
        self.assertNotIn("/api/step-help", paths)
        self.assertNotIn("/api/chat", paths)


if __name__ == "__main__":
    unittest.main()
