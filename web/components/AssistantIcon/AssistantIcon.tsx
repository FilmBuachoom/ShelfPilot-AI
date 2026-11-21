import Image from "next/image";
import glasses from "./glasses.png";

export function AssistantIcon() {
  return (
    <span className="sp-assistant-icon" aria-hidden="true">
      <Image src={glasses} alt="" width={34} height={34} />
    </span>
  );
}
