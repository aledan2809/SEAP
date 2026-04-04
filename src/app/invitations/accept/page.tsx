'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function AcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error'
  );
  const [message, setMessage] = useState(token ? '' : 'Link invalid - token lipsa.');

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Invitație acceptată!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Eroare la acceptarea invitației.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Eroare de rețea.');
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Acceptare Invitație</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {status === 'loading' && (
          <div className="py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Se procesează invitația...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <p className="mt-4 font-medium">{message}</p>
            <Button className="mt-6" onClick={() => router.push('/dashboard')}>
              Mergi la Dashboard
            </Button>
          </div>
        )}
        {status === 'error' && (
          <div className="py-8">
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <p className="mt-4 text-red-600">{message}</p>
            <Button variant="outline" className="mt-6" onClick={() => router.push('/login')}>
              Autentifică-te
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </CardContent>
        </Card>
      }>
        <AcceptForm />
      </Suspense>
    </div>
  );
}
