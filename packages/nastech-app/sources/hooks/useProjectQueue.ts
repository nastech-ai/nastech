import * as React from 'react';
import { useAllMachines } from '@/sync/storage';
import { isMachineOnline } from '@/utils/machineUtils';
import {
    getWorkMode,
    setWorkMode,
    loadQueue,
    enqueueTask,
    markTaskDispatched,
    markTaskFailed,
    removeTask,
    clearDispatchedTasks,
    clearAllTasks,
    getPendingTasksForMachine,
    type WorkMode,
    type QueuedTask,
} from '@/sync/queueStorage';
import { sync } from '@/sync/sync';

export { WorkMode, QueuedTask };

export function useWorkMode(): [WorkMode, (mode: WorkMode) => void] {
    const [mode, setMode] = React.useState<WorkMode>(getWorkMode);
    const update = React.useCallback((m: WorkMode) => {
        setWorkMode(m);
        setMode(m);
    }, []);
    return [mode, update];
}

export function useProjectQueue() {
    const [tasks, setTasks] = React.useState<QueuedTask[]>(loadQueue);
    const [mode, setMode] = useWorkMode();
    const machines = useAllMachines({ includeOffline: true });

    const refresh = React.useCallback(() => setTasks(loadQueue()), []);

    const addTask = React.useCallback((task: Omit<QueuedTask, 'id' | 'createdAt' | 'status'>) => {
        enqueueTask(task);
        refresh();
    }, [refresh]);

    const deleteTask = React.useCallback((id: string) => {
        removeTask(id);
        refresh();
    }, [refresh]);

    const clearCompleted = React.useCallback(() => {
        clearDispatchedTasks();
        refresh();
    }, [refresh]);

    const clearAll = React.useCallback(() => {
        clearAllTasks();
        refresh();
    }, [refresh]);

    // Auto-dispatch: when a machine comes online, send its pending tasks
    const prevMachineOnlineRef = React.useRef<Record<string, boolean>>({});

    React.useEffect(() => {
        const nowOnline: Record<string, boolean> = {};
        for (const m of machines) {
            nowOnline[m.id] = isMachineOnline(m);
        }

        for (const m of machines) {
            const wasOnline = prevMachineOnlineRef.current[m.id] ?? false;
            const isOnline = nowOnline[m.id];

            if (!wasOnline && isOnline) {
                // Machine just came online — dispatch its pending tasks
                const pending = getPendingTasksForMachine(m.id);
                for (const task of pending) {
                    sync.sendQueuedTask(m.id, task).then(() => {
                        markTaskDispatched(task.id);
                        refresh();
                    }).catch((err: any) => {
                        markTaskFailed(task.id, err?.message ?? 'Unknown error');
                        refresh();
                    });
                }
            }
        }

        prevMachineOnlineRef.current = nowOnline;
    }, [machines, refresh]);

    const pendingCount = tasks.filter(t => t.status === 'pending').length;

    return { tasks, mode, setMode, addTask, deleteTask, clearCompleted, clearAll, refresh, pendingCount };
}
