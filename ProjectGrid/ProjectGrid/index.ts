import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { layoutStorageKey } from "./layoutStorage";
import { ProjectGridView } from "./ProjectGridView";
import {
    type CellValue,
    type ColumnFilterMap,
    DEFAULT_PAGE_SIZE,
    EDITABLE_COLUMNS,
    columnLabel,
    fallbackOptionMap,
    type OptionMap,
    parseChoiceOptions,
    toFilterConditions,
} from "./schema";

type DataSet = ComponentFramework.PropertyTypes.DataSet;
type EntityRecord = ComponentFramework.PropertyHelper.DataSetApi.EntityRecord;
type SortDirection = ComponentFramework.PropertyHelper.DataSetApi.Types.SortDirection;

export class ProjectGrid implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged!: () => void;
    private context!: ComponentFramework.Context<IInputs>;
    private dataset!: DataSet;
    private selectedIds: string[] = [];
    private requestedSort: { name: string; sortDirection: SortDirection } | undefined;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        context.mode.trackContainerResize(true);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        this.context = context;
        const dataset = context.parameters.records;
        this.dataset = dataset;

        const columns = [...(dataset.columns ?? [])]
            .filter((column) => column.isHidden !== true)
            .sort((left, right) => left.order - right.order)
            .map((column) => ({
                name: column.name,
                displayName: columnLabel(column.name, column.displayName),
                disableSorting: column.disableSorting === true,
            }));

        const records = (dataset.sortedRecordIds ?? []).map((id) => {
            const record = dataset.records[id];
            const values: Record<string, CellValue> = {};
            const formatted: Record<string, string> = {};
            for (const column of columns) {
                values[column.name] = readCell(record, column.name);
                formatted[column.name] = record.getFormattedValue(column.name) ?? "";
            }
            return { id, values, formatted };
        });

        const hostSort = dataset.sorting?.find((item) => item.sortDirection === 0 || item.sortDirection === 1);
        const activeSort = this.requestedSort ?? hostSort;
        const entityName = targetEntity(dataset);
        const height = context.mode.allocatedHeight;

        return React.createElement(ProjectGridView, {
            columns,
            records,
            loading: dataset.loading === true,
            errorMessage: dataset.error ? dataset.errorMessage : "",
            disabled: context.mode.isControlDisabled,
            height: height > 0 ? height : undefined,
            sortColumn: activeSort?.name,
            sortDirection: activeSort?.sortDirection,
            selectedIds: this.selectedIds,
            pageSize: dataset.paging?.pageSize > 0 ? dataset.paging.pageSize : DEFAULT_PAGE_SIZE,
            totalCount: dataset.paging?.totalResultCount ?? -1,
            hasNextPage: dataset.paging?.hasNextPage === true,
            hasPreviousPage: dataset.paging?.hasPreviousPage === true,
            entityName,
            layoutKey: layoutStorageKey(context.userSettings.userId, entityName),
            onSort: this.handleSort,
            onFilter: this.handleFilter,
            onPageSize: this.handlePageSize,
            onNextPage: this.handleNextPage,
            onPreviousPage: this.handlePreviousPage,
            onSelectionChange: this.handleSelection,
            onEdit: this.handleEdit,
            loadOptions: this.loadOptions,
        });
    }

    public getOutputs(): IOutputs {
        return {
            SelectedIds: JSON.stringify(this.selectedIds),
        };
    }

    public destroy(): void {
        // No resources to clean up.
    }

    private handleSort = (columnName: string): void => {
        const current = this.requestedSort?.name === columnName ? this.requestedSort : this.dataset.sorting?.find((item) => item.name === columnName);
        const sortDirection: SortDirection = current?.sortDirection === 0 ? 1 : 0;
        this.requestedSort = { name: columnName, sortDirection };
        this.dataset.sorting = [this.requestedSort];
        this.dataset.refresh();
    };

    private handleFilter = (filters: ColumnFilterMap): void => {
        const conditions = toFilterConditions(filters);
        if (conditions.length === 0) this.dataset.filtering.clearFilter();
        else this.dataset.filtering.setFilter({ filterOperator: 0, conditions });
        this.dataset.refresh();
    };

    private handlePageSize = (pageSize: number): void => {
        this.dataset.paging.setPageSize(pageSize);
        this.dataset.refresh();
    };

    private handleNextPage = (): void => {
        this.dataset.paging.loadNextPage(true);
    };

    private handlePreviousPage = (): void => {
        this.dataset.paging.loadPreviousPage(true);
    };

    private handleSelection = (ids: string[]): void => {
        this.selectedIds = ids;
        try {
            this.dataset.setSelectedRecordIds(ids);
        } catch {
            // Canvas still receives the output below.
        }
        this.notifyOutputChanged();
    };

    private handleEdit = async (
        recordId: string,
        columnName: string,
        value: number | boolean
    ): Promise<void> => {
        const entity = targetEntity(this.dataset);
        if (!entity) throw new Error("Could not save the change.");
        const data: ComponentFramework.WebApi.Entity = {};
        data[columnName] = value;
        try {
            await this.context.webAPI.updateRecord(entity, recordId, data);
        } catch (error: unknown) {
            const message = error instanceof Error && error.message ? error.message : "Could not save the change.";
            throw new Error(message);
        }
        this.dataset.refresh();
    };

    private loadOptions = async (): Promise<{ options: OptionMap; degraded: boolean }> => {
        const entity = targetEntity(this.dataset);
        if (!entity) return { options: fallbackOptionMap(), degraded: true };
        try {
            const metadata: unknown = await this.context.utils.getEntityMetadata(entity, [...EDITABLE_COLUMNS]);
            const options = parseChoiceOptions(metadata, EDITABLE_COLUMNS);
            const found = EDITABLE_COLUMNS.some((name) => (options[name]?.length ?? 0) > 0);
            if (!found) return { options: fallbackOptionMap(), degraded: true };
            return { options, degraded: false };
        } catch {
            return { options: fallbackOptionMap(), degraded: true };
        }
    };

}

function targetEntity(dataset: DataSet): string {
    try {
        return dataset.getTargetEntityType() ?? "";
    } catch {
        return "";
    }
}

function readCell(record: EntityRecord, columnName: string): CellValue {
    try {
        const value = record.getValue(columnName);
        if (value === null || value === undefined) return null;
        if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return value;
        }
        return null;
    } catch {
        return null;
    }
}
