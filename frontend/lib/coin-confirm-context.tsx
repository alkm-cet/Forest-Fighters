import React, { createContext, useContext, useState } from "react";

export type CoinConfirmConfig = {
  transactionCost: number;
  transactionTitle: string;
  transactionDesc: string;
  onConfirm: () => void;
};

type CoinConfirmContextType = {
  config: CoinConfirmConfig | null;
  triggerCoinConfirm: (cfg: CoinConfirmConfig) => void;
  dismiss: () => void;
};

const CoinConfirmContext = createContext<CoinConfirmContextType | null>(null);

export function CoinConfirmProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CoinConfirmConfig | null>(null);

  function triggerCoinConfirm(cfg: CoinConfirmConfig) {
    setConfig(cfg);
  }

  function dismiss() {
    setConfig(null);
  }

  return (
    <CoinConfirmContext.Provider value={{ config, triggerCoinConfirm, dismiss }}>
      {children}
    </CoinConfirmContext.Provider>
  );
}

export function useCoinConfirm() {
  const ctx = useContext(CoinConfirmContext);
  if (!ctx) throw new Error("useCoinConfirm must be used within CoinConfirmProvider");
  return ctx;
}
