import Image from "next/image";
import glasses from "./glasses.png";

export function AssistantIcon({ imageSize = 34 }: { imageSize?: number }) {
  return (
    <span className="sp-assistant-icon" aria-hidden="true">
      <Image src={glasses} alt="" width={imageSize} height={imageSize} />
    </span>
  );
}
