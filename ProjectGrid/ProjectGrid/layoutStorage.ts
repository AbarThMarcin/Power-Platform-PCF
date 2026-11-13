import { isPageSize, type PageSize } from "./schema";

export interface GridLayout {
    columnOrder: string[];
    columnVisibility: Record<string, boolean>;
    columnSizing: Record<string, number>;
    pageSize: PageSize;
}

export function layoutStorageKey(userId: string, entityName: string): string {
    return `AB.ProjectGrid:${userId || "user"}:${entityName || "dataset"}`;
}

export function readLayout(key: string): GridLayout | undefined {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return undefined;
        const parsed: unknown = JSON.parse(raw);
        const record = parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
        if (!record || !Array.isArray(record.columnOrder)) return undefined;
        const pageSize = typeof record.pageSize === "number" && isPageSize(record.pageSize) ? record.pageSize : undefined;
        if (!pageSize) return undefined;
        return {
            columnOrder: record.columnOrder.filter((name): name is string => typeof name === "string"),
            columnVisibility: booleanMap(record.columnVisibility),
            columnSizing: numberMap(record.columnSizing),
            pageSize,
        };
    } catch {
        return undefined;
    }
}

export function writeLayout(key: string, layout: GridLayout): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(layout));
    } catch {
        // Private browsing can reject storage writes.
    }
}

export function mergeColumnOrder(saved: string[] | undefined, available: string[]): string[] {
    const known = new Set(available);
    const kept = (saved ?? []).filter((name) => known.has(name));
    const seen = new Set(kept);
    return [...kept, ...available.filter((name) => !seen.has(name))];
}

function booleanMap(value: unknown): Record<string, boolean> {
    if (value === null || typeof value !== "object") return {};
    const result: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "boolean") result[key] = entry;
    }
    return result;
}

function numberMap(value: unknown): Record<string, number> {
    if (value === null || typeof value !== "object") return {};
    const result: Record<string, number> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === "number" && Number.isFinite(entry)) result[key] = entry;
    }
    return result;
}
