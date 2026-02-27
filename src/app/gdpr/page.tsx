import Link from 'next/link';

export const metadata = {
  title: 'Protecția Datelor (GDPR) — SEAP Assistant',
};

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-50 border-b bg-white/95 dark:bg-gray-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex h-14 items-center gap-4 px-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
            &larr; Înapoi
          </Link>
          <span className="ml-auto text-xs text-gray-400">Actualizat: 26 Februarie 2026</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-10 px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Protecția Datelor (GDPR)</h1>
          <p className="text-gray-500 mt-2">Conformitate cu Regulamentul UE 2016/679 — Platforma SEAP Assistant</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Angajamentul Nostru</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Platforma SEAP Assistant este concepută cu respectarea principiilor GDPR încă din faza de proiectare
            (<em>Privacy by Design</em> și <em>Privacy by Default</em>). Ne angajăm să protejăm datele
            personale ale tuturor utilizatorilor.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Roluri GDPR</h2>
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="font-medium">Operator de date (Data Controller)</p>
              <p className="text-sm text-gray-500">
                Entitatea care operează platforma SEAP Assistant este operatorul de date personale.
              </p>
            </div>
            <div>
              <p className="font-medium">Persoană Împuternicită (Data Processor)</p>
              <p className="text-sm text-gray-500">
                Platforma procesează datele exclusiv conform instrucțiunilor operatorului
                și în scopurile stabilite prin contract.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Principiile Prelucrării</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>Legalitate, echitate, transparență</strong> — prelucrăm date cu temei legal valid și informăm utilizatorii</li>
            <li><strong>Limitarea scopului</strong> — datele sunt folosite doar pentru scopurile specificate</li>
            <li><strong>Minimizarea datelor</strong> — colectăm doar datele strict necesare</li>
            <li><strong>Exactitate</strong> — menținem datele actualizate și corecte</li>
            <li><strong>Limitarea stocării</strong> — păstrăm datele doar cât este necesar</li>
            <li><strong>Integritate și confidențialitate</strong> — asigurăm securitatea datelor</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Măsuri Tehnice de Securitate</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { t: 'Criptare în tranzit', d: 'TLS 1.3 / HTTPS pe toate conexiunile' },
              { t: 'Parolele criptate', d: 'Hash bcrypt cu salt unic per utilizator' },
              { t: 'Acces bazat pe roluri', d: 'RBAC — fiecare utilizator vede doar datele permise' },
              { t: 'Token-uri JWT', d: 'Acces securizat cu token-uri cu durată limitată' },
              { t: 'Audit Log', d: 'Jurnal de acțiuni pentru trasabilitate completă' },
              { t: 'Backup automat', d: 'Copii de siguranță regulate ale bazei de date' },
            ].map((item) => (
              <div key={item.t} className="rounded-lg border p-3">
                <p className="font-medium text-sm">{item.t}</p>
                <p className="text-xs text-gray-500">{item.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Drepturile Persoanelor Vizate</h2>
          <div className="space-y-3">
            {[
              { r: 'Dreptul de acces (Art. 15)', d: 'Puteți solicita o copie completă a datelor dumneavoastră.' },
              { r: 'Dreptul la rectificare (Art. 16)', d: 'Puteți corecta datele inexacte din profil sau setări.' },
              { r: 'Dreptul la ștergere (Art. 17)', d: 'Puteți solicita ștergerea contului și a datelor asociate.' },
              { r: 'Dreptul la portabilitate (Art. 20)', d: 'Puteți exporta datele într-un format structurat (JSON/CSV).' },
              { r: 'Dreptul la opoziție (Art. 21)', d: 'Vă puteți opune prelucrării bazate pe interes legitim.' },
              { r: 'Dreptul la restricționare (Art. 18)', d: 'Puteți solicita limitarea prelucrării datelor.' },
              { r: 'Retragerea consimțământului', d: 'Puteți retrage oricând consimțământul, fără a afecta legalitatea prelucrării anterioare.' },
            ].map((item) => (
              <div key={item.r} className="flex gap-3">
                <div className="shrink-0 mt-1 h-2 w-2 rounded-full bg-blue-600" />
                <div>
                  <p className="font-medium text-sm">{item.r}</p>
                  <p className="text-xs text-gray-500">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Transferuri Internaționale</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Datele sunt stocate pe servere situate în Uniunea Europeană.
            Nu transferăm date în afara Spațiului Economic European fără garanții
            adecvate conform Art. 46 GDPR (Clauze Contractuale Standard).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Încălcarea Securității Datelor</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            În cazul unei încălcări a securității datelor personale, vom notifica Autoritatea
            Națională de Supraveghere (ANSPDCP) în termen de <strong>72 de ore</strong> conform Art. 33 GDPR.
            Dacă încălcarea prezintă un risc ridicat pentru drepturile persoanelor vizate,
            vom notifica și utilizatorii afectați fără întârzieri nejustificate (Art. 34).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Exercitarea Drepturilor</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Pentru a vă exercita drepturile GDPR, puteți:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Accesa secțiunea <strong>Setări</strong> din contul dumneavoastră</li>
            <li>Trimite un email la: <a href="mailto:gdpr@4pro.io" className="text-blue-600 hover:underline">gdpr@4pro.io</a></li>
          </ul>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Vom răspunde cererii dumneavoastră în termen de <strong>30 de zile</strong> calendaristice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Autoritatea de Supraveghere</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Dacă nu sunteți mulțumit de modul în care gestionăm datele, puteți depune o plângere la:
          </p>
          <div className="rounded-lg border p-4 text-sm text-gray-500 space-y-1">
            <p className="font-medium text-gray-900 dark:text-gray-100">ANSPDCP — Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal</p>
            <p>B-dul G-ral. Gheorghe Magheru nr. 28-30, Sector 1, București</p>
            <p>Email: anspdcp@dataprotection.ro</p>
            <p>Web: <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.dataprotection.ro</a></p>
          </div>
        </section>
      </main>
    </div>
  );
}
