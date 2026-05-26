import * as React from 'react';
import { View, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { Text } from '@/components/StyledText';
import { useUnistyles } from 'react-native-unistyles';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Ionicons } from '@expo/vector-icons';
import { MMKV } from 'react-native-mmkv';
import { Stack } from 'expo-router';

const aiConfigStorage = new MMKV({ id: 'nastech-ai-config' });

const PROVIDERS = [
    { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', baseUrl: null },
    { id: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-...', baseUrl: null },
    { id: 'groq', label: 'Groq (Free fast models)', placeholder: 'gsk_...', baseUrl: null },
    { id: 'ollama', label: 'Ollama (Local)', placeholder: 'http://localhost:11434', baseUrl: 'http://localhost:11434' },
    { id: 'custom', label: 'Custom (OpenAI-compatible)', placeholder: 'sk-...', baseUrl: '' },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

export default function AIApiSettingsScreen() {
    const { theme } = useUnistyles();
    const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(
        (aiConfigStorage.getString('provider') as ProviderId) || 'anthropic'
    );
    const [apiKey, setApiKey] = React.useState(aiConfigStorage.getString('api_key') || '');
    const [baseUrl, setBaseUrl] = React.useState(aiConfigStorage.getString('base_url') || '');
    const [model, setModel] = React.useState(aiConfigStorage.getString('model') || '');
    const [testing, setTesting] = React.useState(false);

    const provider = PROVIDERS.find(p => p.id === selectedProvider)!;

    const save = () => {
        aiConfigStorage.set('provider', selectedProvider);
        aiConfigStorage.set('api_key', apiKey);
        aiConfigStorage.set('base_url', baseUrl);
        aiConfigStorage.set('model', model);
        Alert.alert('Saved', 'AI API settings saved.');
    };

    const testConnection = async () => {
        setTesting(true);
        try {
            const serverUrl = require('@/sync/serverConfig').getServerUrl();
            const body: any = { provider: selectedProvider, model: model || undefined };
            if (apiKey) body.api_key = apiKey;
            if (baseUrl) body.base_url = baseUrl;
            if (!apiKey && selectedProvider !== 'ollama') {
                body.api_key = apiKey;
            }
            const resp = await fetch(`${serverUrl}/v1/ai/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await resp.json();
            if (result.success) {
                Alert.alert('Success', `Connected to ${selectedProvider} successfully!`);
            } else {
                Alert.alert('Failed', result.error || 'Connection failed');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not reach server');
        } finally {
            setTesting(false);
        }
    };

    const clear = () => {
        setApiKey('');
        setBaseUrl('');
        setModel('');
        aiConfigStorage.delete('api_key');
        aiConfigStorage.delete('base_url');
        aiConfigStorage.delete('model');
        Alert.alert('Cleared', 'AI API settings cleared.');
    };

    const inputStyle = {
        backgroundColor: theme.colors.surface,
        color: theme.colors.text,
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.colors.separator,
    };

    return (
        <>
            <Stack.Screen options={{ title: 'Custom AI API' }} />
            <ItemList>
                {/* Provider Selector */}
                <ItemGroup title="AI Provider">
                    {PROVIDERS.map(p => (
                        <Pressable
                            key={p.id}
                            onPress={() => {
                                setSelectedProvider(p.id);
                                aiConfigStorage.set('provider', p.id);
                                if (p.baseUrl !== null) setBaseUrl(p.baseUrl);
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                paddingHorizontal: 16,
                                backgroundColor: theme.colors.surface,
                                borderBottomWidth: 0.5,
                                borderBottomColor: theme.colors.separator,
                            }}
                        >
                            <Ionicons
                                name={selectedProvider === p.id ? 'radio-button-on' : 'radio-button-off'}
                                size={22}
                                color={selectedProvider === p.id ? '#007AFF' : theme.colors.textSecondary}
                                style={{ marginRight: 12 }}
                            />
                            <Text style={{ fontSize: 16, color: theme.colors.text }}>{p.label}</Text>
                        </Pressable>
                    ))}
                </ItemGroup>

                {/* API Key */}
                {selectedProvider !== 'ollama' && (
                    <ItemGroup title="API Key">
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <TextInput
                                style={inputStyle}
                                value={apiKey}
                                onChangeText={setApiKey}
                                placeholder={provider.placeholder}
                                placeholderTextColor={theme.colors.textSecondary}
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                Your API key is stored locally on your device and never sent to NasTech servers.
                            </Text>
                        </View>
                    </ItemGroup>
                )}

                {/* Base URL (Ollama + Custom) */}
                {(selectedProvider === 'ollama' || selectedProvider === 'custom') && (
                    <ItemGroup title="Base URL">
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <TextInput
                                style={inputStyle}
                                value={baseUrl}
                                onChangeText={setBaseUrl}
                                placeholder={selectedProvider === 'ollama' ? 'http://localhost:11434' : 'https://your-api.example.com'}
                                placeholderTextColor={theme.colors.textSecondary}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                            />
                            {selectedProvider === 'ollama' && (
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                                    Make sure Ollama is running and accessible from your device.
                                </Text>
                            )}
                        </View>
                    </ItemGroup>
                )}

                {/* Optional Model */}
                <ItemGroup title="Model (optional)">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TextInput
                            style={inputStyle}
                            value={model}
                            onChangeText={setModel}
                            placeholder={
                                selectedProvider === 'anthropic' ? 'claude-3-haiku-20240307' :
                                selectedProvider === 'openai' ? 'gpt-4o-mini' :
                                selectedProvider === 'groq' ? 'llama-3.1-8b-instant' :
                                selectedProvider === 'ollama' ? 'llama3' :
                                'model-name'
                            }
                            placeholderTextColor={theme.colors.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Leave blank to use the default model for the selected provider.
                        </Text>
                    </View>
                </ItemGroup>

                {/* Actions */}
                <ItemGroup>
                    <Pressable
                        onPress={save}
                        style={{
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            backgroundColor: '#007AFF',
                            borderRadius: 10,
                            margin: 12,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Save Settings</Text>
                    </Pressable>
                    <Pressable
                        onPress={testConnection}
                        disabled={testing}
                        style={{
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            backgroundColor: theme.colors.surface,
                            borderRadius: 10,
                            marginHorizontal: 12,
                            marginBottom: 8,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#007AFF',
                        }}
                    >
                        <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 16 }}>
                            {testing ? 'Testing...' : 'Test Connection'}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={clear}
                        style={{
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            marginHorizontal: 12,
                            marginBottom: 12,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#FF3B30', fontSize: 15 }}>Clear Settings</Text>
                    </Pressable>
                </ItemGroup>

                {/* Info */}
                <ItemGroup title="Supported Providers">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
                            • Anthropic (Claude 3 Haiku, Sonnet){'\n'}
                            • OpenAI (GPT-4o, GPT-4o mini){'\n'}
                            • Groq (free fast Llama 3.1 models){'\n'}
                            • Ollama (local, any model){'\n'}
                            • Any OpenAI-compatible API
                        </Text>
                    </View>
                </ItemGroup>
            </ItemList>
        </>
    );
}
