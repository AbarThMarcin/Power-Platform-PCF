import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { KanbanView } from "./KanbanView";

export class TaskKanban
    implements ComponentFramework.ReactControl<IInputs, IOutputs> {

    private notifyOutputChanged!: () => void;
    private changeJson = "";
    private sequence = 0;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        context.mode.trackContainerResize(true);
    }

    private handleMove = (
        taskId: string,
        newStatus: "todo" | "doing" | "done"
    ): void => {
        this.sequence += 1;

        this.changeJson = JSON.stringify({
            sequence: this.sequence,
            taskId,
            newStatus
        });

        this.notifyOutputChanged();
    };

    public updateView(
        context: ComponentFramework.Context<IInputs>
    ): React.ReactElement {
        const height = context.mode.allocatedHeight;

        return React.createElement(KanbanView, {
            itemsJson: context.parameters.ItemsJson.raw ?? "",
            syncToken: context.parameters.SyncToken.raw ?? 0,
            disabled: context.mode.isControlDisabled,
            height: height > 0 ? height : undefined,
            onMove: this.handleMove
        });
    }

    public getOutputs(): IOutputs {
        return {
            ChangeJson: this.changeJson
        };
    }

    public destroy(): void {
        // No resources to clean up.
    }
}