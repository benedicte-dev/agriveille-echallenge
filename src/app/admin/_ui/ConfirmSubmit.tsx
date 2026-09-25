"use client";

import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui";
import { useAdminForm } from "./AdminForm";

/** Bouton d'envoi d'un AdminForm qui demande confirmation (suppression). */
export function ConfirmSubmit({
  children,
  confirm,
  variant = "danger",
  size = "sm",
  loadingLabel = "Suppression…",
}: {
  children: ReactNode;
  confirm: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loadingLabel?: string;
}) {
  const { pending } = useAdminForm();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      loading={pending}
      loadingLabel={loadingLabel}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
