# Enquiry endpoint — setup

**The contact form is not delivering enquiries by email yet.** One environment
variable in Vercel switches it on. Until then it falls back to opening the
visitor's mail client, which is what it did before — see *Why this matters*.

## Turn it on (about two minutes)

1. Create an account with one of the providers below and get an API key.
2. In Vercel: **Project → Settings → Environment Variables**, add the key,
   apply it to *Production* (and *Preview* if you want to test there).
3. Redeploy. That's it — no code change.

### Pick one

| Variable | Provider | Notes |
|---|---|---|
| `RESEND_API_KEY` | [Resend](https://resend.com) | Simplest. Free tier covers a small site comfortably. **Recommended.** |
| `SENDGRID_API_KEY` | SendGrid | Use if you already have an account. |
| `POSTMARK_TOKEN` | Postmark | Strong deliverability; paid. |
| `ENQUIRY_FORWARD_URL` | any webhook | Posts the enquiry as JSON to Zapier, Make, a CRM or Slack instead of emailing. |

If more than one is set, they are tried in the order above.

### Optional

| Variable | Default | Purpose |
|---|---|---|
| `ENQUIRY_TO` | `sales@kneoautomation.com` | Where enquiries are delivered. |
| `ENQUIRY_FROM` | `website@kneoautomation.com` | The `From:` address. **Must be a sender your provider has verified**, otherwise mail is rejected or lands in spam. |

Every provider requires you to verify the sending domain before it will send
as `@kneoautomation.com`. That is a DNS change (SPF/DKIM records) and it is the
step most likely to trip you up — do it before you test.

## Checking it works

After deploying with a key set, send a test enquiry through `/contact/`.

- **"Thank you — your enquiry has been received."** → delivered.
- **Your mail client opens instead** → the endpoint returned 501, meaning no
  provider key is configured. Check the variable name and that you redeployed
  after adding it.
- **"We could not reach the server…"** → the function itself errored. Check the
  Vercel function logs; the handler logs the provider's own error message.

## Why this matters

The form previously had no backend at all. It built a `mailto:` link and handed
the visitor to their own mail client. On webmail, a locked-down corporate
desktop, or a phone with no mail account set up, pressing **Send** did nothing
at all — and because the browser never reports that, the enquiry vanished
without either side knowing. That is a delivery problem, not a conversion-rate
problem, and no amount of extra form fields or better copy fixes it.

The mail-client handoff is deliberately kept as a fallback so the form is never
worse off than it was. But while it is the *only* path, an unknown share of
enquiries are being lost silently.

## What gets sent

Only these fields are read; anything else the browser posts is ignored, so a
tampered form cannot inject content into the email:

`name`, `company`, `email`, `phone`, `country`, `requirement`, `stage`,
`timeline`, `controllers`, `message`, `page`

`name`, `email` and `message` are required. `company_website` is a honeypot —
if it has any value the request is silently accepted and discarded, because
only a bot can see it.
