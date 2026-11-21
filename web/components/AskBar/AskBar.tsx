import Link from "next/link";
import { Icon } from "../icons";

export function AskBar({ onOpen }: { onOpen?: () => void }) {
  const content = <>
    <span className="sp-askbar__mark" aria-hidden="true">✦</span>
    <span className="sp-askbar__text">ถามผู้ช่วย หรือบอกว่าเพิ่งซื้ออะไรมา</span>
    <span className="sp-askbar__btn"><Icon name="send" size={18} /></span>
  </>;

  return onOpen
    ? <button className="sp-askbar sp-askbar--desktop" type="button" onClick={onOpen}>{content}</button>
    : <Link className="sp-askbar sp-askbar--mobile" href="/assistant">{content}</Link>;
}
