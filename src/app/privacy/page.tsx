import Link from 'next/link';

export const metadata = {
  title: 'Politica de Confidențialitate — SEAP Assistant',
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold">Politica de Confidențialitate</h1>
          <p className="text-gray-500 mt-2">Platforma SEAP Assistant — protecția datelor personale</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Introducere</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Platforma <strong>SEAP Assistant</strong> respectă confidențialitatea datelor dumneavoastră personale
            și se conformează Regulamentului General privind Protecția Datelor (GDPR — Regulamentul UE 2016/679).
            SEAP Assistant este un asistent pentru licitații publice SEAP.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Operator de Date</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Operatorul de date personale este entitatea care operează platforma SEAP Assistant.
            Platforma acționează ca <strong>persoană împuternicită</strong> (processor)
            în numele operatorului, conform Art. 28 GDPR.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Date Colectate</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Colectăm următoarele categorii de date:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>Date de identificare:</strong> nume, prenume, adresă de email, număr de telefon</li>
            <li><strong>Date de autentificare:</strong> parolă (stocată criptat), token-uri de sesiune</li>
            <li><strong>Date specifice platformei:</strong> licitații publice, documente de ofertă, criterii de selecție, istoric de participare</li>
            <li><strong>Date tehnice:</strong> adresă IP, tip browser, sistem de operare (colectate automat)</li>
            <li><strong>Date de plată:</strong> procesate de terți securizați (Stripe) — nu stocăm date de card</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Scopul Prelucrării</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li>Furnizarea și menținerea serviciilor platformei</li>
            <li>Gestionarea conturilor de utilizator și autentificare</li>
            <li>Procesarea plăților și facturare</li>
            <li>Îmbunătățirea serviciilor și analitice de utilizare</li>
            <li>Comunicări legate de serviciu și notificări</li>
            <li>Conformitate cu obligațiile legale</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Temeiul Legal</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>Executarea contractului</strong> (Art. 6(1)(b)) — furnizarea serviciilor solicitate</li>
            <li><strong>Obligație legală</strong> (Art. 6(1)(c)) — conformitate fiscală și contabilă</li>
            <li><strong>Interes legitim</strong> (Art. 6(1)(f)) — securitatea platformei, prevenirea fraudei</li>
            <li><strong>Consimțământ</strong> (Art. 6(1)(a)) — comunicări de marketing (retragere oricând)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">6. Perioada de Stocare</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>Date de cont:</strong> pe durata utilizării serviciului + 30 zile după ștergere</li>
            <li><strong>Date operaționale:</strong> pe durata relației contractuale + 5 ani (obligații fiscale)</li>
            <li><strong>Date de facturare:</strong> 10 ani (conform legislației fiscale)</li>
            <li><strong>Date de marketing:</strong> până la retragerea consimțământului</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">7. Drepturile Dumneavoastră</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Conform GDPR, aveți următoarele drepturi:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 dark:text-gray-400">
            <li><strong>Dreptul de acces</strong> — puteți solicita o copie a datelor dumneavoastră</li>
            <li><strong>Dreptul la rectificare</strong> — puteți corecta datele inexacte</li>
            <li><strong>Dreptul la ștergere</strong> (&ldquo;dreptul de a fi uitat&rdquo;) — puteți solicita ștergerea datelor</li>
            <li><strong>Dreptul la portabilitate</strong> — puteți solicita exportul datelor în format structurat</li>
            <li><strong>Dreptul la opoziție</strong> — vă puteți opune prelucrării în anumite situații</li>
            <li><strong>Dreptul la restricționare</strong> — puteți solicita limitarea prelucrării</li>
            <li><strong>Dreptul de a depune plângere</strong> — la ANSPDCP (Autoritatea Națională de Supraveghere)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">8. Securitatea Datelor</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Implementăm măsuri tehnice și organizatorice adecvate pentru protecția datelor:
            criptare în tranzit (TLS/HTTPS), parolele stocate cu hash bcrypt, acces bazat pe roluri,
            backup-uri regulate și monitorizare continuă a securității.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">9. Cookie-uri</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Platforma folosește doar <strong>cookie-uri esențiale</strong> necesare funcționării
            (autentificare, preferințe de sesiune). Nu folosim cookie-uri de tracking sau marketing de la terți.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">10. Contact</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Pentru exercitarea drepturilor GDPR sau întrebări privind confidențialitatea,
            contactați-ne la{' '}
            <a href="mailto:support@4pro.io" className="text-blue-600 hover:underline">support@4pro.io</a>.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            ANSPDCP:{' '}
            <a href="https://www.dataprotection.ro" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              www.dataprotection.ro
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
