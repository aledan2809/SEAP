'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ro">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>A apărut o eroare</h2>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Încearcă din nou
          </button>
        </div>
      </body>
    </html>
  );
}
