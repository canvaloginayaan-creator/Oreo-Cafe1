"use strict";

const $ = (selector) => document.querySelector(selector);
const esc = window.OreoData.escapeHtml;
const money = window.OreoData.money;
const params = new URLSearchParams(location.search);
const requestedId = params.get("id") || params.get("product") || "oat-latte";
let allProducts = [];
let product = null;
let productFingerprint = "";
let selectedSize = "Medium";
let selectedAddons = new Set();
let quantity = 1;
let toastTimer;
const ADDONS = [
  { name: "Extra shot", price: .8, categories: ["Coffee"] },
  { name: "Oat milk", price: .6, categories: ["Coffee", "Tea"] }
];

function toast(message) {
  const element = $("#toast");
  element.textContent = message; element.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}
function imageArt(item) {
  return esc(item.emoji) + (item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}">` : "");
}
function currentUnitPrice() {
  const size = window.OreoData.sizesFor(product).find((entry) => entry.name === selectedSize);
  const addons = ADDONS.filter((addon) => selectedAddons.has(addon.name));
  return product.price + (product.category === "Pastry" ? 0 : (size ? size.delta : 0)) + addons.reduce((sum, addon) => sum + addon.price, 0);
}
function updatePrice() {
  if (!product) return;
  $("#productPrice").textContent = money(currentUnitPrice());
  $("#addButton").textContent = "Add to order · " + money(currentUnitPrice() * quantity);
  $("#quantityOutput").textContent = quantity;
  $("#quantityOutput").value = quantity;
  $("#quantityMinus").disabled = quantity <= 1;
  $("#quantityPlus").disabled = quantity >= Math.min(window.OreoCart.MAX_QUANTITY, product.stock === null ? 20 : product.stock);
}
function renderProduct() {
  $("#breadcrumbName").textContent = product.name;
  document.title = product.name + " — Oreo's Cafe";
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) descriptionMeta.content = product.description;
  const isDrink = product.category !== "Pastry";
  const availableAddons = ADDONS.filter((addon) => addon.categories.includes(product.category));
  const sizes = window.OreoData.sizesFor(product);
  const soldOut = product.stock === 0;
  $("#productContent").innerHTML = `<div class="product-layout">
    <div class="product-visual" style="--h:${product.hue}">${imageArt(product)}</div>
    <div class="product-info">
      <span class="eyebrow">${esc(product.category)}${product.featured ? " · Cafe favourite" : ""}</span>
      <h1>${esc(product.name)}</h1>
      <div class="product-rating"><strong>★ ${product.rating.toFixed(1)}</strong><span>·</span><span>${esc(product.prepTime)}</span>${product.sku ? `<span>·</span><span>SKU ${esc(product.sku)}</span>` : ""}</div>
      <p class="product-description">${esc(product.longDescription || product.description)}</p>
      ${soldOut ? '<p class="inline-notice error">This product is currently sold out. Please choose another item.</p>' : ""}
      <strong class="product-price" id="productPrice">${money(product.price)}</strong>
      ${isDrink ? `<div class="option-group"><div class="option-label"><span>Choose your size</span><span>Required</span></div><div class="size-options" id="sizeOptions">${sizes.map((size) => `<button type="button" class="size-option ${size.name === selectedSize ? "on" : ""}" data-size="${size.name}" aria-pressed="${size.name === selectedSize}">${size.name}<small>${money(product.price + size.delta)}</small></button>`).join("")}</div></div>` : ""}
      ${availableAddons.length ? `<div class="option-group"><div class="option-label"><span>Make it yours</span><span>Optional</span></div><div class="addon-options" id="addonOptions">${availableAddons.map((addon) => `<button type="button" class="addon-option" data-addon="${esc(addon.name)}" aria-pressed="false">${esc(addon.name)} +${money(addon.price)}</button>`).join("")}</div></div>` : ""}
      <div class="option-group"><div class="option-label"><span>Quantity</span><span>${product.stock !== null ? product.stock + " available" : "Freshly prepared"}</span></div><div class="purchase-row"><div class="quantity-picker"><button type="button" id="quantityMinus" aria-label="Decrease quantity">−</button><output id="quantityOutput" aria-live="polite">1</output><button type="button" id="quantityPlus" aria-label="Increase quantity">+</button></div></div></div>
      <div class="purchase-actions"><button class="btn solid" id="addButton" type="button" ${soldOut ? "disabled" : ""}>Add to order</button><button class="btn" id="buyButton" type="button" style="background:var(--surface)" ${soldOut ? "disabled" : ""}>Buy now</button></div>
      <div class="product-facts"><div class="product-fact"><strong>${esc(product.prepTime)}</strong><span>Preparation</span></div><div class="product-fact"><strong>${product.calories ? product.calories + " kcal" : "Made fresh"}</strong><span>${product.calories ? "Per serving" : "In our cafe"}</span></div><div class="product-fact"><strong>${isDrink ? "3 sizes" : "Baked daily"}</strong><span>${isDrink ? "Your perfect cup" : "Small batches"}</span></div></div>
      ${product.ingredients ? `<p class="ingredients"><strong>Ingredients:</strong> ${esc(product.ingredients)}</p>` : ""}
    </div>
  </div>`;
  updatePrice();
  $("#sizeOptions") && $("#sizeOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    selectedSize = button.dataset.size;
    document.querySelectorAll("[data-size]").forEach((item) => { const on = item === button; item.classList.toggle("on", on); item.setAttribute("aria-pressed", on); });
    updatePrice();
  });
  $("#addonOptions") && $("#addonOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-addon]");
    if (!button) return;
    const name = button.dataset.addon;
    if (selectedAddons.has(name)) selectedAddons.delete(name); else selectedAddons.add(name);
    button.setAttribute("aria-pressed", String(selectedAddons.has(name)));
    updatePrice();
  });
  $("#quantityMinus").addEventListener("click", () => { quantity = Math.max(1, quantity - 1); updatePrice(); });
  $("#quantityPlus").addEventListener("click", () => { quantity = Math.min(window.OreoCart.MAX_QUANTITY, product.stock === null ? 20 : product.stock, quantity + 1); updatePrice(); });
  $("#addButton").addEventListener("click", () => addProduct(false));
  $("#buyButton").addEventListener("click", () => addProduct(true));
  renderRelated();
}
function addProduct(checkout) {
  const result = window.OreoCart.add(product, selectedSize, ADDONS.filter((addon) => selectedAddons.has(addon.name)), quantity);
  if (!result.ok) { toast(result.reason === "limit" ? "Quantity limit reached" : "This product is unavailable"); return; }
  if (checkout) location.href = "checkout.html";
  else { toast(quantity + " × " + product.name + " added to your order"); $("#addButton").textContent = "Added to your order ✓"; setTimeout(updatePrice, 1100); }
}
function renderRelated() {
  const related = allProducts.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4);
  const fallback = related.length ? related : allProducts.filter((item) => item.id !== product.id).slice(0, 4);
  if (!fallback.length) { $("#relatedSection").hidden = true; return; }
  $("#relatedSection").hidden = false;
  $("#relatedGrid").innerHTML = fallback.map((item) => `<a class="related-card" href="product.html?id=${encodeURIComponent(item.id)}"><div class="related-art" style="--h:${item.hue}">${imageArt(item)}</div><div><h3>${esc(item.name)}</h3><p>${money(item.price)} · ★ ${item.rating.toFixed(1)}</p></div></a>`).join("");
}
window.OreoFirebase.onProducts((products) => {
  allProducts = products;
  const found = products.find((item) => item.id === requestedId || item.slug === requestedId);
  if (!found) {
    $("#productContent").innerHTML = `<div class="empty-state"><h2>We couldn't find that product</h2><p>It may have been removed from the menu. Browse the latest cafe selection instead.</p><a class="btn solid" href="index.html#/menu">Browse menu</a></div>`;
    $("#relatedSection").hidden = true;
    return;
  }
  const fingerprint = JSON.stringify(found);
  if (product && product.id === found.id && productFingerprint === fingerprint) return;
  const isNewProduct = !product || product.id !== found.id;
  product = found; productFingerprint = fingerprint;
  if (isNewProduct) { selectedSize = "Medium"; selectedAddons = new Set(); quantity = 1; }
  const stockLimit = product.stock === null ? window.OreoCart.MAX_QUANTITY : Math.max(1, product.stock);
  quantity = Math.min(quantity, stockLimit);
  renderProduct();
});
function updateCartCount() { $("#cartCount").textContent = window.OreoCart.getTotals().count; }
window.addEventListener("oreo:cartchange", updateCartCount); updateCartCount();
window.OreoFirebase.onAuth((user) => {
  $("#authText").textContent = user ? (user.displayName ? user.displayName.split(" ")[0] : "Account") : "Log in";
});
document.addEventListener("error", (event) => { if (event.target.tagName === "IMG") event.target.remove(); }, true);
