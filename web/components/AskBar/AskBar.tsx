import Link from "next/link";
import { AssistantIcon } from "../AssistantIcon/AssistantIcon";
import { Icon } from "../icons";

export function AskBar({ onOpen }: { onOpen?: () => void }) {
  const content = <>
    <AssistantIcon />
    <span className="sp-askbar__text">ถามผู้ช่วยว่าเล่มไหนออกใหม่</span>
    <span className="sp-askbar__btn"><Icon name="send" size={18} /></span>
  </>;

  return onOpen
    ? <button className="sp-askbar sp-askbar--desktop" type="button" onClick={onOpen}>{content}</button>
    : <Link className="sp-askbar sp-askbar--mobile" href="/assistant">{content}</Link>;
}
