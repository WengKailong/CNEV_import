# CNEV_import (Starter)

Monorepo for parallel-import EV sales (Europe). Tech: Next.js (web + admin), Firebase (Firestore + Functions), Brevo (email), reCAPTCHA v3, i18n (en/de).

## Quickstart

```bash
pnpm i
# Functions
cd functions && pnpm i && cd ..
# Web/Admin apps
cd apps/web && pnpm i && cd ../admin && pnpm i && cd ../..
```

Set envs from `.env.example` files. For Functions, set runtime config:

```bash
firebase functions:config:set brevo.key="<BREVO_API_KEY>" mail.to="sales@yourdomain.eu" cors.origin="https://your-web.vercel.app,https://your-admin.vercel.app" recaptcha.secret="<RECAPTCHA_V3_SECRET>" recaptcha.threshold="0.5"
```

## Develop

```bash
pnpm dev:web
pnpm dev:admin
```

Deploy Functions:

```bash
cd functions
pnpm build
firebase deploy --only functions
```
