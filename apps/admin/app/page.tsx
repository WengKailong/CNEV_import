'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function toCSV(rows: any[]) {
  const headers = ['Created','First Name','Last Name','Email','Model','Country','Budget','Language'];
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map(r => [
    r.createdAt?.toDate?.().toISOString?.() || '',
    r.firstName, r.lastName, r.email,
    r.modelName || r.modelId,
    r.country || '',
    r.budget ?? '',
    r.preferredLanguage || ''
  ].map(escape).join(','));
  return [headers.join(','), ...body].join('\n');
}

export default function AdminHome() {
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });
    return () => unsub();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const domain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
    if (domain && !cred.user.email?.endsWith(`@${domain}`)) {
      alert('Unauthorized domain');
      auth.signOut();
    }
  };

  const exportCsv = () => {
    const csv = toCSV(leads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  if (!user) return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <button onClick={signIn} className="mt-4 rounded-xl bg-black px-4 py-2 text-white">Sign in with Google</button>
    </main>
  );

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={exportCsv} className="rounded-xl border px-4 py-2 shadow">Export CSV</button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-left">Country</th>
              <th className="p-2 text-left">Budget</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-t">
                <td className="p-2">{l.createdAt?.toDate?.().toLocaleString?.() || ''}</td>
                <td className="p-2">{l.firstName} {l.lastName}</td>
                <td className="p-2">{l.email}</td>
                <td className="p-2">{l.modelName || l.modelId}</td>
                <td className="p-2">{l.country}</td>
                <td className="p-2">{l.budget ? `€${l.budget.toLocaleString()}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
