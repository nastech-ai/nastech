import { MMKV } from 'react-native-mmkv';

const queueStorage = new MMKV({ id: 'nastech-project-queue' });
const QUEUE_KEY = 'task-queue-v1';
const MODE_KEY = 'work-mode-v1';

export type WorkMode = 'normal' | 'queue';

export interface QueuedTask {
    id: string;
    machineId: string;
    machineName: string;
    projectPath: string;
    taskDescription: string;
    agentType: 'claude' | 'codex' | 'gemini' | 'openclaw';
    createdAt: number;
    status: 'pending' | 'dispatched' | 'failed';
    failReason?: string;
}

export function getWorkMode(): WorkMode {
    return (queueStorage.getString(MODE_KEY) as WorkMode) || 'normal';
}

export function setWorkMode(mode: WorkMode): void {
    queueStorage.set(MODE_KEY, mode);
}

export function loadQueue(): QueuedTask[] {
    const raw = queueStorage.getString(QUEUE_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

function saveQueue(tasks: QueuedTask[]): void {
    queueStorage.set(QUEUE_KEY, JSON.stringify(tasks));
}

export function enqueueTask(task: Omit<QueuedTask, 'id' | 'createdAt' | 'status'>): QueuedTask {
    const newTask: QueuedTask = {
        ...task,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        status: 'pending',
    };
    const queue = loadQueue();
    queue.push(newTask);
    saveQueue(queue);
    return newTask;
}

export function markTaskDispatched(taskId: string): void {
    const queue = loadQueue();
    const idx = queue.findIndex(t => t.id === taskId);
    if (idx !== -1) {
        queue[idx].status = 'dispatched';
        saveQueue(queue);
    }
}

export function markTaskFailed(taskId: string, reason: string): void {
    const queue = loadQueue();
    const idx = queue.findIndex(t => t.id === taskId);
    if (idx !== -1) {
        queue[idx].status = 'failed';
        queue[idx].failReason = reason;
        saveQueue(queue);
    }
}

export function removeTask(taskId: string): void {
    const queue = loadQueue().filter(t => t.id !== taskId);
    saveQueue(queue);
}

export function clearDispatchedTasks(): void {
    const queue = loadQueue().filter(t => t.status === 'pending');
    saveQueue(queue);
}

export function clearAllTasks(): void {
    saveQueue([]);
}

export function getPendingTasksForMachine(machineId: string): QueuedTask[] {
    return loadQueue().filter(t => t.machineId === machineId && t.status === 'pending');
}
