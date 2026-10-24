/* Firebase Auth + Firestore adapter used by every page. */
(function () {
  "use strict";

  const config = window.firebaseConfig || {};
  const configured = Boolean(
    window.firebase &&
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !Object.values(config).some((value) =>
      String(value).includes("YOUR_")
    )
  );

  const productListeners = new Set();
  const authListeners = new Set();

  let products = window.OreoData.DEFAULT_PRODUCTS.slice();
  let productStatus = configured ? "loading" : "demo";
  let currentUser = null;
  let currentIsAdmin = false;
  let auth = null;
  let db = null;
  let authSettled = false;
  let authSequence = 0;
  let resolveAuthReady;

  const authReady = new Promise((resolve) => {
    resolveAuthReady = resolve;
  });

  function notifyProducts() {
    productListeners.forEach((listener) => {
      try {
        listener(products.slice(), productStatus);
      } catch (error) {
        console.error(error);
      }
    });
  }

  async function adminStatus(user) {
    if (!user || !db) return false;

    try {
      const adminDocument = await db
        .collection("admins")
        .doc(user.uid)
        .get();

      const data = adminDocument.exists
        ? adminDocument.data()
        : null;

      return Boolean(data && data.active === true);
    } catch (error) {
      console.warn(
        "Administrator role could not be loaded:",
        error.message
      );
      return false;
    }
  }

  async function notifyAuth(user) {
    const sequence = ++authSequence;
    const nextUser = user || null;
    const nextIsAdmin = await adminStatus(nextUser);

    if (sequence !== authSequence) return;

    currentUser = nextUser;
    currentIsAdmin = nextIsAdmin;
    authSettled = true;
    resolveAuthReady(currentUser);

    authListeners.forEach((listener) => {
      try {
        listener(currentUser, currentIsAdmin);
      } catch (error) {
        console.error(error);
      }
    });

    window.dispatchEvent(
      new CustomEvent("oreo:authchange", {
        detail: {
          user: currentUser,
          isAdmin: currentIsAdmin
        }
      })
    );
  }

  if (configured) {
    try {
      firebase.initializeApp(config);
      auth = firebase.auth();
      db = firebase.firestore();

      auth.onAuthStateChanged(
        notifyAuth,
        () => notifyAuth(null)
      );

      db.collection("products")
        .orderBy("createdAt", "asc")
        .onSnapshot(
          (snapshot) => {
            if (!snapshot.empty) {
              products = snapshot.docs
                .map((doc) =>
                  window.OreoData.normalize(
                    { ...doc.data(), id: doc.id },
                    doc.id
                  )
                )
                .filter(
                  (product) => product.available !== false
                );
            } else {
              products =
                window.OreoData.DEFAULT_PRODUCTS.slice();
            }

            productStatus = snapshot.empty
              ? "demo"
              : "live";

            notifyProducts();
          },
          (error) => {
            console.warn(
              "Using the built-in menu:",
              error.message
            );
            productStatus = "demo";
            notifyProducts();
          }
        );
    } catch (error) {
      console.error("Firebase could not start:", error);
      productStatus = "demo";
      notifyAuth(null);
    }
  } else {
    productStatus = "demo";
    setTimeout(() => notifyAuth(null), 0);
  }

  function onProducts(listener) {
    productListeners.add(listener);
    listener(products.slice(), productStatus);

    return () => productListeners.delete(listener);
  }

  function onAuth(listener) {
    authListeners.add(listener);

    if (authSettled) {
      listener(currentUser, currentIsAdmin);
    }

    return () => authListeners.delete(listener);
  }

  async function signIn(email, password) {
    if (!auth) {
      throw new Error(
        "Firebase is not configured yet. Add your web app details in firebase-config.js."
      );
    }

    return auth.signInWithEmailAndPassword(
      email,
      password
    );
  }

  async function signUp(name, email, password) {
    if (!auth) {
      throw new Error(
        "Firebase is not configured yet. Add your web app details in firebase-config.js."
      );
    }

    const credential =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );

    await credential.user.updateProfile({
      displayName: name
    });

    await db.collection("users")
      .doc(credential.user.uid)
      .set(
        {
          name,
          email,
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt:
            firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    try {
      await credential.user.sendEmailVerification();
    } catch (error) {
      console.warn(
        "Verification email:",
        error.message
      );
    }

    return credential;
  }

  async function signInWithGoogle() {
    if (!auth) {
      throw new Error(
        "Firebase is not configured yet. Add your web app details in firebase-config.js."
      );
    }

    const provider =
      new firebase.auth.GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: "select_account"
    });

    const credential =
      await auth.signInWithPopup(provider);

    if (credential.user) {
      await db.collection("users")
        .doc(credential.user.uid)
        .set(
          {
            name:
              credential.user.displayName ||
              "Cafe guest",
            email: credential.user.email || "",
            lastLoginAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
    }

    return credential;
  }

  async function resetPassword(email) {
    if (!auth) {
      throw new Error(
        "Firebase is not configured yet."
      );
    }

    return auth.sendPasswordResetEmail(email);
  }

  async function resendVerification() {
    if (!auth || !auth.currentUser) {
      throw new Error("Please sign in first.");
    }

    return auth.currentUser.sendEmailVerification();
  }

  async function signOut() {
    if (auth) {
      await auth.signOut();
    }
  }

  function localId(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()
    );
  }

  async function createOrder(order) {
    const orderNumber =
      "OC-" + String(Date.now()).slice(-7);

    const payload = {
      ...order,
      orderNumber,
      status: "pending",
      userId: currentUser ? currentUser.uid : "",
      createdAt: new Date().toISOString()
    };

    if (!db) {
      const id = localId("LOCAL");

      try {
        const existing = JSON.parse(
          localStorage.getItem(
            "oc-local-orders"
          ) || "[]"
        );

        existing.unshift({
          ...payload,
          id,
          local: true
        });

        localStorage.setItem(
          "oc-local-orders",
          JSON.stringify(existing.slice(0, 20))
        );
      } catch (error) {
        // Still return a local reference.
      }

      return {
        id,
        orderNumber,
        local: true
      };
    }

    const data = {
      ...payload,
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    };

    const reference =
      await db.collection("orders").add(data);

    return {
      id: reference.id,
      orderNumber,
      local: false
    };
  }

  async function createReservation(reservation) {
    if (!db) {
      throw new Error(
        "Firebase is not configured yet."
      );
    }

    const payload = {
      ...reservation,
      status: "pending",
      emailStatus: "browser",
      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    };

    const reference = await db
      .collection("reservations")
      .add(payload);

    try {
      if (!window.OreoEmail) {
        throw new Error(
          "email.js must be loaded before firebase-service.js."
        );
      }

      await window.OreoEmail.send(
        "New Oreo's Cafe table request",
        {
          "Customer name": reservation.name,
          "Email": reservation.email,
          "_replyto": reservation.email,
          "Phone": reservation.phone,
          "Date": reservation.date,
          "Time": reservation.time,
          "Guests": reservation.guests,
          "Notes": reservation.notes || "None",
          "Reservation ID": reference.id
        }
      );

      return {
        id: reference.id,
        emailStatus: "submitted"
      };
    } catch (error) {
      console.warn(
        "Reservation saved, but email failed:",
        error
      );

      return {
        id: reference.id,
        emailStatus: "failed"
      };
    }
  }

  async function createMessage(message) {
    if (!db) {
      throw new Error(
        "Firebase is not configured yet."
      );
    }

    const reference = await db
      .collection("messages")
      .add({
        ...message,
        status: "new",
        emailStatus: "browser",
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

    const typeLabel =
      message.type === "complaint"
        ? "Customer complaint"
        : "Website contact message";

    try {
      if (!window.OreoEmail) {
        throw new Error(
          "email.js must be loaded before firebase-service.js."
        );
      }

      await window.OreoEmail.send(
        `${typeLabel}: ${message.subject}`,
        {
          "Message type": typeLabel,
          "Name": message.name,
          "Email": message.email,
          "_replyto": message.email,
          "Phone":
            message.phone || "Not provided",
          "Order number":
            message.orderNumber ||
            "Not provided",
          "Message": message.message,
          "Message ID": reference.id
        }
      );

      return {
        id: reference.id,
        emailStatus: "submitted"
      };
    } catch (error) {
      console.warn(
        "Message saved, but email failed:",
        error
      );

      return {
        id: reference.id,
        emailStatus: "failed"
      };
    }
  }

  function onUserOrders(listener) {
    if (!db || !currentUser) {
      listener([]);
      return () => {};
    }

    return db.collection("orders")
      .where("userId", "==", currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          const orders = snapshot.docs.map(
            (doc) => ({
              ...doc.data(),
              id: doc.id
            })
          );

          orders.sort(
            (a, b) =>
              dateValue(b.createdAt) -
              dateValue(a.createdAt)
          );

          listener(orders);
        },
        (error) => {
          console.error(error);
          listener([]);
        }
      );
  }

  function dateValue(value) {
    if (!value) return 0;

    if (
      typeof value.toDate === "function"
    ) {
      return value.toDate().getTime();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 0
      : date.getTime();
  }

  function onAdminCollection(
    collectionName,
    listener
  ) {
    if (!db || !currentIsAdmin) {
      listener([]);
      return () => {};
    }

    return db.collection(collectionName)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          listener(
            snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id
            }))
          );
        },
        (error) => {
          console.error(
            "Could not load " +
              collectionName +
              ":",
            error
          );

          window.dispatchEvent(
            new CustomEvent(
              "oreo:adminerror",
              {
                detail: {
                  message: error.message
                }
              }
            )
          );
        }
      );
  }

  async function saveProduct(product, id) {
    if (!db || !currentIsAdmin) {
      throw new Error(
        "Administrator access is required."
      );
    }

    const clean =
      window.OreoData.normalize({
        ...product,
        id: id || product.id
      });

    delete clean.createdAt;

    clean.updatedAt =
      firebase.firestore.FieldValue.serverTimestamp();

    if (id) {
      await db.collection("products")
        .doc(id)
        .set(clean, { merge: true });

      return id;
    }

    delete clean.id;

    clean.createdAt =
      firebase.firestore.FieldValue.serverTimestamp();

    const reference = await db
      .collection("products")
      .add(clean);

    return reference.id;
  }

  async function deleteProduct(id) {
    if (!db || !currentIsAdmin) {
      throw new Error(
        "Administrator access is required."
      );
    }

    return db.collection("products")
      .doc(id)
      .delete();
  }

  async function seedProducts() {
    if (!db || !currentIsAdmin) {
      throw new Error(
        "Administrator access is required."
      );
    }

    const batch = db.batch();

    window.OreoData.DEFAULT_PRODUCTS.forEach(
      (product) => {
        const data = { ...product };
        const id = data.id;

        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;

        data.createdAt =
          firebase.firestore.FieldValue.serverTimestamp();

        data.updatedAt =
          firebase.firestore.FieldValue.serverTimestamp();

        batch.set(
          db.collection("products").doc(id),
          data
        );
      }
    );

    return batch.commit();
  }

  async function updateStatus(
    collectionName,
    id,
    status
  ) {
    if (!db || !currentIsAdmin) {
      throw new Error(
        "Administrator access is required."
      );
    }

    const allowed =
      collectionName === "orders"
        ? [
            "pending",
            "preparing",
            "ready",
            "fulfilled",
            "cancelled"
          ]
        : [
            "pending",
            "confirmed",
            "cancelled"
          ];

    if (!allowed.includes(status)) {
      throw new Error("Unsupported status.");
    }

    return db.collection(collectionName)
      .doc(id)
      .update({
        status,
        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });
  }

  window.OreoFirebase = {
  get configured() {
    return configured && Boolean(db);
  },

  get user() {
    return currentUser;
  },

  get isAdmin() {
    return currentIsAdmin;
  },

  get products() {
    return products.slice();
  },

  authReady,
  onProducts,
  onAuth,
  signIn,
  signUp,
  signInWithGoogle,
  resetPassword,
  resendVerification,
  signOut,
  createOrder,
  createReservation,
  createMessage,
  onUserOrders,
  onAdminCollection,
  saveProduct,
  deleteProduct,
  seedProducts,
  updateStatus,
  dateValue,
  localId
};
})();