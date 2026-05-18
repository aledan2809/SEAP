'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Search, X, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IT_CPV_CODES, CPV_GROUPS } from '@/lib/seap/cpv-codes';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import type { CpvEntry } from '@/lib/seap/cpv-nomenclature';

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
  const [customCpvInput, setCustomCpvInput] = useState('');
  const [cpvSearchQuery, setCpvSearchQuery] = useState('');
  const [cpvSearchResults, setCpvSearchResults] = useState<CpvEntry[]>([]);
  const [cpvSearchLoading, setCpvSearchLoading] = useState(false);
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
            Trebuie să creezi mai întâi o organizație în tab-ul &quot;Organizație&quot;
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
    } catch {
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

  const addCustomCpv = () => {
    const code = customCpvInput.trim().toUpperCase();
    if (!code) return;
    if (!/^\d{8}-\d$/.test(code)) {
      toast.error('Format invalid. Exemplu corect: 79823000-9');
      return;
    }
    if (!selectedCpvCodes.includes(code)) {
      setSelectedCpvCodes((prev) => [...prev, code]);
    }
    setCustomCpvInput('');
  };

  const searchCpvByDescription = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCpvSearchResults([]);
      return;
    }
    setCpvSearchLoading(true);
    try {
      const res = await fetch(`/api/cpv/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCpvSearchResults(data.results || []);
    } catch {
      setCpvSearchResults([]);
    } finally {
      setCpvSearchLoading(false);
    }
  }, []);

  const handleCpvSearchInput = (value: string) => {
    setCpvSearchQuery(value);
    searchCpvByDescription(value);
  };

  const addCpvFromSearch = (entry: CpvEntry) => {
    if (!selectedCpvCodes.includes(entry.code)) {
      setSelectedCpvCodes((prev) => [...prev, entry.code]);
    }
    setCpvSearchQuery('');
    setCpvSearchResults([]);
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

  // Prepare options for combobox
  const cpvOptions: ComboboxOption[] = Object.entries(IT_CPV_CODES).map(([code, description]) => ({
    value: code,
    label: code,
    description,
  }));

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

          {/* Combobox for CPV selection */}
          <div className="space-y-2">
            <Label>Caută și adaugă coduri CPV (autocomplete):</Label>
            <Combobox
              options={cpvOptions}
              value={selectedCpvCodes}
              onChange={setSelectedCpvCodes}
              placeholder="Selectează coduri CPV..."
              searchPlaceholder="Caută după cod sau descriere..."
              emptyText="Niciun cod CPV găsit"
              multiple
            />
            <p className="text-xs text-muted-foreground">
              {selectedCpvCodes.length} coduri selectate din {cpvOptions.length} disponibile IT
            </p>
          </div>

          {/* CPV search by description */}
          <div className="space-y-2">
            <Label>Caută cod CPV după descriere (nomenclator complet EU):</Label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: tipărire, carduri, construcții, servicii juridice..."
                    value={cpvSearchQuery}
                    onChange={(e) => handleCpvSearchInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {cpvSearchLoading && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              </div>
              {cpvSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <ul className="max-h-60 overflow-auto py-1">
                    {cpvSearchResults.map((entry) => (
                      <li
                        key={entry.code}
                        className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-accent"
                        onClick={() => addCpvFromSearch(entry)}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                          {entry.code}
                        </span>
                        <span className="text-sm">{entry.description}</span>
                        {selectedCpvCodes.includes(entry.code) && (
                          <span className="ml-auto shrink-0 text-xs text-green-600">✓</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Caută în nomenclatorul complet CPV (~450+ categorii EU) — click pe rezultat pentru a-l adăuga
            </p>
          </div>

          {/* Custom CPV input */}
          <div className="space-y-2">
            <Label>Adaugă orice cod CPV (ex: 79823000-9, 30237131-6):</Label>
            <div className="flex gap-2">
              <Input
                placeholder="XXXXXXXX-X"
                value={customCpvInput}
                onChange={(e) => setCustomCpvInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCpv())}
                className="max-w-48 font-mono"
              />
              <Button type="button" variant="outline" onClick={addCustomCpv}>
                <Plus className="h-4 w-4 mr-1" />
                Adaugă
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pentru domenii non-IT (tipărire, carduri, construcții etc.) — orice cod valid SEAP
            </p>
          </div>
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
