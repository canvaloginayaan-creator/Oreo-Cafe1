"use strict";

const params = new URLSearchParams(location.search);
const panel = document.getElementById("messagePanel");

if (params.get("page") === "contact") {
  panel.hidden = false;

  const form = document.getElementById("messageForm");
  const status = document.getElementById("messageStatus");
  const button = document.getElementById("messageSubmit");

  if (params.get("type") === "complaint") {
    form.elements.namedItem("type").value = "complaint";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fields = form.elements;

    button.disabled = true;
    button.textContent = "Sending…";
    status.classList.remove("error");
    status.textContent = "";

    const message = {
      type: fields.namedItem("type").value,
      name: fields.namedItem("name").value.trim(),
      email: fields.namedItem("email").value.trim(),
      phone: fields.namedItem("phone").value.trim(),
      orderNumber: fields.namedItem("orderNumber").value.trim(),
      subject: fields.namedItem("subject").value.trim(),
      message: fields.namedItem("message").value.trim(),
      source: "website"
    };

    try {
      const result =
        await window.OreoFirebase.createMessage(message);

      if (result.emailStatus === "failed") {
        status.classList.add("error");
        status.textContent =
          "Your message was saved, but the email could not be sent.";
      } else {
        form.reset();
        status.textContent =
          "Your message was sent to the cafe.";
      }
    } catch (error) {
      status.classList.add("error");
      status.textContent =
        "Could not send your message. " + error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Send message";
    }
  });
}