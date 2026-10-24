/* Shared product catalogue and formatting helpers (no framework required). */
(function () {
  "use strict";

  // [name, price, category, emoji, hue, rating, description, image]
  const legacy = [
    ["Oat Latte", 4.5, "Coffee", "☕", 28, 4.8, "Smooth espresso with steamed oat milk.", "images/oat-latte.jpg"],
    ["Flat White", 4, "Coffee", "🥛", 38, 4.7, "Double ristretto with velvety microfoam.", "images/flat-white.jpg"],
    ["Iced Caramel", 5, "Coffee", "🧋", 22, 4.6, "Cold espresso, milk and caramel over ice.", "images/iced-caramel.jpg"],
    ["Cold Brew", 4.8, "Coffee", "🧊", 205, 4.9, "Steeped for 18 hours and served over ice.", "images/cold-brew.jpg"],
    ["Matcha Latte", 5.2, "Tea", "🍵", 125, 4.8, "Ceremonial matcha whisked with milk.", "images/matcha-latte.jpg"],
    ["Masala Chai", 3.5, "Tea", "🫖", 18, 4.7, "Black tea simmered with warm spices.", "images/masala-chai.jpg"],
    ["Mocha", 5, "Coffee", "🍫", 20, 4.7, "Espresso, steamed milk and dark chocolate.", "images/mocha.jpg"],
    ["Iced Lemon Tea", 4.2, "Tea", "🍋", 52, 4.6, "Black tea shaken with lemon over ice.", "images/iced-lemon-tea.jpg"],
    ["Butter Croissant", 3.8, "Pastry", "🥐", 36, 4.9, "Flaky, golden and baked at 6am.", "images/butter-croissant.jpg"],
    ["Glazed Donut", 3.2, "Pastry", "🍩", 330, 4.6, "Soft and fluffy with a sugar glaze.", "images/glazed-donut.jpg"],
    ["Chocolate Muffin", 3.6, "Pastry", "🧁", 15, 4.8, "Rich, moist and loaded with chocolate chips.", "images/chocolate-muffin.jpg"],
    ["Blueberry Cheesecake", 5.5, "Pastry", "🍰", 335, 4.9, "Creamy slice with a blueberry compote.", "images/blueberry-cheesecake.jpg"],
    ["Cappuccino", 4.2, "Coffee", "☕", 30, 4.8, "Equal parts espresso, steamed milk and foam.", "images/cappuccino.jpg"],
    ["Americano", 3.5, "Coffee", "☕", 25, 4.5, "Espresso topped with hot water.", "images/americano.jpg"],
    ["Vanilla Latte", 4.8, "Coffee", "🍦", 48, 4.7, "Espresso and milk with house vanilla syrup.", "images/vanilla-latte.jpg"],
    ["Caramel Macchiato", 5.2, "Coffee", "🍯", 32, 4.8, "Vanilla milk marked with espresso and caramel.", "images/caramel-macchiato.jpg"],
    ["Affogato", 5.6, "Coffee", "🍨", 15, 4.9, "Vanilla ice cream drowned in hot espresso.", "images/affogato.jpg"],
    ["Jasmine Green Tea", 3.8, "Tea", "🍃", 110, 4.6, "Light green tea scented with jasmine.", "images/jasmine-green-tea.jpg"],
    ["Chamomile Tea", 3.6, "Tea", "🌼", 55, 4.5, "Calming and caffeine free.", "images/chamomile-tea.jpg"],
    ["Peach Iced Tea", 4.4, "Tea", "🍑", 14, 4.7, "Black tea with peach, served over ice.", "images/peach-iced-tea.jpg"],
    ["Apple Pie", 4.2, "Pastry", "🥧", 38, 4.7, "Cinnamon apples under a buttery crust.", "images/apple-pie.jpg"],
    ["Chocolate Chip Cookie", 2.8, "Pastry", "🍪", 28, 4.8, "Crisp edges, soft middle, big chocolate chunks.", "images/chocolate-chip-cookie.jpg"],
    ["Sesame Bagel", 3.4, "Pastry", "🥯", 42, 4.5, "Chewy, toasted and served with cream cheese.", "images/sesame-bagel.jpg"],
    ["Belgian Waffle", 5, "Pastry", "🧇", 45, 4.8, "Crisp waffle with maple syrup and butter.", "images/belgian-waffle.jpg"]
  ];

  const descriptions = {
    Coffee: "Made to order with our house-roasted beans and your choice of size. A balanced cup with a rich aroma and a smooth finish.",
    Tea: "Prepared fresh and served with care. Choose your preferred size and enjoy a comforting cup at any time of day.",
    Pastry: "Baked fresh in small batches for the best texture and flavour. A perfect companion to your favourite cafe drink."
  };

  function slugify(value) {
    return String(value || "product")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "product";
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeImage(value) {
    const url = String(value || "").trim();

    if (/^https?:\/\//i.test(url)) return url;

    if (
      /^images\/[a-z0-9_./-]+$/i.test(url) &&
      !url.includes("..")
    ) {
      return url;
    }

    return "";
  }

  function normalize(input, fallbackId) {
    const p = input || {};

    const name = String(p.name || "Untitled product")
      .trim()
      .slice(0, 120);

    const category = String(p.category || "Coffee")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80) || "Coffee";

    const description = String(
      p.description ||
      descriptions[category] ||
      "Prepared fresh to order and served with care."
    ).trim().slice(0, 500);

    return {
      id: String(p.id || fallbackId || slugify(name))
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 120),

      name,
      slug: slugify(p.slug || name),
      price: Math.max(0, number(p.price, 0)),
      category,

      emoji: String(
        p.emoji ||
        (
          category === "Pastry"
            ? "🥐"
            : category === "Tea"
              ? "🍵"
              : "☕"
        )
      ).slice(0, 8),

      hue: ((number(p.hue, 28) % 360) + 360) % 360,
      rating: Math.min(5, Math.max(0, number(p.rating, 4.8))),
      description,

      longDescription: String(
        p.longDescription ||
        description + " " +
        (
          descriptions[category] ||
          "Prepared fresh to order and served with care."
        )
      ).trim().slice(0, 2000),

      image: safeImage(p.image),
      sku: String(p.sku || "").trim().slice(0, 80),

      ingredients: String(p.ingredients || "")
        .trim()
        .slice(0, 600),

      calories: Math.max(0, number(p.calories, 0)),

      prepTime: String(
        p.prepTime ||
        (category === "Pastry" ? "Ready to serve" : "4–6 min")
      ).slice(0, 80),

      stock:
        p.stock === null ||
        p.stock === "" ||
        typeof p.stock === "undefined"
          ? null
          : Math.max(
              0,
              Math.floor(number(p.stock, 0))
            ),

      smallDelta: number(p.smallDelta, -0.5),
      mediumDelta: number(p.mediumDelta, 0),
      largeDelta: number(p.largeDelta, 0.7),
      available: p.available !== false,
      featured: p.featured === true,
      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null
    };
  }

  const defaults = legacy.map((m) =>
    normalize({
      id: slugify(m[0]),
      name: m[0],
      price: m[1],
      category: m[2],
      emoji: m[3],
      hue: m[4],
      rating: m[5],
      description: m[6],
      image: m[7]
    })
  );

  function toLegacy(p) {
    return [
      p.name,
      p.price,
      p.category,
      p.emoji,
      p.hue,
      p.rating,
      p.description,
      p.image
    ];
  }

  function money(value) {
    return "$" + number(value, 0).toFixed(2);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(
      /[&<>'"]/g,
      (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
      })[character]
    );
  }

  function sizesFor(product) {
    return [
      {
        name: "Small",
        delta: product.smallDelta
      },
      {
        name: "Medium",
        delta: product.mediumDelta
      },
      {
        name: "Large",
        delta: product.largeDelta
      }
    ];
  }

  window.OreoData = {
    DEFAULT_PRODUCTS: defaults,
    normalize,
    toLegacy,
    slugify,
    money,
    escapeHtml,
    safeImage,
    sizesFor,
    descriptions
  };
})();
