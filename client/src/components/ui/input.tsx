import { cn } from "@/lib/utils";
import * as React from "react";

// Default composition context for when Input is used outside of Dialog
const defaultDialogComposition = {
  isComposing: () => false,
  setComposing: (_composing: boolean) => {},
  justEndedComposing: () => false,
  markCompositionEnd: () => {},
};

function Input({
  className,
  type,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: React.ComponentProps<"input">) {
  // Use default composition context - this component works standalone
  const dialogComposition = defaultDialogComposition;

  const composingRef = React.useRef(false);
  const justEndedRef = React.useRef(false);

  const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = true;
    dialogComposition.setComposing(true);
    onCompositionStart?.(e);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    justEndedRef.current = true;
    dialogComposition.markCompositionEnd();
    setTimeout(() => {
      composingRef.current = false;
      justEndedRef.current = false;
      dialogComposition.setComposing(false);
    }, 100);
    onCompositionEnd?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isComposing = (e.nativeEvent as any).isComposing || composingRef.current || justEndedRef.current || dialogComposition.justEndedComposing();
    
    if (e.key === "Enter" && isComposing) {
      return;
    }
    
    onKeyDown?.(e);
  };

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export { Input };
