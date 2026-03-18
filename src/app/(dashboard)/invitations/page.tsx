'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [isSending, setIsSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      } else if (res.status === 403) {
        toast.error('Acces interzis. Doar administratorii pot vedea invitațiile.');
      }
    } catch {
      toast.error('Eroare la încărcarea invitațiilor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare la trimitere');
      toast.success(`Invitație trimisă la ${inviteEmail}`);
      setInviteEmail('');
      setInviteDialogOpen(false);
      fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eroare la trimiterea invitației');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      // Delete old invitation and create new one
      await fetch(`/api/invitations?id=${invitation.id}`, { method: 'DELETE' });
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invitation.email, role: invitation.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare');
      toast.success(`Invitație retrimisă la ${invitation.email}`);
      fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eroare la retrimitere');
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Eroare la revocare');
      toast.success('Invitație revocată');
      fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eroare la revocare');
    } finally {
      setDeletingId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'accepted':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'În așteptare';
      case 'accepted':
        return 'Acceptată';
      case 'expired':
        return 'Expirată';
      default:
        return status;
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const otherInvitations = invitations.filter((i) => i.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invitații</h1>
          <p className="text-muted-foreground">
            Gestionează invitațiile pentru membrii organizației
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invită Membru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invită un nou membru</DialogTitle>
              <DialogDescription>
                Trimite o invitație prin email pentru a adăuga un nou membru în organizație.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresa de email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="coleg@firma.ro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as 'MEMBER' | 'ADMIN')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Membru</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Administratorii pot gestiona setările organizației și invita alți membri.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Anulează
                </Button>
                <Button type="submit" disabled={isSending}>
                  {isSending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Trimite Invitația
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invitații în Așteptare</CardTitle>
          <CardDescription>
            Invitații care nu au fost încă acceptate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nu există invitații în așteptare.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Trimisă la</TableHead>
                  <TableHead>Expiră la</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.role === 'ADMIN' ? 'Administrator' : 'Membru'}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.createdAt).toLocaleDateString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expiresAt).toLocaleDateString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(invitation)}
                          disabled={resendingId === invitation.id}
                        >
                          {resendingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Retrimite</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(invitation.id)}
                          disabled={deletingId === invitation.id}
                        >
                          {deletingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Revocă</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {otherInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Istoric Invitații</CardTitle>
            <CardDescription>
              Invitații acceptate sau expirate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(invitation.status)}
                        <span>{statusLabel(invitation.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.role === 'ADMIN' ? 'Administrator' : 'Membru'}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.createdAt).toLocaleDateString('ro-RO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
