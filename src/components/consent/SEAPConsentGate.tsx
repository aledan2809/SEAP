'use client';

import { useEffect, useState } from 'react';
import { SEAPConsentModal } from './SEAPConsentModal';

const DOC_TYPES = ['TOS', 'PRIVACY'] as const;
type DocType = typeof DOC_TYPES[number];

const CACHE_KEY = 'seap_legal_consent_status_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function acceptedKey(versionId: string) {
  return `consent_accepted_seap_${versionId}`;
}
function dismissedKey(docType: string) {
  return `consent_dismissed_seap_${docType}`;
}

interface StatusItem {
  docType: string;
  documentVersionId: string;
  accepted: boolean;
  forced?: boolean;
  deadline?: string | null;
  needsReConsent?: boolean;
}

function loadCache(): { items: StatusItem[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(items: StatusItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
  } catch {}
}

export function SEAPConsentGate() {
  const [pending, setPending] = useState<StatusItem[]>([]);
  const [current, setCurrent] = useState<StatusItem | null>(null);

  useEffect(() => {
    async function check() {
      const cached = loadCache();
      let items: StatusItem[];

      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        items = cached.items;
      } else {
        try {
          const res = await fetch('/api/legal/consent/status', { cache: 'no-store' });
          if (!res.ok) return; // 401 = not logged in; 502 = Legal Hub down — both silent
          const data = await res.json() as { items?: StatusItem[]; pending?: StatusItem[] };
          items = (data.items || data.pending || []) as StatusItem[];
          saveCache(items.filter((i) => !i.accepted || i.needsReConsent));
        } catch {
          return;
        }
      }

      const toShow = items.filter((item) => {
        if (item.accepted && !item.needsReConsent) return false;
        if (localStorage.getItem(acceptedKey(item.documentVersionId))) return false;
        if (!item.forced && localStorage.getItem(dismissedKey(item.docType))) return false;
        return DOC_TYPES.includes(item.docType as DocType);
      });

      setPending(toShow);
      if (toShow.length > 0) setCurrent(toShow[0]);
    }

    check();
  }, []);

  async function handleAccept() {
    if (!current) return;
    try {
      await fetch('/api/legal/consent/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentVersionId: current.documentVersionId,
          consentText: `Am citit și sunt de acord cu ${current.docType === 'TOS' ? 'Termenii și Condițiile' : 'Politica de Confidențialitate'} SEAP Assistant.`,
          method: 'IN_APP',
        }),
      });
    } catch (err) {
      console.error('[SEAP consent] Failed to record consent server-side:', err);
      localStorage.setItem(`consent_pending_seap_${current.documentVersionId}`, 'true');
    }
    localStorage.setItem(acceptedKey(current.documentVersionId), 'true');
    localStorage.removeItem(CACHE_KEY);
    const rest = pending.filter((i) => i.documentVersionId !== current.documentVersionId);
    setPending(rest);
    setCurrent(rest[0] ?? null);
  }

  function handleClose() {
    if (!current) return;
    if (!current.forced) {
      localStorage.setItem(dismissedKey(current.docType), 'true');
    }
    const rest = pending.filter((i) => i.documentVersionId !== current.documentVersionId);
    setPending(rest);
    setCurrent(rest[0] ?? null);
  }

  if (!current) return null;

  return (
    <SEAPConsentModal
      docType={current.docType as 'TOS' | 'PRIVACY' | 'COOKIES'}
      onClose={handleClose}
      onAccept={handleAccept}
    />
  );
}
