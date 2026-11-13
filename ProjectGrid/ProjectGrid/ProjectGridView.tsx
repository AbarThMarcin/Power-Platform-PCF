import {
    type ColumnDef,
    type ColumnSizingState,
    getCoreRowModel,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import { mergeColumnOrder, readLayout, writeLayout } from "./layoutStorage";
import {
    badgeStyle,
    type CellValue,
    choiceLabel,
    type ChoiceOption,
    type ColumnFilter,
    type ColumnFilterMap,
    Columns,
    DEFAULT_PAGE_SIZE,
    defaultColumnWidth,
    filterKind,
    type GridColumnModel,
    type GridRecordModel,
    isEditableColumn,
    isOverdue,
    isPageSize,
    type OptionMap,
    PAGE_SIZES,
    progressPercent,
    type RangeColumnFilter,
    selectedChoiceValue,
    YES_NO_COLUMNS,
} from "./schema";

const SELECT_COLUMN = "__select";

export interface ProjectGridViewProps {
    columns: GridColumnModel[];
    records: GridRecordModel[];
    loading: boolean;
    errorMessage: string;
    disabled: boolean;
    height?: number;
    sortColumn?: string;
    sortDirection?: number;
    selectedIds: string[];
    pageSize: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    entityName: string;
    layoutKey: string;
    onSort: (columnName: string) => void;
    onFilter: (filters: ColumnFilterMap) => void;
    onPageSize: (pageSize: number) => void;
    onNextPage: () => void;
    onPreviousPage: () => void;
    onSelectionChange: (ids: string[]) => void;
    onEdit: (recordId: string, columnName: string, value: number | boolean) => Promise<void>;
    loadOptions: () => Promise<{ options: OptionMap; degraded: boolean }>;
}

export const ProjectGridView: React.FunctionComponent<ProjectGridViewProps> = (props) => {
    const {
        columns,
        records,
        loading,
        errorMessage,
        disabled,
        height,
        sortColumn,
        sortDirection,
        selectedIds,
        pageSize,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        entityName,
        layoutKey,
        onSort,
        onFilter,
        onPageSize,
        onNextPage,
        onPreviousPage,
        onSelectionChange,
    } = props;

    const [columnOrder, setColumnOrder] = React.useState<string[]>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
    const [filters, setFilters] = React.useState<ColumnFilterMap>({});
    const [page, setPage] = React.useState(1);
    const [options, setOptions] = React.useState<OptionMap>({});
    const [optionsNote, setOptionsNote] = React.useState("");
    const [columnsOpen, setColumnsOpen] = React.useState(false);
    const [dropTarget, setDropTarget] = React.useState<string | undefined>();
    const [savingKey, setSavingKey] = React.useState<string | undefined>();
    const [saveError, setSaveError] = React.useState("");
    const [pendingSort, setPendingSort] = React.useState<{ column: string; direction: number } | undefined>();
    const [pendingSelection, setPendingSelection] = React.useState<string[] | undefined>();
    const [chosenPageSize, setChosenPageSize] = React.useState(pageSize);
    const seenPageSize = React.useRef(pageSize);
    if (pageSize !== seenPageSize.current) {
        seenPageSize.current = pageSize;
        if (pageSize !== chosenPageSize) setChosenPageSize(pageSize);
    }

    const columnsRef = React.useRef(columns);
    columnsRef.current = columns;
    const pageSizeRef = React.useRef(pageSize);
    pageSizeRef.current = pageSize;
    const onPageSizeRef = React.useRef(onPageSize);
    onPageSizeRef.current = onPageSize;
    const onFilterRef = React.useRef(onFilter);
    onFilterRef.current = onFilter;
    const onEditRef = React.useRef(props.onEdit);
    onEditRef.current = props.onEdit;
    const loadOptionsRef = React.useRef(props.loadOptions);
    loadOptionsRef.current = props.loadOptions;
    const skipPersist = React.useRef(true);
    const skipFilter = React.useRef(true);
    const pageSizeApplied = React.useRef("");
    const dragSource = React.useRef<string | undefined>(undefined);
    const pointerStart = React.useRef<{ x: number; y: number; dragging: boolean } | undefined>(undefined);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const columnKey = columns.map((column) => column.name).join("|");
    const effectiveSelectedIds = pendingSelection ?? selectedIds;
    const selected = React.useMemo(() => new Set(effectiveSelectedIds), [effectiveSelectedIds]);
    const activeSortColumn = pendingSort?.column ?? sortColumn;
    const activeSortDirection = pendingSort ? pendingSort.direction : sortDirection;

    React.useEffect(() => {
        const available = columnsRef.current.map((column) => column.name);
        const saved = readLayout(layoutKey);
        const visibility = saved?.columnVisibility ?? {};
        const anyVisible = available.length === 0 || available.some((name) => visibility[name] !== false);
        setColumnOrder([SELECT_COLUMN, ...mergeColumnOrder(saved?.columnOrder, available)]);
        setColumnVisibility(anyVisible ? visibility : {});
        setColumnSizing(saved?.columnSizing ?? {});
        skipPersist.current = true;
        if (pageSizeApplied.current !== layoutKey) {
            pageSizeApplied.current = layoutKey;
            if (saved && saved.pageSize !== pageSizeRef.current) {
                setChosenPageSize(saved.pageSize);
                onPageSizeRef.current(saved.pageSize);
            }
        }
    }, [layoutKey, columnKey]);

    React.useEffect(() => {
        if (skipPersist.current) {
            skipPersist.current = false;
            return;
        }
        if (columnOrder.length === 0) return;
        const storedPageSize = isPageSize(chosenPageSize) ? chosenPageSize : DEFAULT_PAGE_SIZE;
        writeLayout(layoutKey, {
            columnOrder: columnOrder.filter((id) => id !== SELECT_COLUMN),
            columnVisibility,
            columnSizing,
            pageSize: storedPageSize,
        });
    }, [columnOrder, columnVisibility, columnSizing, chosenPageSize, layoutKey]);

    React.useEffect(() => {
        if (skipFilter.current) {
            skipFilter.current = false;
            return;
        }
        setPage(1);
        onFilterRef.current(filters);
    }, [filters]);

    React.useEffect(() => {
        if (!hasPreviousPage) setPage(1);
    }, [hasPreviousPage]);

    React.useEffect(() => {
        if (pendingSort && sortColumn === pendingSort.column && sortDirection === pendingSort.direction) {
            setPendingSort(undefined);
        }
    }, [pendingSort, sortColumn, sortDirection]);

    React.useEffect(() => {
        if (!pendingSelection) return;
        if (pendingSelection.length === selectedIds.length && pendingSelection.every((id) => selectedIds.includes(id))) {
            setPendingSelection(undefined);
        }
    }, [pendingSelection, selectedIds]);

    React.useEffect(() => {
        let cancelled = false;
        setOptions({});
        setOptionsNote("");
        void (async () => {
            const result = await loadOptionsRef.current();
            if (cancelled) return;
            setOptions(result.options);
            setOptionsNote(
                result.degraded
                    ? "Choice options could not be loaded. Default labels are shown until Dataverse metadata is available."
                    : ""
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [entityName]);

    React.useEffect(() => {
        if (!columnsOpen) return undefined;
        const close = (event: MouseEvent): void => {
            if (!menuRef.current?.contains(event.target as Node)) setColumnsOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [columnsOpen]);

    const dataOrder = mergeColumnOrder(
        columnOrder.filter((id) => id !== SELECT_COLUMN),
        columns.map((column) => column.name)
    );
    const order = [SELECT_COLUMN, ...dataOrder];

    const columnDefs: ColumnDef<GridRecordModel>[] = [
        {
            id: SELECT_COLUMN,
            size: 44,
            minSize: 44,
            maxSize: 44,
            enableSorting: false,
            enableResizing: false,
            enableHiding: false,
        },
        ...columns.map((column) => ({
            id: column.name,
            accessorFn: (record: GridRecordModel) => record.formatted[column.name] ?? "",
            header: column.displayName,
            size: defaultColumnWidth(column.name),
            minSize: 96,
            maxSize: 480,
            enableSorting: !column.disableSorting,
            enableResizing: true,
        })),
    ];

    const table = useReactTable({
        data: records,
        columns: columnDefs,
        state: { columnOrder: order, columnVisibility, columnSizing },
        onColumnOrderChange: setColumnOrder,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnSizingChange: setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (record) => record.id,
        columnResizeMode: "onChange",
        enableColumnResizing: true,
        manualSorting: true,
        manualFiltering: true,
        manualPagination: true,
    });

    const pageIds = records.map((record) => record.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    const someSelected = pageIds.some((id) => selected.has(id));
    const pageCount = totalCount >= 0 && pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : undefined;
    const pageSizeOptions = isPageSize(chosenPageSize) ? PAGE_SIZES : [chosenPageSize, ...PAGE_SIZES];
    const visibleCount = Math.max(1, table.getVisibleLeafColumns().length);

    const updateFilter = (columnName: string, filter: ColumnFilter): void => {
        setFilters((current) => ({ ...current, [columnName]: filter }));
    };

    const changeSelection = (ids: string[]): void => {
        setPendingSelection(ids);
        onSelectionChange(ids);
    };

    const togglePageSelection = (): void => {
        if (allSelected) changeSelection(effectiveSelectedIds.filter((id) => !pageIds.includes(id)));
        else changeSelection([...new Set([...effectiveSelectedIds, ...pageIds])]);
    };

    const toggleRow = (recordId: string): void => {
        if (selected.has(recordId)) changeSelection(effectiveSelectedIds.filter((id) => id !== recordId));
        else changeSelection([...effectiveSelectedIds, recordId]);
    };

    const commitEdit = (recordId: string, columnName: string, value: number | boolean): void => {
        const key = `${recordId}:${columnName}`;
        setSavingKey(key);
        setSaveError("");
        void (async () => {
            try {
                await onEditRef.current(recordId, columnName, value);
                setSavingKey((current) => (current === key ? undefined : current));
            } catch (error: unknown) {
                setSavingKey((current) => (current === key ? undefined : current));
                setSaveError(error instanceof Error && error.message ? error.message : "Could not save the change.");
            }
        })();
    };

    const hideColumn = (columnId: string, visible: boolean): void => {
        const dataColumns = table.getAllLeafColumns().filter((column) => column.id !== SELECT_COLUMN && column.getIsVisible());
        if (visible && dataColumns.length <= 1) return;
        setColumnVisibility((current) => ({ ...current, [columnId]: !visible }));
    };

    return (
        <div className="ab-grid" style={height ? { height: `${height}px` } : undefined}>
            <div className="ab-grid__toolbar">
                <div className="ab-grid__columns" ref={menuRef}>
                    <button
                        type="button"
                        aria-expanded={columnsOpen}
                        aria-controls="ab-grid-columns"
                        onClick={() => setColumnsOpen((open) => !open)}
                    >
                        Columns
                    </button>
                    {columnsOpen && (
                        <div id="ab-grid-columns" className="ab-grid__column-menu" role="group" aria-label="Visible columns">
                            {columns.map((column) => {
                                const visible = table.getColumn(column.name)?.getIsVisible() ?? true;
                                return (
                                    <label key={column.name}>
                                        <input
                                            type="checkbox"
                                            checked={visible}
                                            onChange={() => hideColumn(column.name, visible)}
                                        />
                                        {column.displayName}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="ab-grid__pager">
                    <label>
                        Rows per page
                        <select
                            aria-label="Rows per page"
                            value={chosenPageSize}
                            onChange={(event) => {
                                const next = Number(event.target.value);
                                if (!isPageSize(next)) return;
                                setChosenPageSize(next);
                                setPage(1);
                                onPageSize(next);
                            }}
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="button" disabled={!hasPreviousPage} onClick={() => { setPage((current) => Math.max(1, current - 1)); onPreviousPage(); }}>
                        Previous
                    </button>
                    <span>{pageCount ? `Page ${page} of ${pageCount}` : `Page ${page}`}</span>
                    <button type="button" disabled={!hasNextPage} onClick={() => { setPage((current) => current + 1); onNextPage(); }}>
                        Next
                    </button>
                </div>
            </div>

            {optionsNote && <p className="ab-grid__note">{optionsNote}</p>}
            {errorMessage && <p className="ab-grid__error" role="alert">{errorMessage}</p>}
            {saveError && <p className="ab-grid__error" role="alert">{saveError}</p>}

            <div className="ab-grid__scroll" aria-busy={loading}>
                <table aria-label="Automation projects" style={{ width: table.getTotalSize() }}>
                    <thead>
                        {table.getHeaderGroups().map((group) => (
                            <tr key={group.id}>
                                {group.headers.map((header) => {
                                    const columnId = header.column.id;
                                    const model = columns.find((column) => column.name === columnId);
                                    const sorted = activeSortColumn === columnId ? activeSortDirection : undefined;
                                    return (
                                        <th
                                            key={header.id}
                                            style={{ width: header.getSize() }}
                                            aria-sort={ariaSort(sorted)}
                                            data-drop={dropTarget === columnId ? "true" : "false"}
                                            onDragOver={(event) => {
                                                if (!dragSource.current || dragSource.current === columnId || columnId === SELECT_COLUMN) return;
                                                event.preventDefault();
                                                setDropTarget(columnId);
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const from = dragSource.current;
                                                dragSource.current = undefined;
                                                setDropTarget(undefined);
                                                if (!from || from === columnId || columnId === SELECT_COLUMN) return;
                                                if (pointerStart.current) pointerStart.current.dragging = true;
                                                setColumnOrder((current) => moveColumn(current.length > 0 ? current : order, from, columnId));
                                            }}
                                        >
                                            <div className="ab-grid__head">
                                                {columnId === SELECT_COLUMN ? (
                                                    <HeaderCheckbox
                                                        checked={allSelected}
                                                        indeterminate={someSelected && !allSelected}
                                                        disabled={disabled || pageIds.length === 0}
                                                        onChange={togglePageSelection}
                                                    />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="ab-grid__sort"
                                                        draggable
                                                        aria-label={model ? `Sort by ${model.displayName}` : "Sort"}
                                                        onPointerDown={(event) => {
                                                            pointerStart.current = { x: event.clientX, y: event.clientY, dragging: false };
                                                        }}
                                                        onPointerMove={(event) => {
                                                            const start = pointerStart.current;
                                                            if (!start) return;
                                                            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.dragging = true;
                                                        }}
                                                        onClick={() => {
                                                            const dragged = pointerStart.current?.dragging === true;
                                                            pointerStart.current = undefined;
                                                            if (dragged || !model || model.disableSorting) return;
                                                            const nextDirection = activeSortColumn === columnId && activeSortDirection === 0 ? 1 : 0;
                                                            setPendingSort({ column: columnId, direction: nextDirection });
                                                            setPage(1);
                                                            onSort(columnId);
                                                        }}
                                                        onDragStart={(event) => {
                                                            dragSource.current = columnId;
                                                            if (!event.dataTransfer) return;
                                                            event.dataTransfer.effectAllowed = "move";
                                                            event.dataTransfer.setData("text/plain", columnId);
                                                        }}
                                                        onDragEnd={() => {
                                                            dragSource.current = undefined;
                                                            setDropTarget(undefined);
                                                        }}
                                                    >
                                                        <span>{model?.displayName ?? header.column.id}</span>
                                                        {sorted === 0 && <span aria-hidden="true">▲</span>}
                                                        {sorted === 1 && <span aria-hidden="true">▼</span>}
                                                    </button>
                                                )}
                                                {header.column.getCanResize() && (
                                                    <span
                                                        className="ab-grid__resizer"
                                                        role="separator"
                                                        aria-orientation="vertical"
                                                        aria-label={model ? `Resize ${model.displayName}` : "Resize column"}
                                                        onMouseDown={(event) => {
                                                            event.stopPropagation();
                                                            header.getResizeHandler()(event);
                                                        }}
                                                        onTouchStart={(event) => {
                                                            event.stopPropagation();
                                                            header.getResizeHandler()(event);
                                                        }}
                                                        onClick={(event) => event.stopPropagation()}
                                                    />
                                                )}
                                            </div>
                                            <div className="ab-grid__filter">
                                                {model && (
                                                    <ColumnFilterControl
                                                        column={model}
                                                        filter={filters[columnId]}
                                                        options={options[columnId] ?? []}
                                                        onChange={(filter) => updateFilter(columnId, filter)}
                                                    />
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {records.length === 0 && (
                            <tr>
                                <td className="ab-grid__empty" colSpan={visibleCount}>
                                    {loading ? "Loading…" : "No records to show."}
                                </td>
                            </tr>
                        )}
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} data-selected={selected.has(row.original.id) ? "true" : "false"}>
                                {row.getVisibleCells().map((cell) => {
                                    const columnId = cell.column.id;
                                    const model = columns.find((column) => column.name === columnId);
                                    const overdue = model?.name === Columns.targetDate && isTargetOverdue(row.original, options);
                                    return (
                                        <td key={cell.id} data-column={columnId} data-overdue={overdue ? "true" : "false"} style={{ width: cell.column.getSize() }}>
                                            {columnId === SELECT_COLUMN ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(row.original.id)}
                                                    disabled={disabled}
                                                    aria-label={`Select ${recordLabel(row.original)}`}
                                                    onChange={() => toggleRow(row.original.id)}
                                                />
                                            ) : model ? (
                                                renderCell(row.original, model, options, disabled, savingKey, commitEdit)
                                            ) : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

function renderCell(
    record: GridRecordModel,
    column: GridColumnModel,
    options: OptionMap,
    disabled: boolean,
    savingKey: string | undefined,
    commitEdit: (recordId: string, columnName: string, value: number | boolean) => void
): React.ReactNode {
    if (column.name === Columns.progress) return <ProgressCell value={record.values[column.name]} />;
    if (isEditableColumn(column.name)) {
        return (
            <ChoiceEditor
                record={record}
                column={column}
                options={options[column.name] ?? []}
                disabled={disabled}
                saving={savingKey === `${record.id}:${column.name}`}
                onCommit={(value) => commitEdit(record.id, column.name, value)}
            />
        );
    }
    const text = record.formatted[column.name] ?? "";
    if (column.name === Columns.targetDate && isTargetOverdue(record, options)) {
        return (
            <span className="ab-grid__overdue" title={text}>
                {text}
                <small>Overdue</small>
            </span>
        );
    }
    return <span className="ab-grid__text" title={text}>{text}</span>;
}

const ChoiceEditor: React.FunctionComponent<{
    record: GridRecordModel;
    column: GridColumnModel;
    options: ChoiceOption[];
    disabled: boolean;
    saving: boolean;
    onCommit: (value: number | boolean) => void;
}> = ({ record, column, options, disabled, saving, onCommit }) => {
    if (options.length === 0) {
        const text = record.formatted[column.name] ?? "";
        return <span className="ab-grid__text" title={text}>{text}</span>;
    }
    const current = selectedChoiceValue(record.values[column.name], record.formatted[column.name], options);
    const label = choiceLabel(record.values[column.name], record.formatted[column.name], options);
    const colors = badgeStyle(column.name, label);
    const known = options.some((option) => String(option.value) === current);
    const yesNo = (YES_NO_COLUMNS as readonly string[]).includes(column.name);
    return (
        <select
            className="ab-grid__editor"
            style={colors}
            aria-label={`${column.displayName} for ${recordLabel(record)}`}
            disabled={disabled || saving}
            value={current}
            onChange={(event) => {
                const next = event.target.value;
                if (next === current) return;
                const option = options.find((item) => String(item.value) === next);
                if (!option) return;
                onCommit(yesNo ? option.value === 1 : option.value);
            }}
        >
            {current === "" && <option value="">Select</option>}
            {current !== "" && !known && <option value={current}>{record.formatted[column.name] || current}</option>}
            {options.map((option) => (
                <option key={option.value} value={String(option.value)}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

const ProgressCell: React.FunctionComponent<{ value: CellValue }> = ({ value }) => {
    const percent = progressPercent(value);
    if (percent === undefined) return <span className="ab-grid__text" />;
    return (
        <span className="ab-grid__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${percent}%`}>
            <span style={{ width: `${percent}%` }} />
            <em>{percent}%</em>
        </span>
    );
};

const HeaderCheckbox: React.FunctionComponent<{
    checked: boolean;
    indeterminate: boolean;
    disabled: boolean;
    onChange: () => void;
}> = ({ checked, indeterminate, disabled, onChange }) => {
    const ref = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            aria-label="Select all on this page"
            onChange={onChange}
        />
    );
};

const ColumnFilterControl: React.FunctionComponent<{
    column: GridColumnModel;
    filter: ColumnFilter | undefined;
    options: ChoiceOption[];
    onChange: (filter: ColumnFilter) => void;
}> = ({ column, filter, options, onChange }) => {
    const kind = filterKind(column.name);
    if (kind === "text") {
        return <TextFilter label={column.displayName} onChange={(value) => onChange({ kind: "text", value })} />;
    }
    if (kind === "choice") {
        const value = filter?.kind === "choice" ? filter.value : "";
        return (
            <select aria-label={`Filter ${column.displayName}`} value={value} onChange={(event) => onChange({ kind: "choice", value: event.target.value })}>
                <option value="">All</option>
                {options.map((option) => (
                    <option key={option.value} value={String(option.value)}>{option.label}</option>
                ))}
            </select>
        );
    }
    if (kind === "yesno") {
        const value = filter?.kind === "yesno" ? filter.value : "";
        return (
            <select aria-label={`Filter ${column.displayName}`} value={value} onChange={(event) => onChange({ kind: "yesno", value: yesNoFilterValue(event.target.value) })}>
                <option value="">All</option>
                <option value="1">Yes</option>
                <option value="0">No</option>
            </select>
        );
    }
    if (kind === "date" || kind === "number") {
        return <RangeFilter kind={kind} label={column.displayName} onChange={onChange} />;
    }
    return null;
};

const TextFilter: React.FunctionComponent<{ label: string; onChange: (value: string) => void }> = ({ label, onChange }) => {
    const [text, setText] = React.useState("");
    const debounced = useDebounced(text, 300);
    const first = React.useRef(true);
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    React.useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        onChangeRef.current(debounced);
    }, [debounced]);
    return (
        <input
            type="text"
            aria-label={`Filter ${label}`}
            placeholder="Filter"
            value={text}
            onChange={(event) => setText(event.target.value)}
        />
    );
};

const RangeFilter: React.FunctionComponent<{
    kind: "date" | "number";
    label: string;
    onChange: (filter: RangeColumnFilter) => void;
}> = ({ kind, label, onChange }) => {
    const [from, setFrom] = React.useState("");
    const [to, setTo] = React.useState("");
    const delay = kind === "number" ? 300 : 0;
    const debouncedFrom = useDebounced(from, delay);
    const debouncedTo = useDebounced(to, delay);
    const first = React.useRef(true);
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    React.useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        onChangeRef.current({ kind, from: debouncedFrom, to: debouncedTo });
    }, [debouncedFrom, debouncedTo, kind]);
    const inputType = kind === "date" ? "date" : "number";
    return (
        <span className="ab-grid__range">
            <input type={inputType} aria-label={`${label} from`} value={from} onChange={(event) => setFrom(event.target.value)} />
            <input type={inputType} aria-label={`${label} to`} value={to} onChange={(event) => setTo(event.target.value)} />
        </span>
    );
};

function useDebounced(value: string, delay: number): string {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function yesNoFilterValue(value: string): "" | "0" | "1" {
    if (value === "0" || value === "1") return value;
    return "";
}

function ariaSort(direction: number | undefined): "ascending" | "descending" | "none" {
    if (direction === 0) return "ascending";
    if (direction === 1) return "descending";
    return "none";
}

function recordLabel(record: GridRecordModel): string {
    return record.formatted[Columns.projectName] || record.id;
}

function isTargetOverdue(record: GridRecordModel, options: OptionMap): boolean {
    const statusOptions = options[Columns.projectStatus] ?? [];
    const status = choiceLabel(
        record.values[Columns.projectStatus] ?? null,
        record.formatted[Columns.projectStatus] ?? "",
        statusOptions
    );
    return isOverdue(record.values[Columns.targetDate] ?? null, status);
}

function moveColumn(order: string[], from: string, to: string): string[] {
    const next = order.filter((id) => id !== from);
    const index = next.indexOf(to);
    if (index < 0) return order;
    next.splice(index, 0, from);
    if (next[0] !== SELECT_COLUMN) return [SELECT_COLUMN, ...next.filter((id) => id !== SELECT_COLUMN)];
    return next;
}
