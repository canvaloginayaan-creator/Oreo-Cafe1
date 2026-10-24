"use strict";

const $ = (selector) => document.querySelector(selector);
const esc = window.OreoData.escapeHtml;
const money = window.OreoData.money;
const nextParam = new URLSearchParams(location.search).get("next");
const nextPage = nextParam && /^[a-z0-9_-]+\.html(?:\?[^\s]*)?$/i.test(nextParam) ? nextParam : "";
let stopOrders = null;
let authBusy = false;

function friendlyError(error) {
  const messages = {
    "auth/invalid-credential": "That email or password is incorrect.",
    "auth/wrong-password": "That email or password is incorrect.",
    "auth/user-not-found": "No account was found with that email.",
    "auth/email-already-in-use": "An account already exists with that email. Try logging in.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before completion.",
    "auth/unauthorized-domain": "Add this website's domain in Firebase Authentication > Settings > Authorized domains.",
    "auth/network-request-failed": "Check your internet connection and try again."
  };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}
function setMessage(message, error) {
  const element = $("#authMessage");
  element.textContent = message || "";
  element.classList.toggle("error", Boolean(error));
}
function setBusy(busy) {
  authBusy = busy;
  document.querySelectorAll("#loginForm button[type=submit],#signupForm button[type=submit],#googleLogin").forEach((button) => { button.disabled = busy; });
}
function showTab(signup) {
  $("#loginTab").classList.toggle("on", !signup); $("#signupTab").classList.toggle("on", signup);
  $("#loginTab").setAttribute("aria-selected", String(!signup)); $("#signupTab").setAttribute("aria-selected", String(signup));
  $("#loginForm").hidden = signup; $("#signupForm").hidden = !signup;
  setMessage("");
}
$("#loginTab").addEventListener("click", () => showTab(false));
$("#signupTab").addEventListener("click", () => showTab(true));
function afterAuthentication(user) {
  if (!nextPage) return false;
  // admin.html performs the admins/{uid} role check after authentication.
  location.href = nextPage;
  return true;
}
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); if (authBusy) return;
  const fields = event.currentTarget.elements;
  setBusy(true); setMessage("Logging you in…");
  try {
    const credential = await window.OreoFirebase.signIn(fields.email.value.trim(), fields.password.value);
    if (!afterAuthentication(credential.user)) setMessage("Logged in successfully.");
  } catch (error) { setMessage(friendlyError(error), true); }
  finally { setBusy(false); }
});
$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault(); if (authBusy) return;
  const fields = event.currentTarget.elements;
  if (fields.password.value !== fields.confirmPassword.value) { setMessage("The passwords do not match.", true); return; }
  setBusy(true); setMessage("Creating your account…");
  try {
    const credential = await window.OreoFirebase.signUp(fields.name.value.trim(), fields.email.value.trim(), fields.password.value);
    if (!afterAuthentication(credential.user)) setMessage("Account created. A verification email has been sent to you.");
  } catch (error) { setMessage(friendlyError(error), true); }
  finally { setBusy(false); }
});
$("#googleLogin").addEventListener("click", async () => {
  if (authBusy) return;
  setBusy(true); setMessage("Opening Google sign-in…");
  try { const credential = await window.OreoFirebase.signInWithGoogle(); if (!afterAuthentication(credential.user)) setMessage("Logged in with Google."); }
  catch (error) { setMessage(friendlyError(error), true); }
  finally { setBusy(false); }
});
$("#forgotPassword").addEventListener("click", async () => {
  const email = $("#loginForm").elements.email.value.trim();
  if (!email) { setMessage("Enter your email address first, then choose Forgot password.", true); return; }
  try { await window.OreoFirebase.resetPassword(email); setMessage("Password reset email sent. Check your inbox."); }
  catch (error) { setMessage(friendlyError(error), true); }
});

function renderOrders(orders) {
  const history = $("#orderHistory");
  if (!orders.length) {
    history.innerHTML = '<div class="empty-state panel-card"><h2>No orders yet</h2><p>Your cafe orders will appear here after checkout.</p><a class="btn solid" href="index.html#/menu">Start an order</a></div>';
    return;
  }
  history.innerHTML = orders.map((order) => {
    const date = window.OreoFirebase.dateValue(order.createdAt);
    const itemCount = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return `<article class="history-card"><div class="history-head"><h3>${esc(order.orderNumber || order.id)}</h3><span class="status-badge">${esc(order.status || "pending")}</span></div><p>${date ? new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Recent"} · ${itemCount} items · ${esc(order.orderType || "pickup")}</p><p>${(order.items || []).slice(0, 3).map((item) => esc(item.quantity + " × " + item.name)).join(" · ")}${(order.items || []).length > 3 ? " …" : ""}</p><p><strong style="color:var(--text)">${money(order.total)}</strong></p></article>`;
  }).join("");
}
window.OreoFirebase.onAuth((user, isAdmin) => {
  $("#authCard").hidden = Boolean(user);
  $("#accountView").hidden = !user;
  if (stopOrders) { stopOrders(); stopOrders = null; }
  if (!user) return;
  $("#accountName").textContent = user.displayName || "Your account";
  $("#accountEmail").textContent = user.email || "";
  $("#accountAvatar").textContent = (user.displayName || user.email || "O").charAt(0).toUpperCase();
  $("#adminAction").hidden = !isAdmin;
  $("#verificationAction").hidden = user.emailVerified;
  if (isAdmin) {
    $("#accountNotice").hidden = false;
    $("#accountNotice").textContent = "Administrator access is active for this account.";
  } else if (!user.emailVerified) {
    $("#accountNotice").hidden = false;
    $("#accountNotice").textContent = "Check your inbox to verify your email address. You can still order while verification is pending.";
  } else $("#accountNotice").hidden = true;
  stopOrders = window.OreoFirebase.onUserOrders(renderOrders);
});
$("#signOut").addEventListener("click", async () => { await window.OreoFirebase.signOut(); showTab(false); });
$("#resendVerification").addEventListener("click", async () => {
  try { await window.OreoFirebase.resendVerification(); $("#accountNotice").textContent = "Verification email sent. Check your inbox and spam folder."; }
  catch (error) { $("#accountNotice").textContent = friendlyError(error); }
});
$("#refreshVerification").addEventListener("click", async () => {
  const user = window.OreoFirebase.user;
  if (!user) return;
  await user.reload();
  try { await user.getIdTokenResult(true); } catch (error) { /* reload below still refreshes */ }
  location.reload();
});
function updateCartCount() { $("#cartCount").textContent = window.OreoCart.getTotals().count; }
window.addEventListener("oreo:cartchange", updateCartCount); updateCartCount();
if (!window.OreoFirebase.configured) $("#firebaseNotice").hidden = false;
