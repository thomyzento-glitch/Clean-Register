/* =========================================================
   HIGIENE CONTROL — lógica de la app
   Datos de ejemplo guardados en localStorage para simular
   backend (usuarios, lugares a limpiar, checklist e historial).
   ========================================================= */

(() => {
  "use strict";

  /* ---------------- Datos base (mock) ---------------- */
  const EMPLEADOS = [
    { id: "u1", nombre: "Ana",     apellido: "Gómez",     password: "1234" },
    { id: "u2", nombre: "Carlos",  apellido: "Pérez",     password: "1234" },
    { id: "u3", nombre: "Lucía",   apellido: "Fernández", password: "1234" },
    { id: "u4", nombre: "Martín",  apellido: "Rojas",     password: "1234" },
  ];

  const CHECKLIST_BASE = [
    "Inodoro limpio",
    "Lavamanos limpio",
    "Espejos limpios",
    "Pisos limpios y secos",
    "Dispensadores abastecidos",
    "Papelera vacía",
    "Sin olores desagradables",
    "Puerta y paredes limpias",
  ];

  const LUGARES = [
    "Baño Mujeres - Piso 2",
    "Baño Hombres - Piso 2",
    "Baño Mujeres - Piso 1",
    "Baño Hombres - Piso 1",
  ];

  /* ---------------- Estado en memoria ---------------- */
  let currentUser = null;      // empleado logueado
  let currentTask = null;      // { lugar, items:[{label, checked}], photos:[], startedAt }
  let pendingComplete = null;  // callback cuando se confirma el modal

  /* ---------------- Persistencia simple ---------------- */
  const STORAGE_KEY = "higiene-control-historial";

  function loadHistorial() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveHistorial(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  /* ---------------- Utilidades ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function pad(n) { return n.toString().padStart(2, "0"); }
  function formatDate(d) {
    const dias = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  }
  function formatTime(d) {
    let h = d.getHours(); const m = pad(d.getMinutes());
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return `${pad(h)}:${m} ${ampm}`;
  }
  function formatShortDate(d) {
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  }
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------------- Navegación entre pantallas ---------------- */
  function goTo(screenKey) {
    $$(".screen").forEach(s => s.classList.remove("active"));
    const target = $(`#screen-${screenKey}`);
    if (target) target.classList.add("active");

    $$(".nav-item").forEach(n => n.classList.remove("active"));
    $$(`.nav-item[data-nav="${screenKey}"]`).forEach(n => n.classList.add("active"));

    if (screenKey === "home") renderHome();
    if (screenKey === "tasks") renderTaskList();
    if (screenKey === "history") renderHistory();
    if (screenKey === "profile") renderProfile();
  }

  document.body.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn) { goTo(navBtn.dataset.nav); return; }
    const backBtn = e.target.closest("[data-back]");
    if (backBtn) { goTo(backBtn.dataset.back); return; }
  });

  /* ---------------- LOGIN ---------------- */
  function populateEmployeeSelect() {
    const select = $("#input-empleado");
    EMPLEADOS.forEach(emp => {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = `${emp.nombre} ${emp.apellido}`;
      select.appendChild(opt);
    });
  }

  $("#toggle-pass").addEventListener("click", () => {
    const input = $("#input-password");
    input.type = input.type === "password" ? "text" : "password";
  });

  $("#forgot-btn").addEventListener("click", () => {
    showToast("Pedile a tu supervisor que reinicie tu contraseña.");
  });

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const empId = $("#input-empleado").value;
    const pass = $("#input-password").value;
    const errorEl = $("#login-error");
    errorEl.hidden = true;

    const emp = EMPLEADOS.find(x => x.id === empId);
    if (!emp) {
      errorEl.textContent = "Seleccioná tu nombre en la lista.";
      errorEl.hidden = false;
      return;
    }
    if (emp.password !== pass) {
      errorEl.textContent = "Contraseña incorrecta. Intentá nuevamente.";
      errorEl.hidden = false;
      return;
    }
    currentUser = emp;
    $("#input-password").value = "";
    goTo("home");
  });

  /* ---------------- INICIO ---------------- */
  function todaysTasksForUser() {
    // Simula: 4 lugares asignados hoy, algunos ya completados en el historial de hoy.
    const historial = loadHistorial();
    const todayStr = formatShortDate(new Date());
    const doneToday = historial
      .filter(h => h.userId === currentUser.id && h.dateStr === todayStr)
      .map(h => h.lugar);

    return LUGARES.map(lugar => ({
      lugar,
      done: doneToday.includes(lugar),
    }));
  }

  function renderHome() {
    if (!currentUser) return;
    $("#home-name").textContent = currentUser.nombre;
    $("#home-date").textContent = formatDate(new Date());

    const tasks = todaysTasksForUser();
    const asignados = tasks.length;
    const realizadas = tasks.filter(t => t.done).length;
    const pendientes = asignados - realizadas;
    const cumplimiento = asignados ? Math.round((realizadas / asignados) * 100) : 0;

    $("#stat-asignados").textContent = asignados;
    $("#stat-realizadas").textContent = realizadas;
    $("#stat-pendientes").textContent = pendientes;
    $("#stat-cumplimiento").textContent = `${cumplimiento}%`;

    const historial = loadHistorial().filter(h => h.userId === currentUser.id);
    const list = $("#activity-list");
    list.innerHTML = "";
    if (!historial.length) {
      list.innerHTML = `<div class="empty-state">Todavía no registraste ninguna limpieza hoy.</div>`;
      return;
    }
    historial.slice(0, 4).forEach(h => {
      list.appendChild(activityRow(h));
    });
  }

  function activityRow(h) {
    const row = document.createElement("div");
    row.className = "activity-item";
    row.innerHTML = `
      <span class="ai-check">✓</span>
      <div class="ai-body">
        <strong>${h.lugar}</strong>
        <span>Limpieza realizada</span>
      </div>
      <time>${h.timeStr}</time>
    `;
    return row;
  }

  /* ---------------- LISTA DE TAREAS ---------------- */
  function renderTaskList() {
    const container = $("#task-list");
    container.innerHTML = "";
    const tasks = todaysTasksForUser();

    tasks.forEach(t => {
      const card = document.createElement("div");
      card.className = "task-card" + (t.done ? " done" : "");
      card.innerHTML = `
        <span class="tc-icon">${t.done ? "✓" : "🚻"}</span>
        <div class="tc-body">
          <strong>${t.lugar}</strong>
          <span>${t.done ? "Completada hoy" : "8 puntos de verificación"}</span>
        </div>
        <span class="tc-chevron">${t.done ? "" : "›"}</span>
      `;
      if (!t.done) {
        card.addEventListener("click", () => openChecklist(t.lugar));
      }
      container.appendChild(card);
    });
  }

  /* ---------------- CHECKLIST DE LIMPIEZA ---------------- */
  function openChecklist(lugar) {
    currentTask = {
      lugar,
      items: CHECKLIST_BASE.map(label => ({ label, checked: false })),
      photos: [],
      startedAt: new Date(),
    };
    $("#cl-title").textContent = lugar;
    $("#cl-meta").textContent = `Inicio: ${formatTime(currentTask.startedAt)} · ${formatShortDate(currentTask.startedAt)}`;
    $("#cl-observations").value = "";
    renderChecklistItems();
    renderPhotoGrid();
    goTo("checklist");
  }

  function renderChecklistItems() {
    const wrap = $("#checklist-items");
    wrap.innerHTML = "";
    currentTask.items.forEach((item, idx) => {
      const row = document.createElement("label");
      row.className = "check-row" + (item.checked ? " checked" : "");
      row.innerHTML = `
        <input type="checkbox" ${item.checked ? "checked" : ""} data-idx="${idx}">
        <span>${item.label}</span>
      `;
      row.querySelector("input").addEventListener("change", (e) => {
        currentTask.items[idx].checked = e.target.checked;
        row.classList.toggle("checked", e.target.checked);
      });
      wrap.appendChild(row);
    });
  }

  function renderPhotoGrid() {
    const grid = $("#photo-grid");
    grid.innerHTML = "";
    currentTask.photos.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "photo-thumb";
      div.innerHTML = `
        <img src="${p.dataUrl}" alt="Foto ${i + 1}">
        <span class="pt-badge">✓</span>
        <time>Foto ${i + 1} · ${formatTime(p.takenAt)}</time>
      `;
      grid.appendChild(div);
    });
  }

  $("#photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentTask.photos.push({ dataUrl: ev.target.result, takenAt: new Date() });
      renderPhotoGrid();
      showToast("Foto agregada.");
    };
    reader.onerror = () => showToast("No se pudo subir la foto. Probá de nuevo.");
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  $("#finish-btn").addEventListener("click", () => {
    if (!currentTask) return;
    const total = currentTask.items.length;
    const doneCount = currentTask.items.filter(i => i.checked).length;

    if (doneCount < total) {
      showToast(`Te faltan ${total - doneCount} tareas por marcar.`);
      return;
    }
    if (currentTask.photos.length < 2) {
      showToast("Subí al menos 2 fotos como evidencia.");
      return;
    }
    openConfirmModal(
      `${currentTask.lugar} — ${doneCount}/${total} tareas, ${currentTask.photos.length} fotos.`,
      completeCurrentTask
    );
  });

  function completeCurrentTask() {
    const finishedAt = new Date();
    const historial = loadHistorial();
    const record = {
      id: "r" + Date.now(),
      userId: currentUser.id,
      lugar: currentTask.lugar,
      tasksTotal: currentTask.items.length,
      tasksDone: currentTask.items.filter(i => i.checked).length,
      photos: currentTask.photos.length,
      observations: $("#cl-observations").value.trim(),
      startedAt: currentTask.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      dateStr: formatShortDate(finishedAt),
      timeStr: formatTime(finishedAt),
    };
    historial.unshift(record);
    saveHistorial(historial);

    const minutos = Math.max(1, Math.round((finishedAt - currentTask.startedAt) / 60000));
    $("#done-title").textContent = record.lugar;
    $("#done-datetime").textContent = `${record.dateStr} - ${record.timeStr}`;
    $("#done-tasks").textContent = `${record.tasksDone}/${record.tasksTotal}`;
    $("#done-photos").textContent = record.photos;
    $("#done-time").textContent = `${minutos} min`;

    currentTask = null;
    goTo("done");
  }

  /* ---------------- ESCANEAR QR ---------------- */
  $("#fake-scan-btn").addEventListener("click", () => {
    const lugar = LUGARES[Math.floor(Math.random() * LUGARES.length)];
    const tasks = todaysTasksForUser();
    const pending = tasks.find(t => !t.done);
    openChecklist(pending ? pending.lugar : lugar);
  });
  $("#manual-code-btn").addEventListener("click", () => {
    showToast("Ingresá el código impreso en la puerta del baño.");
  });

  /* ---------------- HISTORIAL ---------------- */
  function renderHistory() {
    const list = $("#history-list");
    list.innerHTML = "";
    const historial = loadHistorial().filter(h => h.userId === currentUser.id);
    if (!historial.length) {
      list.innerHTML = `<div class="empty-state">Todavía no hay limpiezas registradas.</div>`;
      return;
    }
    historial.forEach(h => list.appendChild(activityRow(h)));
  }

  /* ---------------- PERFIL ---------------- */
  function renderProfile() {
    $("#profile-avatar").textContent = (currentUser.nombre[0] + currentUser.apellido[0]).toUpperCase();
    $("#profile-name").textContent = `${currentUser.nombre} ${currentUser.apellido}`;
    const historial = loadHistorial().filter(h => h.userId === currentUser.id);
    $("#profile-total").textContent = historial.length;
    const tasks = todaysTasksForUser();
    const cumplimiento = tasks.length ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0;
    $("#profile-rate").textContent = `${cumplimiento}%`;
  }

  $("#logout-btn").addEventListener("click", () => {
    currentUser = null;
    currentTask = null;
    goTo("login");
  });

  /* ---------------- MODAL DE CONFIRMACIÓN ---------------- */
  function openConfirmModal(subText, onYes) {
    $("#modal-sub").textContent = subText;
    pendingComplete = onYes;
    $("#confirm-overlay").hidden = false;
  }
  function closeConfirmModal() {
    $("#confirm-overlay").hidden = true;
    pendingComplete = null;
  }
  $("#confirm-yes").addEventListener("click", () => {
    const cb = pendingComplete;
    closeConfirmModal();
    if (cb) cb();
  });
  $("#confirm-no").addEventListener("click", closeConfirmModal);

  /* ---------------- Menú (placeholder) ---------------- */
  $("#menu-btn").addEventListener("click", () => {
    showToast("Menú próximamente.");
  });

  /* ---------------- Init ---------------- */
  populateEmployeeSelect();
  goTo("login");
})();
