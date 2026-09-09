import * as React from "react";

import { cn } from "@/lib/utils";

// Themed native <select>. Admin uses a handful of simple selects (managed
// context, stage, status, correct answer); this gives them the same surface as
// <Input> without pulling in a full listbox primitive. Native options keep
// keyboard/mobile behavior for free.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
