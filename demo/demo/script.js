// Oreo's Cafe storefront. Plain JavaScript; Firebase data arrives through firebase-service.js.
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const root = document.documentElement;
const esc = window.OreoData.escapeHtml;
const money = window.OreoData.money;
const slug = window.OreoData.slugify;
const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (error) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (error) { /* private mode */ } },
  del(key) { try { localStorage.removeItem(key); } catch (error) { /* private mode */ } }
};
let PRODUCTS = window.OreoData.DEFAULT_PRODUCTS.slice();
const THEMES = [
  ["paper", "Paper", "#f3ebda", "#ddd0b6", "#3b2a1e"], ["espresso", "Espresso", "#130e0b", "#2c211a", "#f3e9dc"],
  ["snow", "Snow", "#ffffff", "#e8e8ea", "#111111"], ["midnight", "Midnight", "#070b16", "#1a2440", "#e8ecf7"],
  ["forest", "Forest", "#08120d", "#183025", "#e6f0ea"], ["wine", "Wine", "#150709", "#331a20", "#f5e6e8"]
];
const ACCENTS = ["#d98b73", "#e5734f", "#c9453c", "#d9a066", "#e8b04a", "#7fb88a", "#4fb3a5", "#6fa8d6", "#8c8fe0", "#b79ae0", "#e08ab8"];
const toastEl = $("#toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
}
function productUrl(product) { return "product.html?id=" + encodeURIComponent(product.id); }
function art(product) {
  return esc(product.emoji) + (product.image ? `<img src="${esc(product.image)}" alt="" loading="lazy">` : "");
}

/* Menu grids */
const cols = () => matchMedia("(max-width:560px)").matches ? 2 : matchMedia("(max-width:760px)").matches ? 3 : matchMedia("(max-width:980px)").matches ? 4 : matchMedia("(max-width:1180px)").matches ? 5 : 6;
const homeLimit = () => cols() === 2 ? 6 : cols() * 2;
const pageSize = () => cols() === 2 ? 8 : Infinity;
let favs;
try { favs = new Set(JSON.parse(store.get("oc-favs-v2") || "[]")); } catch (error) { favs = new Set(); }

function cardHTML(product) {
  const saved = favs.has(product.id);
  const soldOut = product.stock === 0;
  return `<article class="card rv in${soldOut ? " unavailable" : ""}" data-id="${esc(product.id)}" data-c="${esc(product.category)}" tabindex="0" role="link" aria-label="${esc(product.name)}, ${money(product.price)}. View details" style="--h:${product.hue}">
    <div class="img" aria-hidden="true">${art(product)}</div>
    ${soldOut ? "<span class=\"sold-out\">Sold out</span>" : ""}
    <button class="fav" data-fav="${esc(product.id)}" aria-label="${saved ? "Remove" : "Save"} ${esc(product.name)}" aria-pressed="${saved}"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></button>
    <button class="add" data-add="${esc(product.id)}" aria-label="Add ${esc(product.name)} to order" ${soldOut ? "disabled" : ""}><svg viewBox="0 0 24 24"><path class="plus" d="M12 5v14M5 12h14"/><path class="tick" d="M5 13l4 4L19 7"/></svg></button>
    <div class="meta"><h3>${esc(product.name)}</h3><p><span>${esc(product.category)}</span><span>${money(product.price)}</span><span class="rt"><svg viewBox="0 0 24 24"><polygon points="12,2 15.1,8.6 22,9.3 16.8,14 18.2,21 12,17.5 5.8,21 7.2,14 2,9.3 8.9,8.6"/></svg>${product.rating.toFixed(1)}</span></p></div>
  </article>`;
}

function setupMenu(gridEl, filtersEl, countEl, options) {
  let cards = [], category = "All", query = "", visible = Infinity;
  const none = gridEl.parentElement && gridEl.parentElement.querySelector(".nomatch");
  function show(animate) {
    let total = 0, shown = 0;
    cards.forEach((card) => {
      const product = PRODUCTS.find((item) => item.id === card.dataset.id);
      if (!product) return;
      const hit = (category === "All" || (category === "Top" ? product.rating >= 4.8 : category === "Saved" ? favs.has(product.id) : product.category === category)) &&
        (!query || (product.name + " " + product.category + " " + product.description).toLowerCase().includes(query));
      if (hit) total++;
      const on = hit && total <= visible;
      card.classList.toggle("hidden", !on);
      card.classList.remove("pop");
      if (on && animate) {
        void card.offsetWidth;
        card.style.animationDelay = (shown++ * 40) + "ms";
        card.classList.add("pop");
      }
    });
    countEl.textContent = total + (total === 1 ? " item" : " items");
    if (none) none.hidden = total > 0;
    if (options.more) options.more.hidden = total <= visible;
  }
  function apply() {
    gridEl.classList.add("swap");
    setTimeout(() => { show(true); gridEl.classList.remove("swap"); }, 120);
  }
  function render() {
    visible = options.page ? options.page() : Infinity;
    const limit = options.limit();
    gridEl.innerHTML = PRODUCTS.slice(0, limit).map(cardHTML).join("");
    cards = [...gridEl.querySelectorAll(".card")];
    show(false);
    if (options.pill) options.pill.hidden = PRODUCTS.length <= limit;
  }
  filtersEl.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    category = button.dataset.f;
    filtersEl.querySelectorAll("button").forEach((item) => item.classList.toggle("on", item === button));
    slide(filtersEl);
    visible = options.page ? options.page() : Infinity;
    apply();
  });
  if (options.search) options.search.addEventListener("input", () => {
    query = options.search.value.trim().toLowerCase();
    visible = options.page ? options.page() : Infinity;
    apply();
  });
  if (options.more) options.more.addEventListener("click", () => { visible += options.page(); apply(); });
  render();
  return {
    refresh: render,
    setFilter(nextCategory, nextQuery) {
      category = nextCategory || "All";
      query = (nextQuery || "").toLowerCase();
      filtersEl.querySelectorAll("button").forEach((button) => button.classList.toggle("on", button.dataset.f === category));
      if (options.search) options.search.value = nextQuery || "";
      visible = options.page ? options.page() : Infinity;
      show(false);
      slide(filtersEl);
    }
  };
}

const grid = $("#grid"), grid2 = $("#grid2");
const homeMenu = setupMenu(grid, $("#filters"), $("#menuCount"), { limit: homeLimit, pill: $("#moreWrap") });
const fullMenu = setupMenu(grid2, $("#filters2"), $("#menuCount2"), { limit: () => PRODUCTS.length, search: $("#menuSearch"), more: $("#loadWrap"), page: pageSize });
let resizeTimer;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { homeMenu.refresh(); fullMenu.refresh(); }, 160); });
window.OreoFirebase.onProducts((products) => {
  PRODUCTS = products;
  homeMenu.refresh();
  fullMenu.refresh();
  if ($("#sr").classList.contains("open")) srDraw();
});

/* Favourites and product navigation */
function toggleFavourite(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  store.set("oc-favs-v2", JSON.stringify([...favs]));
  $$(`[data-fav="${CSS.escape(id)}"]`).forEach((button) => {
    const on = favs.has(id);
    button.setAttribute("aria-pressed", String(on));
    button.classList.remove("pulse"); void button.offsetWidth; button.classList.add("pulse");
  });
  ["#filters", "#filters2"].forEach((selector) => {
    const active = $(selector + " button.on");
    if (active && active.dataset.f === "Saved") active.click();
  });
}
function openProduct(id) {
  const product = PRODUCTS.find((item) => item.id === id || item.slug === id);
  if (product) location.href = productUrl(product);
}
function cardClick(event) {
  const favourite = event.target.closest("[data-fav]");
  if (favourite) { event.stopPropagation(); toggleFavourite(favourite.dataset.fav); return; }
  const add = event.target.closest("[data-add]");
  if (add) { event.stopPropagation(); quickAdd(add.dataset.add, add); return; }
  const card = event.target.closest(".card");
  if (card) openProduct(card.dataset.id);
}
[grid, grid2].forEach((element) => {
  element.addEventListener("click", cardClick);
  element.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("card")) {
      event.preventDefault(); openProduct(event.target.dataset.id);
    }
  });
});

/* Shared cart drawer */
const cartEl = $("#cart");
function cartLabel(item) {
  const options = [];
  if (item.category !== "Pastry") options.push(item.size);
  item.addons.forEach((addon) => options.push(addon.name));
  return item.name + (options.length ? " (" + options.join(", ") + ")" : "");
}
function drawCart() {
  const items = window.OreoCart.getItems();
  const totals = window.OreoCart.getTotals();
  $("#count").textContent = totals.count;
  const rows = items.map((item) => `<li><span class="cart-item-name">${esc(cartLabel(item))}</span><span class="qty"><button data-q="-1" data-key="${esc(item.key)}" aria-label="Remove one ${esc(item.name)}">&minus;</button><b>${item.quantity}</b><button data-q="1" data-key="${esc(item.key)}" aria-label="Add one ${esc(item.name)}" ${item.quantity >= window.OreoCart.MAX_QUANTITY ? "disabled" : ""}>+</button></span><span class="price">${money(window.OreoCart.unitPrice(item) * item.quantity)}</span></li>`).join("");
  cartEl.innerHTML = "<h3>Your order</h3>" + (items.length
    ? `<ul>${rows}</ul><div class="tot"><span>Total ${money(totals.subtotal)}</span><button class="btn" id="clear" style="padding:8px 16px;font-size:13px;background:var(--surface2)">Clear</button></div><button class="btn solid" id="place" style="width:100%;justify-content:center;margin-top:12px">Checkout</button>`
    : `<p class="empty">Nothing yet. Tap + on any item.</p>`);
}
window.addEventListener("oreo:cartchange", drawCart);
drawCart();
function bump() { const button = $("#orderBtn"); button.classList.remove("bump"); void button.offsetWidth; button.classList.add("bump"); }
function quickAdd(id, button) {
  const product = PRODUCTS.find((item) => item.id === id);
  if (!product) return;
  const result = window.OreoCart.add(product, "Medium", [], 1);
  if (!result.ok) { toast(result.reason === "limit" ? "Quantity limit reached" : "This item is currently unavailable"); return; }
  button.classList.add("done"); setTimeout(() => button.classList.remove("done"), 700);
  if (!reduceMotion) fly(button, product);
  bump();
}
function fly(from, product) {
  const rect = from.getBoundingClientRect();
  const element = document.createElement("div");
  element.className = "fly"; element.style.setProperty("--h", product.hue); element.innerHTML = art(product);
  document.body.appendChild(element);
  const x0 = rect.left + rect.width / 2, y0 = rect.top + rect.height / 2, started = performance.now(), duration = 600;
  (function step(now) {
    const t = Math.min(1, (now - started) / duration), target = $("#orderBtn").getBoundingClientRect();
    const x2 = target.left + target.width / 2, y2 = target.top + target.height / 2;
    const e = 1 - Math.pow(1 - t, 3), u = 1 - e;
    const x = u * x0 + e * x2, y = u * y0 + e * y2 - Math.sin(t * Math.PI) * 70;
    element.style.transform = `translate(${x - 20}px,${y - 20}px) scale(${1 - .65 * e})`;
    element.style.opacity = t > .85 ? (1 - t) / .15 : 1;
    if (t < 1) requestAnimationFrame(step); else element.remove();
  })(started);
}
$("#orderBtn").addEventListener("click", (event) => {
  $("#menuPop").classList.remove("open");
  const open = cartEl.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", open);
});
cartEl.addEventListener("click", (event) => {
  if (event.target.id === "clear") { window.OreoCart.clear(); return; }
  if (event.target.id === "place") { location.href = "checkout.html"; return; }
  const button = event.target.closest("[data-q]");
  if (!button) return;
  const item = window.OreoCart.getItems().find((entry) => entry.key === button.dataset.key);
  if (item) window.OreoCart.update(item.key, item.quantity + Number(button.dataset.q));
});

/* Navigation popovers */
const pop = $("#menuPop"), moreBtn = $("#moreBtn"), nav = $("#nav"), blur = $("#blur");
moreBtn.addEventListener("click", () => {
  const open = pop.classList.toggle("open");
  moreBtn.setAttribute("aria-expanded", open);
  cartEl.classList.remove("open");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".order")) { cartEl.classList.remove("open"); $("#orderBtn").setAttribute("aria-expanded", "false"); }
  if (!event.target.closest(".more")) { pop.classList.remove("open"); moreBtn.setAttribute("aria-expanded", "false"); }
});

/* Firebase authentication state in the main navigation */
window.OreoFirebase.onAuth((user, isAdmin) => {
  $("#authText").textContent = user ? (user.displayName ? user.displayName.split(" ")[0] : "Account") : "Log in";
  $("#authLink").href = "auth.html";
  $("#authLink").setAttribute("aria-label", user ? "Open your account" : "Log in or create an account");
  $("#authLink").classList.toggle("signed-in", Boolean(user));
  $("#authLink").title = isAdmin ? "Administrator account" : user ? (user.email || "Account") : "Log in or sign up";
  const reservationFields = $("#resForm").elements;
  if (user && !reservationFields.email.value) reservationFields.email.value = user.email || "";
  if (user && !reservationFields.name.value) reservationFields.name.value = user.displayName || "";
});

/* Reservation request -> Firestore -> Cloud Function -> cafe email */
let icsUrl = "";
function localISODate(date) {
  const year = date.getFullYear(), month = String(date.getMonth() + 1).padStart(2, "0"), day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
$("#resForm").elements.date.min = localISODate(new Date());
function calendarFor(form) {
  const fields = form.elements;
  const start = new Date(fields.date.value + "T" + fields.time.value), end = new Date(start.getTime() + 90 * 60000), link = $("#icsLink");
  if (Number.isNaN(start.getTime())) { link.style.display = "none"; return; }
  const z = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (value) => String(value).replace(/[\r\n]+/g, " ").replace(/([,;\\])/g, "\\$1");
  if (icsUrl) URL.revokeObjectURL(icsUrl);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Oreos Cafe//EN", "BEGIN:VEVENT", "UID:" + Date.now() + "@oreoscafe", "DTSTAMP:" + z(new Date()), "DTSTART:" + z(start), "DTEND:" + z(end), "SUMMARY:Table at Oreo's Cafe", "LOCATION:12 Garden Road", "DESCRIPTION:Reservation request for " + clean(fields.guests.value) + ". Confirmed only after the cafe contacts you.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  icsUrl = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.href = icsUrl; link.style.display = "";
}
$("#resForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget, fields = form.elements, button = $("#resSubmit"), ok = $("#resOk");
  const data = {
    name: fields.name.value.trim(), phone: fields.phone.value.trim(), email: fields.email.value.trim(),
    date: fields.date.value, time: fields.time.value, guests: fields.guests.value,
    notes: fields.notes.value.trim(), source: "website"
  };
  button.disabled = true; button.textContent = "Sending request…";
  ok.classList.remove("error");
  try {
    if (window.OreoFirebase.configured) {
      await window.OreoFirebase.createReservation(data);
      $("#resOkText").textContent = "Request received. We'll contact you soon to confirm your table.";
      calendarFor(form);
      form.reset();
    } else {
      const subject = "Table request — " + data.name + " — " + data.date;
      const body = [`Name: ${data.name}`, `Email: ${data.email}`, `Phone: ${data.phone}`, `Date: ${data.date}`, `Time: ${data.time}`, `Guests: ${data.guests}`, `Special requests: ${data.notes || "None"}`].join("\n");
      location.href = "mailto:" + window.OREOS_CAFE_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      $("#resOkText").textContent = "Your email app has opened. Press Send there to complete your request. Connect Firebase for automatic email delivery.";
      calendarFor(form);
    }
    ok.classList.remove("show"); void ok.offsetWidth; ok.classList.add("show");
  } catch (error) {
    $("#resOkText").textContent = "We could not send your request. Please try again or email " + window.OREOS_CAFE_EMAIL + ". " + error.message;
    ok.classList.add("error", "show");
  } finally {
    button.disabled = false; button.textContent = "Request a table";
  }
});

/* Search */
const sr = $("#sr"), srIn = $("#srIn"), srList = $("#srList");
let srSelection = 0, srHits = [];
const lock = (on) => root.classList.toggle("lock", on);
function srDraw() {
  const query = srIn.value.trim().toLowerCase();
  srHits = PRODUCTS.filter((product) => !query || (product.name + " " + product.category + " " + product.description).toLowerCase().includes(query)).slice(0, 6);
  srSelection = 0;
  srList.innerHTML = srHits.length ? srHits.map((product, index) => `<li data-id="${esc(product.id)}" class="${index ? "" : "sel"}"><span class="em" style="--h:${product.hue}">${esc(product.emoji)}</span>${esc(product.name)}<small>${esc(product.category)}, ${money(product.price)}</small></li>`).join("") : "<li class=\"srempty\">No products found</li>";
}
function openSearch() { sr.classList.add("open"); sr.setAttribute("aria-hidden", "false"); lock(true); srIn.value = ""; srDraw(); srIn.focus(); }
function closeSearch() { if (!sr.classList.contains("open")) return; sr.classList.remove("open"); sr.setAttribute("aria-hidden", "true"); lock(false); }
function srPick(id) { closeSearch(); openProduct(id); }
$("#srBtn").addEventListener("click", openSearch);
sr.addEventListener("click", (event) => { if (event.target === sr) closeSearch(); });
srIn.addEventListener("input", srDraw);
srIn.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && srHits.length) srPick(srHits[srSelection].id);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    srSelection = (srSelection + (event.key === "ArrowDown" ? 1 : -1) + srHits.length) % (srHits.length || 1);
    srList.querySelectorAll("li").forEach((item, index) => item.classList.toggle("sel", index === srSelection));
  }
});
srList.addEventListener("click", (event) => { const item = event.target.closest("li[data-id]"); if (item) srPick(item.dataset.id); });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
  if (event.key === "Escape") { pop.classList.remove("open"); cartEl.classList.remove("open"); closeSearch(); closeKeys(); closeLightbox(); }
});

/* Theme and display settings */
$("#sws").innerHTML = THEMES.map((theme) => `<button class="sw" data-t="${theme[0]}" aria-pressed="false" style="background:${theme[2]};color:${theme[4]}"><span class="mini" style="background:${theme[3]}"><i></i><u></u></span>${theme[1]}</button>`).join("");
$("#dots").innerHTML = ACCENTS.map((colour) => `<button data-c="${colour}" aria-pressed="false" aria-label="Accent ${colour}" style="background:${colour}"></button>`).join("");
const sysSw = $("#sysSw");
function markTheme() {
  const selected = root.dataset.theme || null;
  const effective = selected || (matchMedia("(prefers-color-scheme:dark)").matches ? "espresso" : "paper");
  $$(".sw").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.t === effective)));
  sysSw.setAttribute("aria-checked", String(!selected));
  const accent = root.style.getPropertyValue("--accent");
  $$("#dots button").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.c === accent)));
}
function setTheme(theme) {
  root.style.removeProperty("--accent"); store.del("oc-accent2");
  if (theme) { root.dataset.theme = theme; store.set("oc-theme2", theme); }
  else { delete root.dataset.theme; store.set("oc-theme2", "system"); }
  markTheme(); setHero();
}
$("#themeBtn").addEventListener("click", () => {
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "espresso" : "paper");
  setTheme(["paper", "snow"].includes(current) ? "espresso" : "paper");
});
$("#sws").addEventListener("click", (event) => { const button = event.target.closest(".sw"); if (button) setTheme(button.dataset.t); });
sysSw.addEventListener("click", () => setTheme(root.dataset.theme ? null : (matchMedia("(prefers-color-scheme:dark)").matches ? "espresso" : "paper")));
$("#dots").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; root.style.setProperty("--accent", button.dataset.c); store.set("oc-accent2", button.dataset.c); markTheme(); });
const savedTheme = store.get("oc-theme2"), savedAccent = store.get("oc-accent2");
if (savedTheme === "system") delete root.dataset.theme; else if (savedTheme) root.dataset.theme = savedTheme;
if (savedAccent) root.style.setProperty("--accent", savedAccent);
markTheme();
const perfSw = $("#perfSw");
const syncPerf = () => perfSw.setAttribute("aria-checked", String(root.dataset.perf === "on"));
perfSw.addEventListener("click", () => { const on = root.dataset.perf !== "on"; root.dataset.perf = on ? "on" : "off"; store.set("oc-perf", on ? "1" : "0"); syncPerf(); });
syncPerf();
$$('.switch.dummy').forEach((button) => button.addEventListener("click", () => button.setAttribute("aria-checked", String(button.getAttribute("aria-checked") !== "true"))));
function setSize(size) {
  root.dataset.ts = size; store.set("oc-ts", size);
  $$("#sizes button").forEach((button) => button.classList.toggle("on", button.dataset.s === size));
  slide($("#sizes")); setTimeout(moveSlider, 350);
}
$("#sizes").addEventListener("click", (event) => { const button = event.target.closest("button"); if (button) setSize(button.dataset.s); });
setSize(store.get("oc-ts") || "medium");

/* Sliding navigation and scroll spy */
function slide(box) {
  const slider = box && box.querySelector(".slider"), active = box && box.querySelector("a.on,button.on");
  if (!slider) return;
  if (!active || !active.offsetWidth) { slider.style.opacity = 0; return; }
  if (!slider.dataset.ready) slider.style.transition = "none";
  slider.style.opacity = 1; slider.style.width = active.offsetWidth + "px"; slider.style.transform = "translateX(" + active.offsetLeft + "px)";
  if (!slider.dataset.ready) { void slider.offsetWidth; slider.style.transition = ""; slider.dataset.ready = "1"; }
}
function moveSlider() { $$(".links,.filters").forEach(slide); }
addEventListener("resize", moveSlider); addEventListener("load", moveSlider);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveSlider);
const spy = $$("#links a"), sections = spy.map((link) => $(link.getAttribute("href")));
let currentSection = 0, lastGlass = -1, scrollTick = false;
function onScroll() {
  const glass = Math.min(1, scrollY / 240);
  if (Math.abs(glass - lastGlass) > .02 || glass === 0 || glass === 1) { lastGlass = glass; nav.style.setProperty("--sc", glass.toFixed(2)); }
  let current = 0;
  sections.forEach((section, index) => { if (section && section.getBoundingClientRect().top < innerHeight * .4) current = index; });
  if (current !== currentSection && !document.body.classList.contains("v-settings") && !document.body.classList.contains("v-menu")) {
    currentSection = current; spy.forEach((link, index) => link.classList.toggle("on", index === current)); moveSlider();
  }
  scrollTick = false;
}
addEventListener("scroll", () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });

/* Home, full-menu and settings routes */
const VIEWS = { "#/settings": "v-settings", "#/menu": "v-menu" };
const viewOf = () => VIEWS[location.hash] || "";
function applyQueryFilter() {
  const params = new URLSearchParams(location.search);
  const category = params.get("filter"), query = params.get("search");
  if (category || query !== null) fullMenu.setFilter(category || "All", query || "");
}
function route() {
  const legacyDrink = location.hash.match(/^#\/drink\/(.+)$/);
  if (legacyDrink) { location.replace("product.html?id=" + encodeURIComponent(legacyDrink[1])); return; }
  const view = viewOf();
  document.body.classList.remove("v-settings", "v-menu");
  if (view) document.body.classList.add(view);
  nav.classList.remove("hide"); blur.classList.remove("slim");
  if (view) {
    scrollTo(0, 0);
    spy.forEach((link) => link.classList.toggle("on", view === "v-menu" && link.getAttribute("href") === "#menu"));
    if (view === "v-menu") applyQueryFilter();
  } else {
    const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (target) target.scrollIntoView(); else scrollTo(0, 0);
    currentSection = -1; onScroll();
  }
  moveSlider();
}
addEventListener("hashchange", route);

/* Hero, opening hours and reveal motion */
const heroBg = $(".hero-bg");
let heroSource = "";
function setHero() {
  const theme = root.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "espresso" : "paper");
  const sources = ["images/hero-" + theme + ".jpg", "images/hero.jpg"];
  (function tryNext(index) {
    if (index >= sources.length || sources[index] === heroSource) return;
    const image = new Image(); image.alt = ""; image.decoding = "async"; image.className = "hero-photo";
    image.onload = () => {
      if (sources[index] === heroSource) return;
      heroSource = sources[index]; heroBg.appendChild(image);
      requestAnimationFrame(() => image.classList.add("in"));
      setTimeout(() => heroBg.querySelectorAll(".hero-photo").forEach((other) => { if (other !== image) other.remove(); }), 700);
    };
    image.onerror = () => tryNext(index + 1);
    image.src = sources[index];
  })(0);
}
setHero();
function updateOpen() {
  const hour = new Date().getHours(), open = hour >= 8 || hour < 1;
  $("#openTxt").textContent = open ? "Open now" : "Closed, opens at 8am";
  $("#openDot").style.background = open ? "#4ec27a" : "#d9604c";
}
updateOpen(); setInterval(updateOpen, 60000);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
$("#hours").innerHTML = DAYS.map((day, index) => `<li class="${index === new Date().getDay() ? "today" : ""}"><span>${day}</span><span>8am to 1am</span></li>`).join("");
const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) { entry.target.classList.add("in"); observer.unobserve(entry.target); }
}), { threshold: .12 });
$$(".rv").forEach((element, index) => { element.style.transitionDelay = (index % 4) * 60 + "ms"; observer.observe(element); });
route();

/* Gallery and lightbox */
const GALLERY = [["☕", "Morning pour", 28], ["🥐", "Fresh from the oven", 38], ["🪴", "The window seats", 110], ["🎶", "Late night sessions", 250], ["🍰", "Slice of the day", 335], ["🌙", "Open till 1am", 230]];
$("#gal").innerHTML = GALLERY.map((item, index) => `<button class="gtile" data-g="${index}" style="--h:${item[2]}" aria-label="${item[1]}">${item[0]}<img src="images/gallery-${index + 1}.jpg" alt="" loading="lazy"><span class="gcap">${item[1]}</span></button>`).join("");
const lb = $("#lb"); let lightboxIndex = 0;
function lbShow(index) {
  lightboxIndex = (index + GALLERY.length) % GALLERY.length;
  const item = GALLERY[lightboxIndex];
  $("#lbImg").style.setProperty("--h", item[2]);
  $("#lbImg").innerHTML = item[0] + `<img src="images/gallery-${lightboxIndex + 1}.jpg" alt="${item[1]}">`;
  $("#lbCap").textContent = item[1];
}
function openLightbox(index) { lbShow(index); lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); lock(true); $("#lbClose").focus(); }
function closeLightbox() { if (!lb.classList.contains("open")) return; lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); lock(false); }
$("#gal").addEventListener("click", (event) => { const tile = event.target.closest(".gtile"); if (tile) openLightbox(Number(tile.dataset.g)); });
$("#lbClose").addEventListener("click", closeLightbox);
$("#lbPrev").addEventListener("click", () => lbShow(lightboxIndex - 1));
$("#lbNext").addEventListener("click", () => lbShow(lightboxIndex + 1));
lb.addEventListener("click", (event) => { if (event.target === lb) closeLightbox(); });
document.addEventListener("keydown", (event) => {
  if (lb.classList.contains("open")) {
    if (event.key === "ArrowLeft") lbShow(lightboxIndex - 1);
    if (event.key === "ArrowRight") lbShow(lightboxIndex + 1);
  }
});

/* Reviews */
const REVIEWS = [
  ["Ayesha K.", "The oat latte is the best I have had. Cozy, quiet and always warm."],
  ["Daniel R.", "Croissants are out by six and they are unreal. My new morning stop."],
  ["Mina S.", "Perfect for late night study sessions. Great Wi-Fi and comfy chairs."],
  ["Omar T.", "The cold brew is smooth and strong. Staff remembered my order on day two."],
  ["Lena P.", "Matcha latte, window seat, rain outside. Does not get better."],
  ["Hamza A.", "Friendly team and the cheesecake is dangerous. Booked a table for my birthday."]
];
$("#revTrack").innerHTML = [...REVIEWS, ...REVIEWS].map((review) => `<figure class="rev"><div class="stars" aria-label="5 stars">★★★★★</div><blockquote>${esc(review[1])}</blockquote><figcaption>${esc(review[0])}</figcaption></figure>`).join("");

/* Keyboard help */
const keys = $("#ks");
function openKeys() { keys.classList.add("open"); keys.setAttribute("aria-hidden", "false"); lock(true); $("#ksClose").focus(); }
function closeKeys() { if (!keys.classList.contains("open")) return; keys.classList.remove("open"); keys.setAttribute("aria-hidden", "true"); lock(false); }
$("#ksClose").addEventListener("click", closeKeys);
keys.addEventListener("click", (event) => { if (event.target === keys) closeKeys(); });
document.addEventListener("keydown", (event) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "/") { event.preventDefault(); openSearch(); }
  if (event.key === "?") { event.preventDefault(); openKeys(); }
});

/* Three-dot menu and installable app */
function surprise() {
  const go = () => {
    const list = [...grid.querySelectorAll(".card:not(.hidden)")], card = list[Math.floor(Math.random() * list.length)];
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "smooth" }); card.classList.remove("spot"); void card.offsetWidth; card.classList.add("spot");
    setTimeout(() => card.classList.remove("spot"), 1800);
  };
  if (viewOf()) { location.hash = "#menu"; setTimeout(go, 500); } else go();
}
let installEvent = null;
addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installEvent = event; });
async function installApp() {
  if (installEvent) { await installEvent.prompt(); installEvent = null; }
  else location.href = "info.html?page=app";
}
const MENU_ACTIONS = {
  Categories: () => { location.hash = "#/menu"; },
  "Best sellers": () => { location.href = "?filter=Top#/menu"; },
  "Surprise me": surprise,
  "Install app": installApp,
  "Keyboard shortcuts": openKeys,
  Settings: () => { location.hash = "#/settings"; },
  Language: () => toast("English (UK) is selected"),
  Report: () => { location.href = "mailto:" + window.OREOS_CAFE_EMAIL + "?subject=" + encodeURIComponent("Website report"); },
  "Request a drink": () => { location.href = "mailto:" + window.OREOS_CAFE_EMAIL + "?subject=" + encodeURIComponent("Drink request"); }
};
$$("#menuPop .it").forEach((button) => {
  const action = Object.keys(MENU_ACTIONS).find((name) => button.textContent.trim().startsWith(name));
  if (action) button.addEventListener("click", () => { pop.classList.remove("open"); moreBtn.setAttribute("aria-expanded", "false"); MENU_ACTIONS[action](); });
});
$$('.install-app').forEach((button) => button.addEventListener("click", installApp));

/* Images gracefully fall back to their emoji artwork. */
document.addEventListener("error", (event) => { if (event.target.tagName === "IMG") event.target.remove(); }, true);
$$('img').forEach((image) => { if (image.complete && !image.naturalWidth) image.remove(); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
