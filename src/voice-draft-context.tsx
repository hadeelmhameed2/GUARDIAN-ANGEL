import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { VoiceDraft } from '@/src/voice-trigger';

export type { VoiceDraft };

type VoiceDraftContextValue = {
  drafts: VoiceDraft[];
  addDraft: (draft: VoiceDraft) => void;
  removeDraft: (id: string) => void;
};

const VoiceDraftContext = createContext<VoiceDraftContextValue | null>(null);

/**
 * Holds voice-trigger recordings in memory, shared between the disguised
 * Calculator screen (which records them silently) and the Drafts screen
 * (which lists and acts on them). Mounted once at the root layout so it
 * survives navigating between those two routes.
 */
export function VoiceDraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<VoiceDraft[]>([]);

  const addDraft = useCallback((draft: VoiceDraft) => {
    setDrafts((prev) => [draft, ...prev]);
  }, []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const target = prev.find((draft) => draft.id === id);
      if (target?.url) {
        try {
          URL.revokeObjectURL(target.url);
        } catch {
          // ignore — the URL may already be revoked or unavailable on native
        }
      }
      return prev.filter((draft) => draft.id !== id);
    });
  }, []);

  const value = useMemo(() => ({ drafts, addDraft, removeDraft }), [drafts, addDraft, removeDraft]);

  return <VoiceDraftContext.Provider value={value}>{children}</VoiceDraftContext.Provider>;
}

export function useVoiceDrafts(): VoiceDraftContextValue {
  const ctx = useContext(VoiceDraftContext);
  if (!ctx) {
    throw new Error('useVoiceDrafts must be used within a VoiceDraftProvider');
  }
  return ctx;
}
