/* Enquiry endpoint.
 *
 * WHY THIS EXISTS. The contact form previously had no backend at all: it built
 * a mailto: link and handed the visitor off to their own mail client. For
 * anyone on webmail, a locked-down corporate desktop, or a phone with no mail
 * account configured, pressing Send did nothing whatsoever - and because the
 * browser never reported it, an enquiry could be lost without either side
 * knowing. That is not a conversion rate problem, it is a delivery problem,
 * and no amount of extra form fields fixes it.
 *
 * DESIGN. Deliberately provider-agnostic. Whichever of these is configured in
 * the Vercel project's environment variables is the one that gets used:
 *
 *   RESEND_API_KEY            Resend  (simplest: one key, nothing else)
 *   SENDGRID_API_KEY          SendGrid
 *   POSTMARK_TOKEN            Postmark
 *   ENQUIRY_FORWARD_URL       any webhook - Zapier, Make, a CRM, Slack
 *
 * Plus, optionally:
 *   ENQUIRY_TO                where enquiries land   (default sales@kneoautomation.com)
 *   ENQUIRY_FROM             the From: address       (must be a verified sender)
 *
 * With none of them set the endpoint answers 501 and the browser falls back to
 * the old mail-client behaviour, so the form is never worse off than before.
 */

const TO_DEFAULT   = 'sales@kneoautomation.com';
const FROM_DEFAULT = 'website@kneoautomation.com';

/* Fields we accept. Anything else the browser sends is ignored rather than
   forwarded, so a tampered form cannot inject arbitrary content into the
   email. */
const FIELDS = [
  ['name',            'Name'],
  ['company',         'Company'],
  ['email',           'Work email'],
  ['phone',           'Phone'],
  ['country',         'Country / plant location'],
  ['requirement',     'Requirement'],
  ['stage',           'Project stage'],
  ['timeline',        'Timeline'],
  ['controllers',     'Existing controls'],
  ['message',         'Project details'],
  ['page',            'Enquiry sent from'],
];

const MAX = 4000;          // per field, after which we truncate rather than reject

function clean(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\r\n/g, '\n').trim().slice(0, MAX);
}

function looksLikeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;       // already parsed
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  // multipart/form-data is what FormData sends; parse the simple text parts.
  const boundary = (type.match(/boundary=(?:"([^"]+)"|([^;]+))/) || [])[1]
                || (type.match(/boundary=(?:"([^"]+)"|([^;]+))/) || [])[2];
  if (boundary) {
    const out = {};
    for (const part of raw.split('--' + boundary)) {
      const m = part.match(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n?$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  }
  // urlencoded
  const out = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    out[decodeURIComponent(k.replace(/\+/g, ' '))] =
      decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

async function send(subject, text, replyTo) {
  const to   = process.env.ENQUIRY_TO   || TO_DEFAULT;
  const from = process.env.ENQUIRY_FROM || FROM_DEFAULT;

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return 'resend';
  }

  if (process.env.SENDGRID_API_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    if (!r.ok) throw new Error(`SendGrid ${r.status}: ${await r.text()}`);
    return 'sendgrid';
  }

  if (process.env.POSTMARK_TOKEN) {
    const r = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, ReplyTo: replyTo }),
    });
    if (!r.ok) throw new Error(`Postmark ${r.status}: ${await r.text()}`);
    return 'postmark';
  }

  if (process.env.ENQUIRY_FORWARD_URL) {
    const r = await fetch(process.env.ENQUIRY_FORWARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, text, replyTo, to }),
    });
    if (!r.ok) throw new Error(`Forward ${r.status}`);
    return 'webhook';
  }

  return null;                     // nothing configured
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  let body;
  try { body = await readBody(req); }
  catch { res.status(400).json({ ok: false, error: 'Malformed request' }); return; }

  /* Honeypot. A real person never sees this field, so anything in it is a bot.
     Answer 200 so the bot believes it succeeded and does not retry. */
  if (clean(body.company_website)) { res.status(200).json({ ok: true }); return; }

  const name    = clean(body.name);
  const email   = clean(body.email);
  const message = clean(body.message);

  const missing = [];
  if (!name) missing.push('name');
  if (!email) missing.push('email');
  if (!message) missing.push('message');
  if (missing.length) {
    res.status(400).json({ ok: false, error: `Missing: ${missing.join(', ')}` });
    return;
  }
  if (!looksLikeEmail(email)) {
    res.status(400).json({ ok: false, error: 'That email address does not look valid.' });
    return;
  }

  const lines = [];
  for (const [key, label] of FIELDS) {
    const v = clean(body[key]);
    if (v) lines.push(`${label}: ${v}`);
  }
  lines.push('', `Received: ${new Date().toISOString()}`);

  const subject = `Website enquiry — ${clean(body.requirement) || 'General'} — ${
    clean(body.company) || name}`;

  let via;
  try {
    via = await send(subject, lines.join('\n'), email);
  } catch (err) {
    console.error('[enquiry] send failed:', err && err.message);
    res.status(502).json({ ok: false, error: 'Could not deliver the enquiry.' });
    return;
  }

  if (!via) {
    /* No provider configured yet. Say so honestly so the browser can fall back
       to the mail client rather than telling the visitor it was sent. */
    console.warn('[enquiry] no email provider configured — set RESEND_API_KEY (or another) in Vercel');
    res.status(501).json({ ok: false, error: 'No mail provider configured' });
    return;
  }

  console.log(`[enquiry] delivered via ${via}: ${subject}`);
  res.status(200).json({ ok: true });
}
