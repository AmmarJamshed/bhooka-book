/** Link styled as a button */

import Link from "next/link";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface LinkButtonProps extends ButtonVariantProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({ href, className, variant, size, children }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
