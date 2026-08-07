const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const clean = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.INQUIRY_TO_EMAIL) {
    console.error('Inquiry email configuration is incomplete.');
    return json({ error: 'Inquiry service is temporarily unavailable.' }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Hidden field: silently accept bot submissions without sending email.
  if (clean(input.website, 200)) {
    return json({ ok: true });
  }

  const inquiryType = clean(input.inquiry_type, 20) === 'Question' ? 'Question' : 'Offer';
  const name = clean(input.name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const company = clean(input.company, 160);
  const message = clean(input.message, 4000);
  const rawAmount = clean(input.offer_amount_usd, 32).replace(/[^0-9.]/g, '');
  const amount = Number(rawAmount);

  if (!name || !validEmail(email)) {
    return json({ error: 'Please provide a valid name and email.' }, 400);
  }

  if (inquiryType === 'Offer' && (!Number.isFinite(amount) || amount <= 0)) {
    return json({ error: 'Please provide a valid offer amount.' }, 400);
  }

  const reference = `JAI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const offerLabel = inquiryType === 'Offer'
    ? `$${Math.round(amount).toLocaleString('en-US')}`
    : 'Not applicable';
  const subject = inquiryType === 'Offer'
    ? `New JusticiAI offer — ${offerLabel}`
    : 'New JusticiAI acquisition inquiry';

  const text = [
    `New ${inquiryType.toLowerCase()} for JusticiAI.com`,
    `Reference: ${reference}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || 'Not provided'}`,
    `Offer: ${offerLabel}`,
    `Message: ${message || 'No message provided.'}`
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171717">
      <h1 style="font-size:24px">New ${escapeHtml(inquiryType.toLowerCase())} for JusticiAI.com</h1>
      <p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Company:</strong> ${escapeHtml(company || 'Not provided')}</p>
      <p><strong>Offer:</strong> ${escapeHtml(offerLabel)}</p>
      <p><strong>Message:</strong><br>${escapeHtml(message || 'No message provided.').replaceAll('\n', '<br>')}</p>
    </div>`;

  let resendResponse;
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.INQUIRY_TO_EMAIL],
        reply_to: email,
        subject,
        text,
        html
      })
    });
  } catch (error) {
    console.error('Resend request failed:', error);
    return json({ error: 'Unable to submit your inquiry. Please try again.' }, 502);
  }

  if (!resendResponse.ok) {
    const providerError = await resendResponse.text().catch(() => '');
    console.error('Resend rejected inquiry:', resendResponse.status, providerError);
    return json({ error: 'Unable to submit your inquiry. Please try again.' }, 502);
  }

  return json({ ok: true, reference });
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, 405);
}
