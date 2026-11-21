import type { ComponentPropsWithoutRef } from "react";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "default" | "action" | "ghost";
  size?: "default" | "sm" | "block";
};

export function Button({ variant = "default", size = "default", type = "button", className, ...props }: ButtonProps) {
  const classes = [
    "sp-btn",
    variant !== "default" && `sp-btn--${variant}`,
    size !== "default" && `sp-btn--${size}`,
    className,
  ].filter(Boolean).join(" ");

  return <button className={classes} type={type} {...props} />;
}
