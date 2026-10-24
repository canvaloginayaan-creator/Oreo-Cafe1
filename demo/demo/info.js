"use strict";

const pages = {
  story: {
    title: "Our story",
    eyebrow: "The corner table",
    intro: "A good cup, a warm pastry and enough time to enjoy both.",
    body: `<div class="panel-card"><h2>Made slowly, served warm.</h2><p>Oreo's Cafe started with one simple idea: a neighbourhood cafe should feel like your favourite corner of home. We roast in small batches, bake before the doors open and keep the lights on late for conversation, study and quiet moments.</p><h3>What matters to us</h3><ul><li>Fresh ingredients and careful preparation.</li><li>Friendly service without rushing you.</li><li>A comfortable space from 8am until 1am.</li></ul><p><a href="index.html#about">Discover more on the home page</a> or <a href="index.html#reserve">request your table</a>.</p></div>`
  },
  careers: {
    title: "Careers",
    eyebrow: "Join the team",
    intro: "We are always glad to meet thoughtful baristas, bakers and hosts.",
    body: `<div class="panel-card"><h2>Bring your warmth to the cafe.</h2><p>We do not have any listed vacancies right now, but you can introduce yourself for future front-of-house, barista and bakery opportunities.</p><h3>What to send</h3><p>Tell us a little about your experience, the role you are interested in and your availability. Please do not send sensitive identity documents by email.</p><p style="margin-top:20px"><a class="btn solid" href="mailto:hello@oreoscafe.com?subject=Careers%20at%20Oreo's%20Cafe">Introduce yourself</a></p></div>`
  },
  news: {
    title: "News and updates",
    eyebrow: "From the cafe",
    intro: "Fresh bakes, new drinks and what is happening at the corner table.",
    body: `<div class="info-cards"><article class="panel-card"><span class="eyebrow">Now ordering</span><h2>Your cafe account</h2><p>Create an account with email or Google, save your order history and check out with pickup or delivery details.</p><a href="auth.html">Create an account →</a></article><article class="panel-card"><span class="eyebrow">Fresh from the oven</span><h2>Daily small-batch bakes</h2><p>Croissants, muffins, cookies and cakes are prepared in small batches. Availability can change through the day.</p><a href="index.html?filter=Pastry#/menu">See today's pastries →</a></article><article class="panel-card"><span class="eyebrow">Late nights</span><h2>Open until 1am</h2><p>Our Wi-Fi and corner seats are ready for late-night conversations and study sessions.</p><a href="index.html#visit">Plan your visit →</a></article><article class="panel-card"><span class="eyebrow">Your table</span><h2>Reservation requests</h2><p>Send your preferred date, time and party size. The cafe will contact you to confirm availability.</p><a href="index.html#reserve">Request a table →</a></article></div>`
  },
  contact: {
    title: "Contact us",
    eyebrow: "Come say hi",
    intro: "Questions, feedback or a table for your next get-together—we are listening.",
    body: `<div class="info-cards"><div class="panel-card"><h2>Visit</h2><p><a href="https://www.google.com/maps/search/?api=1&query=12%20Garden%20Road" target="_blank" rel="noopener">12 Garden Road</a><br>Open daily, 8am to 1am.</p><p><a href="https://www.google.com/maps/search/?api=1&query=12%20Garden%20Road" target="_blank" rel="noopener">Get directions →</a></p></div><div class="panel-card"><h2>Write</h2><p>For general questions and feedback:<br><a href="mailto:hello@oreoscafe.com">hello@oreoscafe.com</a></p><p>For table requests, please use the reservation form so we receive your preferred date and time.</p></div></div><div class="panel-card"><h2>Request a table</h2><p>Choose your date, time, guest count and add any special requests. A request is not a confirmed booking until the cafe contacts you.</p><p style="margin-top:18px"><a class="btn solid" href="index.html#reserve">Open reservation form</a></p></div>`
  },
  app: {
    title: "Install the web app",
    eyebrow: "Oreo's on your home screen",
    intro: "Use the cafe like an app without downloading anything from an app store.",
    body: `<div class="panel-card"><h2>Android and desktop</h2><p>Open Oreo's Cafe in Chrome or Edge, then open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If your browser shows an install prompt, the Install web app button in our footer can open it for you.</p><h3>iPhone and iPad</h3><p>Open the website in Safari, tap the Share button, then choose <strong>Add to Home Screen</strong> and confirm.</p><h3>Why install?</h3><p>The app opens in its own window and keeps a network-first offline copy of the main site for unreliable connections. Live login, ordering and reservations still need an internet connection.</p></div>`
  },
  terms: {
    title: "Terms of use",
    eyebrow: "The practical details",
    intro: "Terms for using the Oreo's Cafe website and placing requests or orders.",
    body: `<div class="panel-card"><h2>Orders</h2><p>An online order is received as pending. The cafe may contact you to confirm availability, timing and details. Prices and totals are shown before you place the order. Paying at the cafe and cash on delivery are the available payment methods; this website does not process card payments.</p><h3>Pickup and delivery</h3><p>Pickup is from 12 Garden Road during opening hours. Delivery availability, fees and timing depend on the address and are confirmed by the cafe. Please provide accurate contact and delivery information.</p><h3>Table requests</h3><p>A reservation request does not guarantee a table. Your booking is confirmed only when the cafe contacts you. Calendar files are reminders, not confirmation.</p><h3>Accounts and acceptable use</h3><p>You are responsible for your account credentials and for lawful use of the site. Do not attempt to access another customer's information or the administrator dashboard.</p><h3>Product information</h3><p>Recipes and availability can change. Contact the cafe about allergies before ordering; notes in checkout are not a guarantee against cross-contact.</p></div>`
  },
  privacy: {
    title: "Privacy policy",
    eyebrow: "Your information",
    intro: "What the website stores and why. Last updated 22 October 2026.",
    body: `<div class="panel-card"><h2>Information you provide</h2><p>If you create an account, Firebase Authentication processes your name, email address and sign-in method. If you order or request a table, the details you enter are stored in Cloud Firestore so the cafe can manage that request. Order details can include your phone number, delivery address, selected products and total.</p><h3>Browser storage</h3><p>The site uses local browser storage for your cart, favourites, theme and display preferences. You can clear this through your browser settings. Demo orders created before Firebase is configured stay only in that browser.</p><h3>Email and service providers</h3><p>Reservation details are emailed to the cafe through a deployed Firebase Cloud Function and the configured email provider. Google sign-in is provided through Firebase Authentication. Their own privacy terms also apply.</p><h3>Payment details</h3><p>This website does not request, process or store card numbers, expiry dates or security codes.</p><h3>Your choices</h3><p>You can order as a guest without creating an account. To request access, correction or deletion of your information, contact <a href="mailto:hello@oreoscafe.com">hello@oreoscafe.com</a>. Operational and legal records may need to be retained where necessary.</p></div>`
  }
};
const requested = new URLSearchParams(location.search).get("page") || "story";
const page = pages[requested] || pages.story;
document.title = page.title + " — Oreo's Cafe";
document.getElementById("infoContent").innerHTML = `<div class="subpage-head"><span class="eyebrow">${page.eyebrow}</span><h1>${page.title}</h1><p>${page.intro}</p></div>${page.body}`;
