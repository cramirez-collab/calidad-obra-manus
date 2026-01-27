import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderProps<T> {
  label: string;
  sortKey: keyof T;
  currentSortKey: keyof T | null;
  sortDirection: "asc" | "desc";
  onSort: (key: keyof T) => void;
  className?: string;
}

export function SortableHeader<T>({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps<T>) {
  const isActive = currentSortKey === sortKey;

  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors text-left font-medium",
        isActive ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {label}
      {isActive ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}
