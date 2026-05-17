'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SEAPConsentModalProps {
  docType: 'TOS' | 'PRIVACY' | 'COOKIES';
  onClose: () => void;
  onAccept?: () => void;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

function renderMarkdown(md: string): React.ReactNode[] {
  return md.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h3 key={i} className="font-semibold text-sm mt-3 mb-1">{renderInline(line.slice(4))}</h3>;
    if (line.startsWith('## ')) return <h2 key={i} className="font-semibold text-base mt-4 mb-1">{renderInline(line.slice(3))}</h2>;
    if (line.startsWith('# ')) return <h1 key={i} className="font-bold text-lg mt-4 mb-2">{renderInline(line.slice(2))}</h1>;
    if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc">{renderInline(line.slice(2))}</li>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>;
  });
}

const TITLE: Record<string, string> = {
  TOS: 'Termeni și Condiții',
  PRIVACY: 'Politica de Confidențialitate',
  COOKIES: 'Politica de Cookie-uri',
};

export function SEAPConsentModal({ docType, onClose, onAccept }: SEAPConsentModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/legal/document?type=${docType.toLowerCase()}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setContent(d.contentMarkdown || ''))
      .catch(() => setLoadError(true));
  }, [docType]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{TITLE[docType] ?? docType}</DialogTitle>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pr-1 text-sm text-muted-foreground space-y-1 min-h-0"
          style={{ maxHeight: '55vh' }}
        >
          {loadError ? (
            <p className="text-destructive text-sm">Nu s-a putut încărca documentul. Încearcă din nou.</p>
          ) : content === null ? (
            <p className="text-muted-foreground">Se încarcă…</p>
          ) : (
            <div className="space-y-0.5">{renderMarkdown(content)}</div>
          )}
        </div>

        {!scrolled && content !== null && !loadError && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            Derulează până la capăt pentru a putea accepta.
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Mai târziu
          </Button>
          {onAccept && (
            <Button size="sm" disabled={!scrolled} onClick={onAccept}>
              Accept
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
