"""
app.py - Main entry point and REST API for Quick Note Application.
Demonstrates the client-server request-response lifecycle with JSON payload handling
and SQLite persistence.
"""

from flask import Flask, render_template, request, jsonify
import database

app = Flask(__name__)

# Ensure tables exist on startup
database.init_db()


# ---------------------------------------------------------------------------
# Page Route (SPA)
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Serve the single-page application frontend."""
    return render_template("index.html")


# ---------------------------------------------------------------------------
# REST API Endpoints
# ---------------------------------------------------------------------------
@app.route("/api/notes", methods=["GET"])
def list_notes():
    """
    Retrieve notes list.
    Query parameters:
      - search: string to match title or content
      - category: filter by category name
    """
    search_query = request.args.get("search", default=None, type=str)
    category = request.args.get("category", default=None, type=str)
    notes = database.get_all_notes(search_query=search_query, category=category)
    return jsonify({"success": True, "count": len(notes), "data": notes}), 200


@app.route("/api/notes", methods=["POST"])
def add_note():
    """
    Create a new note.
    Expected JSON body:
      - title (optional string)
      - content (required non-empty string)
      - category (optional string, defaults to 'General')
      - color (optional hex color string)
    """
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"success": False, "error": "Invalid request. JSON body expected."}), 400

    content = payload.get("content", "").strip()
    if not content:
        return jsonify({"success": False, "error": "Note content is required and cannot be empty."}), 400

    title = payload.get("title", "").strip()
    category = payload.get("category", "General").strip() or "General"
    color = payload.get("color", "#ffffff").strip() or "#ffffff"

    new_note = database.create_note(title=title, content=content, category=category, color=color)
    return jsonify({"success": True, "message": "Note created successfully.", "data": new_note}), 201


@app.route("/api/notes/<int:note_id>", methods=["GET"])
def get_note(note_id):
    """Retrieve a single note by ID."""
    note = database.get_note_by_id(note_id)
    if not note:
        return jsonify({"success": False, "error": f"Note with ID {note_id} not found."}), 404
    return jsonify({"success": True, "data": note}), 200


@app.route("/api/notes/<int:note_id>", methods=["PUT"])
def edit_note(note_id):
    """
    Update an existing note by ID.
    JSON body may contain updated title, content, category, and/or color.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"success": False, "error": "Invalid request. JSON body expected."}), 400

    content = payload.get("content")
    if content is not None and not content.strip():
        return jsonify({"success": False, "error": "Note content cannot be empty."}), 400

    updated = database.update_note(
        note_id=note_id,
        title=payload.get("title"),
        content=payload.get("content"),
        category=payload.get("category"),
        color=payload.get("color"),
    )

    if not updated:
        return jsonify({"success": False, "error": f"Note with ID {note_id} not found."}), 404

    return jsonify({"success": True, "message": "Note updated successfully.", "data": updated}), 200


@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
def remove_note(note_id):
    """Delete a note by ID."""
    deleted = database.delete_note(note_id)
    if not deleted:
        return jsonify({"success": False, "error": f"Note with ID {note_id} not found."}), 404
    return jsonify({"success": True, "message": f"Note {note_id} deleted successfully."}), 200


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check and summary stats endpoint."""
    stats = database.get_stats()
    return jsonify({"status": "healthy", "service": "quick-note-api", "stats": stats}), 200


# ---------------------------------------------------------------------------
# Global Error Handlers
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found_handler(err):
    return jsonify({"success": False, "error": "Resource not found"}), 404


@app.errorhandler(500)
def server_error_handler(err):
    return jsonify({"success": False, "error": "Internal server error occurred"}), 500


if __name__ == "__main__":
    print("=" * 60)
    print("  🚀 Quick Note Application Server running!")
    print("  🌐 Open in your browser: http://127.0.0.1:5000")
    print("  ⚡ REST API ready at: http://127.0.0.1:5000/api/notes")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
