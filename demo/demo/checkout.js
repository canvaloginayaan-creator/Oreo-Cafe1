"use strict";

const $ = (selector) => document.querySelector(selector);
const esc = window.OreoData.escapeHtml;
const money = window.OreoData.money;
const DELIVERY_PRICE = 2.5;
let orderComplete = false;
let currentUser = null;

function orderType() {
  const checked = document.querySelector('input[name="orderType"]:checked');
  return checked ? checked.value : "pickup";
}
function totals() {
  const subtotal = window.OreoCart.getTotals().subtotal;
  const delivery = orderType() === "delivery" ? DELIVERY_PRICE : 0;
  return { subtotal, delivery, total: subtotal + delivery };
}
function renderSummary() {
  if (orderComplete) return;
  const items = window.OreoCart.getItems();
  if (!items.length) {
    $("#checkoutContent").innerHTML = `<div class="empty-state"><h2>Your order is empty</h2><p>Add a coffee, tea or fresh pastry before coming to checkout.</p><a class="btn solid" href="index.html#/menu">Explore the menu</a></div>`;
    return;
  }
  $("#summaryItems").innerHTML = items.map((item) => {
    const options = [item.category !== "Pastry" ? item.size : "", ...item.addons.map((addon) => addon.name)].filter(Boolean).join(", ");
    return `<div class="summary-item"><div class="summary-thumb" style="--h:${item.hue}">${esc(item.emoji)}${item.image ? `<img src="${esc(item.image)}" alt="">` : ""}</div><div><h3>${item.quantity} × ${esc(item.name)}</h3><p>${esc(options || "Regular")}</p></div><strong>${money(window.OreoCart.unitPrice(item) * item.quantity)}</strong></div>`;
  }).join("");
  const value = totals();
  $("#subtotal").textContent = money(value.subtotal);
  $("#deliveryFee").textContent = value.delivery ? money(value.delivery) : "Free";
  $("#grandTotal").textContent = money(value.total);
  $("#placeOrder").textContent = "Place order · " + money(value.total);
}
function updateOrderType() {
  const delivery = orderType() === "delivery";
  const fields = $("#addressFields");
  if (fields) {
    fields.hidden = !delivery;
    fields.querySelectorAll("input").forEach((input) => { input.required = delivery; });
  }
  if ($("#paymentText")) $("#paymentText").textContent = delivery
    ? "Pay in cash when your order arrives. This website does not request or store card details."
    : "Pay at the counter when you collect your order. This website does not request or store card details.";
  if ($("#paymentNotice")) $("#paymentNotice").textContent = delivery ? "Cash on delivery · No online payment needed" : "Pay at cafe · No online payment needed";
  renderSummary();
}
document.querySelectorAll('input[name="orderType"]').forEach((input) => input.addEventListener("change", updateOrderType));
window.addEventListener("oreo:cartchange", renderSummary);
renderSummary();

window.OreoFirebase.onAuth((user) => {
  currentUser = user;
  const notice = $("#checkoutNotice");
  if (!notice) return;
  if (user) {
    const form = $("#checkoutForm");
    if (form) {
      if (!form.elements.name.value) form.elements.name.value = user.displayName || "";
      if (!form.elements.email.value) form.elements.email.value = user.email || "";
    }
    if (!window.OreoFirebase.configured) {
      notice.hidden = false;
      notice.innerHTML = "Demo mode: add your Firebase web configuration so orders reach the admin panel. This order will otherwise be saved only in this browser.";
    }
  } else {
    notice.hidden = false;
    notice.innerHTML = (window.OreoFirebase.configured ? "" : "<strong>Demo mode:</strong> orders currently stay in this browser. ") + '<a href="auth.html?next=checkout.html">Sign in or create an account</a> to keep your order history, or continue as a guest.';
  }
});

$("#checkoutForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (orderComplete) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const items = window.OreoCart.getItems();
  if (!items.length) { renderSummary(); return; }
  const fields = form.elements;
  const value = totals();
  const type = orderType();
  const order = {
    customer: {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim()
    },
    orderType: type,
    address: type === "delivery" ? fields.address.value.trim() : "Pickup at 12 Garden Road",
    city: type === "delivery" ? fields.city.value.trim() : "",
    notes: fields.notes.value.trim(),
    paymentMethod: type === "delivery" ? "Cash on delivery" : "Pay at cafe",
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      category: item.category,
      size: item.size,
      addons: item.addons,
      quantity: item.quantity,
      unitPrice: Number(window.OreoCart.unitPrice(item).toFixed(2)),
      lineTotal: Number((window.OreoCart.unitPrice(item) * item.quantity).toFixed(2))
    })),
    subtotal: Number(value.subtotal.toFixed(2)),
    deliveryFee: Number(value.delivery.toFixed(2)),
    total: Number(value.total.toFixed(2)),
    currency: "USD",
    source: "website"
  };
  const button = $("#placeOrder"), error = $("#checkoutError");
  button.disabled = true; button.textContent = "Placing your order…"; error.textContent = "";
  try {
    const result = await window.OreoFirebase.createOrder(order);
    orderComplete = true;
    window.OreoCart.clear();
    const reference = result.orderNumber || result.id;
    try { localStorage.setItem("oc-last-order", JSON.stringify({ ...result, total: order.total, createdAt: new Date().toISOString() })); } catch (storageError) { /* optional */ }
    $("#checkoutContent").innerHTML = `<div class="order-success"><div class="success-icon">✓</div><span class="eyebrow">${result.local ? "Local demo order" : "Order sent to the cafe"}</span><h1>Thank you, ${esc(order.customer.name.split(" ")[0])}.</h1><div class="success-reference">Order ${esc(reference)}</div><p>${result.local
      ? "This demo order is saved only in this browser. Add your Firebase configuration to send live orders to the admin panel."
      : "Your order is pending and is now visible in the admin panel. We'll contact you at " + esc(order.customer.phone) + " if anything needs confirming."}</p><p><strong>${esc(order.paymentMethod)} · ${money(order.total)}</strong></p><div class="success-actions"><a class="btn solid" href="index.html#/menu">Order something else</a>${currentUser && !result.local ? '<a class="btn" style="background:var(--surface)" href="auth.html">View my orders</a>' : ""}</div></div>`;
    scrollTo({ top: 0, behavior: "smooth" });
  } catch (submissionError) {
    error.textContent = "Your order could not be placed. " + submissionError.message;
    button.disabled = false; renderSummary();
  }
});
document.addEventListener("error", (event) => { if (event.target.tagName === "IMG") event.target.remove(); }, true);
