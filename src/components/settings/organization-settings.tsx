'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Building2, Plus, ChevronRight, UserPlus, Mail, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  cui: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  role?: string;
  isActive?: boolean;
  _count?: {
    tenders: number;
    documents: number;
  };
}

interface OrganizationSettingsProps {
  organizations: Organization[];
  activeOrganization: Organization | null;
}

export function OrganizationSettings({
  organizations,
  activeOrganization,
}: OrganizationSettingsProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(!activeOrganization);
  const [formData, setFormData] = useState({
    name: activeOrganization?.name || '',
    cui: activeOrganization?.cui || '',
    address: activeOrganization?.address || '',
    email: activeOrganization?.email || '',
    phone: activeOrganization?.phone || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = activeOrganization
        ? `/api/organizations/${activeOrganization.id}`
        : '/api/organizations';
      const method = activeOrganization ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(
        activeOrganization
          ? 'Organizație actualizată cu succes!'
          : 'Organizație creată cu succes!'
      );

      setShowForm(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Eroare la salvarea organizației'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    setIsSwitching(orgId);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to switch');
      }

      toast.success('Organizație selectată');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Eroare la schimbarea organizației'
      );
    } finally {
      setIsSwitching(null);
    }
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      cui: '',
      address: '',
      email: '',
      phone: '',
    });
    setShowForm(true);
  };

  const handleEditCurrent = () => {
    if (activeOrganization) {
      setFormData({
        name: activeOrganization.name || '',
        cui: activeOrganization.cui || '',
        address: activeOrganization.address || '',
        email: activeOrganization.email || '',
        phone: activeOrganization.phone || '',
      });
    }
    setShowForm(true);
  };

  // Show create form if no organizations
  if (organizations.length === 0 || showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {activeOrganization ? 'Editează Organizație' : 'Adaugă Organizație'}
          </CardTitle>
          <CardDescription>
            {activeOrganization
              ? 'Actualizează informațiile firmei tale'
              : 'Creează o organizație pentru a monitoriza licitații.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="name">Nume Firmă *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="SC Exemplu SRL"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cui">CUI *</Label>
              <Input
                id="cui"
                type="text"
                value={formData.cui}
                onChange={(e) =>
                  setFormData({ ...formData, cui: e.target.value })
                }
                placeholder="RO12345678"
                disabled={!!activeOrganization}
                className={activeOrganization ? 'bg-muted' : ''}
                required={!activeOrganization}
              />
              {activeOrganization && (
                <p className="text-xs text-muted-foreground">
                  CUI-ul nu poate fi modificat
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresă</Label>
              <Input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Str. Exemplu nr. 1, București"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email firmă</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="contact@firma.ro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="0721 234 567"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : activeOrganization ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {activeOrganization ? 'Salvează' : 'Creează Organizație'}
              </Button>
              {organizations.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Anulează
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Show organizations list
  return (
    <div className="space-y-6">
      {/* Active Organization */}
      {activeOrganization && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {activeOrganization.name}
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Activă
                  </span>
                </CardTitle>
                <CardDescription>
                  CUI: {activeOrganization.cui}
                  {activeOrganization.role && (
                    <> • Rol: {activeOrganization.role}</>
                  )}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleEditCurrent}>
                Editează
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {activeOrganization.address && (
                <div>
                  <span className="text-muted-foreground">Adresă:</span>{' '}
                  {activeOrganization.address}
                </div>
              )}
              {activeOrganization.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  {activeOrganization.email}
                </div>
              )}
              {activeOrganization.phone && (
                <div>
                  <span className="text-muted-foreground">Telefon:</span>{' '}
                  {activeOrganization.phone}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Members */}
      {activeOrganization && (activeOrganization.role === 'OWNER' || activeOrganization.role === 'ADMIN') && (
        <InviteSection organizationId={activeOrganization.id} />
      )}

      {/* Other Organizations */}
      {organizations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alte Organizații</CardTitle>
            <CardDescription>
              Ai acces la {organizations.length} organizații. Click pentru a
              selecta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organizations
                .filter((org) => org.id !== activeOrganization?.id)
                .map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrg(org.id)}
                    disabled={!!isSwitching}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                  >
                    <div className="text-left">
                      <div className="font-medium">{org.name}</div>
                      <div className="text-sm text-muted-foreground">
                        CUI: {org.cui}
                        {org.role && <> • {org.role}</>}
                      </div>
                    </div>
                    {isSwitching === org.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Organization */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full" onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" />
            Adaugă o altă organizație
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Invite Section ---

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

function InviteSection({ organizationId }: { organizationId: string }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [isSending, setIsSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingInvites(false);
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
      fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Eroare la trimiterea invitației');
    } finally {
      setIsSending(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'accepted': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'expired': return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'În așteptare';
      case 'accepted': return 'Acceptată';
      case 'expired': return 'Expirată';
      default: return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5" />
          Invită Membri
        </CardTitle>
        <CardDescription>
          Trimite invitații prin email pentru a adăuga membri în organizație.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="coleg@firma.ro"
              required
            />
          </div>
          <div className="w-32 space-y-1">
            <Label>Rol</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'MEMBER' | 'ADMIN')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Membru</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Invită
          </Button>
        </form>

        {/* Invitation List */}
        {loadingInvites ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invitations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Invitații ({invitations.length})
            </p>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg border text-sm"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(inv.status)}
                  <div>
                    <span className="font-medium">{inv.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {inv.role === 'ADMIN' ? 'Admin' : 'Membru'}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {statusLabel(inv.status)}
                  {inv.status === 'pending' && (
                    <> • expiră {new Date(inv.expiresAt).toLocaleDateString('ro-RO')}</>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nicio invitație trimisă încă.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
