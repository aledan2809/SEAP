'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'NEW', label: 'Nou', color: 'text-blue-600' },
  { value: 'REVIEWING', label: 'În analiză', color: 'text-yellow-600' },
  { value: 'PREPARING', label: 'În pregătire', color: 'text-purple-600' },
  { value: 'SUBMITTED', label: 'Depus', color: 'text-green-600' },
  { value: 'WON', label: 'Câștigat', color: 'text-green-700' },
  { value: 'LOST', label: 'Pierdut', color: 'text-red-600' },
  { value: 'IGNORED', label: 'Ignorat', color: 'text-gray-500' },
];

interface TenderStatusSelectProps {
  tenderId: string;
  currentStatus: string;
}

export function TenderStatusSelect({
  tenderId,
  currentStatus,
}: TenderStatusSelectProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success('Status actualizat!');
      router.refresh();
    } catch {
      toast.error('Eroare la actualizarea statusului');
    } finally {
      setIsLoading(false);
    }
  };

  const currentOption = statusOptions.find((s) => s.value === currentStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <span className={currentOption?.color}>{currentOption?.label}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className={option.value === currentStatus ? 'bg-accent' : ''}
          >
            <span className={option.color}>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
