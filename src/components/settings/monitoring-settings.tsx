'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Search, X, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IT_CPV_CODES, CPV_GROUPS } from '@/lib/seap/cpv-codes';

interface Organization {
  id: string;
  name: string;
  cpvCodes: string[];
  keywords: string[];
  minValue: unknown;
  maxValue: unknown;
}

interface MonitoringSettingsProps {
  organization: Organization | null;
}

export function MonitoringSettings({ organization }: MonitoringSettingsProps) {
  const router = useRouter();
  const [selectedCpvCodes, setSelectedCpvCodes] = useState<string[]>(
    organization?.cpvCodes || []
  );
  const [keywords, setKeywords] = useState<string[]>(
    organization?.keywords || []
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [minValue, setMinValue] = useState(
    organization?.minValue ? String(organization.minValue) : ''
  );
  const [maxValue, setMaxValue] = useState(
    organization?.maxValue ? String(organization.maxValue) : ''
  );
  const [cpvSearch, setCpvSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Configurare Monitorizare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Trebuie să creezi mai întâi o organizație în tab-ul "Organizație"
            pentru a configura monitorizarea.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/organizations/${organization.id}/monitoring`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpvCodes: selectedCpvCodes,
          keywords,
          minValue: minValue ? parseFloat(minValue) : null,
          maxValue: maxValue ? parseFloat(maxValue) : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success('Setări de monitorizare salvate!');
      router.refresh();
    } catch (error) {
      toast.error('Eroare la salvarea setărilor');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCpvCode = (code: string) => {
    setSelectedCpvCodes((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const selectCpvGroup = (groupCodes: readonly string[]) => {
    const newCodes = new Set([...selectedCpvCodes, ...groupCodes]);
    setSelectedCpvCodes(Array.from(newCodes));
  };

  // Filtrează codurile CPV după search
  const filteredCpvCodes = Object.entries(IT_CPV_CODES).filter(
    ([code, description]) =>
      code.toLowerCase().includes(cpvSearch.toLowerCase()) ||
      description.toLowerCase().includes(cpvSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* CPV Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Coduri CPV de Monitorizat</CardTitle>
          <CardDescription>
            Selectează codurile CPV pentru care vrei să primești notificări de
            licitații noi. Lasă gol pentru a primi toate licitațiile IT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick select groups */}
          <div className="space-y-2">
            <Label>Selectare rapidă pe categorii:</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.software)}
              >
                Software
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.hardware)}
              >
                Hardware
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.servers)}
              >
                Servere
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.networking)}
              >
                Rețelistică
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.services)}
              >
                Servicii IT
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCpvGroup(CPV_GROUPS.security)}
              >
                Securitate
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCpvCodes([])}
              >
                Resetează
              </Button>
            </div>
          </div>

          {/* Selected codes */}
          {selectedCpvCodes.length > 0 && (
            <div className="space-y-2">
              <Label>Coduri selectate ({selectedCpvCodes.length}):</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/50">
                {selectedCpvCodes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleCpvCode(code)}
                  >
                    {code}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search and select */}
          <div className="space-y-2">
            <Label>Caută și adaugă coduri CPV:</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Caută după cod sau descriere..."
                value={cpvSearch}
                onChange={(e) => setCpvSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* CPV list */}
          <div className="max-h-72 overflow-y-auto border rounded-md">
            {filteredCpvCodes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Niciun cod CPV găsit pentru "{cpvSearch}"
              </div>
            ) : (
              filteredCpvCodes.map(([code, description]) => {
                const isSelected = selectedCpvCodes.includes(code);
                return (
                  <div
                    key={code}
                    className={`flex items-center gap-3 p-2 hover:bg-accent cursor-pointer border-b last:border-b-0 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleCpvCode(code)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCpvCode(code)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {code}
                    </span>
                    <span className="text-sm truncate">{description}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {filteredCpvCodes.length} coduri CPV {cpvSearch ? 'găsite' : 'disponibile'} &middot; {selectedCpvCodes.length} selectate
          </p>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Cuvinte Cheie</CardTitle>
          <CardDescription>
            Adaugă cuvinte cheie pentru a crește scorul licitațiilor care le
            conțin în titlu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: laptop, server, software..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            />
            <Button type="button" onClick={addKeyword}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={() => removeKeyword(keyword)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtre Valoare</CardTitle>
          <CardDescription>
            Limitează licitațiile după valoarea estimată (în RON)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="minValue">Valoare minimă (RON)</Label>
              <Input
                id="minValue"
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxValue">Valoare maximă (RON)</Label>
              <Input
                id="maxValue"
                type="number"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="1000000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isLoading} size="lg">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvează Setările de Monitorizare
        </Button>
      </div>
    </div>
  );
}
