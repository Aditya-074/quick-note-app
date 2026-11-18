/**
 * Quick Note Application - Client-side SPA Controller
 * Demonstrates async request-response cycles with fetch API,
 * dynamic DOM rendering, and real-time state management.
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------------------
  const noteForm = document.getElementById('note-form');
  const noteTitleInput = document.getElementById('note-title');
  const noteContentInput = document.getElementById('note-content');
  const noteCategorySelect = document.getElementById('note-category');
  const saveNoteBtn = document.getElementById('save-note-btn');
  const charCountDisplay = document.getElementById('char-count');

  const notesContainer = document.getElementById('notes-container');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const totalCountBadge = document.getElementById('total-count-badge');
  const focusComposerBtn = document.getElementById('focus-composer-btn');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterPillsContainer = document.getElementById('category-filter-pills');

  // Edit Modal Elements
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const editNoteIdInput = document.getElementById('edit-note-id');
  const editNoteTitleInput = document.getElementById('edit-note-title');
  const editNoteContentInput = document.getElementById('edit-note-content');
  const editNoteCategorySelect = document.getElementById('edit-note-category');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  // HTTP Inspector Elements
  const toggleInspectorBtn = document.getElementById('toggle-inspector-btn');
  const inspectorDrawer = document.getElementById('inspector-drawer');
  const closeInspectorBtn = document.getElementById('close-inspector-btn');
  const clearInspectorBtn = document.getElementById('clear-inspector-btn');
  const inspectorLogs = document.getElementById('inspector-logs');

  // Theme & Toast
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toastContainer = document.getElementById('toast-container');

  // -------------------------------------------------------------------------
  // Application State
  // -------------------------------------------------------------------------
  let activeFilter = 'all';
  let searchQuery = '';
  let searchDebounceTimer = null;
  let allNotes = [];

  // -------------------------------------------------------------------------
  // Theme Management (Light / Dark)
  // -------------------------------------------------------------------------
  const savedTheme = localStorage.getItem('quicknote_theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('quicknote_theme', newTheme);
    updateThemeIcon(newTheme);
  });

  function updateThemeIcon(theme) {
    const iconSpan = themeToggleBtn.querySelector('.theme-icon');
    if (iconSpan) {
      iconSpan.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  // -------------------------------------------------------------------------
  // HTTP Inspector Logging Helper
  // Demonstrates request-response lifecycle visually to the user
  // -------------------------------------------------------------------------
  function logHttpTransaction(method, url, requestBody, statusCode, responseBody) {
    const logItem = document.createElement('div');
    logItem.className = 'inspector-log-item';

    const timestamp = new Date().toLocaleTimeString();
    const statusClass = `log-status-${statusCode}`;

    logItem.innerHTML = `
      <div class="log-meta">
        <div>
          <span class="log-method ${method}">${method}</span>
          <span style="margin-left: 6px; font-weight: 500;">${escapeHtml(url)}</span>
        </div>
        <div>
          <span class="${statusClass}">HTTP ${statusCode}</span>
          <span style="color: var(--text-light); margin-left: 6px;">${timestamp}</span>
        </div>
      </div>
      <div class="log-details">
        ${requestBody ? `<div><strong style="color:var(--text-muted)">Request:</strong> <pre>${escapeHtml(JSON.stringify(requestBody, null, 2))}</pre></div>` : ''}
        <div><strong style="color:var(--text-muted)">Response:</strong> <pre>${escapeHtml(JSON.stringify(responseBody, null, 2))}</pre></div>
      </div>
    `;

    // Remove "waiting" message if present
    const emptyNotice = inspectorLogs.querySelector('.inspector-empty');
    if (emptyNotice) {
      emptyNotice.remove();
    }

    inspectorLogs.insertBefore(logItem, inspectorLogs.firstChild);

    // Limit log size to 25 entries
    while (inspectorLogs.children.length > 25) {
      inspectorLogs.removeChild(inspectorLogs.lastChild);
    }
  }

  toggleInspectorBtn.addEventListener('click', () => {
    inspectorDrawer.classList.toggle('open');
  });

  closeInspectorBtn.addEventListener('click', () => {
    inspectorDrawer.classList.remove('open');
  });

  clearInspectorBtn.addEventListener('click', () => {
    inspectorLogs.innerHTML = '<div class="inspector-empty">Waiting for HTTP activity...</div>';
  });

  // -------------------------------------------------------------------------
  // Fetch / Network Wrapper
  // -------------------------------------------------------------------------
  async function apiRequest(endpoint, options = {}) {
    const method = options.method || 'GET';
    const requestPayload = options.body ? JSON.parse(options.body) : null;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      logHttpTransaction(method, endpoint, requestPayload, response.status, data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (err) {
      if (!options.silent) {
        showToast(err.message || 'Network request failed', 'error');
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Core Operations: Read (GET), Create (POST), Update (PUT), Delete (DELETE)
  // -------------------------------------------------------------------------

  /**
   * Fetch notes from Python backend with optional filter/search params
   */
  async function loadNotes(showLoading = true) {
    if (showLoading) {
      loadingState.style.display = 'block';
      notesContainer.style.display = 'none';
      emptyState.style.display = 'none';
    }

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (activeFilter && activeFilter !== 'all') params.append('category', activeFilter);

      const endpoint = `/api/notes${params.toString() ? '?' + params.toString() : ''}`;
      const res = await apiRequest(endpoint);

      allNotes = res.data || [];
      renderNotes(allNotes);
      updateTotalBadge(res.count);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      loadingState.style.display = 'none';
    }
  }

  /**
   * Render notes to the grid
   */
  function renderNotes(notes) {
    notesContainer.innerHTML = '';

    if (!notes || notes.length === 0) {
      notesContainer.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    notesContainer.style.display = 'grid';

    notes.forEach(note => {
      const card = createNoteCardElement(note);
      notesContainer.appendChild(card);
    });
  }

  /**
   * Create Note Card DOM Node
   */
  function createNoteCardElement(note) {
    const card = document.createElement('article');
    card.className = 'note-card';
    card.setAttribute('data-id', note.id);
    card.setAttribute('data-color', note.color || '#ffffff');

    const formattedTime = formatTimestamp(note.created_at);
    const categoryIcon = getCategoryIcon(note.category);

    card.innerHTML = `
      <div>
        <div class="note-top">
          <h3 class="note-title">${escapeHtml(note.title)}</h3>
          <span class="note-badge">${categoryIcon} ${escapeHtml(note.category || 'General')}</span>
        </div>
        <div class="note-body">${escapeHtml(note.content)}</div>
      </div>
      <div class="note-footer">
        <span class="note-time" title="${escapeHtml(note.created_at || '')}">
          <span>🕒</span> ${formattedTime}
        </span>
        <div class="note-card-actions">
          <button class="action-btn copy-btn" title="Copy note text" aria-label="Copy note">📋</button>
          <button class="action-btn edit-btn" title="Edit note" aria-label="Edit note">✏️</button>
          <button class="action-btn delete-btn" title="Delete note" aria-label="Delete note">🗑️</button>
        </div>
      </div>
    `;

    // Action: Copy to clipboard
    const copyBtn = card.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
      const textToCopy = `${note.title ? note.title + '\n\n' : ''}${note.content}`;
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('Note copied to clipboard!', 'info'))
        .catch(() => showToast('Failed to copy text', 'error'));
    });

    // Action: Edit
    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => openEditModal(note));

    // Action: Delete
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => handleDeleteNote(note.id, note.title));

    return card;
  }

  /**
   * Handle Create Form Submission (POST)
   */
  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const category = noteCategorySelect.value;
    const selectedColorRadio = document.querySelector('input[name="color"]:checked');
    const color = selectedColorRadio ? selectedColorRadio.value : '#ffffff';

    if (!content) {
      showToast('Note content cannot be empty!', 'error');
      noteContentInput.focus();
      return;
    }

    setBtnLoading(saveNoteBtn, true, 'Saving...');

    try {
      const res = await apiRequest('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content, category, color }),
      });

      showToast('Note saved to database!', 'success');
      noteForm.reset();
      updateCharCount();

      // Reset color radio to white
      const defaultColor = document.getElementById('c-white');
      if (defaultColor) defaultColor.checked = true;

      // Reload notes list
      await loadNotes(false);
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setBtnLoading(saveNoteBtn, false, 'Save Note');
    }
  });

  /**
   * Handle Delete Note (DELETE)
   */
  async function handleDeleteNote(id, title) {
    const displayName = title ? `"${title}"` : 'this note';
    if (!confirm(`Are you sure you want to delete ${displayName}?`)) {
      return;
    }

    try {
      await apiRequest(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      showToast('Note deleted successfully', 'info');
      await loadNotes(false);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  /**
   * Edit Modal Logic (PUT)
   */
  function openEditModal(note) {
    editNoteIdInput.value = note.id;
    editNoteTitleInput.value = note.title || '';
    editNoteContentInput.value = note.content || '';
    editNoteCategorySelect.value = note.category || 'General';

    // Set matching color radio in edit modal
    const colorRadios = document.querySelectorAll('input[name="edit-color"]');
    colorRadios.forEach(radio => {
      radio.checked = radio.value.toLowerCase() === (note.color || '#ffffff').toLowerCase();
    });

    editModal.style.display = 'flex';
    editNoteContentInput.focus();
  }

  function closeEditModal() {
    editModal.style.display = 'none';
  }

  closeModalBtn.addEventListener('click', closeEditModal);
  cancelEditBtn.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const noteId = editNoteIdInput.value;
    const title = editNoteTitleInput.value.trim();
    const content = editNoteContentInput.value.trim();
    const category = editNoteCategorySelect.value;
    const selectedColor = document.querySelector('input[name="edit-color"]:checked')?.value || '#ffffff';

    if (!content) {
      showToast('Content cannot be empty', 'error');
      return;
    }

    try {
      await apiRequest(`/api/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, category, color: selectedColor }),
      });

      showToast('Note updated successfully', 'success');
      closeEditModal();
      await loadNotes(false);
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  });

  // -------------------------------------------------------------------------
  // Filtering & Search
  // -------------------------------------------------------------------------
  filterPillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;

    filterPillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    activeFilter = pill.getAttribute('data-category');
    loadNotes(true);
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadNotes(false);
    }, 280);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    loadNotes(false);
    searchInput.focus();
  });

  focusComposerBtn.addEventListener('click', () => {
    noteContentInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // -------------------------------------------------------------------------
  // Keyboard Shortcuts & Helpers
  // -------------------------------------------------------------------------
  function updateCharCount() {
    const len = noteContentInput.value.length;
    charCountDisplay.textContent = `${len} character${len === 1 ? '' : 's'}`;
  }

  noteContentInput.addEventListener('input', updateCharCount);

  // Submit on Ctrl+Enter or Cmd+Enter
  noteContentInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNoteBtn.click();
    }
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      inspectorDrawer.classList.remove('open');
    }
  });

  // -------------------------------------------------------------------------
  // UI Helpers (Toast, Button States, Formatters)
  // -------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function setBtnLoading(btn, isLoading, text) {
    const spinner = btn.querySelector('.btn-spinner');
    const label = btn.querySelector('.btn-text');

    btn.disabled = isLoading;
    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (label) label.textContent = text;
  }

  function updateTotalBadge(count) {
    if (totalCountBadge) {
      totalCountBadge.textContent = count !== undefined ? count : allNotes.length;
    }
  }

  function formatTimestamp(timestampStr) {
    if (!timestampStr) return 'Just now';
    try {
      // Normalize SQLite standard UTC timestamp
      const date = new Date(timestampStr.replace(' ', 'T') + 'Z');
      if (isNaN(date.getTime())) {
        return timestampStr;
      }

      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return timestampStr;
    }
  }

  function getCategoryIcon(cat) {
    const icons = {
      'General': '📌',
      'Work': '💼',
      'Personal': '🌿',
      'Ideas': '💡',
      'Study': '📚',
      'To-Do': '✅',
    };
    return icons[cat] || '📌';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -------------------------------------------------------------------------
  // Initial Page Load
  // -------------------------------------------------------------------------
  loadNotes();
});
