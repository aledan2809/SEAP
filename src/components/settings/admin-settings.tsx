'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Shield, Mail, HardDrive, Bot, ScanSearch, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  [key: string]: string;
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.status === 403) {
        setError('forbidden');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSettings(data.settings);
    } catch {
      setError('load_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      toast.success(`${data.updated} setări salvate cu succes`);
    } catch {
      toast.error('Eroare la salvarea setărilor');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nu ai permisiuni de administrator.</p>
          <p className="text-xs mt-1">Contactează un admin pentru a fi adăugat în lista admin_emails.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>Eroare la încărcarea setărilor.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Email
          </CardTitle>
          <CardDescription>Configurare SMTP pentru notificări prin email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Provider</Label>
              <Select value={settings.email_provider || 'console'} onValueChange={(v) => update('email_provider', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="console">Console (dev)</SelectItem>
                  <SelectItem value="smtp">SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Email From</Label>
              <Input value={settings.email_from || ''} onChange={(e) => update('email_from', e.target.value)} placeholder="noreply@firma.ro" />
            </div>
          </div>
          {settings.email_provider === 'smtp' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>SMTP Host</Label>
                <Input value={settings.smtp_host || ''} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1">
                <Label>SMTP Port</Label>
                <Input value={settings.smtp_port || ''} onChange={(e) => update('smtp_port', e.target.value)} placeholder="587" />
              </div>
              <div className="space-y-1">
                <Label>SMTP User</Label>
                <Input value={settings.smtp_user || ''} onChange={(e) => update('smtp_user', e.target.value)} placeholder="user@gmail.com" />
              </div>
              <div className="space-y-1">
                <Label>SMTP Password</Label>
                <Input type="password" value={settings.smtp_pass || ''} onChange={(e) => update('smtp_pass', e.target.value)} placeholder="••••••••" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5" />
            Stocare
          </CardTitle>
          <CardDescription>Stocarea documentelor: local sau Cloudflare R2.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Mod Stocare</Label>
              <Select value={settings.storage_mode || 'local'} onValueChange={(v) => update('storage_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (filesystem)</SelectItem>
                  <SelectItem value="r2">Cloudflare R2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.storage_mode === 'local' && (
              <div className="space-y-1">
                <Label>Cale Locală</Label>
                <Input value={settings.storage_local_path || ''} onChange={(e) => update('storage_local_path', e.target.value)} placeholder="./uploads" />
              </div>
            )}
          </div>
          {settings.storage_mode === 'r2' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>R2 Account ID</Label>
                <Input value={settings.r2_account_id || ''} onChange={(e) => update('r2_account_id', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>R2 Bucket</Label>
                <Input value={settings.r2_bucket || ''} onChange={(e) => update('r2_bucket', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>R2 Access Key</Label>
                <Input type="password" value={settings.r2_access_key || ''} onChange={(e) => update('r2_access_key', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>R2 Secret Key</Label>
                <Input type="password" value={settings.r2_secret_key || ''} onChange={(e) => update('r2_secret_key', e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanSearch className="h-5 w-5" />
            Scanner SEAP
          </CardTitle>
          <CardDescription>Configurare scanare automată licitații.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Scanare Activă</Label>
              <Select value={settings.scanner_enabled || 'true'} onValueChange={(v) => update('scanner_enabled', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activă</SelectItem>
                  <SelectItem value="false">Dezactivată</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Interval (ore)</Label>
              <Input type="number" value={settings.scanner_interval_hours || '24'} onChange={(e) => update('scanner_interval_hours', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Pagini/Scanare</Label>
              <Input type="number" value={settings.scanner_max_pages || '5'} onChange={(e) => update('scanner_max_pages', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5" />
            Analiză AI
          </CardTitle>
          <CardDescription>Configurare analiză automată cu Claude AI.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Provider AI</Label>
              <Select value={settings.ai_provider || 'anthropic'} onValueChange={(v) => update('ai_provider', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="mock">Mock (demo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Auto-analiză la import</Label>
              <Select value={settings.ai_auto_analyze || 'false'} onValueChange={(v) => update('ai_auto_analyze', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Dezactivată</SelectItem>
                  <SelectItem value="true">Activată</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Platformă
          </CardTitle>
          <CardDescription>Setări generale ale platformei.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Mod Mentenanță</Label>
              <Select value={settings.maintenance_mode || 'false'} onValueChange={(v) => update('maintenance_mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Dezactivat</SelectItem>
                  <SelectItem value="true">Activat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Înregistrare</Label>
              <Select value={settings.registration_enabled || 'true'} onValueChange={(v) => update('registration_enabled', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activată</SelectItem>
                  <SelectItem value="false">Dezactivată</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Email-uri Admin</Label>
              <Input value={settings.admin_emails || ''} onChange={(e) => update('admin_emails', e.target.value)} placeholder="admin@firma.ro, alt@admin.ro" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            Jurnal Audit
          </CardTitle>
          <CardDescription>
            Vizualizează activitatea utilizatorilor din sistem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogViewer />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvează Setările
        </Button>
      </div>
    </div>
  );
}

// --- Audit Log Viewer ---
interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: unknown;
  ip: string | null;
  createdAt: string;
}

function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/audit-logs?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Niciun log disponibil.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Afișând ultimele {logs.length} din {total} evenimente
      </p>
      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="p-3 text-xs space-y-1 hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{log.action}</span>
                {log.resource && (
                  <span className="text-muted-foreground">
                    → {log.resource}
                    {log.resourceId && (
                      <span className="ml-1 font-mono">#{log.resourceId.slice(0, 8)}</span>
                    )}
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">
                {new Date(log.createdAt).toLocaleString('ro-RO')}
              </span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              {log.userEmail && <span>{log.userEmail}</span>}
              {log.ip && <span className="font-mono text-[10px]">{log.ip}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
