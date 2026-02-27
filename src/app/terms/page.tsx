import Link from 'next/link';

export const metadata = {
  title: 'Termeni și Condiții — SEAP Assistant',
};

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold">Termeni și Condiții</h1>
          <p className="text-gray-500 mt-2">Platforma SEAP Assistant — condiții de utilizare a serviciilor</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Definiții</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>&bdquo;Platforma&rdquo;</strong> — aplicația web SEAP Assistant accesibilă la adresa curentă</li>
            <li><strong>&bdquo;Furnizorul&rdquo;</strong> — entitatea care operează și dezvoltă platforma SEAP Assistant</li>
            <li><strong>&bdquo;Utilizatorul&rdquo;</strong> — orice persoană care accesează și folosește platforma</li>
            <li><strong>&bdquo;Contul&rdquo;</strong> — contul creat de utilizator pentru accesarea serviciilor</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Obiectul Serviciului</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Platforma SEAP Assistant este un asistent pentru licitații publice SEAP, oferind servicii dedicate pentru firme participante la licitații, consultanți achiziții publice, manageri de proiecte.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Înregistrarea și Contul</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Crearea unui cont necesită informații corecte și actualizate</li>
            <li>Fiecare utilizator este responsabil pentru securitatea credențialelor sale</li>
            <li>Un cont nu poate fi transferat altei persoane fără acordul scris al Furnizorului</li>
            <li>Furnizorul își rezervă dreptul de a suspenda conturile care încalcă acești termeni</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Plăți</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Platforma poate oferi planuri gratuite și plătite</li>
            <li>Plățile sunt procesate prin furnizori terți securizați (Stripe)</li>
            <li>Facturarea se face conform planului ales</li>
            <li>Anularea abonamentului poate fi făcută oricând; accesul continuă până la finalul perioadei plătite</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Obligațiile Utilizatorului</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Să utilizeze platforma doar în scopuri legale și conform destinației sale</li>
            <li>Să nu partajeze credențialele de acces cu persoane neautorizate</li>
            <li>Să furnizeze informații corecte și actualizate</li>
            <li>Să nu încerce să compromită securitatea sau funcționarea platformei</li>
            <li>Să respecte drepturile de proprietate intelectuală ale Furnizorului</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Obligațiile Furnizorului</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Să asigure funcționarea platformei cu un uptime rezonabil (99%+)</li>
            <li>Să protejeze datele utilizatorilor conform GDPR și legislației aplicabile</li>
            <li>Să notifice utilizatorii despre modificări semnificative ale serviciului</li>
            <li>Să ofere suport tehnic conform planului ales</li>
            <li>Să efectueze backup-uri regulate ale datelor</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Proprietate Intelectuală</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Platforma SEAP Assistant, inclusiv designul, codul sursă, logo-urile și documentația,
            sunt proprietatea Furnizorului și sunt protejate de legea drepturilor de autor.
            Datele introduse de utilizatori rămân proprietatea acestora.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Limitarea Răspunderii</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Platforma este oferită &bdquo;ca atare&rdquo; (as-is) fără garanții implicite de adecvare</li>
            <li>Furnizorul nu răspunde pentru pierderi indirecte, inclusiv pierderi de profit</li>
            <li>Răspunderea totală a Furnizorului este limitată la suma plătită în ultimele 12 luni</li>
            <li>Furnizorul nu răspunde pentru întreruperi cauzate de forță majoră sau furnizori terți</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Reziliere</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Oricare parte poate rezilia acordul cu un preaviz de 30 de zile. În caz de încălcare gravă
            a termenilor, Furnizorul poate suspenda sau rezilia accesul imediat. La reziliere,
            utilizatorul poate solicita exportul datelor sale în termen de 30 de zile.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">10. Modificări</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Furnizorul își rezervă dreptul de a modifica acești termeni. Utilizatorii vor fi notificați
            prin email sau prin anunț în platformă cu cel puțin 15 zile înainte de intrarea în vigoare
            a modificărilor. Continuarea utilizării după această perioadă constituie acceptarea noilor termeni.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">11. Legea Aplicabilă</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Acești termeni sunt guvernați de legislația din România. Orice litigii vor fi soluționate
            pe cale amiabilă; în caz contrar, competența revine instanțelor judecătorești din România.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">12. Contact</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Pentru întrebări legate de acești termeni:{' '}
            <a href="mailto:support@4pro.io" className="text-blue-600 hover:underline">support@4pro.io</a>
          </p>
        </section>
      </main>
    </div>
  );
}
