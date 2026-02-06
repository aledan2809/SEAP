'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  cui: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

interface OrganizationSettingsProps {
  organization: Organization | null;
  userId: string;
}

export function OrganizationSettings({ organization, userId }: OrganizationSettingsProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    cui: organization?.cui || '',
    address: organization?.address || '',
    email: organization?.email || '',
    phone: organization?.phone || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = organization
        ? `/api/organizations/${organization.id}`
        : '/api/organizations';
      const method = organization ? 'PATCH' : 'POST';

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
        organization
          ? 'Organizație actualizată cu succes!'
          : 'Organizație creată cu succes!'
      );

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

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Adaugă Organizație
          </CardTitle>
          <CardDescription>
            Nu ai o organizație asociată. Creează una pentru a monitoriza licitații.
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
                required
              />
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

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Creează Organizație
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Date Organizație
        </CardTitle>
        <CardDescription>
          Actualizează informațiile firmei tale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="name">Nume Firmă</Label>
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
            <Label htmlFor="cui">CUI</Label>
            <Input
              id="cui"
              type="text"
              value={formData.cui}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              CUI-ul nu poate fi modificat
            </p>
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

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvează
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
