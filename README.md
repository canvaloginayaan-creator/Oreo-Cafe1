# Oreo's Cafe

Plain HTML/CSS/JavaScript cafe storefront with Firebase Authentication, Cloud Firestore, customer checkout and a full admin dashboard.

- Website and setup guide: [`demo/demo/README.md`](demo/demo/README.md)
- Storefront: [`demo/demo/index.html`](demo/demo/index.html)
- Admin panel: [`demo/demo/admin.html`](demo/demo/admin.html)
- Firebase web configuration: [`demo/demo/firebase-config.js`](demo/demo/firebase-config.js)
- Firestore security rules: [`firestore.rules`](firestore.rules)
- Reservation email Cloud Function: [`functions/index.js`](functions/index.js)

## Local preview

```bash
cd demo/demo
python3 -m http.server 3000
```

No React, Tailwind or website build step is used. Read the setup guide before enabling live authentication, orders and reservation emails.
