import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Pagina nu a fost găsită</h2>
      <p>Ne pare rău, pagina pe care o cauți nu există.</p>
      <Link href="/" style={{ marginTop: '1rem', display: 'inline-block' }}>
        Înapoi la pagina principală
      </Link>
    </div>
  );
}
