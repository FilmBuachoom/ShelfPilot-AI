import Link from "next/link";
import { AssistantIcon } from "../AssistantIcon/AssistantIcon";
import { Icon } from "../icons";

const navItems = [
  { href: "/", label: "คลังของฉัน", icon: "shelf" },
  { href: "/new", label: "ออกใหม่", icon: "calendar" },
  { href: "/recommend", label: "แนะนำ", icon: "recommend", usesAI: true },
  { href: "/assistant", label: "ผู้ช่วย", icon: "chat", usesAI: true },
] as const;

export function BottomNav({ pathname, aiEnabled, onAssistant, panelOpen, rail = false }: {
  pathname: string;
  aiEnabled: boolean;
  rail?: boolean;
  onAssistant?: () => void;
  panelOpen?: boolean;
}) {
  return (
    <nav className={rail ? "sp-nav sp-nav--rail" : "sp-nav sp-nav--bottom"} aria-label="เมนูหลัก">
      {navItems.map((item) => {
        if ("usesAI" in item && !aiEnabled) return null;
        const { href, label, icon } = item;
        const active = pathname === href || (href === "/" && pathname.startsWith("/series/"));
        const className = `sp-nav__item${active ? " sp-nav__item--active" : ""}`;
        const content = <>{icon === "chat" ? <AssistantIcon /> : <Icon name={icon} />}<span>{label}</span></>;
        return href === "/assistant" && rail && onAssistant ? (
          <button key={href} id="assistant-panel-toggle" type="button" className={className} aria-expanded={panelOpen}
            aria-controls={panelOpen ? "assistant-panel" : undefined} onClick={onAssistant}>{content}</button>
        ) : (
          <Link key={href} href={href} className={className} aria-current={active ? "page" : undefined}>{content}</Link>
        );
      })}
    </nav>
  );
}
