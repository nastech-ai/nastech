import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Text } from '@/components/StyledText';
import { Typography } from '@/constants/Typography';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RoundButton } from '@/components/RoundButton';
import { Modal } from '@/modal';
import { layout } from '@/components/layout';
import { t } from '@/text';
import { getServerUrl, setServerUrl, validateServerUrl, getServerInfo } from '@/sync/serverConfig';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type ServerStatus = 'checking' | 'online' | 'offline';

function useServerStatus(serverUrl: string) {
    const [status, setStatus] = useState<ServerStatus>('checking');
    const [latency, setLatency] = useState<number | null>(null);

    const check = useCallback(async () => {
        setStatus('checking');
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${serverUrl}/v1/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const ms = Date.now() - start;
            setLatency(ms);
            setStatus(res.ok ? 'online' : 'offline');
        } catch {
            setLatency(null);
            setStatus('offline');
        }
    }, [serverUrl]);

    useEffect(() => {
        check();
        const interval = setInterval(check, 30000);
        return () => clearInterval(interval);
    }, [check]);

    return { status, latency, refresh: check };
}

const stylesheet = StyleSheet.create((theme) => ({
    keyboardAvoidingView: {
        flex: 1,
    },
    itemListContainer: {
        flex: 1,
    },
    contentContainer: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusLabel: {
        ...Typography.default('semiBold'),
        fontSize: 14,
        flex: 1,
    },
    statusLatency: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    labelText: {
        ...Typography.default('semiBold'),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: theme.colors.input.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        ...Typography.mono(),
        fontSize: 14,
        color: theme.colors.input.text,
    },
    textInputValidating: {
        opacity: 0.6,
    },
    errorText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textDestructive,
        marginBottom: 12,
    },
    validatingText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.status.connecting,
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    buttonWrapper: {
        flex: 1,
    },
    statusText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
}));

export default function ServerConfigScreen() {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const router = useRouter();
    const serverInfo = getServerInfo();
    const currentServerUrl = getServerUrl();
    const [inputUrl, setInputUrl] = useState(serverInfo.isCustom ? currentServerUrl : '');
    const [error, setError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const { status: serverStatus, latency, refresh: refreshStatus } = useServerStatus(currentServerUrl);

    const statusColor = serverStatus === 'online'
        ? theme.colors.status?.connected ?? '#34C759'
        : serverStatus === 'offline'
            ? theme.colors.textDestructive ?? '#FF3B30'
            : theme.colors.status?.connecting ?? '#FF9500';

    const statusLabel = serverStatus === 'online'
        ? 'Online'
        : serverStatus === 'offline'
            ? 'Offline'
            : 'Checking…';

    const validateServer = async (url: string): Promise<boolean> => {
        try {
            setIsValidating(true);
            setError(null);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain'
                }
            });

            if (!response.ok) {
                setError(t('server.serverReturnedError'));
                return false;
            }

            const text = await response.text();
            if (!text.includes('Welcome to NasTech Server!')) {
                setError(t('server.notValidNasTechServer'));
                return false;
            }

            return true;
        } catch (err) {
            setError(t('server.failedToConnectToServer'));
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = async () => {
        if (!inputUrl.trim()) {
            Modal.alert(t('common.error'), t('server.enterServerUrl'));
            return;
        }

        const validation = validateServerUrl(inputUrl);
        if (!validation.valid) {
            setError(validation.error || t('errors.invalidFormat'));
            return;
        }

        const isValid = await validateServer(inputUrl);
        if (!isValid) {
            return;
        }

        const confirmed = await Modal.confirm(
            t('server.changeServer'),
            t('server.continueWithServer'),
            { confirmText: t('common.continue'), destructive: true }
        );

        if (confirmed) {
            setServerUrl(inputUrl);
            refreshStatus();
        }
    };

    const handleReset = async () => {
        const confirmed = await Modal.confirm(
            t('server.resetToDefault'),
            t('server.resetServerDefault'),
            { confirmText: t('common.reset'), destructive: true }
        );

        if (confirmed) {
            setServerUrl(null);
            setInputUrl('');
            refreshStatus();
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: t('server.serverConfiguration'),
                    headerBackTitle: t('common.back'),
                }}
            />

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ItemList style={styles.itemListContainer}>
                    <ItemGroup>
                        <View style={styles.statusRow}>
                            {serverStatus === 'checking' ? (
                                <ActivityIndicator size="small" color={statusColor} />
                            ) : (
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            )}
                            <Text style={[styles.statusLabel, { color: statusColor }]}>
                                {statusLabel}
                            </Text>
                            {serverStatus === 'online' && latency !== null && (
                                <Text style={styles.statusLatency}>{latency}ms</Text>
                            )}
                        </View>
                    </ItemGroup>

                    <ItemGroup footer={t('server.advancedFeatureFooter')}>
                        <View style={styles.contentContainer}>
                            <Text style={styles.labelText}>{t('server.customServerUrlLabel').toUpperCase()}</Text>
                            <TextInput
                                style={[
                                    styles.textInput,
                                    isValidating && styles.textInputValidating
                                ]}
                                value={inputUrl}
                                onChangeText={(text) => {
                                    setInputUrl(text);
                                    setError(null);
                                }}
                                placeholder={t('common.urlPlaceholder')}
                                placeholderTextColor={theme.colors.input.placeholder}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                                editable={!isValidating}
                            />
                            {error && (
                                <Text style={styles.errorText}>
                                    {error}
                                </Text>
                            )}
                            {isValidating && (
                                <Text style={styles.validatingText}>
                                    {t('server.validatingServer')}
                                </Text>
                            )}
                            <View style={styles.buttonRow}>
                                <View style={styles.buttonWrapper}>
                                    <RoundButton
                                        title={t('server.resetToDefault')}
                                        size="normal"
                                        display="inverted"
                                        onPress={handleReset}
                                    />
                                </View>
                                <View style={styles.buttonWrapper}>
                                    <RoundButton
                                        title={isValidating ? t('server.validating') : t('common.save')}
                                        size="normal"
                                        action={handleSave}
                                        disabled={isValidating}
                                    />
                                </View>
                            </View>
                            {serverInfo.isCustom && (
                                <Text style={styles.statusText}>
                                    {t('server.currentlyUsingCustomServer')}
                                </Text>
                            )}
                        </View>
                    </ItemGroup>

                </ItemList>
            </KeyboardAvoidingView>
        </>
    );
}
