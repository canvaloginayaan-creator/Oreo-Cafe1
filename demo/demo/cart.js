/* One persistent cart shared by the menu, product and checkout pages. */
(function () {
  "use strict";

  const STORAGE_KEY = "oc-cart-v3";
  const MAX_QUANTITY = 20;
  let items = [];

  function emit() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (error) { /* private mode */ }
    window.dispatchEvent(new CustomEvent("oreo:cartchange", { detail: { items: getItems(), totals: getTotals() } }));
  }

  function getItems() {
    return items.map((item) => ({
      ...item,
      addons: item.addons.map((addon) => ({ ...addon }))
    }));
  }

  function getTotals() {
    return items.reduce((result, item) => {
      const unit = item.basePrice + item.sizeDelta + item.addons.reduce((sum, addon) => sum + addon.price, 0);
      result.count += item.quantity;
      result.subtotal += unit * item.quantity;
      return result;
    }, { count: 0, subtotal: 0 });
  }

  function unitPrice(item) {
    return item.basePrice + item.sizeDelta + item.addons.reduce((sum, addon) => sum + addon.price, 0);
  }

  function makeKey(productId, size, addons) {
    const addonKey = addons.map((addon) => addon.name).sort().join("+");
    return [productId, size, addonKey].join("|");
  }

  function add(product, size, addons, quantity) {
    if (!product || product.available === false || product.stock === 0) return { ok: false, reason: "unavailable" };
    const isDrink = product.category !== "Pastry";
    const selectedSize = isDrink ? (size || "Medium") : "Regular";
    const selectedAddons = (addons || []).map((addon) => ({
      name: String(addon.name).slice(0, 80),
      price: Math.max(0, Number(addon.price) || 0)
    }));
    const amount = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 1)));
    const key = makeKey(product.id, selectedSize, selectedAddons);
    const existing = items.find((item) => item.key === key);
    const stockLimit = product.stock === null ? MAX_QUANTITY : Math.min(MAX_QUANTITY, product.stock);
    if (existing) {
      if (existing.quantity >= stockLimit) return { ok: false, reason: "limit" };
      existing.quantity = Math.min(stockLimit, existing.quantity + amount);
    } else {
      items.push({
        key,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image,
        emoji: product.emoji,
        hue: product.hue,
        category: product.category,
        basePrice: product.price,
        size: selectedSize,
        sizeDelta: isDrink ? (window.OreoData.sizesFor(product).find((entry) => entry.name === selectedSize) || { delta: 0 }).delta : 0,
        addons: selectedAddons,
        quantity: Math.min(stockLimit, amount)
      });
    }
    emit();
    return { ok: true, key };
  }

  function update(key, quantity) {
    const item = items.find((entry) => entry.key === key);
    if (!item) return;
    const next = Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 0));
    if (next <= 0) items = items.filter((entry) => entry.key !== key);
    else item.quantity = next;
    emit();
  }

  function remove(key) {
    items = items.filter((item) => item.key !== key);
    emit();
  }

  function clear() {
    items = [];
    emit();
  }

  function migrateLegacyCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) {
        items = saved.filter((item) => item && typeof item.key === "string" && typeof item.productId === "string" && Number(item.quantity) > 0).map((item) => ({
          key: item.key,
          productId: item.productId,
          slug: String(item.slug || item.productId),
          name: String(item.name || "Cafe item").slice(0, 120),
          image: window.OreoData.safeImage(item.image),
          emoji: String(item.emoji || "☕").slice(0, 8),
          hue: Number(item.hue) || 28,
          category: ["Coffee", "Tea", "Pastry"].includes(item.category) ? item.category : "Coffee",
          basePrice: Math.max(0, Number(item.basePrice) || 0),
          size: String(item.size || "Medium"),
          sizeDelta: Number(item.sizeDelta) || 0,
          addons: Array.isArray(item.addons) ? item.addons.map((addon) => ({ name: String(addon.name).slice(0, 80), price: Math.max(0, Number(addon.price) || 0) })) : [],
          quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(item.quantity) || 1)))
        }));
      }
    } catch (error) { items = []; }
  }

  migrateLegacyCart();

  window.OreoCart = {
    MAX_QUANTITY,
    getItems,
    getTotals,
    unitPrice,
    add,
    update,
    remove,
    clear,
    refresh: emit
  };
})();
