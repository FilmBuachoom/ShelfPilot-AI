"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav/BottomNav";
import { Button } from "@/components/Button/Button";
import { useSingleActionGuard } from "@/components/Button/use-single-action-guard";
import { Icon } from "@/components/icons";
import { AssistantScreen } from "./assistant/assistant-screen";
import { AssistantPanelContext } from "./assistant/panel";
import { ShelfScreen } from "./shelf-screen";

export function AppShell({ aiEnabled, children }: { aiEnabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const assistantRoute = aiEnabled && pathname === "/assistant";
  const showPanel = aiEnabled && (assistantRoute || panelOpen);

  useSingleActionGuard();

  function openAssistant() {
    if (showPanel) document.querySelector<HTMLTextAreaElement>("#assistant-panel textarea")?.focus();
    setPanelOpen(true);
  }

  function closeAssistant() {
    if (assistantRoute) router.replace("/");
    setPanelOpen(false);
    document.getElementById("assistant-panel-toggle")?.focus();
  }

  return (
    <AssistantPanelContext.Provider value={{ aiEnabled, openAssistant }}>
      <div className={`sp-app${showPanel ? " sp-app--with-assistant" : ""}${assistantRoute ? " sp-app--assistant-route" : ""}`}>
        <header className="sp-app-header">
          <Link className="sp-wordmark" href="/">ShelfPilot</Link>
          <Link className="sp-link" href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}
            aria-label="แอดมิน"><Icon name="admin" size={20} /></Link>
        </header>
        <aside className="sp-rail">
          <Link className="sp-wordmark" href="/">ShelfPilot</Link>
          <BottomNav rail pathname={pathname} aiEnabled={aiEnabled} panelOpen={showPanel}
            onAssistant={showPanel ? closeAssistant : openAssistant} />
          <Link className="sp-nav__item" href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>
            <Icon name="admin" /><span>แอดมิน</span>
          </Link>
        </aside>
        {assistantRoute ? (
          <main className="sp-app-main sp-app-main--desktop"><ShelfScreen /></main>
        ) : (
          <main className="sp-app-main">{children}</main>
        )}
        {showPanel && (
          <section id="assistant-panel" className="sp-assistant-panel" aria-label="ผู้ช่วย">
            <div className="sp-panel-head">
              <span>ผู้ช่วย</span>
              <Button variant="ghost" size="sm" aria-label="ปิดผู้ช่วย" onClick={closeAssistant}><Icon name="close" size={18} /></Button>
            </div>
            {assistantRoute ? children : <AssistantScreen />}
          </section>
        )}
        <BottomNav pathname={pathname} aiEnabled={aiEnabled} />
      </div>
    </AssistantPanelContext.Provider>
  );
}
