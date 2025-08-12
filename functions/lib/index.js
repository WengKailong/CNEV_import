// Gen2 / Node 20 / CommonJS 构建，不使用 functions.config()
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import corsFactory from 'cors';
initializeApp();
const db = getFirestore();
setGlobalOptions({
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 60,
});
// CORS：从环境变量读取（逗号分隔）
const cors = corsFactory({
    origin: (origin, cb) => {
        const originStr = process.env.CORS_ORIGIN || '';
        const allowed = originStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!origin || allowed.includes(origin))
            return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
});
// reCAPTCHA 开关与配置，都从环境变量读取
const recaptchaEnabled = (process.env.RECAPTCHA_ENABLED ?? 'true') === 'true';
async function verifyRecaptcha(token) {
    if (!recaptchaEnabled)
        return;
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret)
        throw new Error('Missing reCAPTCHA secret');
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = (await resp.json());
    const threshold = Number(process.env.RECAPTCHA_THRESHOLD ?? 0.5);
    if (!data.success || (typeof data.score === 'number' && data.score < threshold)) {
        throw new Error('Failed reCAPTCHA');
    }
}
export const submitLead = onRequest(async (req, res) => {
    await new Promise((resolve) => cors(req, res, async () => {
        try {
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return resolve();
            }
            const { firstName, lastName, email, phone, country, preferredLanguage, modelId, modelName, budget, message, gdprConsent, utm, recaptchaToken, } = (req.body || {});
            if (!gdprConsent) {
                res.status(400).json({ error: 'GDPR consent required' });
                return resolve();
            }
            if (!email || !firstName || !lastName || !modelId) {
                res.status(400).json({ error: 'Missing required fields' });
                return resolve();
            }
            if (recaptchaEnabled) {
                if (!recaptchaToken) {
                    res.status(400).json({ error: 'Missing reCAPTCHA token' });
                    return resolve();
                }
                await verifyRecaptcha(recaptchaToken);
            }
            const doc = {
                firstName, lastName, email,
                phone: phone || '', country: country || '',
                preferredLanguage: preferredLanguage || 'en',
                modelId, modelName: modelName || '',
                budget: budget ?? null, message: message || '',
                gdprConsent: true, utm: utm || null,
                createdAt: FieldValue.serverTimestamp(),
            };
            const ref = await db.collection('leads').add(doc);
            // Brevo 邮件提醒（从环境变量读取；缺任何一项就跳过）
            const apiKey = process.env.BREVO_KEY;
            const to = process.env.MAIL_TO;
            if (apiKey && to) {
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
              `,
                    }),
                });
            }
            else {
                console.warn('BREVO_KEY or MAIL_TO missing; skip email notify');
            }
            res.status(200).json({ ok: true, id: ref.id });
            resolve();
        }
        catch (e) {
            console.error(e);
            res.status(400).json({ error: e?.message || 'Bad Request' });
            resolve();
        }
    }));
});
