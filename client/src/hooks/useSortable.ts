import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

export function useSortable<T>(items: T[] | undefined, defaultKey?: keyof T) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultKey || null,
    direction: "asc",
  });

  const sortedItems = useMemo(() => {
    if (!items) return [];
    if (!sortConfig.key) return items;

    return [...items].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bValue == null) return sortConfig.direction === "asc" ? -1 : 1;

      // Handle numbers
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Handle strings (case insensitive)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      // Natural numeric sorting for strings with numbers
      const numA = parseFloat(aStr);
      const numB = parseFloat(bStr);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === "asc" ? numA - numB : numB - numA;
      }

      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const requestSort = (key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIndicator = (key: keyof T) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  return { sortedItems, sortConfig, requestSort, getSortIndicator };
}
