# Quick Note Application 📝

A single-page web application (SPA) where users can create, view, edit, and organize notes.

This project was built to illustrate the fundamental **client-server request-response lifecycle**, asynchronous JavaScript communication via the `fetch` API, and persistent data storage using Python and SQLite.

---

## 📌 Project Overview

- **Frontend**: Clean single-page application built with semantic HTML5, modern CSS3 (featuring dark/light theme support and responsive card layout), and vanilla JavaScript.
- **Backend**: Python (Flask) providing a structured REST API for CRUD operations.
- **Database**: SQLite3 for server-side persistence.
- **Developer Tools**: An interactive HTTP Inspector drawer built directly into the UI to inspect HTTP requests, status codes, and payloads in real time.

---

## 🚀 Architecture & Request-Response Flow

```
+-------------------------------------------------------------+
|                      Browser / Client                       |
|  - User inputs note & clicks "Save"                         |
|  - JavaScript captures form event                           |
|  - Dispatches: fetch('/api/notes', { method: 'POST', ... }) |
+------------------------------+------------------------------+
                               |
                   HTTP POST   |   HTTP 201 Created
                   JSON Data   |   JSON Response
                               v
+-------------------------------------------------------------+
|                    Python Backend (Flask)                   |
|  - Validates incoming JSON payload                          |
|  - Executes parameterized SQL INSERT query                  |
|  - Commits to SQLite database                               |
|  - Returns HTTP 201 with saved note record                  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      SQLite Database                        |
|  - Table: notes (id, title, content, category, color, ...)  |
+-------------------------------------------------------------+
```

---

## ✨ Features

- **Instant Note Creation**: Write notes with an optional title, category, and accent color.
- **Single-Page Application (SPA)**: New notes appear on the board without a full browser refresh.
- **Live Search & Category Filtering**: Filter notes by category pills or search note titles and content in real-time.
- **Full CRUD Support**: Create, Read, Update, and Delete notes.
- **Clipboard Integration**: One-click button to copy note text.
- **Dark & Light Mode**: Persistent theme toggle saved in `localStorage`.
- **Built-in HTTP Inspector**: Visual drawer showing every network request, status code, and response body.
- **Automated Tests**: Unit and integration test suite covering API endpoints and validation.

---

## 📂 Project Structure

```text
├── app.py              # Flask server and REST API routes
├── database.py         # SQLite connection manager and SQL queries
├── requirements.txt    # Python dependencies
├── .gitignore          # Git exclusion rules
├── templates/
│   └── index.html      # Single-page interface
├── static/
│   ├── css/
│   │   └── style.css   # Styling, theme variables, and animations
│   └── js/
│       └── app.js      # Client controller and DOM manipulation
└── tests/
    └── test_app.py     # Automated test suite
```

---

## 🛠️ Getting Started

### Prerequisites

- Python 3.8 or higher installed on your system.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/quick-note-app.git
   cd quick-note-app
   ```

2. **Create and activate a virtual environment (optional but recommended)**:
   ```bash
   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate

   # On Windows:
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the application**:
   ```bash
   python app.py
   ```

5. **Open in browser**:
   Navigate to `http://127.0.0.1:5000` in your web browser.

---

## 🧪 Running Tests

To execute the automated test suite:

```bash
python -m unittest tests/test_app.py
```

---

## 📡 API Reference

| Endpoint | Method | Description | Sample Status |
| :--- | :---: | :--- | :---: |
| `/` | `GET` | Serves the single-page application | `200 OK` |
| `/api/notes` | `GET` | List all notes (supports `?search=` and `?category=`) | `200 OK` |
| `/api/notes` | `POST` | Create a new note | `201 Created` |
| `/api/notes/<id>` | `GET` | Fetch a single note by ID | `200 OK` / `404 Not Found` |
| `/api/notes/<id>` | `PUT` | Update an existing note | `200 OK` / `404 Not Found` |
| `/api/notes/<id>` | `DELETE` | Remove a note | `200 OK` / `404 Not Found` |
| `/api/health` | `GET` | Service status and note count summary | `200 OK` |
