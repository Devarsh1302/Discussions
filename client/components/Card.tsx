import type { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ className = "", children }: CardProps) {
  return (
    <section
      className={`rounded-[24px] border border-white/8 bg-white/[0.04] shadow-[0_12px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}
