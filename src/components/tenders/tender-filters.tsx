'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface TenderFiltersProps {
  currentStatus?: string;
  currentSearch?: string;
}

const statusOptions = [
  { value: 'all', label: 'Toate statusurile' },
  { value: 'NEW', label: 'Noi' },
  { value: 'REVIEWING', label: 'În analiză' },
  { value: 'PREPARING', label: 'În pregătire' },
  { value: 'SUBMITTED', label: 'Depuse' },
  { value: 'WON', label: 'Câștigate' },
  { value: 'LOST', label: 'Pierdute' },
  { value: 'CANCELLED', label: 'Anulate' },
  { value: 'IGNORED', label: 'Ignorate' },
];

export function TenderFilters({ currentStatus, currentSearch }: TenderFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentSearch || '');

  const updateFilters = (updates: { status?: string; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.status !== undefined) {
      if (updates.status === 'all' || !updates.status) {
        params.delete('status');
      } else {
        params.set('status', updates.status);
      }
    }

    if (updates.search !== undefined) {
      if (!updates.search) {
        params.delete('search');
      } else {
        params.set('search', updates.search);
      }
    }

    startTransition(() => {
      router.push(`/tenders?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchValue });
  };

  const clearSearch = () => {
    setSearchValue('');
    updateFilters({ search: '' });
  };

  const clearAllFilters = () => {
    setSearchValue('');
    startTransition(() => {
      router.push('/tenders');
    });
  };

  const hasFilters = currentStatus || currentSearch;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <form onSubmit={handleSearch} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Caută după titlu, autoritate sau ID SEAP..."
            aria-label="Caută licitații"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Șterge căutarea"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          Caută
        </Button>
      </form>

      <Select
        value={currentStatus || 'all'}
        onValueChange={(value) => updateFilters({ status: value })}
      >
        <SelectTrigger className="w-[180px]" aria-label="Filtrează după status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" onClick={clearAllFilters} disabled={isPending}>
          <X className="mr-2 h-4 w-4" />
          Șterge filtrele
        </Button>
      )}
    </div>
  );
}
