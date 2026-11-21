"use client";

import { createContext, useContext, type MouseEventHandler } from "react";

export const AssistantPanelContext = createContext<{
  panelOpen: boolean;
  openAssistant?: MouseEventHandler<HTMLButtonElement>;
}>({ panelOpen: false });

export function useAssistantPanel() {
  return useContext(AssistantPanelContext);
}
