"""
database.py - Database initialization and helper functions for Quick Note.
Uses SQLite for zero-configuration, robust local data storage.
"""

import sqlite3
import os
from contextlib import contextmanager

DB_NAME = os.environ.get("NOTE_DB_NAME", "notes.db")


def get_db_path():
    """Return the absolute path to the database file."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, DB_NAME)


@contextmanager
def get_db_connection():
    """Context manager for SQLite database connection.
    Ensures connections are properly closed and rows are accessible as dictionaries.
    """
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema if tables do not exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                color TEXT DEFAULT '#ffffff',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def get_all_notes(search_query=None, category=None):
    """Retrieve all notes, optionally filtered by keyword or category."""
    query = "SELECT id, title, content, category, color, created_at, updated_at FROM notes WHERE 1=1"
    params = []

    if search_query:
        query += " AND (title LIKE ? OR content LIKE ?)"
        wildcard = f"%{search_query.strip()}%"
        params.extend([wildcard, wildcard])

    if category and category.lower() != "all":
        query += " AND LOWER(category) = LOWER(?)"
        params.append(category.strip())

    query += " ORDER BY created_at DESC"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_note_by_id(note_id):
    """Retrieve a single note by its ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, content, category, color, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def create_note(title, content, category="General", color="#ffffff"):
    """Insert a new note into the database and return the created record."""
    title = (title or "").strip()
    if not title:
        title = "Untitled Note"

    content = (content or "").strip()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO notes (title, content, category, color, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (title, content, category or "General", color or "#ffffff"),
        )
        new_id = cursor.lastrowid
        cursor.execute(
            "SELECT id, title, content, category, color, created_at, updated_at FROM notes WHERE id = ?",
            (new_id,),
        )
        return dict(cursor.fetchone())


def update_note(note_id, title=None, content=None, category=None, color=None):
    """Update an existing note and return the updated record, or None if not found."""
    existing = get_note_by_id(note_id)
    if not existing:
        return None

    new_title = (title.strip() if title is not None else existing["title"]) or "Untitled Note"
    new_content = content.strip() if content is not None else existing["content"]
    new_category = category.strip() if category is not None else existing["category"]
    new_color = color.strip() if color is not None else existing["color"]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE notes
            SET title = ?, content = ?, category = ?, color = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (new_title, new_content, new_category, new_color, note_id),
        )
        cursor.execute(
            "SELECT id, title, content, category, color, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        )
        return dict(cursor.fetchone())


def delete_note(note_id):
    """Delete a note by ID. Returns True if deleted, False if not found."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        return cursor.rowcount > 0


def get_stats():
    """Return summary statistics of notes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total_notes FROM notes")
        total = cursor.fetchone()["total_notes"]

        cursor.execute("SELECT DISTINCT category FROM notes WHERE category IS NOT NULL AND category != ''")
        categories = [row["category"] for row in cursor.fetchall()]

        return {"total_notes": total, "categories": categories}
