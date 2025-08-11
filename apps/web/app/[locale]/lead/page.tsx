'use client';
import { useState } from 'react';
import Script from 'next/script';
import { useParams } from 'next/navigation';

const endpoint = process.env.NEXT_PUBLIC_FUNCTION_SUBMIT_LEAD!;
const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

const dict: any = {
  en: { title: 'Tell us what you need', submit: 'Submit', submitting: 'Submitting...', thanks: 'Thank you! We will get back to you shortly.', fail: 'Submission failed. Please try again.' },
  de: { title: 'Sagen Sie uns, was Sie brauchen', submit: 'Senden', submitting: 'Senden...', thanks: 'Danke! Wir melden uns in Kürze.', fail: 'Senden fehlgeschlagen. Bitte erneut versuchen.' }
};

export default function LeadPage() {
  const params = useParams<{ locale: string }>();
  const locale = (params?.locale as string) || 'en';
  const t = dict[locale] || dict.en;

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  async function getRecaptchaToken() {
    const grecaptcha: any = (window as any).grecaptcha;
    return new Promise<string>((resolve) => {
      if (!grecaptcha) return resolve('');
      grecaptcha.ready(() => {
        grecaptcha.execute(siteKey, { action: 'lead_submit' }).then((token: string) => resolve(token));
      });
    });
  }

  async function submit(formData: FormData) {
    setLoading(true); setOk(null);
    const payload: any = Object.fromEntries(formData.entries());
    const recaptchaToken = await getRecaptchaToken();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        budget: payload.budget ? Number(payload.budget) : null,
        gdprConsent: payload.gdprConsent === 'on',
        recaptchaToken,
        preferredLanguage: locale,
        utm: {
          source: new URLSearchParams(window.location.search).get('utm_source'),
          medium: new URLSearchParams(window.location.search).get('utm_medium'),
          campaign: new URLSearchParams(window.location.search).get('utm_campaign')
        }
      })
    });
    setOk(res.ok);
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="afterInteractive" />
      <h1 className="mb-4 text-2xl font-bold">{t.title}</h1>
      <form action={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input name="firstName" placeholder="First name" className="rounded-xl border p-3" required />
          <input name="lastName" placeholder="Last name" className="rounded-xl border p-3" required />
        </div>
        <input name="email" type="email" placeholder="Email" className="w-full rounded-xl border p-3" required />
        <input name="phone" placeholder="Phone" className="w-full rounded-xl border p-3" />
        <div className="grid grid-cols-2 gap-3">
          <input name="country" placeholder="Country" className="rounded-xl border p-3" />
          <select name="preferredLanguage" className="rounded-xl border p-3" defaultValue={locale}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="modelId" placeholder="Model ID" className="rounded-xl border p-3" required />
          <input name="modelName" placeholder="Model name (optional)" className="rounded-xl border p-3" />
        </div>
        <input name="budget" type="number" placeholder="Budget (EUR)" className="w-full rounded-xl border p-3" />
        <textarea name="message" placeholder="Message" className="w-full rounded-xl border p-3" rows={4} />

        <label className="flex items-start gap-2 text-sm">
          <input name="gdprConsent" type="checkbox" required />
          <span>
            I agree to the processing of my personal data for the purpose of receiving a quotation in accordance with the
            <a className="underline" href="/privacy" target="_blank"> Privacy Policy</a>.
          </span>
        </label>

        <button disabled={loading} className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? t.submitting : t.submit}
        </button>

        {ok === true && <p className="text-green-600">{t.thanks}</p>}
        {ok === false && <p className="text-red-600">{t.fail}</p>}
      </form>
    </main>
  );
}
