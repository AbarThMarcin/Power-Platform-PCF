/** Publisher prefix for the automation-project columns. Change this if the solution uses a different prefix. */
export const SCHEMA_PREFIX = "ab";

const column = (suffix: string): string => `${SCHEMA_PREFIX}_${suffix}`;

export const Columns = {
    projectName: column("projectname"),
    department: column("department"),
    technology: column("technology"),
    projectStatus: column("projectstatus"),
    priority: column("priority"),
    startDate: column("startdate"),
    targetDate: column("targetdate"),
    estimatedHoursSaved: column("estimatedhourssaved"),
    implementationCost: column("implementationcost"),
    progress: column("progress"),
    businessCritical: column("businesscritical"),
} as const;

export const CHOICE_COLUMNS = [
    Columns.department,
    Columns.technology,
    Columns.projectStatus,
    Columns.priority,
] as const;

export const YES_NO_COLUMNS = [Columns.businessCritical] as const;

const DATE_COLUMNS = [Columns.startDate, Columns.targetDate] as const;

const NUMBER_COLUMNS = [
    Columns.estimatedHoursSaved,
    Columns.implementationCost,
    Columns.progress,
] as const;

export const EDITABLE_COLUMNS = [...CHOICE_COLUMNS, ...YES_NO_COLUMNS] as const;

const COLUMN_LABELS: Record<string, string> = {
    [Columns.projectName]: "Project Name",
    [Columns.department]: "Department",
    [Columns.technology]: "Technology",
    [Columns.projectStatus]: "Project Status",
    [Columns.priority]: "Priority",
    [Columns.startDate]: "Start Date",
    [Columns.targetDate]: "Target Date",
    [Columns.estimatedHoursSaved]: "Estimated Hours Saved",
    [Columns.implementationCost]: "Implementation Cost",
    [Columns.progress]: "Progress",
    [Columns.businessCritical]: "Business Critical",
};

/** Prefer the view's display name. Known columns fall back to a readable label when the dataset only has the logical name. */
export function columnLabel(name: string, displayName: string | undefined): string {
    const provided = displayName?.trim() ?? "";
    if (provided && provided.toLowerCase() !== name.toLowerCase()) return provided;
    return COLUMN_LABELS[name] ?? (provided || name);
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export type CellValue = string | number | boolean | Date | null;

export interface GridColumnModel {
    name: string;
    displayName: string;
    disableSorting: boolean;
}

export interface GridRecordModel {
    id: string;
    values: Record<string, CellValue>;
    formatted: Record<string, string>;
}

export interface ChoiceOption {
    label: string;
    value: number;
}

export type OptionMap = Record<string, ChoiceOption[]>;

export type FilterKind = "text" | "choice" | "yesno" | "date" | "number" | "none";

export interface TextColumnFilter {
    kind: "text";
    value: string;
}

export interface ChoiceColumnFilter {
    kind: "choice";
    value: string;
}

export interface YesNoColumnFilter {
    kind: "yesno";
    value: "" | "0" | "1";
}

export interface RangeColumnFilter {
    kind: "date" | "number";
    from: string;
    to: string;
}

export type ColumnFilter = TextColumnFilter | ChoiceColumnFilter | YesNoColumnFilter | RangeColumnFilter;
export type ColumnFilterMap = Record<string, ColumnFilter | undefined>;

export interface DatasetCondition {
    attributeName: string;
    conditionOperator: ComponentFramework.PropertyHelper.DataSetApi.Types.ConditionOperator;
    value: string;
}

const EQUAL = 0 satisfies ComponentFramework.PropertyHelper.DataSetApi.Types.ConditionOperator;
const GREATER_EQUAL = 4 satisfies ComponentFramework.PropertyHelper.DataSetApi.Types.ConditionOperator;
const LESS_EQUAL = 5 satisfies ComponentFramework.PropertyHelper.DataSetApi.Types.ConditionOperator;
const CONTAINS = 49 satisfies ComponentFramework.PropertyHelper.DataSetApi.Types.ConditionOperator;

const STATUS_COLORS: Record<string, { color: string; background: string }> = {
    idea: { color: "#cbd5e1", background: "#1e293b" },
    analysis: { color: "#7dd3fc", background: "#0c4a6e" },
    development: { color: "#a5b4fc", background: "#312e81" },
    live: { color: "#5eead4", background: "#134e4a" },
    "on hold": { color: "#94a3b8", background: "#1e293b" },
};

const PRIORITY_COLORS: Record<string, { color: string; background: string }> = {
    low: { color: "#cbd5e1", background: "#1e293b" },
    medium: { color: "#7dd3fc", background: "#0c4a6e" },
    high: { color: "#fda4af", background: "#4c1d2e" },
};

const FALLBACK_OPTIONS: OptionMap = {
    [Columns.department]: [
        { label: "Finance", value: 1 },
        { label: "HR", value: 2 },
        { label: "IT", value: 3 },
        { label: "Operations", value: 4 },
    ],
    [Columns.technology]: [
        { label: "Power Automate", value: 1 },
        { label: "Power Apps", value: 2 },
        { label: "UiPath", value: 3 },
        { label: "Python", value: 4 },
    ],
    [Columns.projectStatus]: [
        { label: "Idea", value: 1 },
        { label: "Analysis", value: 2 },
        { label: "Development", value: 3 },
        { label: "Live", value: 4 },
        { label: "On Hold", value: 5 },
    ],
    [Columns.priority]: [
        { label: "Low", value: 1 },
        { label: "Medium", value: 2 },
        { label: "High", value: 3 },
    ],
    [Columns.businessCritical]: [
        { label: "No", value: 0 },
        { label: "Yes", value: 1 },
    ],
};

export function isPageSize(value: number): value is PageSize {
    return (PAGE_SIZES as readonly number[]).includes(value);
}

export function filterKind(columnName: string): FilterKind {
    if (columnName === Columns.projectName) return "text";
    if ((CHOICE_COLUMNS as readonly string[]).includes(columnName)) return "choice";
    if ((YES_NO_COLUMNS as readonly string[]).includes(columnName)) return "yesno";
    if ((DATE_COLUMNS as readonly string[]).includes(columnName)) return "date";
    if ((NUMBER_COLUMNS as readonly string[]).includes(columnName)) return "number";
    return "none";
}

export function isEditableColumn(columnName: string): boolean {
    return (EDITABLE_COLUMNS as readonly string[]).includes(columnName);
}

export function defaultColumnWidth(columnName: string): number {
    if (columnName === Columns.projectName) return 220;
    if (columnName === Columns.progress) return 150;
    if ((DATE_COLUMNS as readonly string[]).includes(columnName)) return 170;
    return 150;
}

export function badgeStyle(
    columnName: string,
    label: string
): { color: string; background: string } | undefined {
    const key = label.trim().toLowerCase();
    if (columnName === Columns.projectStatus) return STATUS_COLORS[key];
    if (columnName === Columns.priority) return PRIORITY_COLORS[key];
    return undefined;
}

export function fallbackOptionMap(): OptionMap {
    return FALLBACK_OPTIONS;
}

export function progressPercent(value: CellValue): number | undefined {
    const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
    if (!Number.isFinite(numeric)) return undefined;
    return Math.min(100, Math.max(0, Math.round(numeric)));
}

export function choiceLabel(raw: CellValue, formatted: string, options: ChoiceOption[]): string {
    const match = options.find((option) => valuesMatch(option.value, raw));
    if (match) return match.label;
    return formatted;
}

export function selectedChoiceValue(raw: CellValue, formatted: string, options: ChoiceOption[]): string {
    if (typeof raw === "boolean") return raw ? "1" : "0";
    const byValue = options.find((option) => valuesMatch(option.value, raw));
    if (byValue) return String(byValue.value);
    const label = (formatted || (typeof raw === "string" ? raw : "")).trim().toLowerCase();
    const byLabel = options.find((option) => option.label.toLowerCase() === label);
    if (byLabel) return String(byLabel.value);
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    if (typeof raw === "string" && raw.trim()) return raw;
    return "";
}

export function isOverdue(target: CellValue, statusLabel: string, today = new Date()): boolean {
    const day = dateOnly(target);
    if (!day) return false;
    if (statusLabel.trim().toLowerCase() === "live") return false;
    return day < localDateOnly(today);
}

export function toFilterConditions(filters: ColumnFilterMap): DatasetCondition[] {
    const conditions: DatasetCondition[] = [];
    for (const [attributeName, filter] of Object.entries(filters)) {
        if (!filter) continue;
        if (filter.kind === "text") {
            const value = filter.value.trim();
            if (!value) continue;
            conditions.push({ attributeName, conditionOperator: CONTAINS, value });
            continue;
        }
        if (filter.kind === "choice" || filter.kind === "yesno") {
            if (!filter.value) continue;
            conditions.push({ attributeName, conditionOperator: EQUAL, value: filter.value });
            continue;
        }
        if (filter.from.trim()) {
            conditions.push({
                attributeName,
                conditionOperator: GREATER_EQUAL,
                value: filter.from.trim(),
            });
        }
        if (filter.to.trim()) {
            conditions.push({
                attributeName,
                conditionOperator: LESS_EQUAL,
                value: filter.to.trim(),
            });
        }
    }
    return conditions;
}

export function parseChoiceOptions(metadata: unknown, names: readonly string[]): OptionMap {
    const root = asRecord(metadata);
    const attributes = root?.Attributes ?? root?.attributes;
    const options: OptionMap = {};
    for (const name of names) {
        const parsed = readOptions(readAttribute(attributes, name));
        if (parsed.length > 0) options[name] = parsed;
    }
    return options;
}

function valuesMatch(optionValue: number, raw: CellValue): boolean {
    if (typeof raw === "number") return raw === optionValue;
    if (typeof raw === "boolean") return raw ? optionValue === 1 : optionValue === 0;
    if (typeof raw === "string" && raw.trim() !== "" && Number(raw) === optionValue) return true;
    return false;
}

function dateOnly(value: CellValue): string | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return utcDateOnly(value);
    }
    if (typeof value === "string") {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
        return match?.[1];
    }
    return undefined;
}

function utcDateOnly(value: Date): string {
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${value.getUTCFullYear()}-${month}-${day}`;
}

function localDateOnly(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
}

function readAttribute(attributes: unknown, name: string): unknown {
    if (Array.isArray(attributes)) {
        return attributes.find((item) => {
            const record = asRecord(item);
            return record?.LogicalName === name || record?.logicalName === name;
        });
    }
    const record = asRecord(attributes);
    if (!record) return undefined;
    if (typeof record.get === "function") {
        const getByName = record.get as (key: string) => unknown;
        return getByName(name);
    }
    return record[name];
}

function readOptions(attribute: unknown): ChoiceOption[] {
    const record = asRecord(attribute);
    if (!record) return [];
    const descriptor = asRecord(record.attributeDescriptor);
    const optionSet =
        asRecord(record.OptionSet) ??
        asRecord(record.optionSet) ??
        asRecord(descriptor?.OptionSet) ??
        asRecord(descriptor?.optionSet);
    const rawOptions = optionSet?.Options ?? optionSet?.options ?? record.Options ?? record.options;
    const options: ChoiceOption[] = [];
    for (const item of readList(rawOptions)) {
        const option = asRecord(item);
        if (!option) continue;
        const value = option.Value ?? option.value;
        const label = readLabel(option.Label ?? option.label);
        if (typeof value !== "number" || !label) continue;
        options.push({ label, value });
    }
    return options;
}

function readList(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const record = asRecord(value);
    if (!record || typeof record.getLength !== "function" || typeof record.get !== "function") return [];
    const length = (record.getLength as () => number)();
    const getAt = record.get as (index: number) => unknown;
    const items: unknown[] = [];
    for (let index = 0; index < length; index += 1) items.push(getAt(index));
    return items;
}

function readLabel(label: unknown): string {
    if (typeof label === "string") return label.trim();
    const record = asRecord(label);
    if (!record) return "";
    const user = asRecord(record.UserLocalizedLabel);
    if (typeof user?.Label === "string") return user.Label.trim();
    if (!Array.isArray(record.LocalizedLabels)) return "";
    const first = asRecord(record.LocalizedLabels[0]);
    return typeof first?.Label === "string" ? first.Label.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (value !== null && typeof value === "object") return value as Record<string, unknown>;
    return undefined;
}
