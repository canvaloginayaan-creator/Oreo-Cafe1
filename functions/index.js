"use strict";

const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const nodemailer = require("nodemailer");

admin.initializeApp();

const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");
const gmailUser = defineString("GMAIL_USER", { default: "canvalogin.ayaan@gmail.com" });
const cafeRecipient = "canvalogin.ayaan@gmail.com";

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

/**
 * A new website reservation triggers one email to the cafe.
 * Set the secret before deploying:
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 * Optionally set GMAIL_USER if the sender Gmail address changes.
 */
exports.sendReservationEmail = onDocumentCreated({
  document: "reservations/{reservationId}",
  secrets: [gmailAppPassword],
  retry: false
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const reservation = snapshot.data();
  const reservationId = event.params.reservationId;
  const sender = gmailUser.value();
  const text = [
    "New table request from the Oreo's Cafe website",
    "",
    `Name: ${reservation.name || ""}`,
    `Email: ${reservation.email || ""}`,
    `Phone: ${reservation.phone || ""}`,
    `Date: ${reservation.date || ""}`,
    `Time: ${reservation.time || ""}`,
    `Guests: ${reservation.guests || ""}`,
    `Special requests: ${reservation.notes || "None"}`,
    "",
    `Firestore reservation ID: ${reservationId}`
  ].join("\n");
  const rows = [
    ["Name", reservation.name],
    ["Email", reservation.email],
    ["Phone", reservation.phone],
    ["Date", reservation.date],
    ["Time", reservation.time],
    ["Guests", reservation.guests],
    ["Special requests", reservation.notes || "None"]
  ];
  const html = `<!doctype html><html><body style="margin:0;padding:28px;background:#f3ebda;font-family:Arial,sans-serif;color:#3b2a1e"><div style="max-width:560px;margin:auto;padding:28px;border-radius:20px;background:#fffaf0"><h1 style="margin:0 0 8px;font-size:24px">New table request</h1><p style="margin:0 0 22px;color:#8a7762">Oreo's Cafe website</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eadfc9;color:#8a7762;width:145px">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #eadfc9;font-weight:600">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin:22px 0 0;color:#8a7762;font-size:12px">Reservation ID: ${escapeHtml(reservationId)}</p></div></body></html>`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: sender, pass: gmailAppPassword.value() }
    });
    await transporter.sendMail({
      from: `Oreo's Cafe Reservations <${sender}>`,
      to: cafeRecipient,
      replyTo: reservation.email || undefined,
      subject: `Table request: ${reservation.name || "Guest"} — ${reservation.date || ""} at ${reservation.time || ""}`,
      text,
      html
    });
    await snapshot.ref.update({
      emailStatus: "sent",
      emailSentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    logger.info("Reservation email sent", { reservationId });
  } catch (error) {
    logger.error("Reservation email failed", { reservationId, error: error.message });
    await snapshot.ref.update({ emailStatus: "failed" });
    throw error;
  }
});
