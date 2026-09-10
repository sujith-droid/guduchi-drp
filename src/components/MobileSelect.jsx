import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MobileSelect
 * Uses the vaul Drawer (bottom sheet) on mobile and the Radix Select on desktop.
 * options: [{ value, label }]
 */
export default function MobileSelect({ value, onValueChange, options = [], placeholder, triggerClassName }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-11 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            triggerClassName
          )}
        >
          <span className={value ? "" : "text-muted-foreground"}>{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{placeholder || "Select an option"}</DrawerTitle>
        </DrawerHeader>
        <div className="px-2 pb-6 space-y-1 max-h-[60vh] overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onValueChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm text-left transition-colors min-h-[44px]",
                opt.value === value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
              )}
            >
              {opt.label}
              {opt.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}