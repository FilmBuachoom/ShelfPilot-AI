"use client";

import { createContext, useContext } from "react";

export const AssistantPanelContext = createContext<{
  aiEnabled: boolean;
  openAssistant?: () => void;
}>({ aiEnabled: false });

export function useAssistantPanel() {
  return useContext(AssistantPanelContext);
}
