// apps/web/app/[locale]/lead/page.tsx
'use client';

import Script from 'next/script';
import { useCallback, useMemo, useState } from 'react';

type LeadPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  preferredLanguage?: string;
  modelId: string;
  modelName?: string;
  budget?: number | null;
  message?: string;
  gdprConsent: boolean;
  utm?: Record<string, string>;
  recaptchaToken?: string;
};

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export default function LeadPage({ params }: { params: { locale: string } }) {
  const endpoint = process.env.NEXT_PUBLIC_FUNCTION_SUBMIT_LEAD || '';
  const recaptchaEnabled = (process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED ?? 'false') === 'true';
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const defaultLang = useMemo(() => (['en', 'de'].includes(params?.locale) ? params.locale : 'en'), [params?.locale]);

  const [form, setForm] = useState<LeadPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'DE',
    preferredLanguage: defaultLang,
    modelId: '',
    modelName: '',
    budget: undefined,
    message: '',
    gdprConsent: false,
  });

  const models = useMemo(
    () => [
      { id: 'BYD-SEAL', name: 'BYD Seal' },
      { id: 'BYD-ATTO3', name: 'BYD ATTO 3' },
      { id: 'TESLA-M3', name: 'Tesla Model 3 (CN PI)' },
    ],
    []
  );

  const countries = useMemo(
    () => ['DE', 'AT', 'NL', 'BE', 'FR', 'IT', 'ES', 'PL', 'CZ', 'DK', 'SE', 'NO'],
    []
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type, checked } = e.target as HTMLInputElement;
      setForm((f) => ({
        ...f,
        [name]:
          type === 'checkbox'
            ? checked
            : name === 'budget' && value !== ''
              ? Number(value)
              : value,
      }));
    },
    []
  );

  const validate = (f: LeadPayload) => {
    if (!f.firstName.trim()) return 'First name is required';
    if (!f.lastName.trim()) return 'Last name is required';
    if (!f.email.trim() || !/\S+@\S+\.\S+/.test(f.email)) return 'Valid email is required';
    if (!f.modelId) return 'Please select a model';
    if (!f.gdprConsent) return 'GDPR consent is required';
    if (!endpoint) return 'Submit endpoint is not configured';
    return null;
    // NOTE: backend will also validate
  };

  const getRecaptchaToken = async (): Promise<string | undefined> => {
    if (!recaptchaEnabled || !recaptchaSiteKey) return undefined;
    // wait until grecaptcha is ready (script injected below)
    await new Promise<void>((resolve) => {
      const wait = () => {
        if (typeof window !== 'undefined' && window.grecaptcha?.ready) {
          window.grecaptcha.ready(() => resolve());
        } else {
          setTimeout(wait, 50);
        }
      };
      wait();
    });
    return window.grecaptcha!.execute(recaptchaSiteKey, { action: 'lead_submit' });
  };

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setOkMsg(null);
      setErrMsg(null);

      const v = validate(form);
      if (v) {
        setErrMsg(v);
        return;
      }

      setSending(true);
      try {
        const token = await getRecaptchaToken();
        const payload: LeadPayload = {
          ...form,
          preferredLanguage: form.preferredLanguage || defaultLang,
          modelName: form.modelName || (models.find((m) => m.id === form.modelId)?.name ?? ''),
          recaptchaToken: token,
          // naive UTM capture from URL
          utm: Object.fromEntries(new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')),
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data?.error || `Submit failed (${res.status})`);

        setOkMsg('Submitted successfully! ID: ' + (data?.id ?? ''));
        // reset minimal fields
        setForm((f) => ({ ...f, message: '', budget: undefined }));
      } catch (err: any) {
        setErrMsg(err?.message || 'Submit failed');
        console.error(err);
      } finally {
        setSending(false);
      }
    },
    [form, endpoint, defaultLang, models, recaptchaEnabled, recaptchaSiteKey]
  );

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Only inject reCAPTCHA script if explicitly enabled AND site key present */}
      {recaptchaEnabled && recaptchaSiteKey && (
        <Script
          id="recaptcha-v3"
          src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`}
          strategy="afterInteractive"
        />
      )}

      <h1 className="text-2xl font-semibold mb-4">Request a Quote</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col">
            <span>First name *</span>
            <input
              name="firstName"
              value={form.firstName}
              onChange={onChange}
              className="border rounded p-2"
              required
            />
          </label>
          <label className="flex flex-col">
            <span>Last name *</span>
            <input
              name="lastName"
              value={form.lastName}
              onChange={onChange}
              className="border rounded p-2"
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col">
            <span>Email *</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              className="border rounded p-2"
              required
            />
          </label>
          <label className="flex flex-col">
            <span>Phone</span>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              className="border rounded p-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col">
            <span>Country</span>
            <select name="country" value={form.country} onChange={onChange} className="border rounded p-2">
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span>Preferred language</span>
            <select
              name="preferredLanguage"
              value={form.preferredLanguage}
              onChange={onChange}
              className="border rounded p-2"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col">
            <span>Model *</span>
            <select
              name="modelId"
              value={form.modelId}
              onChange={onChange}
              className="border rounded p-2"
              required
            >
              <option value="">Select a model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col">
            <span>Budget (€)</span>
            <input
              type="number"
              inputMode="numeric"
              name="budget"
              value={form.budget ?? ''}
              onChange={onChange}
              className="border rounded p-2"
              placeholder="e.g. 38000"
              min={0}
            />
          </label>
        </div>

        <label className="flex flex-col">
          <span>Message</span>
          <textarea
            name="message"
            value={form.message}
            onChange={onChange}
            className="border rounded p-2"
            rows={4}
            placeholder="Any requirements, timeline, preferred trim, etc."
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="gdprConsent"
            checked={form.gdprConsent}
            onChange={onChange}
            className="h-4 w-4"
            required
          />
          <span>I consent to the processing of my personal data (GDPR).</span>
        </label>

        <button
          type="submit"
          disabled={sending}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
        >
          {sending ? 'Submitting…' : 'Submit'}
        </button>

        {okMsg && <p className="text-green-700">{okMsg}</p>}
        {errMsg && <p className="text-red-600">{errMsg}</p>}

        {/* Dev helpers */}
        <div className="text-xs text-gray-500 mt-4 space-y-1">
          <div>Endpoint: {endpoint || '(not set)'}</div>
          <div>reCAPTCHA: {recaptchaEnabled ? `enabled (${recaptchaSiteKey ? 'key present' : 'missing key'})` : 'disabled'}</div>
        </div>
      </form>
    </div>
  );
}
