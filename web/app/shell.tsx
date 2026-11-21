"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav/BottomNav";
import { Button } from "@/components/Button/Button";
import { useSingleActionGuard } from "@/components/Button/use-single-action-guard";
import { Icon } from "@/components/icons";
import { useChat } from "@/lib/chat/use-chat";
import { AssistantScreen } from "./assistant/assistant-screen";
import { AssistantPanelContext } from "./assistant/panel";
import { ShelfScreen } from "./shelf-screen";

export function AppShell({ aiEnabled, children }: { aiEnabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const chat = useChat();
  const [panelOpen, setPanelOpen] = useState(false);
  const assistantInput = useRef<HTMLTextAreaElement>(null);
  const panelWasOpen = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const assistantRoute = aiEnabled && pathname === "/assistant";
  const showPanel = aiEnabled && (assistantRoute || panelOpen);

  useSingleActionGuard();

  useEffect(() => {
    const wasOpen = panelWasOpen.current;
    panelWasOpen.current = showPanel;
    if (showPanel && (!wasOpen || assistantRoute)) {
      assistantInput.current?.focus({ preventScroll: !assistantRoute });
    }
    if (showPanel || !restoreFocus.current) return;
    restoreFocus.current = false;
    const target = opener.current?.getClientRects().length
      ? opener.current
      : document.getElementById("assistant-panel-toggle");
    target?.focus({ preventScroll: true });
    opener.current = null;
  }, [assistantRoute, showPanel]);

  function openAssistant(event: MouseEvent<HTMLButtonElement>) {
    opener.current = event.currentTarget;
    if (showPanel) {
      assistantInput.current?.focus({ preventScroll: true });
      return;
    }
    setPanelOpen(true);
  }

  function closeAssistant() {
    restoreFocus.current = true;
    if (assistantRoute) router.replace("/");
    setPanelOpen(false);
  }

  return (
    <AssistantPanelContext.Provider value={{ panelOpen: showPanel, openAssistant: aiEnabled ? openAssistant : undefined }}>
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
            <AssistantScreen {...chat} inputRef={assistantInput} />
          </section>
        )}
        <BottomNav pathname={pathname} aiEnabled={aiEnabled} />
      </div>
    </AssistantPanelContext.Provider>
  );
}
