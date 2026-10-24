"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = window.OreoData.escapeHtml;
const money = window.OreoData.money;

let dashboardStarted = false;
let subscriptions = [];
let products = [], orders = [], reservations = [];
let editingProductId = null;
let activeOrderId = null;
let toastTimer;

function toast(message) {
  const element = $("#adminToast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
}

function friendlyError(error) {
  const map = {
    "auth/invalid-credential": "That email or password is incorrect.",
    "auth/wrong-password": "That email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed.",
    "auth/unauthorized-domain": "Add this domain under Firebase Authentication > Settings > Authorized domains."
  };

  return map[error.code] || error.message || "Something went wrong.";
}

function formatDate(value, includeTime) {
  const time = window.OreoFirebase.dateValue(value);
  if (!time) return "Just now";

  return new Date(time).toLocaleString(
    undefined,
    includeTime === false
      ? { day: "numeric", month: "short", year: "numeric" }
      : {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit"
        }
  );
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}"><div class="admin-empty">${esc(text)}</div></td></tr>`;
}

function statusPill(status) {
  return `<span class="status-pill ${esc(status || "pending")}">${esc(status || "pending")}</span>`;
}

function productThumb(product) {
  return `<div class="table-thumb" style="--h:${product.hue}">${esc(product.emoji)}${product.image ? `<img src="${esc(product.image)}" alt="">` : ""}</div>`;
}

const viewTitles = {
  overview: ["Dashboard", "Good to see you."],
  products: ["Catalogue", "Products"],
  orders: ["Fulfilment", "Orders"],
  reservations: ["Guest bookings", "Table requests"]
};

function showView(view) {
  if (!viewTitles[view]) return;

  $$(".admin-view").forEach((section) => {
    section.hidden = section.id !== "view-" + view;
  });

  $$(".admin-nav [data-view]").forEach((button) => {
    button.classList.toggle("on", button.dataset.view === view);
  });

  $("#viewEyebrow").textContent = viewTitles[view][0];
  $("#viewTitle").textContent = viewTitles[view][1];

  if (innerWidth < 800) {
    scrollTo({ top: 0, behavior: "smooth" });
  }
}

if (!window.OreoFirebase.configured) {
  $("#adminConfigNotice").hidden = false;
}

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");

  button.disabled = true;
  $("#adminLoginMessage").textContent = "";

  try {
    await window.OreoFirebase.signIn(
      form.elements.email.value.trim(),
      form.elements.password.value
    );
  } catch (error) {
    $("#adminLoginMessage").textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
});

$("#adminGoogle").addEventListener("click", async () => {
  $("#adminLoginMessage").textContent = "";

  try {
    await window.OreoFirebase.signInWithGoogle();
  } catch (error) {
    $("#adminLoginMessage").textContent = friendlyError(error);
  }
});

async function signOut() {
  await window.OreoFirebase.signOut();
}

$("#adminSignOut").addEventListener("click", signOut);
$("#deniedSignOut").addEventListener("click", signOut);
$("#deniedRefresh").addEventListener("click", () => location.reload());

window.OreoFirebase.onAuth((user, isAdmin) => {
  if (user && isAdmin) {
    $("#adminGate").hidden = true;
    $("#adminApp").hidden = false;
    $("#adminName").textContent = user.displayName || "Administrator";
    $("#adminEmail").textContent = user.email || "";
    $("#adminAvatar").textContent = (
      user.displayName ||
      user.email ||
      "A"
    ).charAt(0).toUpperCase();

    if (!dashboardStarted) startDashboard();
  } else {
    $("#adminGate").hidden = false;
    $("#adminApp").hidden = true;
    $("#gateLogin").hidden = Boolean(user);
    $("#gateDenied").hidden = !user;

    if (user) {
      $("#deniedEmail").textContent =
        "Signed in as " +
        (user.email || "this account") +
        ". No active admin document was found for UID " +
        user.uid +
        ".";
    }

    stopDashboard();
  }
});

function stopDashboard() {
  subscriptions.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });

  subscriptions = [];
  dashboardStarted = false;
  products = [];
  orders = [];
  reservations = [];
}

$$("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

$$('[data-action="add-product"]').forEach((button) => {
  button.addEventListener("click", () => openProductEditor());
});

function startDashboard() {
  dashboardStarted = true;

  subscriptions.push(
    window.OreoFirebase.onAdminCollection("products", (items) => {
      products = items.map((item) =>
        window.OreoData.normalize(item, item.id)
      );

      renderProductCategoryOptions();
      renderProducts();
      renderMetrics();
      renderStock();
    })
  );

  subscriptions.push(
    window.OreoFirebase.onAdminCollection("orders", (items) => {
      orders = items;
      renderOrders();
      renderMetrics();
      renderRecentOrders();
      renderChart();

      if (
        activeOrderId &&
        $("#orderModal").classList.contains("open")
      ) {
        const active = orders.find(
          (order) => order.id === activeOrderId
        );

        if (active) renderOrderDetails(active);
      }
    })
  );

  subscriptions.push(
    window.OreoFirebase.onAdminCollection("reservations", (items) => {
      reservations = items;
      renderReservations();
      renderMetrics();
    })
  );

  showView("overview");
}

window.addEventListener("oreo:adminerror", (event) => {
  const alert = $("#adminAlert");
  alert.hidden = false;
  alert.textContent =
    "A live update could not be loaded. Check your Firestore rules and connection. " +
    event.detail.message;
});

function renderMetrics() {
  const pending = orders.filter(
    (order) => order.status === "pending"
  ).length;

  const sales = orders
    .filter((order) => order.status === "fulfilled")
    .reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  $("#metricProducts").textContent = products.length;
  $("#metricOrders").textContent = orders.length;
  $("#metricPending").textContent = pending;
  $("#metricSales").textContent = money(sales);
  $("#sidebarProductCount").textContent = products.length;
  $("#sidebarOrderCount").textContent = pending;
  $("#sidebarReservationCount").textContent = reservations.filter(
    (item) => item.status === "pending"
  ).length;
}

function renderRecentOrders() {
  $("#recentOrdersBody").innerHTML = orders.length
    ? orders.slice(0, 5).map((order) =>
        `<tr>
          <td>
            <button class="admin-link" data-view-order="${esc(order.id)}" type="button">
              ${esc(order.orderNumber || order.id.slice(0, 8))}
            </button>
            <small>${formatDate(order.createdAt)}</small>
          </td>
          <td>${esc(order.customer && order.customer.name || "Guest")}</td>
          <td><strong>${money(order.total)}</strong></td>
          <td>${statusPill(order.status)}</td>
        </tr>`
      ).join("")
    : emptyRow(4, "No orders yet. New website orders will appear here.");
}

function renderStock() {
  const watched = products
    .filter(
      (product) =>
        !product.available ||
        (product.stock !== null && product.stock <= 5)
    )
    .slice(0, 6);

  $("#stockList").innerHTML = watched.length
    ? watched.map((product) =>
        `<div class="stock-row">
          <span>${esc(product.emoji)}</span>
          <div>
            <strong>${esc(product.name)}</strong>
            <small>${esc(product.category)} · ${product.available ? "Available" : "Hidden"}</small>
          </div>
          <b>${product.stock === null ? "Unlimited" : product.stock + " left"}</b>
        </div>`
      ).join("")
    : '<div class="admin-empty">No low-stock products. Your inventory looks good.</div>';
}

function renderChart() {
  const days = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    const total = orders
      .filter((order) => {
        const created = window.OreoFirebase.dateValue(order.createdAt);

        return (
          order.status === "fulfilled" &&
          created >= date.getTime() &&
          created < next.getTime()
        );
      })
      .reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0
      );

    days.push({
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      total
    });
  }

  const week = days.reduce((sum, day) => sum + day.total, 0);
  const max = Math.max(...days.map((day) => day.total), 1);

  $("#weekSales").textContent = money(week);

  $("#salesChart").innerHTML = days
    .map(
      (day) => `
        <div class="chart-day">
          <div class="chart-bar-wrap">
            <div
              class="chart-bar"
              style="height:${Math.max(2, day.total / max * 100)}%"
              data-value="${money(day.total)}"
            ></div>
          </div>
          <span>${day.label}</span>
        </div>`
    )
    .join("");
}

/* Product management */

const NEW_CATEGORY = "__new__";

function productCategoryNames() {
  const unique = new Map();

  [
    "Coffee",
    "Tea",
    "Pastry",
    ...products.map((product) => product.category)
  ].forEach((value) => {
    const name = String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);

    if (
      name &&
      name !== NEW_CATEGORY &&
      !unique.has(name.toLowerCase())
    ) {
      unique.set(name.toLowerCase(), name);
    }
  });

  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

function toggleNewCategoryField() {
  const fields = $("#productForm").elements;
  const isNew = fields.category.value === NEW_CATEGORY;

  $("#newCategoryWrap").hidden = !isNew;
  fields.newCategory.required = isNew;
}

function renderProductCategoryOptions(selected) {
  const select = $("#productForm").elements.category;
  const names = productCategoryNames();
  const current = selected || select.value || "Coffee";

  select.innerHTML =
    names
      .map(
        (name) =>
          `<option value="${esc(name)}">${esc(name)}</option>`
      )
      .join("") +
    `<option value="${NEW_CATEGORY}">＋ Add new category…</option>`;

  select.value =
    current === NEW_CATEGORY || names.includes(current)
      ? current
      : "Coffee";

  toggleNewCategoryField();

  const filter = $("#productCategory");
  const filterSelected = filter.value || "All";

  filter.innerHTML =
    '<option value="All">All categories</option>' +
    names
      .map(
        (name) =>
          `<option value="${esc(name)}">${esc(name)}</option>`
      )
      .join("");

  filter.value =
    filterSelected === "All" ||
    names.includes(filterSelected)
      ? filterSelected
      : "All";
}

function renderProducts() {
  const query = $("#productSearch").value.trim().toLowerCase();
  const category = $("#productCategory").value;

  const filtered = products.filter(
    (product) =>
      (category === "All" || product.category === category) &&
      (
        !query ||
        (
          product.name +
          " " +
          product.sku +
          " " +
          product.category
        )
          .toLowerCase()
          .includes(query)
      )
  );

  $("#productsBody").innerHTML = filtered.length
    ? filtered.map((product) =>
        `<tr>
          <td>
            <div class="table-product">
              ${productThumb(product)}
              <div>
                <strong>${esc(product.name)}</strong>
                <small>${esc(product.sku || product.slug)}</small>
              </div>
            </div>
          </td>
          <td>${esc(product.category)}</td>
          <td><strong>${money(product.price)}</strong></td>
          <td>${product.stock === null ? "Unlimited" : product.stock}</td>
          <td>${statusPill(product.available && product.stock !== 0 ? "available" : "unavailable")}</td>
          <td>
            <div class="table-actions">
              <a
                class="icon-btn"
                href="product.html?id=${encodeURIComponent(product.id)}"
                target="_blank"
                rel="noopener"
                aria-label="View ${esc(product.name)}"
              >↗</a>
              <button
                class="icon-btn"
                data-edit="${esc(product.id)}"
                type="button"
                aria-label="Edit ${esc(product.name)}"
              >✎</button>
            </div>
          </td>
        </tr>`
      ).join("")
    : emptyRow(
        6,
        products.length
          ? "No products match this search."
          : "Your catalogue is empty. Add a product or import the starter menu."
      );
}

$("#productSearch").addEventListener("input", renderProducts);
$("#productCategory").addEventListener("change", renderProducts);

$("#productsBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit]");
  if (button) openProductEditor(button.dataset.edit);
});

$("#addProduct").addEventListener("click", () => openProductEditor());

$("#productForm").elements.category.addEventListener("change", () => {
  toggleNewCategoryField();

  const fields = $("#productForm").elements;

  if (fields.category.value === NEW_CATEGORY) {
    fields.newCategory.focus();
  }
});

$("#seedProducts").addEventListener("click", async () => {
  if (
    products.length &&
    !confirm(
      "Import the 24 starter products? Matching starter IDs will be replaced with their defaults."
    )
  ) {
    return;
  }

  const button = $("#seedProducts");
  button.disabled = true;

  try {
    await window.OreoFirebase.seedProducts();
    toast("Starter menu imported");
  } catch (error) {
    toast(friendlyError(error));
  } finally {
    button.disabled = false;
  }
});

function openModal(id) {
  const modal = $("#" + id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("lock");
}

function closeModal(id) {
  const modal = $("#" + id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("lock");

  if (id === "orderModal") activeOrderId = null;
}

$$("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

$$(".admin-modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    $$(".admin-modal.open").forEach((modal) => {
      closeModal(modal.id);
    });
  }
});

function openProductEditor(id) {
  editingProductId = id || null;

  const form = $("#productForm");
  const fields = form.elements;

  form.reset();
  $("#productFormError").textContent = "";
  $("#productFormTitle").textContent = id
    ? "Edit product"
    : "Add product";
  $("#deleteProduct").hidden = !id;

  const product = id
    ? products.find((item) => item.id === id)
    : null;

  fields.newCategory.value = "";

  renderProductCategoryOptions(
    product ? product.category : "Coffee"
  );

  const values = product || {
    name: "",
    category: "Coffee",
    price: "",
    sku: "",
    stock: null,
    rating: 4.8,
    emoji: "☕",
    hue: 28,
    prepTime: "4–6 min",
    calories: "",
    image: "",
    description: "",
    longDescription: "",
    ingredients: "",
    smallDelta: -0.5,
    mediumDelta: 0,
    largeDelta: 0.7,
    available: true,
    featured: false
  };

  [
    "name",
    "category",
    "price",
    "sku",
    "rating",
    "emoji",
    "hue",
    "prepTime",
    "calories",
    "image",
    "description",
    "longDescription",
    "ingredients",
    "smallDelta",
    "mediumDelta",
    "largeDelta"
  ].forEach((name) => {
    fields[name].value =
      values[name] == null ? "" : values[name];
  });

  fields.stock.value =
    values.stock === null ? "" : values.stock;

  fields.available.checked = values.available !== false;
  fields.featured.checked = values.featured === true;

  updateImagePreview();
  openModal("productModal");

  setTimeout(() => fields.name.focus(), 100);
}

function updateImagePreview() {
  const fields = $("#productForm").elements;
  const image = window.OreoData.safeImage(fields.image.value);
  const emoji = fields.emoji.value || "☕";

  $("#productImagePreview").innerHTML =
    esc(emoji) +
    (image
      ? `<img src="${esc(image)}" alt="Product preview">`
      : "");
}

$("#productForm").elements.image.addEventListener(
  "input",
  updateImagePreview
);

$("#productForm").elements.emoji.addEventListener(
  "input",
  updateImagePreview
);

$("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const fields = form.elements;
  const button = $("#saveProduct");

  let category = fields.category.value.trim();

  if (category === NEW_CATEGORY) {
    category = fields.newCategory.value
      .trim()
      .replace(/\s+/g, " ");
  }

  if (!category || category === NEW_CATEGORY) {
    $("#productFormError").textContent =
      "Enter a name for the new category.";
    return;
  }

  if (
    fields.image.value.trim() &&
    !window.OreoData.safeImage(fields.image.value)
  ) {
    $("#productFormError").textContent =
      "Use a direct http(s) image URL or a safe relative images/ path.";
    return;
  }

  const product = {
    name: fields.name.value.trim(),
    category,
    price: Number(fields.price.value),
    sku: fields.sku.value.trim(),
    stock:
      fields.stock.value === ""
        ? null
        : Number(fields.stock.value),
    rating: Number(fields.rating.value),
    emoji: fields.emoji.value,
    hue: Number(fields.hue.value),
    prepTime: fields.prepTime.value.trim(),
    calories:
      fields.calories.value === ""
        ? 0
        : Number(fields.calories.value),
    image: fields.image.value.trim(),
    description: fields.description.value.trim(),
    longDescription: fields.longDescription.value.trim(),
    ingredients: fields.ingredients.value.trim(),
    smallDelta: Number(fields.smallDelta.value),
    mediumDelta: Number(fields.mediumDelta.value),
    largeDelta: Number(fields.largeDelta.value),
    available: fields.available.checked,
    featured: fields.featured.checked
  };

  button.disabled = true;
  button.textContent = "Saving…";
  $("#productFormError").textContent = "";

  try {
    await window.OreoFirebase.saveProduct(
      product,
      editingProductId
    );

    closeModal("productModal");

    toast(
      editingProductId
        ? "Product updated"
        : "Product added to the menu"
    );
  } catch (error) {
    $("#productFormError").textContent = friendlyError(error);
  } finally {
    button.disabled = false;
    button.textContent = "Save product";
  }
});

$("#deleteProduct").addEventListener("click", async () => {
  if (!editingProductId) return;

  const product = products.find(
    (item) => item.id === editingProductId
  );

  if (
    !confirm(
      "Delete " +
        (product ? product.name : "this product") +
        "? This cannot be undone."
    )
  ) {
    return;
  }

  try {
    await window.OreoFirebase.deleteProduct(editingProductId);
    closeModal("productModal");
    toast("Product deleted");
  } catch (error) {
    $("#productFormError").textContent = friendlyError(error);
  }
});

/* Orders and fulfilment */

function orderOptions(selected) {
  return [
    "pending",
    "preparing",
    "ready",
    "fulfilled",
    "cancelled"
  ]
    .map(
      (status) =>
        `<option value="${status}" ${status === selected ? "selected" : ""}>
          ${status.charAt(0).toUpperCase() + status.slice(1)}
        </option>`
    )
    .join("");
}

function renderOrders() {
  const query = $("#orderSearch").value.trim().toLowerCase();
  const status = $("#orderStatus").value;

  const filtered = orders.filter((order) => {
    const customer = order.customer || {};

    return (
      (status === "all" ||
        (order.status || "pending") === status) &&
      (
        !query ||
        (
          String(order.orderNumber || order.id) +
          " " +
          customer.name +
          " " +
          customer.email +
          " " +
          customer.phone
        )
          .toLowerCase()
          .includes(query)
      )
    );
  });

  $("#ordersBody").innerHTML = filtered.length
    ? filtered.map((order) => {
        const itemCount = (order.items || []).reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        );

        return `<tr>
          <td>
            <button class="admin-link" data-view-order="${esc(order.id)}" type="button">
              ${esc(order.orderNumber || order.id.slice(0, 8))}
            </button>
            <small>${esc(order.orderType || "pickup")}</small>
          </td>
          <td class="table-customer">
            <strong>${esc(order.customer && order.customer.name || "Guest")}</strong>
            <small>${esc(order.customer && order.customer.phone || "")}</small>
          </td>
          <td>${itemCount}</td>
          <td><strong>${money(order.total)}</strong></td>
          <td>${formatDate(order.createdAt)}</td>
          <td>
            <select
              class="status-select"
              data-order-status="${esc(order.id)}"
              aria-label="Status for ${esc(order.orderNumber || order.id)}"
            >
              ${orderOptions(order.status || "pending")}
            </select>
          </td>
          <td>
            <button class="icon-btn" data-view-order="${esc(order.id)}" type="button" aria-label="View order">→</button>
          </td>
        </tr>`;
      }).join("")
    : emptyRow(
        7,
        orders.length
          ? "No orders match these filters."
          : "No incoming orders yet."
      );
}

$("#orderSearch").addEventListener("input", renderOrders);
$("#orderStatus").addEventListener("change", renderOrders);
$("#ordersBody").addEventListener("click", openOrderFromEvent);
$("#recentOrdersBody").addEventListener("click", openOrderFromEvent);

function openOrderFromEvent(event) {
  const button = event.target.closest("[data-view-order]");

  if (button) {
    openOrder(button.dataset.viewOrder);
  }
}

$("#ordersBody").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-order-status]");
  if (!select) return;

  select.disabled = true;

  try {
    await window.OreoFirebase.updateStatus(
      "orders",
      select.dataset.orderStatus,
      select.value
    );

    toast("Order marked " + select.value);
  } catch (error) {
    toast(friendlyError(error));
    select.disabled = false;
  }
});

function openOrder(id) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;

  activeOrderId = id;
  renderOrderDetails(order);
  openModal("orderModal");
}

function renderOrderDetails(order) {
  const customer = order.customer || {};

  $("#orderDialogTitle").textContent =
    order.orderNumber || order.id;

  $("#orderDetails").innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-card">
        <h3>Customer</h3>
        <p><strong>${esc(customer.name || "Guest")}</strong></p>
        <p>
          ${esc(customer.phone || "No phone")}<br>
          ${esc(customer.email || "No email")}
        </p>
      </div>

      <div class="order-detail-card">
        <h3>Receiving & payment</h3>
        <p>
          ${esc(order.orderType || "pickup")}<br>
          ${esc(order.paymentMethod || "Pay at cafe")}
        </p>
        <p>
          ${esc(order.address || "")}${order.city ? ", " + esc(order.city) : ""}
        </p>
      </div>

      <div class="order-detail-card full">
        <h3>Items</h3>
        <div class="order-items">
          ${(order.items || []).map((item) => `
            <div class="order-item">
              <span>
                ${item.quantity} × <strong>${esc(item.name)}</strong>
                <small>
                  ${esc(
                    [
                      item.size,
                      ...(item.addons || []).map((addon) => addon.name)
                    ]
                      .filter(Boolean)
                      .join(", ")
                  )}
                </small>
              </span>
              <strong>${money(item.lineTotal)}</strong>
            </div>
          `).join("")}
        </div>

        <div class="order-detail-total">
          <span>Total</span>
          <span>${money(order.total)}</span>
        </div>
      </div>

      ${order.notes ? `
        <div class="order-detail-card full">
          <h3>Order notes</h3>
          <p>${esc(order.notes)}</p>
        </div>
      ` : ""}

      <div class="order-detail-card full">
        <h3>Current status</h3>
        ${statusPill(order.status || "pending")}
        <p>Received ${formatDate(order.createdAt, true)}</p>
      </div>
    </div>

    <div class="order-status-actions">
      <button class="admin-btn" data-detail-status="pending" type="button">Mark pending</button>
      <button class="admin-btn" data-detail-status="preparing" type="button">Start preparing</button>
      <button class="admin-btn primary" data-detail-status="fulfilled" type="button">Mark fulfilled ✓</button>
    </div>
  `;
}

$("#orderDetails").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-detail-status]");

  if (!button || !activeOrderId) return;

  button.disabled = true;

  try {
    await window.OreoFirebase.updateStatus(
      "orders",
      activeOrderId,
      button.dataset.detailStatus
    );

    toast("Order marked " + button.dataset.detailStatus);

    if (button.dataset.detailStatus === "fulfilled") {
      closeModal("orderModal");
    }
  } catch (error) {
    toast(friendlyError(error));
    button.disabled = false;
  }
});

$("#exportOrders").addEventListener("click", () => {
  if (!orders.length) {
    toast("There are no orders to export");
    return;
  }

  const cell = (value) => {
    let text = String(value == null ? "" : value);

    if (/^[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const rows = [
    [
      "Order",
      "Date",
      "Customer",
      "Email",
      "Phone",
      "Type",
      "Items",
      "Total USD",
      "Status"
    ]
  ];

  orders.forEach((order) => {
    rows.push([
      order.orderNumber || order.id,
      formatDate(order.createdAt, true),
      order.customer && order.customer.name,
      order.customer && order.customer.email,
      order.customer && order.customer.phone,
      order.orderType,
      (order.items || [])
        .map((item) => item.quantity + "x " + item.name)
        .join("; "),
      Number(order.total) || 0,
      order.status
    ]);
  });

  const blob = new Blob(
    [
      rows
        .map((row) => row.map(cell).join(","))
        .join("\r\n")
    ],
    { type: "text/csv;charset=utf-8" }
  );

  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download =
    "oreos-orders-" +
    new Date().toISOString().slice(0, 10) +
    ".csv";

  link.click();

  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

/* Reservation requests */

function renderReservations() {
  $("#reservationsBody").innerHTML = reservations.length
    ? reservations.map((reservation) => `
        <tr>
          <td>
            <strong>${esc(reservation.name || "Guest")}</strong>
            <small>${esc(reservation.notes || "No special requests")}</small>
          </td>
          <td>
            <strong>${esc(reservation.date || "")}</strong>
            <small>${esc(reservation.time || "")}</small>
          </td>
          <td>${esc(reservation.guests || "")}</td>
          <td>
            ${esc(reservation.phone || "")}
            <small>${esc(reservation.email || "")}</small>
          </td>
          <td>${statusPill(reservation.emailStatus || "pending")}</td>
          <td>
            <select
              class="status-select"
              data-reservation-status="${esc(reservation.id)}"
              aria-label="Reservation status"
            >
              ${["pending", "confirmed", "cancelled"]
                .map(
                  (status) => `
                    <option
                      value="${status}"
                      ${status === (reservation.status || "pending") ? "selected" : ""}
                    >
                      ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </td>
          <td>
            <a
              class="icon-btn"
              href="mailto:${esc(reservation.email || "")}?subject=${encodeURIComponent("Your Oreo's Cafe table request")}"
              aria-label="Email guest"
            >@</a>
          </td>
        </tr>
      `).join("")
    : emptyRow(7, "No table requests yet.");
}

$("#reservationsBody").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-reservation-status]");

  if (!select) return;

  select.disabled = true;

  try {
    await window.OreoFirebase.updateStatus(
      "reservations",
      select.dataset.reservationStatus,
      select.value
    );

    toast("Reservation marked " + select.value);
  } catch (error) {
    toast(friendlyError(error));
    select.disabled = false;
  }
});

document.addEventListener(
  "error",
  (event) => {
    if (event.target.tagName === "IMG") {
      event.target.remove();
    }
  },
  true
);
