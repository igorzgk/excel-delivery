import { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium",
        "bg-[color:var(--brand)] text-black hover:bg-[color:var(--brand-600)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
    />
  );
}
