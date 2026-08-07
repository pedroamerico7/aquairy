const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY || !env.INQUIRY_TO_EMAIL || !env.RESEND_FROM_EMAIL || !env.TURNSTILE_SECRET_KEY) {
    console.error("Inquiry configuration is incomplete.", {
      hasResendKey: Boolean(env.RESEND_API_KEY),
      hasRecipient: Boolean(env.INQUIRY_TO_EMAIL),
      hasSender: Boolean(env.RESEND_FROM_EMAIL),
      hasTurnstileSecret: Boolean(env.TURNSTILE_SECRET_KEY)
    });
    return json({ error: "The inquiry service is not configured yet." }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ error: "Invalid request format." }, 415);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (clean(input.website, 200)) return json({ ok: true });

  const name = clean(input.name, 100);
  const email = clean(input.email, 160).toLowerCase();
  const company = clean(input.company, 120);
  const offer = clean(input.offer, 30);
  const message = clean(input.message, 3000);
  const turnstileToken = clean(input.turnstileToken, 2048);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || !emailPattern.test(email) || !message) {
    return json({ error: "Please provide a valid name, email and message." }, 400);
  }

  if (!turnstileToken) {
    return json({ error: "Please complete the security verification." }, 400);
  }

  let verification;
  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get("CF-Connecting-IP") || undefined,
        idempotency_key: crypto.randomUUID()
      })
    });
    verification = await verifyResponse.json();
  } catch {
    return json({ error: "Security verification is temporarily unavailable." }, 503);
  }

  const allowedHostnames = new Set(["aquairy.com", "www.aquairy.com"]);
  if (!verification.success || verification.action !== "inquiry" || !allowedHostnames.has(verification.hostname)) {
    console.error("Turnstile rejected inquiry:", verification);
    return json({ error: "Security verification failed. Please try again." }, 400);
  }

  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    company: escapeHtml(company || "Not provided"),
    offer: escapeHtml(offer || "Not provided"),
    message: escapeHtml(message).replaceAll("\n", "<br>")
  };

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.INQUIRY_TO_EMAIL],
        reply_to: email,
        subject: `Aquairy.com acquisition inquiry — ${name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#0b1f33"><h1 style="font-size:24px">New Aquairy.com inquiry</h1><p><strong>Name:</strong> ${safe.name}</p><p><strong>Email:</strong> ${safe.email}</p><p><strong>Company:</strong> ${safe.company}</p><p><strong>Offer:</strong> ${safe.offer}</p><hr style="border:0;border-top:1px solid #dce7eb"><p><strong>Message</strong></p><p>${safe.message}</p></div>`,
        text: `New Aquairy.com inquiry\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || "Not provided"}\nOffer: ${offer || "Not provided"}\n\nMessage:\n${message}`,
        tags: [{ name: "source", value: "aquairy_inquiry" }]
      })
    });
  } catch (error) {
    console.error("Resend request failed:", error);
    return json({ error: "The message could not be sent. Please try again shortly." }, 502);
  }

  if (!response.ok) {
    const providerError = await response.text().catch(() => "");
    console.error("Resend rejected inquiry:", response.status, providerError);
    return json({ error: "The message could not be sent. Please try again shortly." }, 502);
  }

  return json({ ok: true });
}

export function onRequestGet() {
  return json({ error: "Method not allowed." }, 405);
}
