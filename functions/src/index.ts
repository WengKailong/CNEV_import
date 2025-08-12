import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import corsFactory from 'cors';

admin.initializeApp();
const db = admin.firestore();
const cors = corsFactory({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGIN || (functions.config().cors?.origin ?? ''))
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
});

// ---- reCAPTCHA 开关 & 配置 ----
const recaptchaEnabled =
  (process.env.RECAPTCHA_ENABLED ?? functions.config().recaptcha?.enabled ?? 'true') === 'true';

async function verifyRecaptcha(token: string) {
  if (!recaptchaEnabled) return; // 关闭时直接跳过校验
  const secret = process.env.RECAPTCHA_SECRET || functions.config().recaptcha?.secret;
  if (!secret) {
    throw new Error('Missing reCAPTCHA secret');
  }
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`
  });
  const data = await res.json();
  const threshold = Number(process.env.RECAPTCHA_THRESHOLD || functions.config().recaptcha?.threshold || 0.5);
  if (!data.success || (typeof data.score === 'number' && data.score < threshold)) {
    throw new Error('Failed reCAPTCHA');
  }
}

export const submitLead = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

      const {
        firstName, lastName, email, phone, country,
        preferredLanguage, modelId, modelName, budget,
        message, gdprConsent, utm, recaptchaToken
      } = req.body || {};

      if (!gdprConsent) return res.status(400).json({ error: 'GDPR consent required' });
      if (!email || !firstName || !lastName || !modelId) return res.status(400).json({ error: 'Missing required fields' });

      // 仅在开启 reCAPTCHA 时强制需要 token
      if (recaptchaEnabled) {
        if (!recaptchaToken) return res.status(400).json({ error: 'Missing reCAPTCHA token' });
        await verifyRecaptcha(recaptchaToken);
      }

      const doc = {
        firstName, lastName, email, phone, country,
        preferredLanguage: preferredLanguage || 'en',
        modelId, modelName, budget: budget || null,
        message: message || '', gdprConsent: true,
        utm: utm || null, createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      const ref = await db.collection('leads').add(doc);

      // Brevo 邮件提醒
      const apiKey = process.env.BREVO_KEY || functions.config().brevo?.key;
      const to = process.env.MAIL_TO || functions.config().mail?.to;
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          to: [{ email: to }],
          sender: { name: 'EV Sales Bot', email: 'no-reply@yourdomain.eu' },
          subject: `New Lead: ${firstName} ${lastName} - ${modelName || modelId}`,
          htmlContent: `
            <h3>New lead</h3>
            <p><b>Name:</b> ${firstName} ${lastName}</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Phone:</b> ${phone || ''}</p>
            <p><b>Country:</b> ${country || ''}</p>
            <p><b>Language:</b> ${preferredLanguage || 'en'}</p>
            <p><b>Model:</b> ${modelName || modelId}</p>
            <p><b>Budget:</b> ${budget || ''}</p>
            <p><b>Message:</b> ${message || ''}</p>
            <p><b>UTM:</b> ${JSON.stringify(utm || {})}</p>
            <p><b>DocID:</b> ${ref.id}</p>
          `
        })
      });

      res.status(200).json({ ok: true, id: ref.id });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e?.message || 'Bad Request' });
    }
  });
});
