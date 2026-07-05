"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type SidebarToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-9 w-9 px-0"
      onClick={onToggle}
      aria-label={collapsed ? "Afficher la barre laterale" : "Masquer la barre laterale"}
    >
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </Button>
  );
}
