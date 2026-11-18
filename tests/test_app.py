"""
test_app.py - Automated Test Suite for Quick Note Application.
Covers REST API endpoints, request-response flows, validation, and database operations.
"""

import os
import unittest
import tempfile
import json

# Set a temporary database for testing before importing app / database
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
os.environ["NOTE_DB_NAME"] = temp_db_path

import app
import database


class QuickNoteTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.app.config["TESTING"] = True
        cls.client = app.app.test_client()

    def setUp(self):
        # Re-initialize clean test schema before each test
        with database.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS notes")
            conn.commit()
        database.init_db()

    @classmethod
    def tearDownClass(cls):
        try:
            os.close(temp_db_fd)
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)
        except OSError:
            pass

    def test_index_page_loads(self):
        """Test that the single-page application is served at root /."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Quick Note", response.data)

    def test_get_empty_notes(self):
        """Test retrieving notes when none exist."""
        response = self.client.get("/api/notes")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["data"], [])

    def test_create_note_success(self):
        """Test creating a note via POST request (request-response lifecycle)."""
        payload = {
            "title": "Grocery Run",
            "content": "Buy oats, almond milk, and berries.",
            "category": "Personal",
            "color": "#e7f5ff",
        }
        response = self.client.post(
            "/api/notes",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["title"], "Grocery Run")
        self.assertEqual(data["data"]["content"], "Buy oats, almond milk, and berries.")
        self.assertEqual(data["data"]["category"], "Personal")
        self.assertIn("id", data["data"])

    def test_create_note_validation_missing_content(self):
        """Test that empty or missing content returns 400 Bad Request."""
        payload = {"title": "No content here", "content": "   "}
        response = self.client.post(
            "/api/notes",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data["success"])
        self.assertIn("content is required", data["error"].lower())

    def test_get_single_note_by_id(self):
        """Test retrieving a specific note by ID."""
        created = database.create_note("Test", "Sample content")
        note_id = created["id"]

        response = self.client.get(f"/api/notes/{note_id}")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["id"], note_id)
        self.assertEqual(data["data"]["title"], "Test")

    def test_get_nonexistent_note_returns_404(self):
        """Test that retrieving a nonexistent note returns 404 Not Found."""
        response = self.client.get("/api/notes/9999")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertFalse(data["success"])

    def test_update_note(self):
        """Test updating a note via PUT."""
        created = database.create_note("Draft", "Initial draft")
        note_id = created["id"]

        update_payload = {
            "title": "Final Draft",
            "content": "Polished text content",
            "category": "Work",
        }
        response = self.client.put(
            f"/api/notes/{note_id}",
            data=json.dumps(update_payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["title"], "Final Draft")
        self.assertEqual(data["data"]["content"], "Polished text content")
        self.assertEqual(data["data"]["category"], "Work")

    def test_delete_note(self):
        """Test deleting a note via DELETE."""
        created = database.create_note("To be deleted", "Bye bye")
        note_id = created["id"]

        response = self.client.delete(f"/api/notes/{note_id}")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data["success"])

        # Confirm note is gone
        verify_response = self.client.get(f"/api/notes/{note_id}")
        self.assertEqual(verify_response.status_code, 404)

    def test_search_and_filter(self):
        """Test keyword searching and category filtering."""
        database.create_note("Python Tips", "Use context managers", "Study")
        database.create_note("Shopping", "Buy apples", "Personal")
        database.create_note("Project RoadMap", "Sprint 1 Python backend", "Work")

        # Search for "python"
        search_res = self.client.get("/api/notes?search=Python")
        self.assertEqual(search_res.status_code, 200)
        search_data = search_res.get_json()
        self.assertEqual(search_data["count"], 2)

        # Filter by category "Personal"
        cat_res = self.client.get("/api/notes?category=Personal")
        self.assertEqual(cat_res.status_code, 200)
        cat_data = cat_res.get_json()
        self.assertEqual(cat_data["count"], 1)
        self.assertEqual(cat_data["data"][0]["title"], "Shopping")

    def test_health_check(self):
        """Test the health check endpoint."""
        database.create_note("Hello", "World")
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["stats"]["total_notes"], 1)


if __name__ == "__main__":
    unittest.main()
