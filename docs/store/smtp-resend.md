# Custom SMTP with Resend (Supabase Auth e-mails)

Supabase's built-in e-mail has a low sending limit, fine for testing but not
for launch. Resend has a free tier (Daniel approved it for Phase 8).

The Resend API key is a secret: it goes **straight into the Supabase
dashboard**, never into the chat, the repository or `.env`.

1. Create a Resend account and add the domain `tapstrong.app`
   (Domains → Add domain). Add the DNS records Resend shows (SPF, DKIM, and
   the optional DMARC) at the domain registrar, then wait for "Verified".
2. Resend → API Keys → Create API key, permission "Sending access", domain
   `tapstrong.app`. Copy it.
3. Supabase dashboard → Authentication → Emails → SMTP Settings → Enable
   custom SMTP:
   - Sender email: `no-reply@tapstrong.app`, sender name: `TapStrong`
   - Host: `smtp.resend.com`, port: `465`
   - Username: `resend`
   - Password: paste the API key here.
4. Authentication → Rate Limits: raise "Emails sent per hour" (e.g. 100).
5. Test: in the app, "Save progress" with your own e-mail; the 6-digit code
   should arrive from `no-reply@tapstrong.app`.

The e-mail templates (Magic Link and Change Email, with `{{ .Token }}`) stay
as they are.
