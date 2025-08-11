'use client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import ModelCard from '../../components/ModelCard';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const dict: Record<string, any> = {
  en: {
    title: 'Parallel Import EVs for Europe',
    subtitle: 'Certified dealers, EU-compliant paperwork, warranty options.',
    request: 'Request a Quote'
  },
  de: {
    title: 'Paralleler Import von E-Autos für Europa',
    subtitle: 'Zertifizierte Händler, EU-konforme Dokumente, Garantieoptionen.',
    request: 'Angebot anfordern'
  }
};

export default function Home() {
  const params = useParams<{ locale: string }>();
  const locale = (params?.locale as string) || 'en';
  const t = dict[locale] || dict.en;
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'models'), where('isActive', '==', true));
      const snap = await getDocs(q);
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="text-gray-600">{t.subtitle}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {models.map(m => <ModelCard key={m.id} model={m} />)}
      </div>
      <div className="mt-10 flex items-center gap-3">
        <Link href={`/${locale}/lead`} className="rounded-xl border px-4 py-2 shadow hover:shadow-md">{t.request}</Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Lang:</span>
          <Link href="/en">EN</Link>
          <span>·</span>
          <Link href="/de">DE</Link>
        </div>
      </div>
    </main>
  );
}
