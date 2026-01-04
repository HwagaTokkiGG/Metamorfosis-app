/* SIMPLE APP — Registro, Login, Publicaciones, Roles, Buzón privado y Cambio de Logo */

// =========================================================
// Utilidades
// =========================================================
function $(id) { return document.querySelector(id); }

// NOTE: show/hide se usan en muchos lugares. Para proteger el feed
// añadimos una comprobación dentro de show para evitar que alguien
// manipule el DOM y muestre la sección del feed sin autorización.
function show(id) {
    const el = $(id);
    if (!el) return;
    // Protección específica: si se intenta mostrar la sección FEED, validar.
    try {
        const targetId = typeof id === "string" ? id.replace(/^\s*/, '') : null;
        if (targetId === "#feedSection" || (el.id && el.id === "feedSection")) {
            // Sólo permitir si el usuario está autenticado (registered user/admin/moderator)
            if (!currentUser) {
                alert("Acceso denegado: regístrate con tu Gmail institucional");
                // Forzar vista de autenticación y mantener feed oculto
                hide("#feedSection");
                show("#authSection");
                return;
            }
            // Si currentUser existe, permitimos el acceso (los usuarios ya registrados pueden ver el feed).
            // Nota: la validación de dominios para nuevos registros ocurre en registro/login.
        }
    } catch (e) {
        // si algo falla, seguir con comportamiento normal
    }

    el.classList.remove("hide");
}

function hide(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("hide");
}

function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
}
function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// escape regex helper
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Title Case helper for display names
function toDisplayName(name) {
    if (!name || typeof name !== "string") return name;
    const atIndex = name.indexOf("@");
    if (atIndex > 0) {
        const local = name.slice(0, atIndex);
        const domain = name.slice(atIndex);
        const pieces = local.split(/([.\-_ ])/g);

        return pieces.map(p => {
            if (/^[.\-_ ]$/.test(p)) return p;
            return p.split(/([A-Za-zÀ-ÖØ-öø-ÿ]+)/g).map(tok => {
                if (!tok) return tok;
                return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
            }).join('');
        }).join('') + domain;
    } else {
        return name.split(/\s+/).map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
    }
}

// =========================================================
// Datos
// =========================================================
let users = load("users", []);
let posts = load("posts", []);
let comments = load("comments", []);
let messages = load("messages", []);
let currentUser = load("currentUser", null);
let currentPostId = null;
let savedLogo = load("appLogo", null);

// =========================================================
// Normalizar usernames
// =========================================================
(function normalizeUsernames() {
    let changed = false;
    users = users.map(u => {
        if (!u || typeof u.username !== "string") return u;
        const lower = u.username.toLowerCase();
        if (u.username !== lower) {
            changed = true;
            return Object.assign({}, u, { username: lower });
        }
        return u;
    });
    if (changed) save("users", users);

    if (currentUser && currentUser.username) {
        currentUser.username = currentUser.username.toLowerCase();
        save("currentUser", currentUser);
    }
})();

// =========================================================
// Dominios permitidos
// =========================================================
let allowedDomains = load("allowedDomains", ["@colegio.edu.co"]);

// =========================================================
// Mostrar logo guardado
// =========================================================
function loadLogo() {
    const logo = $("#appLogo");
    if (logo && savedLogo) {
        logo.src = savedLogo;
        logo.style.display = "block";
    }
}
loadLogo();

// =========================================================
// Mostrar lista de dominios
// =========================================================
function renderDomains() {
    const list = $("#allowedDomainsList");
    if (!list) return;
    list.innerHTML = "";
    allowedDomains.forEach(domain => {
        const li = document.createElement("li");
        li.textContent = domain;
        list.appendChild(li);
    });
}

if ($("#addDomainBtn")) {
    $("#addDomainBtn").onclick = () => {
        const newDom = $("#newDomainInput").value.trim().toLowerCase();
        if (!newDom.startsWith("@")) return alert("Debe empezar con @");
        if (allowedDomains.includes(newDom)) return alert("Ese dominio ya existe");

        allowedDomains.push(newDom);
        save("allowedDomains", allowedDomains);
        $("#newDomainInput").value = "";
        renderDomains();
    };
}

// =========================================================
// Validación dominio institucional (solo nuevos usuarios)
// =========================================================
function requiresInstitutionalEmail(username) {
    // La función devuelve true si la validación debe aplicarse a este username.
    // Queremos que no aplique para administradoras, moderadoras, ni usuarios ya registrados.
    // Si el username ya existe en users => ES un usuario registrado; NO se le exige dominio para acceder al feed.
    // (La regla de exigir dominio se aplica a usuarios que aún no están en "users" — es decir, nuevos registros.)
    const existing = users.find(u => u.username === username);
    if (existing) {
        // usuario ya registrado: no requiere verificación para poder ver el feed
        return false;
    }
    // para nuevos (no existentes), sí requiere correo institucional
    return true;
}

function hasAllowedDomain(username) {
    if (!username || typeof username !== "string") return false;
    return allowedDomains.some(domain => username.toLowerCase().endsWith(domain));
}

// =========================================================
// UI según rol  (MODIFICADA: Feed oculto hasta login)
// =========================================================
function updateUI() {

    // Por seguridad, siempre ocultamos el botón Feed si no hay sesión válida.
    if (!currentUser) {
        hide("#btnFeed");
        hide("#feedSection"); // asegurar que la sección también esté oculta
    }

    if (currentUser) {
        // usuario ya registrado puede ver Feed
        show("#btnFeed");

        hide("#authSection");
        show("#btnLogout");
        show("#btnEditProfile");

        if (currentUser.role === "admin") {
            show("#btnNewPost");
            show("#btnUserPanel");
            show("#btnInbox");
            show("#btnLogoPanel");
            hide("#floatingMessageBtn");
        }
        else if (currentUser.role === "moderator") {
            show("#btnNewPost");
            hide("#btnUserPanel");
            show("#btnInbox");
            hide("#btnLogoPanel");
            hide("#floatingMessageBtn");
        }
        else {
            hide("#btnNewPost");
            hide("#btnUserPanel");
            hide("#btnInbox");
            hide("#btnLogoPanel");
            show("#floatingMessageBtn");
        }
    }
    else {
        // No hay sesión: mostrar panel de auth y ocultar opciones sensibles.
        show("#authSection");
        hide("#btnLogout");
        hide("#btnNewPost");
        hide("#btnUserPanel");
        hide("#btnInbox");
        hide("#btnEditProfile");
        hide("#btnLogoPanel");
        // Asegurar feed oculto
        hide("#feedSection");
    }
}

// =========================================================
// Navegación
// =========================================================
$("#btnAuth") && ($("#btnAuth").onclick = () => {
    show("#authSection");
    hide("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#editProfileSection");
    hide("#logoSection");
});

// Al hacer click en btnFeed se comprueba de nuevo la sesión — bloqueo total.
$("#btnFeed") && ($("#btnFeed").onclick = () => {
    // Protección extra por si alguien intenta activar el botón vía consola.
    if (!currentUser) {
        alert("Acceso denegado: regístrate con tu Gmail institucional");
        show("#authSection");
        hide("#feedSection");
        return;
    }

    hide("#authSection");
    show("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#editProfileSection");
    hide("#logoSection");

    renderPosts();
});

$("#btnNewPost") && ($("#btnNewPost").onclick = () => {
    hide("#feedSection");
    hide("#authSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#editProfileSection");
    hide("#logoSection");

    show("#newPostSection");
});

$("#btnUserPanel") && ($("#btnUserPanel").onclick = () => {
    if (!currentUser || currentUser.role !== "admin") return;

    hide("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#editProfileSection");
    hide("#logoSection");

    renderUserList();
    renderDomains();
    show("#userManagementSection");
});

// =========================================================
// PANEL CAMBIAR LOGO
// =========================================================
$("#btnLogoPanel") && ($("#btnLogoPanel").onclick = () => {
    hide("#feedSection");
    hide("#authSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#editProfileSection");

    show("#logoSection");
});

$("#saveLogoBtn") && ($("#saveLogoBtn").onclick = async () => {
    const file = $("#logoFile").files[0];
    if (!file) return alert("Selecciona una imagen.");

    const reader = new FileReader();
    reader.onload = () => {
        savedLogo = reader.result;
        save("appLogo", savedLogo);

        if ($("#appLogo")) {
            $("#appLogo").src = savedLogo;
            $("#appLogo").style.display = "block";
        }

        alert("Logo actualizado.");
        $("#btnFeed") && $("#btnFeed").click();
    };

    reader.readAsDataURL(file);
});

$("#cancelLogoBtn") && ($("#cancelLogoBtn").onclick = () => {
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// PANEL EDITAR PERFIL
// =========================================================
$("#btnEditProfile") && ($("#btnEditProfile").onclick = () => {
    hide("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#inboxSection");
    hide("#logoSection");

    if (currentUser && currentUser.username) {
        $("#editUsernameInput").value = toDisplayName(currentUser.username);
    } else {
        $("#editUsernameInput").value = "";
    }

    show("#editProfileSection");
});

$("#btnLogout") && ($("#btnLogout").onclick = () => {
    currentUser = null;
    save("currentUser", null);
    updateUI();
    show("#authSection");
});

// =========================================================
// Registro
// =========================================================
$("#registerForm") && ($("#registerForm").onsubmit = e => {
    e.preventDefault();

    const rawUser = $("#regUser").value.trim();
    const user = rawUser.toLowerCase();
    const pass = $("#regPass").value.trim();

    if (users.find(u => u.username === user)) {
        alert("Ese usuario ya existe.");
        return;
    }

    // Si es usuario nuevo -> debe tener dominio permitido
    if (requiresInstitutionalEmail(user) && !hasAllowedDomain(user)) {
        return alert("Acceso denegado: por favor registrarse con su Gmail institucional");
    }

    let role = "user";
    if (users.length < 2) role = "admin";

    const newUser = { username: user, pass, role };

    users.push(newUser);
    save("users", users);

    currentUser = newUser;
    save("currentUser", currentUser);

    alert("Registrada correctamente (" + toDisplayName(currentUser.username) + ")");
    updateUI();
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Login
// =========================================================
$("#loginForm") && ($("#loginForm").onsubmit = e => {
    e.preventDefault();

    const userInput = $("#loginUser").value.trim();
    const user = userInput.toLowerCase();
    const pass = $("#loginPass").value.trim();

    const found = users.find(u => u.username === user && u.pass === pass);

    if (!found) return alert("Credenciales incorrectas");

    // Nota: found ya está registrado -> le permitimos el acceso aunque su correo no tenga el dominio,
    // porque la regla de dominio se aplica solo a nuevos registros (por requisito).
    currentUser = found;
    save("currentUser", currentUser);

    alert("Bienvenida " + toDisplayName(currentUser.username));
    updateUI();
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Crear publicación
// =========================================================
$("#postForm") && ($("#postForm").onsubmit = async e => {
    e.preventDefault();

    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "moderator")) {
        alert("No tienes permiso para publicar.");
        return;
    }

    const title = $("#postTitle").value.trim();
    const body = $("#postBody").value.trim();
    const file = $("#postMedia").files[0];

    let mediaData = null;
    let mediaType = null;

    if (file) {
        mediaType = file.type;
        mediaData = await new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.readAsDataURL(file);
        });
    }

    posts.unshift({
        id: Date.now(),
        title,
        body,
        author: currentUser.username,
        date: new Date().toLocaleString(),
        mediaData,
        mediaType
    });

    save("posts", posts);

    $("#postTitle").value = "";
    $("#postBody").value = "";
    $("#postMedia").value = "";

    alert("Publicado");
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Mostrar posts
// =========================================================
function renderPosts() {
    // Protección adicional: nunca renderizar posts si no hay sesión válida
    if (!currentUser) {
        alert("Acceso denegado: regístrate con tu Gmail institucional");
        hide("#feedSection");
        show("#authSection");
        return;
    }

    const container = $("#postsContainer");
    if (!container) return;
    container.innerHTML = "";

    if (posts.length === 0) {
        container.innerHTML = "<p>No hay publicaciones.</p>";
        return;
    }

    posts.forEach(p => {
        const div = document.createElement("div");
        div.className = "post";

        const authorDisplay = toDisplayName(p.author);

        div.innerHTML = `
            <h3>${p.title}</h3>
            <p>${p.body}</p>
            <small>Publicado por ${authorDisplay} — ${p.date}</small>
        `;

        if (p.mediaData) {
            if (p.mediaType && p.mediaType.startsWith && p.mediaType.startsWith("image/")) {
                const img = document.createElement("img");
                img.src = p.mediaData;
                div.appendChild(img);
            }
            else if (p.mediaType === "video/mp4") {
                const video = document.createElement("video");
                video.src = p.mediaData;
                video.controls = true;
                div.appendChild(video);
            }
            else if (p.mediaType === "application/pdf") {
                const link = document.createElement("a");
                link.href = p.mediaData;
                link.target = "_blank";
                link.className = "file-link";
                link.innerText = "Ver PDF";
                div.appendChild(link);
            }
        }

        const btnComments = document.createElement("button");
        btnComments.innerText = "Ver comentarios";
        btnComments.onclick = () => openComments(p.id);
        div.appendChild(btnComments);

// 🔴 Botón eliminar (solo admin / moderadora)
if (currentUser && (currentUser.role === "admin" || currentUser.role === "moderator")) {
    const btnDelete = document.createElement("button");
    btnDelete.innerText = "Eliminar post";
    btnDelete.style.background = "#b30000";
    btnDelete.style.color = "white";
    btnDelete.style.marginLeft = "8px";

    btnDelete.onclick = () => {
        if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;

        posts = posts.filter(post => post.id !== p.id);
        save("posts", posts);
        renderPosts();
    };

    div.appendChild(btnDelete);
}

        container.appendChild(div);
    });
}

// =========================================================
// Gestión de usuarios
// =========================================================
function renderUserList() {
    const list = $("#userList");
    if (!list) return;
    list.innerHTML = "";

    users.forEach(u => {
        const row = document.createElement("div");
        row.className = "user-row";

        row.innerHTML = `
            <strong>${toDisplayName(u.username)}</strong><br>
            Rol actual: ${u.role}
        `;

        const isCurrent = (currentUser && u.username === currentUser.username);

        if (u.role === "user") {
            let btnM = document.createElement("button");
            btnM.innerText = "Ascender a moderadora";
            btnM.onclick = () => changeRole(u.username, "moderator");

            let btnA = document.createElement("button");
            btnA.innerText = "Ascender a administradora";
            btnA.onclick = () => changeRole(u.username, "admin");

            row.appendChild(btnM);
            row.appendChild(btnA);
        }

        else if (u.role === "moderator") {
            let btnA = document.createElement("button");
            btnA.innerText = "Ascender a administradora";
            btnA.onclick = () => changeRole(u.username, "admin");

            let btnU = document.createElement("button");
            btnU.innerText = "Degradar a usuaria";
            btnU.onclick = () => changeRole(u.username, "user");

            row.appendChild(btnA);
            row.appendChild(btnU);
        }

        else if (u.role === "admin") {
            if (!isCurrent) {
                let btnM = document.createElement("button");
                btnM.innerText = "Degradar a moderadora";
                btnM.onclick = () => changeRole(u.username, "moderator");

                let btnU = document.createElement("button");
                btnU.innerText = "Degradar a usuaria";
                btnU.onclick = () => changeRole(u.username, "user");

                row.appendChild(btnM);
                row.appendChild(btnU);
            }
        }

        list.appendChild(row);
    });
}

function changeRole(username, newRole) {
    const user = users.find(u => u.username === username);
    if (!user) return;

    if (user.role === "admin" && newRole !== "admin") {
        const admins = users.filter(u => u.role === "admin");
        if (admins.length === 1) {
            alert("No puedes eliminar a la última administradora.");
            return;
        }
    }

    user.role = newRole;
    save("users", users);

    alert(toDisplayName(username) + " ahora es " + newRole);
    renderUserList();
}

// =========================================================
// Editar perfil
// =========================================================
$("#btnSaveUsername") && ($("#btnSaveUsername").onclick = () => {
    let newNameRaw = $("#editUsernameInput").value.trim();
    if (!newNameRaw) return alert("El nombre no puede estar vacío.");

    const inputLower = newNameRaw.toLowerCase();
    const looksLikeEmail = inputLower.includes("@");

    if (looksLikeEmail) {

        if (requiresInstitutionalEmail(currentUser.username) && !hasAllowedDomain(inputLower)) {
            return alert("El nuevo nombre de usuario debe ser un correo institucional válido.");
        }

        if (users.some(u => u.username === inputLower && u.username !== currentUser.username)) {
            return alert("Ese usuario ya existe.");
        }

        const oldName = currentUser.username;
        currentUser.username = inputLower;

        users = users.map(u => {
            if (u.username === oldName) u.username = inputLower;
            return u;
        });
        posts = posts.map(p => { if (p.author === oldName) p.author = inputLower; return p; });
        comments = comments.map(c => { if (c.author === oldName) c.author = inputLower; return c; });
        messages = messages.map(m => {
            if (m.realUser === oldName) m.realUser = inputLower;
            if (m.sender && m.sender.toLowerCase() === oldName) m.sender = inputLower;
            return m;
        });
    } else {
        alert("Se actualizó el nombre de visualización (no afecta al correo/usuario de acceso).");
    }

    save("users", users);
    save("posts", posts);
    save("comments", comments);
    save("messages", messages);
    save("currentUser", currentUser);

    alert("Nombre actualizado.");
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Comentarios
// =========================================================
function openComments(postId) {
    currentPostId = postId;

    const list = $("#approvedComments");
    if (!list) return;
    list.innerHTML = "";

    const approved = comments.filter(c => c.postId === postId && c.status === "approved");

    if (approved.length === 0) list.innerHTML = "<p>No hay comentarios todavía.</p>";
    else {
        approved.forEach(c => {
            const div = document.createElement("div");
            div.className = "comment";
            div.innerHTML = `
                <b>${toDisplayName(c.author)}</b><br>
                ${c.text}<br>
                <small>${c.date}</small>
            `;
            list.appendChild(div);
        });
    }

    hide("#feedSection");
    show("#commentsPanel");
}

$("#sendCommentBtn") && ($("#sendCommentBtn").onclick = () => {
    if (!currentUser) return alert("Debes iniciar sesión");

    const text = $("#commentText").value.trim();
    if (!text) return alert("Escribe algo");

    let status = "pending";
    if (currentUser.role === "admin" || currentUser.role === "moderator") {
        status = "approved";
    }

    comments.push({
        postId: currentPostId,
        author: currentUser.username,
        text,
        date: new Date().toLocaleString(),
        status
    });

    save("comments", comments);

    alert(status === "approved" ? "Comentario publicado" : "Pendiente de aprobación");

    $("#commentText").value = "";
    openComments(currentPostId);
});

$("#closeCommentsBtn") && ($("#closeCommentsBtn").onclick = () => {
    show("#feedSection");
    hide("#commentsPanel");
});

// =========================================================
// SANITIZADOR
// =========================================================
function sanitize(text) {
    if (!text || typeof text !== "string") return text;
    const forbidden = [
        "puta", "mierda", "estúpida", "estupida",
        "estúpido", "estupido", "hijueputa",
        "perra", "gonorrea", "pirobo", "piroba",
        "sapo", "sapa"
    ];

    let sanitized = text;

    forbidden.forEach(word => {
        const regex = new RegExp(escapeRegex(word), "gi");
        sanitized = sanitized.replace(regex, "*");
    });

    return sanitized;
}

// =========================================================
// Mensajes privados
// =========================================================
$("#floatingMessageBtn") && ($("#floatingMessageBtn").onclick = () => {
    hide("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#inboxSection");
    hide("#editProfileSection");
    hide("#logoSection");

    show("#sendMessageSection");
});

$("#btnSubmitMessage") && ($("#btnSubmitMessage").onclick = async () => {
    if (!currentUser) return alert("Debes iniciar sesión");

    const anon = $("#isAnonymous").checked;
    const rawName = $("#senderName").value.trim();
    const nameForDisplay = rawName ? toDisplayName(rawName) : null;
    const subject = $("#messageSubject").value.trim();
    let body = sanitize($("#messageBody").value.trim());

    const file = $("#messageFile").files[0];

    if (!subject || !body) return alert("Escribe el asunto y el mensaje");

    let fileData = null;
    let fileType = null;

    if (file) {
        fileType = file.type;
        fileData = await new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.readAsDataURL(file);
        });
    }

    messages.unshift({
        id: Date.now(),
        sender: anon ? "Anónimo" : (nameForDisplay || toDisplayName(currentUser.username)),
        realUser: currentUser.username,
        subject,
        body,
        date: new Date().toLocaleString(),
        fileData,
        fileType,
        read: false
    });

    save("messages", messages);

    alert("Mensaje enviado");
    $("#btnFeed") && $("#btnFeed").click();
});

$("#btnCancelMessage") && ($("#btnCancelMessage").onclick = () => {
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Bandeja admin
// =========================================================
$("#btnInbox") && ($("#btnInbox").onclick = () => {
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "moderator"))
        return;

    hide("#feedSection");
    hide("#newPostSection");
    hide("#commentsPanel");
    hide("#userManagementSection");
    hide("#sendMessageSection");
    hide("#editProfileSection");
    hide("#logoSection");

    renderInbox();
    show("#inboxSection");
});

function renderInbox() {
    const box = $("#inboxList");
    if (!box) return;
    box.innerHTML = "";

    if (messages.length === 0) {
        box.innerHTML = "<p>No hay mensajes.</p>";
        return;
    }

    messages.forEach(msg => {
        const card = document.createElement("div");
        card.className = "message-card" + (msg.read ? "" : " unread");

        const senderDisplay = msg.sender ? msg.sender : toDisplayName(msg.realUser);

        card.innerHTML = `
            <div class="message-sender">
                ${senderDisplay}
                ${msg.sender === "Anónimo" ? '<span class="message-anon">anon</span>' : ''}
            </div>
            <p><b>Asunto:</b> ${msg.subject}</p>
            <p>${msg.body}</p>
            <small>${msg.date}</small><br>
        `;

        if (msg.fileData) {

    if (msg.fileType && msg.fileType.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = msg.fileData;
        img.style.maxWidth = "100%";
        img.style.marginTop = "10px";
        img.style.borderRadius = "6px";
        card.appendChild(img);
    }

    else if (msg.fileType && msg.fileType.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = msg.fileData;
        video.controls = true;
        video.style.maxWidth = "100%";
        video.style.marginTop = "10px";
        video.style.borderRadius = "6px";
        card.appendChild(video);
    }
}

        card.onclick = () => {
            msg.read = true;
            save("messages", messages);
            renderInbox();
        };

        box.appendChild(card);
    });
}

$("#btnCloseInbox") && ($("#btnCloseInbox").onclick = () => {
    $("#btnFeed") && $("#btnFeed").click();
});

// =========================================================
// Inicialización
updateUI();
if (currentUser) $("#btnFeed") && $("#btnFeed").click();

// =========================================================
// 🔐 ADMINISTRADORA RAÍZ (BLINDAJE TOTAL)
// =========================================================
(function ensureRootAdmin() {
    const ROOT_USERNAME = "contralora gabriela becerra";
    const ROOT_PASSWORD = "conejitolucumibl";

    let users = [];
    try {
        users = JSON.parse(localStorage.getItem("users")) || [];
    } catch {
        users = [];
    }

    const existing = users.find(
        u => u.username === ROOT_USERNAME
    );

    if (!existing) {
        users.push({
            username: ROOT_USERNAME,
            password: ROOT_PASSWORD,
            role: "admin",
            createdAt: Date.now(),
            protected: true
        });
        console.warn("Administradora raíz restaurada automáticamente");
    } else {
        existing.role = "admin";
        existing.password = ROOT_PASSWORD;
        existing.protected = true;
    }

    localStorage.setItem("users", JSON.stringify(users));
})();
