import * as React from 'react';
import { View, ScrollView, Alert, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { Text } from '@/components/StyledText';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Switch } from '@/components/Switch';
import { useProjectQueue, type QueuedTask } from '@/hooks/useProjectQueue';
import { useAllMachines } from '@/sync/storage';
import { isMachineOnline } from '@/utils/machineUtils';

const AGENT_LABELS: Record<string, string> = {
    claude: 'Claude Code',
    codex: 'Codex',
    gemini: 'Gemini',
    openclaw: 'OpenClaw',
};

const AGENT_COLORS: Record<string, string> = {
    claude: '#D97757',
    codex: '#007AFF',
    gemini: '#4285F4',
    openclaw: '#34C759',
};

function formatRelativeTime(ts: number): string {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function TaskRow({ task, onDelete }: { task: QueuedTask; onDelete: () => void }) {
    const { theme } = useUnistyles();
    const statusColor = task.status === 'dispatched' ? '#34C759' : task.status === 'failed' ? '#FF3B30' : '#FF9500';
    const statusLabel = task.status === 'dispatched' ? 'Sent' : task.status === 'failed' ? 'Failed' : 'Queued';

    return (
        <View style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.colors.separator,
            backgroundColor: theme.colors.surface,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{
                    backgroundColor: AGENT_COLORS[task.agentType] + '22',
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    marginRight: 8,
                }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: AGENT_COLORS[task.agentType] }}>
                        {AGENT_LABELS[task.agentType] ?? task.agentType}
                    </Text>
                </View>
                <View style={{ backgroundColor: statusColor + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginLeft: 'auto' }}>
                    {formatRelativeTime(task.createdAt)}
                </Text>
            </View>
            <Text style={{ fontSize: 15, color: theme.colors.text, marginBottom: 2 }} numberOfLines={2}>
                {task.taskDescription}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                    {task.machineName} • {task.projectPath}
                </Text>
                <Pressable onPress={onDelete} hitSlop={12}>
                    <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
                </Pressable>
            </View>
            {task.status === 'failed' && task.failReason && (
                <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: 4 }}>
                    {task.failReason}
                </Text>
            )}
        </View>
    );
}

export default function QueueSettingsScreen() {
    const { theme } = useUnistyles();
    const { tasks, mode, setMode, deleteTask, clearCompleted, clearAll, pendingCount } = useProjectQueue();
    const machines = useAllMachines({ includeOffline: true });
    const onlineMachines = machines.filter(isMachineOnline);

    const queueEnabled = mode === 'queue';

    const handleClearAll = () => {
        Alert.alert(
            'Clear All Tasks',
            'Remove all queued, sent, and failed tasks?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: clearAll },
            ]
        );
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Work Queue' }} />
            <ItemList style={{ paddingTop: 0 }}>

                {/* Mode Toggle */}
                <ItemGroup
                    title="Work Mode"
                    footer={
                        queueEnabled
                            ? 'Tasks are queued on your phone and auto-dispatched when a PC comes online.'
                            : 'Tasks are sent directly to an online PC. Queue mode is off.'
                    }
                >
                    <Item
                        title="Queue Mode"
                        subtitle={queueEnabled ? 'Enabled — tasks queue when PC is offline' : 'Disabled — tasks run directly'}
                        icon={<Ionicons name="layers-outline" size={29} color="#FF9500" />}
                        rightElement={
                            <Switch
                                value={queueEnabled}
                                onValueChange={(v) => setMode(v ? 'queue' : 'normal')}
                            />
                        }
                        showChevron={false}
                    />
                </ItemGroup>

                {/* Machine Status */}
                <ItemGroup title="PC Status">
                    {machines.length === 0 ? (
                        <View style={{ padding: 16 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                                No machines connected yet. Scan QR code from the main settings to connect a PC.
                            </Text>
                        </View>
                    ) : machines.map(m => {
                        const online = isMachineOnline(m);
                        const pending = pendingCount > 0 && !online
                            ? tasks.filter(t => t.machineId === m.id && t.status === 'pending').length
                            : 0;
                        return (
                            <Item
                                key={m.id}
                                title={m.metadata?.displayName ?? m.metadata?.host ?? 'Unknown PC'}
                                subtitle={online
                                    ? 'Online — tasks will dispatch immediately'
                                    : pending > 0
                                        ? `Offline — ${pending} task${pending !== 1 ? 's' : ''} queued`
                                        : 'Offline'}
                                icon={
                                    <Ionicons
                                        name="desktop-outline"
                                        size={29}
                                        color={online ? '#34C759' : '#FF9500'}
                                    />
                                }
                                showChevron={false}
                            />
                        );
                    })}
                </ItemGroup>

                {/* Queue Stats */}
                {tasks.length > 0 && (
                    <ItemGroup title={`Queued Tasks (${tasks.length})`}>
                        {tasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                onDelete={() => deleteTask(task.id)}
                            />
                        ))}
                        <Item
                            title="Clear Sent & Failed"
                            icon={<Ionicons name="checkmark-done-outline" size={29} color="#007AFF" />}
                            onPress={clearCompleted}
                            showChevron={false}
                        />
                        <Item
                            title="Clear All Tasks"
                            icon={<Ionicons name="trash-outline" size={29} color="#FF3B30" />}
                            onPress={handleClearAll}
                            showChevron={false}
                            titleStyle={{ color: '#FF3B30' }}
                        />
                    </ItemGroup>
                )}

                {tasks.length === 0 && (
                    <ItemGroup>
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.textSecondary} style={{ marginBottom: 12 }} />
                            <Text style={{ fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center' }}>
                                No tasks in queue.{'\n'}
                                {queueEnabled
                                    ? 'Tasks you create while a PC is offline will appear here.'
                                    : 'Enable Queue Mode to start batching tasks.'}
                            </Text>
                        </View>
                    </ItemGroup>
                )}

                {/* How It Works */}
                <ItemGroup title="How Queue Mode Works" footer="API keys stay on your device and are never shared.">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 22 }}>
                            1. Enable Queue Mode in settings{'\n'}
                            2. Create tasks in the app — even when your PC is off{'\n'}
                            3. Tasks are stored locally on your phone{'\n'}
                            4. When your PC comes back online, tasks dispatch automatically{'\n'}
                            5. Track progress from the Queued Tasks list above
                        </Text>
                    </View>
                </ItemGroup>

            </ItemList>
        </>
    );
}
