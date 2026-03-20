// ==UserScript==
// @name         FarmRPG QuickNav
// @namespace    http://tampermonkey.net/
// @version      1.1.0 - 2026-03-20
// @description  A draggable favorites overlay with quick navigation links and grouping
// @author       Cadis Etrama Di Raizel
// @match        https://farmrpg.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=farmrpg.com
// @grant        none
// ==/UserScript==
// 2026-03-20
(function () {
  "use strict";

  // ===========================================================================
  // STATE
  // ===========================================================================

  const state = {
    // Array of { id, label, url } | { id, label, isGroup: true, members: [{id, label, url}] }
    favorites: JSON.parse(localStorage.getItem("frpg_favorites") || "[]"),
    isVisible: false,
    isEditMode: false,
    openGroupId: null,
    drag: { active: false, startX: 0, startY: 0, originX: 0, originY: 0 },
    reorder: { draggedId: null, draggedFromGroupId: null },
  };

  function saveFavorites() {
    localStorage.setItem("frpg_favorites", JSON.stringify(state.favorites));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function getCurrentPageInfo() {
    const hash = window.location.hash;
    if (!hash || hash === "#!" || hash === "#!/" || hash === "#!/home.php") {
      return { url: hash || "#!/home.php", label: "Home" };
    }
    const path = hash.replace(/^#!\/?/, "");
    const navTitle =
      document.querySelector(".navbar .title") ||
      document.querySelector(".navbar-inner .title");
    if (navTitle && navTitle.textContent.trim()) {
      return { url: hash, label: navTitle.textContent.trim() };
    }
    const filename = path.split("?")[0].replace(".php", "");
    const label = filename
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { url: path, label };
  }

  function generateId() {
    return "_" + Math.random().toString(36).slice(2, 9);
  }

  // ===========================================================================
  // CHIP BUILDERS - NORMAL MODE
  // ===========================================================================

  function buildChipNormal(fav, groupId = null) {
    const chip = document.createElement("a");
    chip.className = "frpg-fav-chip";
    chip.dataset.id = fav.id;
    if (groupId) chip.dataset.groupId = groupId;
    chip.textContent = fav.label;
    chip.title = fav.url;
    chip.href = fav.url;

    return chip;
  }

  function buildChipGroup(group) {
    const wrap = document.createElement("div");
    wrap.className = "frpg-group-chip";
    wrap.dataset.id = group.id;

    const isOpen = state.openGroupId === group.id;
    if (isOpen) wrap.classList.add("frpg-group-chip--open");

    // Header button (the visible chip part)
    const header = document.createElement("button");
    header.className = "frpg-group-header";
    header.innerHTML =
      `<span class="frpg-group-label">${escHtml(group.label)}</span>` +
      `<span class="frpg-group-arrow">${isOpen ? "▴" : "▾"}</span>`;

    header.addEventListener("click", () => {
      if (state.openGroupId === group.id) {
        state.openGroupId = null;
      } else {
        state.openGroupId = group.id;
      }
      renderFavList();
    });

    wrap.appendChild(header);

    // Inline expanded members
    if (isOpen) {
      const membersRow = document.createElement("div");
      membersRow.className = "frpg-group-members";

      if (group.members.length === 0) {
        const empty = document.createElement("span");
        empty.className = "frpg-empty";
        empty.textContent = "Empty group";
        membersRow.appendChild(empty);
      } else {
        group.members.forEach((m) => {
          membersRow.appendChild(buildChipNormal(m, group.id));
        });
      }

      wrap.appendChild(membersRow);
    }

    return wrap;
  }

  // ===========================================================================
  // CHIP BUILDERS - EDIT MODE
  // ===========================================================================

  function buildChipEdit(fav, groupId = null) {
    const wrap = document.createElement("div");
    wrap.className = "frpg-fav-chip frpg-fav-chip--edit";
    wrap.dataset.id = fav.id;
    if (groupId) wrap.dataset.groupId = groupId;
    wrap.draggable = true;

    const handle = document.createElement("span");
    handle.className = "frpg-chip-handle";
    handle.textContent = "⠿";
    handle.title = "Drag to reorder or drop onto a group";

    const labelEl = document.createElement("span");
    labelEl.className = "frpg-chip-label";
    labelEl.textContent = fav.label;
    labelEl.contentEditable = true;
    labelEl.spellcheck = false;
    labelEl.title = "Click to rename";

    labelEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        labelEl.blur();
      }
    });
    labelEl.addEventListener("blur", () => {
      const newLabel = labelEl.textContent.trim();
      if (newLabel) {
        fav.label = newLabel;
        saveFavorites();
      } else {
        labelEl.textContent = fav.label;
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "frpg-chip-del";
    delBtn.textContent = "✕";
    delBtn.title = "Remove favorite";
    delBtn.addEventListener("click", () => {
      if (groupId) {
        // Remove from inside a group
        const grp = state.favorites.find((f) => f.id === groupId);
        if (grp) {
          grp.members = grp.members.filter((m) => m.id !== fav.id);
          saveFavorites();
          renderFavList();
        }
      } else {
        state.favorites = state.favorites.filter((f) => f.id !== fav.id);
        saveFavorites();
        renderFavList();
      }
    });

    // ── Drag events ──
    wrap.addEventListener("dragstart", (e) => {
      state.reorder.draggedId = fav.id;
      state.reorder.draggedFromGroupId = groupId;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => wrap.classList.add("frpg-dragging"), 0);
    });
    wrap.addEventListener("dragend", () => {
      wrap.classList.remove("frpg-dragging");
      state.reorder.draggedId = null;
      state.reorder.draggedFromGroupId = null;
      document
        .querySelectorAll(".frpg-drop-target")
        .forEach((el) => el.classList.remove("frpg-drop-target"));
    });
    wrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document
        .querySelectorAll(".frpg-drop-target")
        .forEach((el) => el.classList.remove("frpg-drop-target"));
      wrap.classList.add("frpg-drop-target");
    });
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't bubble up to a group chip
      const draggedId = state.reorder.draggedId;
      const fromGroupId = state.reorder.draggedFromGroupId;
      const targetId = fav.id;
      const targetGroupId = groupId;

      if (!draggedId || draggedId === targetId) return;

      // Pull the dragged item out of wherever it lives
      const dragged = extractItem(draggedId, fromGroupId);
      if (!dragged) return;

      // Insert next to the target
      insertItemNextTo(dragged, targetId, targetGroupId);
      saveFavorites();
      renderFavList();
    });

    wrap.appendChild(handle);
    wrap.appendChild(labelEl);
    wrap.appendChild(delBtn);
    return wrap;
  }

  function buildChipGroupEdit(group) {
    const wrap = document.createElement("div");
    wrap.className = "frpg-group-chip frpg-group-chip--edit";
    wrap.dataset.id = group.id;
    wrap.draggable = true;

    // ── Group header (rename + delete) ──
    const header = document.createElement("div");
    header.className = "frpg-group-header frpg-group-header--edit";

    const handle = document.createElement("span");
    handle.className = "frpg-chip-handle";
    handle.textContent = "⠿";
    handle.title = "Drag to reorder groups";

    const labelEl = document.createElement("span");
    labelEl.className = "frpg-chip-label";
    labelEl.textContent = group.label;
    labelEl.contentEditable = true;
    labelEl.spellcheck = false;
    labelEl.title = "Click to rename group";

    labelEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        labelEl.blur();
      }
    });
    labelEl.addEventListener("blur", () => {
      const newLabel = labelEl.textContent.trim();
      if (newLabel) {
        group.label = newLabel;
        saveFavorites();
      } else {
        labelEl.textContent = group.label;
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "frpg-chip-del";
    delBtn.textContent = "✕";
    delBtn.title = "Delete group (members returned to bar)";
    delBtn.addEventListener("click", () => {
      const idx = state.favorites.findIndex((f) => f.id === group.id);
      if (idx === -1) return;
      // Return members to top-level before the group's position
      state.favorites.splice(idx, 1, ...group.members);
      saveFavorites();
      renderFavList();
    });

    header.appendChild(handle);
    header.appendChild(labelEl);
    header.appendChild(delBtn);
    wrap.appendChild(header);

    // ── Members row (editable) ──
    if (group.members.length > 0) {
      const membersRow = document.createElement("div");
      membersRow.className = "frpg-group-members frpg-group-members--edit";
      group.members.forEach((m) => {
        membersRow.appendChild(buildChipEdit(m, group.id));
      });
      wrap.appendChild(membersRow);
    }

    // ── Drop zone: accept regular chips dragged onto this group ──
    wrap.addEventListener("dragover", (e) => {
      // Only accept if dragged item is NOT itself a group
      const draggedId = state.reorder.draggedId;
      if (!draggedId) return;
      const draggedItem = findItem(draggedId, state.reorder.draggedFromGroupId);
      if (draggedItem && draggedItem.isGroup) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document
        .querySelectorAll(".frpg-drop-target")
        .forEach((el) => el.classList.remove("frpg-drop-target"));
      wrap.classList.add("frpg-drop-target");
    });

    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = state.reorder.draggedId;
      const fromGroupId = state.reorder.draggedFromGroupId;
      if (!draggedId) return;

      // Don't allow dropping a group into a group
      const draggedItem = findItem(draggedId, fromGroupId);
      if (!draggedItem || draggedItem.isGroup) return;

      // Don't re-add if already in this group
      if (fromGroupId === group.id) return;

      // Move dragged item into this group
      const extracted = extractItem(draggedId, fromGroupId);
      if (!extracted) return;
      group.members.push(extracted);
      saveFavorites();
      renderFavList();
    });

    // ── Drag the group itself (reorder groups) ──
    wrap.addEventListener("dragstart", (e) => {
      // Only start drag from the handle or header, not from child chips
      if (!e.target.closest(".frpg-group-header--edit")) return;
      state.reorder.draggedId = group.id;
      state.reorder.draggedFromGroupId = null;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => wrap.classList.add("frpg-dragging"), 0);
    });
    wrap.addEventListener("dragend", () => {
      wrap.classList.remove("frpg-dragging");
      state.reorder.draggedId = null;
      state.reorder.draggedFromGroupId = null;
      document
        .querySelectorAll(".frpg-drop-target")
        .forEach((el) => el.classList.remove("frpg-drop-target"));
    });

    return wrap;
  }

  // ===========================================================================
  // ITEM MANIPULATION HELPERS
  // ===========================================================================

  // Find an item by id (optionally scoped to a group's members)
  function findItem(id, groupId) {
    if (groupId) {
      const grp = state.favorites.find((f) => f.id === groupId);
      return grp ? grp.members.find((m) => m.id === id) : null;
    }
    return state.favorites.find((f) => f.id === id) || null;
  }

  // Remove and return an item from wherever it lives
  function extractItem(id, groupId) {
    if (groupId) {
      const grp = state.favorites.find((f) => f.id === groupId);
      if (!grp) return null;
      const idx = grp.members.findIndex((m) => m.id === id);
      if (idx === -1) return null;
      return grp.members.splice(idx, 1)[0];
    }
    const idx = state.favorites.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    return state.favorites.splice(idx, 1)[0];
  }

  // Insert item next to a target (in the same list the target lives in)
  function insertItemNextTo(item, targetId, targetGroupId) {
    if (targetGroupId) {
      const grp = state.favorites.find((f) => f.id === targetGroupId);
      if (!grp) return;
      const idx = grp.members.findIndex((m) => m.id === targetId);
      grp.members.splice(idx, 0, item);
    } else {
      const idx = state.favorites.findIndex((f) => f.id === targetId);
      state.favorites.splice(idx, 0, item);
    }
  }

  // ===========================================================================
  // OVERLAY RENDER
  // ===========================================================================

  function renderFavList() {
    const list = document.getElementById("frpg-fav-list");
    if (!list) return;
    list.innerHTML = "";

    if (state.favorites.length === 0) {
      const empty = document.createElement("span");
      empty.className = "frpg-empty";
      empty.textContent = state.isEditMode
        ? "No favorites yet."
        : 'No favorites yet - navigate to a page and click "+ Add".';
      list.appendChild(empty);
      return;
    }

    state.favorites.forEach((fav) => {
      if (fav.isGroup) {
        list.appendChild(
          state.isEditMode ? buildChipGroupEdit(fav) : buildChipGroup(fav),
        );
      } else {
        list.appendChild(
          state.isEditMode ? buildChipEdit(fav) : buildChipNormal(fav),
        );
      }
    });
  }

  function updateOverlayMode() {
    const overlay = document.getElementById("frpg-favorites-overlay");
    if (!overlay) return;

    const addBtn = document.getElementById("frpg-add-btn");
    const addGroupBtn = document.getElementById("frpg-add-group-btn");
    const editBtn = document.getElementById("frpg-edit-btn");

    if (state.isEditMode) {
      overlay.classList.add("frpg-edit-mode");
      if (addBtn) addBtn.style.display = "none";
      if (addGroupBtn) addGroupBtn.style.display = "none";
      if (editBtn) {
        editBtn.textContent = "✔ Done";
        editBtn.classList.add("frpg-btn--active");
      }
    } else {
      overlay.classList.remove("frpg-edit-mode");
      if (addBtn) addBtn.style.display = "";
      if (addGroupBtn) addGroupBtn.style.display = "";
      if (editBtn) {
        editBtn.textContent = "✎ Edit";
        editBtn.classList.remove("frpg-btn--active");
      }
    }

    renderFavList();
  }

  // ===========================================================================
  // NEW GROUP INLINE INPUT
  // ===========================================================================

  function showNewGroupInput() {
    // Avoid duplicates
    if (document.getElementById("frpg-newgroup-form")) return;

    const actions = document.getElementById("frpg-overlay-actions");

    const form = document.createElement("div");
    form.id = "frpg-newgroup-form";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Group name…";
    input.className = "frpg-newgroup-input";
    input.maxLength = 24;

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "✔";
    confirmBtn.className = "frpg-newgroup-confirm";
    confirmBtn.title = "Create group";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "✕";
    cancelBtn.className = "frpg-newgroup-cancel";
    cancelBtn.title = "Cancel";

    function dismiss() {
      form.remove();
    }

    function confirm() {
      const label = input.value.trim();
      if (!label) {
        input.focus();
        return;
      }
      state.favorites.push({
        id: generateId(),
        label,
        isGroup: true,
        members: [],
      });
      saveFavorites();
      dismiss();
      renderFavList();
    }

    confirmBtn.addEventListener("click", confirm);
    cancelBtn.addEventListener("click", dismiss);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirm();
      if (e.key === "Escape") dismiss();
    });

    form.appendChild(input);
    form.appendChild(confirmBtn);
    form.appendChild(cancelBtn);

    // Insert the form before the actions row
    actions.parentNode.insertBefore(form, actions);
    input.focus();
  }

  // ===========================================================================
  // CREATE OVERLAY
  // ===========================================================================

  function createOverlay() {
    if (document.getElementById("frpg-favorites-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "frpg-favorites-overlay";
    overlay.innerHTML = `
      <div id="frpg-overlay-header">
        <span id="frpg-drag-handle" title="Drag to move">⠿ Favorites</span>
        <div id="frpg-overlay-actions">
          <button id="frpg-add-btn"       title="Save current page as favorite">+ Add this page</button>
          <button id="frpg-add-group-btn" title="Create a new group">+ New Group</button>
          <button id="frpg-edit-btn"      title="Edit / reorder favorites">✎ Edit</button>
          <button id="frpg-close-btn"     title="Close">✕</button>
        </div>
      </div>
      <div id="frpg-fav-list"></div>
    `;

    document.body.appendChild(overlay);

    // ---- Add this page ----
    document.getElementById("frpg-add-btn").addEventListener("click", () => {
      const { url, label } = getCurrentPageInfo();
      if (state.favorites.some((f) => !f.isGroup && f.url === url)) {
        const existing = document.querySelector(
          `.frpg-fav-chip[title="${url}"]`,
        );
        if (existing) {
          existing.classList.add("frpg-flash");
          setTimeout(() => existing.classList.remove("frpg-flash"), 600);
        }
        return;
      }
      state.favorites.push({ id: generateId(), label, url });
      saveFavorites();
      renderFavList();
    });

    // ---- New Group ----
    document
      .getElementById("frpg-add-group-btn")
      .addEventListener("click", () => {
        showNewGroupInput();
      });

    // ---- Edit / Done ----
    document.getElementById("frpg-edit-btn").addEventListener("click", () => {
      state.isEditMode = !state.isEditMode;
      // Close any open group when entering edit mode
      if (state.isEditMode) state.openGroupId = null;
      updateOverlayMode();
    });

    // ---- Close ----
    document.getElementById("frpg-close-btn").addEventListener("click", () => {
      toggleOverlay(false);
    });

    // ---- Overlay drag ----
    const handle = document.getElementById("frpg-drag-handle");
    handle.addEventListener("mousedown", onDragStart);
    handle.addEventListener("touchstart", onDragStart, { passive: true });

    renderFavList();
  }

  function toggleOverlay(forceState) {
    state.isVisible = forceState !== undefined ? forceState : !state.isVisible;

    let overlay = document.getElementById("frpg-favorites-overlay");
    if (state.isVisible) {
      if (!overlay) createOverlay();
      overlay = document.getElementById("frpg-favorites-overlay");
      overlay.style.display = "flex";
      state.isEditMode = false;
      updateOverlayMode();
    } else {
      if (overlay) overlay.style.display = "none";
    }

    const navBtn = document.getElementById("frpg-nav-btn");
    if (navBtn)
      navBtn.classList.toggle("frpg-nav-btn--active", state.isVisible);
  }

  // ===========================================================================
  // OVERLAY DRAG (reposition)
  // ===========================================================================

  function onDragStart(e) {
    const overlay = document.getElementById("frpg-favorites-overlay");
    if (!overlay) return;
    const isTouch = e.type === "touchstart";
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const rect = overlay.getBoundingClientRect();

    state.drag = {
      active: true,
      startX: clientX,
      startY: clientY,
      originX: rect.left,
      originY: rect.top,
    };

    const moveEvent = isTouch ? "touchmove" : "mousemove";
    const endEvent = isTouch ? "touchend" : "mouseup";

    function onMove(ev) {
      if (!state.drag.active) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const newX = Math.max(
        0,
        Math.min(
          window.innerWidth - overlay.offsetWidth,
          state.drag.originX + cx - state.drag.startX,
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          window.innerHeight - overlay.offsetHeight,
          state.drag.originY + cy - state.drag.startY,
        ),
      );
      overlay.style.left = newX + "px";
      overlay.style.top = newY + "px";
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
    }

    function onEnd() {
      state.drag.active = false;
      document.removeEventListener(moveEvent, onMove);
      document.removeEventListener(endEvent, onEnd);
    }

    document.addEventListener(moveEvent, onMove);
    document.addEventListener(endEvent, onEnd);
  }

  // ===========================================================================
  // INJECT NAV BUTTON
  // ===========================================================================

  function injectNavButton() {
    if (document.getElementById("frpg-nav-btn-li")) return;

    const sidebarList = document.querySelector(".panel-left .page-content ul");
    if (!sidebarList) return;

    const li = document.createElement("li");
    li.id = "frpg-nav-btn-li";

    const btn = document.createElement("a");
    btn.id = "frpg-nav-btn";
    btn.className = "item-link item-content frpg-nav-btn";
    btn.href = "#";
    btn.innerHTML = `<div class="item-inner"><div class="item-title">⭐ QuickNav</div></div>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleOverlay();
    });

    li.appendChild(btn);

    const firstLi = sidebarList.querySelector("li");
    if (firstLi && firstLi.nextSibling) {
      sidebarList.insertBefore(li, firstLi.nextSibling);
    } else {
      sidebarList.appendChild(li);
    }
  }

  // ===========================================================================
  // ESCAPE HTML
  // ===========================================================================

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ===========================================================================
  // STYLES
  // ===========================================================================

  function injectStyles() {
    if (document.getElementById("frpg-fav-styles")) return;
    const style = document.createElement("style");
    style.id = "frpg-fav-styles";
    style.textContent = `
      /* ---- Overlay ---- */
      #frpg-favorites-overlay {
        position: fixed;
        top: 60px;
        right: 16px;
        z-index: 99999;
        display: none;
        flex-direction: column;
        gap: 8px;
        background: #1e3a1a;
        border: 1px solid rgba(255, 200, 50, 0.35);
        border-radius: 10px;
        padding: 8px 10px;
        min-width: 220px;
        max-width: 90vw;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
        color: #c8f0c0;
        user-select: none;
      }

      /* ---- Header ---- */
      #frpg-overlay-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-bottom: 6px;
        border-bottom: 0.5px solid rgba(255,255,255,0.12);
        flex-wrap: wrap;
      }

      #frpg-drag-handle {
        font-size: 12px;
        color: #ffd966;
        font-weight: 500;
        cursor: move;
        letter-spacing: 0.3px;
        white-space: nowrap;
      }

      #frpg-overlay-actions {
        display: flex;
        gap: 5px;
        align-items: center;
        flex-wrap: wrap;
      }

      #frpg-overlay-actions button {
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 5px;
        border: 0.5px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08);
        color: #c8f0c0;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
        font-family: inherit;
      }
      #frpg-overlay-actions button:hover { background: rgba(255,255,255,0.16); }
      #frpg-add-btn       { border-color: rgba(100,220,80,0.4)  !important; color: #90ee90  !important; }
      #frpg-add-group-btn { border-color: rgba(100,180,255,0.4) !important; color: #9ecfff  !important; }
      #frpg-edit-btn.frpg-btn--active {
        background: rgba(255,200,50,0.18) !important;
        border-color: rgba(255,200,50,0.5) !important;
        color: #ffd966 !important;
      }
      #frpg-close-btn {
        border-color: transparent !important;
        background: none !important;
        color: rgba(255,255,255,0.35) !important;
        font-size: 14px !important;
        padding: 2px 5px !important;
      }

      /* ---- New group inline form ---- */
      #frpg-newgroup-form {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 0 6px;
        border-bottom: 0.5px solid rgba(255,255,255,0.1);
      }
      .frpg-newgroup-input {
        flex: 1;
        background: rgba(255,255,255,0.08);
        border: 0.5px solid rgba(100,180,255,0.4);
        border-radius: 5px;
        color: #e8ffe0;
        font-size: 11px;
        padding: 3px 7px;
        outline: none;
        font-family: inherit;
        min-width: 0;
      }
      .frpg-newgroup-input::placeholder { color: rgba(255,255,255,0.3); }
      .frpg-newgroup-confirm, .frpg-newgroup-cancel {
        font-size: 11px;
        padding: 3px 7px;
        border-radius: 5px;
        cursor: pointer;
        font-family: inherit;
        border: 0.5px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08);
        color: #c8f0c0;
        transition: background 0.15s;
      }
      .frpg-newgroup-confirm { border-color: rgba(100,220,80,0.4); color: #90ee90; }
      .frpg-newgroup-confirm:hover { background: rgba(100,220,80,0.15); }
      .frpg-newgroup-cancel:hover  { background: rgba(255,255,255,0.14); }

      /* ---- Favorites list row ---- */
      #frpg-fav-list {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 6px;
        overflow-x: auto;
        padding-bottom: 2px;
        align-items: flex-start;
        min-height: 30px;
      }
      #frpg-fav-list::-webkit-scrollbar        { height: 3px; }
      #frpg-fav-list::-webkit-scrollbar-track  { background: rgba(255,255,255,0.05); border-radius: 2px; }
      #frpg-fav-list::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.2);  border-radius: 2px; }

      /* ---- Normal chip ---- */
      .frpg-fav-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(255,255,255,0.08);
        border: 0.5px solid rgba(255,255,255,0.18);
        border-radius: 6px;
        padding: 4px 10px;
        color: #c8f0c0;
        font-size: 12px;
        white-space: nowrap;
        flex-shrink: 0;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .frpg-fav-chip:hover { background: rgba(255,255,255,0.16); color: #e8ffe0; }
      .frpg-flash {
        border-color: #ffd966 !important;
        background: rgba(255,217,102,0.2) !important;
        transition: none !important;
      }

      /* ---- Edit-mode chip ---- */
      .frpg-fav-chip--edit {
        cursor: grab;
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,200,50,0.3);
        padding: 3px 6px 3px 4px;
        position: relative;
        gap: 4px;
      }
      .frpg-fav-chip--edit:active { cursor: grabbing; }
      .frpg-chip-handle { color: rgba(255,255,255,0.3); font-size: 12px; cursor: grab; flex-shrink: 0; }
      .frpg-chip-label  { outline: none; border-bottom: 0.5px solid transparent; min-width: 20px; color: #c8f0c0; font-size: 12px; }
      .frpg-chip-label:focus { border-bottom-color: #ffd966; color: #fff; }
      .frpg-chip-del {
        background: #c0392b; border: none; border-radius: 50%;
        width: 15px; height: 15px; color: #fff; font-size: 9px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; padding: 0; line-height: 1; font-family: inherit;
        transition: background 0.15s;
      }
      .frpg-chip-del:hover { background: #e74c3c; }
      .frpg-dragging    { opacity: 0.4; }
      .frpg-drop-target { border-color: #ffd966 !important; background: rgba(255,217,102,0.15) !important; }

      /* ---- Group chip (normal mode) ---- */
      .frpg-group-chip {
        display: inline-flex;
        flex-direction: row;
        flex-shrink: 0;
        gap: 0;
        position: relative;
      }

      .frpg-group-header {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(100,180,255,0.12);
        border: 0.5px solid rgba(100,180,255,0.35);
        border-radius: 6px;
        padding: 4px 8px;
        color: #9ecfff;
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.15s;
        font-family: inherit;
        flex-shrink: 0;
      }
      .frpg-group-header:hover { background: rgba(100,180,255,0.22); }
      .frpg-group-chip--open .frpg-group-header {
        border-bottom-right-radius: 0;
        border-top-right-radius: 6px;
        background: rgba(100,180,255,0.2);
      }
      .frpg-group-arrow { font-size: 9px; opacity: 0.7; }

      /* Expanded members inline, to the right of the group header */
      .frpg-group-members {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        background: rgba(100,180,255,0.07);
        border: 0.5px solid rgba(100,180,255,0.25);
        border-left: none;
        border-radius: 0 6px 6px 0;
        padding: 3px 8px 3px 6px;
        flex-shrink: 0;
      }

      /* ---- Group chip (edit mode) ---- */
      .frpg-group-chip--edit {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        background: rgba(100,180,255,0.07);
        border: 0.5px solid rgba(100,180,255,0.3);
        border-radius: 6px;
        padding: 4px 6px;
        flex-shrink: 0;
      }
      .frpg-group-header--edit {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: grab;
      }
      .frpg-group-members--edit {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        background: none;
        border: none;
        border-radius: 0;
        padding: 0;
      }

      /* ---- Empty state ---- */
      .frpg-empty {
        color: rgba(255,255,255,0.35);
        font-size: 11px;
        font-style: italic;
        white-space: nowrap;
      }

      /* ---- Nav button ---- */
      #frpg-nav-btn.frpg-nav-btn--active .item-title { color: #ffd966 !important; }
    `;
    document.head.appendChild(style);
  }

  // ===========================================================================
  // INIT
  // ===========================================================================

  function init() {
    injectStyles();
    injectNavButton();
  }

  function waitForSidebar() {
    const sidebar = document.querySelector(".panel-left .page-content ul");
    if (sidebar) {
      init();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(".panel-left .page-content ul")) {
        observer.disconnect();
        init();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("page:init", () => injectNavButton());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForSidebar);
  } else {
    waitForSidebar();
  }

  console.log("[FarmRPG QuickNav] v1.1.0 loaded");
})();
