"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { SocialSharePayload } from "@/lib/share/types";
import { SocialShareModal } from "@/components/share/SocialShareModal";

interface SocialShareContextType {
  openShare: (payload: SocialSharePayload) => void;
  closeShare: () => void;
  isShareOpen: boolean;
  sharePayload: SocialSharePayload | null;
}

const SocialShareContext = createContext<SocialShareContextType | undefined>(undefined);

export function SocialShareProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<SocialSharePayload | null>(null);

  const openShare = useCallback((newPayload: SocialSharePayload) => {
    setPayload(newPayload);
    setIsOpen(true);
  }, []);

  const closeShare = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SocialShareContext.Provider
      value={{
        openShare,
        closeShare,
        isShareOpen: isOpen,
        sharePayload: payload,
      }}
    >
      {children}
      <SocialShareModal
        isOpen={isOpen}
        onClose={closeShare}
        payload={payload}
      />
    </SocialShareContext.Provider>
  );
}

export function useSocialShare() {
  const context = useContext(SocialShareContext);
  if (!context) {
    throw new Error("useSocialShare must be used within a SocialShareProvider");
  }
  return context;
}
