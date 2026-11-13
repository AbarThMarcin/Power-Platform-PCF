import * as React from "react";

type Status = "todo" | "doing" | "done";
type TaskType = "story" | "bug" | "issue";

interface Task {
    id: string;
    title: string;
    status: Status;
    assignee: string;
    description: string;
    type: TaskType;
}

interface KanbanViewProps {
    itemsJson: string;
    syncToken: number;
    disabled: boolean;
    height?: number;
    onMove: (taskId: string, newStatus: Status) => void;
}

const columns: { id: Status; title: string }[] = [
    { id: "todo", title: "To do" },
    { id: "doing", title: "In progress" },
    { id: "done", title: "Done" }
];

const taskTypes: { id: TaskType; title: string }[] = [
    { id: "story", title: "Story" },
    { id: "bug", title: "Bug" },
    { id: "issue", title: "Issue" }
];

function isStatus(value: unknown): value is Status {
    return value === "todo" || value === "doing" || value === "done";
}

function isTaskType(value: string): value is TaskType {
    return value === "story" || value === "bug" || value === "issue";
}

function readTask(value: unknown): Task | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const task = value as Record<string, unknown>;
    const type =
        typeof task.type === "string" ? task.type.trim().toLowerCase() : "";

    if (
        typeof task.id !== "string" ||
        task.id.trim().length === 0 ||
        typeof task.title !== "string" ||
        !isStatus(task.status) ||
        typeof task.assignee !== "string" ||
        typeof task.description !== "string" ||
        !isTaskType(type)
    ) {
        return null;
    }

    return {
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        description: task.description,
        type
    };
}

function TaskTypeIcon({ type }: { type: TaskType }): React.ReactElement {
    if (type === "story") {
        return (
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M3.2 1.6h6.2c1 0 1.8.8 1.8 1.8V14L7.6 11.8 3.2 14V1.6z"
                />
            </svg>
        );
    }

    if (type === "bug") {
        return (
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M6.2 3.1 5 1.9l.8-.8L7.1 2.4A2.8 2.8 0 0 1 8 2.2c.3 0 .6.1.9.2l1.3-1.3.8.8-1.2 1.2A2.7 2.7 0 0 1 10.5 6H11v1.1H5V6h.5a2.7 2.7 0 0 1 .7-2.9zM5 8.2h6V9.4c0 1.7-1.3 3.1-3 3.1s-3-1.4-3-3.1V8.2zM2.6 7.4l1.3.7V6.8L2.6 6.1l-1 .1.1 1.2zm10.8 0 .1-1.2-1-.1-1.3.7v1.3l1.3-.7zM3.1 11.2l1-.5.6 1.1-1 .5-.6-1.1zm9.8 0-.6 1.1-1-.5.6-1.1 1 .5z"
                />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                d="M8 4.5v4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <circle cx="8" cy="11.2" r=".9" fill="currentColor" />
        </svg>
    );
}

function AssigneeIcon(): React.ReactElement {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="5" r="2.2" fill="currentColor" />
            <path
                fill="currentColor"
                d="M3.4 13.2c.7-2.2 2.4-3.4 4.6-3.4s3.9 1.2 4.6 3.4H3.4z"
            />
        </svg>
    );
}

function parseTasks(json: string): {
    tasks: Task[];
    error: string;
} {
    try {
        const data: unknown = JSON.parse(json || "[]");

        if (!Array.isArray(data)) {
            throw new Error(
                "Items must be a list of tasks."
            );
        }

        const tasks: Task[] = [];

        for (const item of data) {
            const task = readTask(item);

            if (!task) {
                throw new Error(
                    "Required fields: id, title, status (todo, doing, or done), assignee, description, and type (story, bug, or issue)."
                );
            }

            tasks.push(task);
        }

        if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
            throw new Error("Each task must have a unique ID.");
        }

        return {
            tasks,
            error: ""
        };
    } catch (error: unknown) {
        return {
            tasks: [],
            error:
                error instanceof Error
                    ? error.message
                    : "Invalid data."
        };
    }
}

export function KanbanView({
    itemsJson,
    syncToken,
    disabled,
    height,
    onMove
}: KanbanViewProps): React.ReactElement {
    const parsed = React.useMemo(
        () => parseTasks(itemsJson),
        [itemsJson]
    );

    const [tasks, setTasks] = React.useState<Task[]>(parsed.tasks);
    const [draggedId, setDraggedId] = React.useState<string | null>(null);
    const [overStatus, setOverStatus] = React.useState<Status | null>(null);
    const [announcement, setAnnouncement] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    // Block the next move immediately, before the next render.
    const saveInProgress = React.useRef(false);

    const interactionDisabled = disabled || isSaving;

    // Canvas passes the current data and changes SyncToken after a save finishes or the data reloads.
    React.useEffect(() => {
        setTasks(parsed.tasks);
        setDraggedId(null);
        setOverStatus(null);

        saveInProgress.current = false;
        setIsSaving(false);
        setAnnouncement("");
    }, [parsed, syncToken]);

    function moveTask(taskId: string, newStatus: Status): void {
        const task = tasks.find((item) => item.id === taskId);

        if (
            disabled ||
            saveInProgress.current ||
            !task ||
            task.status === newStatus
        ) {
            return;
        }

        saveInProgress.current = true;
        setIsSaving(true);

        // Optimistic update: the card moves before the save is confirmed.
        setTasks((current) =>
            current.map((item) =>
                item.id === taskId
                    ? { ...item, status: newStatus }
                    : item
            )
        );

        setAnnouncement("Saving change…");

        // The PCF reports the change to Canvas.
        onMove(taskId, newStatus);
    }

    function endDrag(): void {
        setDraggedId(null);
        setOverStatus(null);
    }

    return (
        <div
            className="ab-kanban"
            style={{ height }}
            aria-label="Task board"
        >
            {parsed.error ? (
                <p role="alert">{parsed.error}</p>
            ) : (
                <div
                    className="ab-kanban__board"
                    aria-busy={isSaving}
                >
                    {columns.map((column) => {
                        const columnTasks = tasks.filter(
                            (task) => task.status === column.id
                        );
                        const draggedTask = tasks.find(
                            (task) => task.id === draggedId
                        );
                        const canDrop =
                            draggedTask !== undefined &&
                            draggedTask.status !== column.id &&
                            !interactionDisabled;
                        const isOver = canDrop && overStatus === column.id;

                        return (
                            <section
                                key={column.id}
                                className={
                                    "ab-kanban__column" +
                                    (canDrop
                                        ? " ab-kanban__column--target"
                                        : "") +
                                    (isOver
                                        ? " ab-kanban__column--over"
                                        : "")
                                }
                                data-status={column.id}
                                aria-label={column.title}
                                onDragOver={(event) => {
                                    if (!canDrop) {
                                        return;
                                    }

                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";

                                    if (overStatus !== column.id) {
                                        setOverStatus(column.id);
                                    }
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();

                                    const taskId =
                                        event.dataTransfer.getData(
                                            "text/plain"
                                        );

                                    // Accept a drag only when it started on this board.
                                    if (
                                        canDrop &&
                                        draggedId !== null &&
                                        taskId === draggedId
                                    ) {
                                        moveTask(taskId, column.id);
                                    }

                                    endDrag();
                                }}
                            >
                                <h3 className="ab-kanban__heading">
                                    {column.title}
                                    <span>{columnTasks.length}</span>
                                </h3>

                                {canDrop && (
                                    <div className="ab-kanban__drop">
                                        Drop here
                                    </div>
                                )}

                                {columnTasks.map((task) => (
                                    <article
                                        key={task.id}
                                        className="ab-kanban__card"
                                        data-type={task.type}
                                        data-dragging={
                                            draggedId === task.id
                                        }
                                        draggable={!interactionDisabled}
                                        onDragStart={(event) => {
                                            if (
                                                interactionDisabled ||
                                                saveInProgress.current
                                            ) {
                                                event.preventDefault();
                                                return;
                                            }

                                            event.dataTransfer.setData(
                                                "text/plain",
                                                task.id
                                            );

                                            event.dataTransfer.effectAllowed =
                                                "move";

                                            setDraggedId(task.id);
                                        }}
                                        onDragEnd={endDrag}
                                    >
                                        <div
                                            className="ab-kanban__type"
                                            data-type={task.type}
                                        >
                                            <TaskTypeIcon type={task.type} />
                                            {taskTypes.find(
                                                (item) => item.id === task.type
                                            )?.title}
                                        </div>

                                        <div className="ab-kanban__title">
                                            {task.title}
                                        </div>

                                        {task.description.trim().length > 0 && (
                                            <p className="ab-kanban__description">
                                                {task.description}
                                            </p>
                                        )}

                                        <div className="ab-kanban__assignee">
                                            <AssigneeIcon />
                                            <span>
                                                {task.assignee.trim() ||
                                                    "Unassigned"}
                                            </span>
                                        </div>

                                        <label className="ab-kanban__status">
                                            Status

                                            <select
                                                value={task.status}
                                                disabled={
                                                    interactionDisabled
                                                }
                                                onChange={(event) => {
                                                    const value =
                                                        event.target.value;

                                                    if (isStatus(value)) {
                                                        moveTask(
                                                            task.id,
                                                            value
                                                        );
                                                    }
                                                }}
                                            >
                                                {columns.map((option) => (
                                                    <option
                                                        key={option.id}
                                                        value={option.id}
                                                    >
                                                        {option.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </article>
                                ))}

                                {columnTasks.length === 0 && !canDrop && (
                                    <p className="ab-kanban__empty">
                                        Drop a task here
                                    </p>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            <div
                className="ab-kanban__announcement"
                role="status"
                aria-live="polite"
            >
                {announcement}
            </div>
        </div>
    );
}