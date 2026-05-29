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
    {
        id: 'anthropic',
        label: 'Anthropic',
        sublabel: 'Claude 3/4 — Opus, Sonnet, Haiku',
        placeholder: 'sk-ant-api03-...',
        baseUrl: null,
        defaultModel: 'claude-sonnet-4-5',
        modelHint: 'claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5',
        docsUrl: 'https://docs.anthropic.com/api',
        color: '#D97757',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        sublabel: 'GPT-4o, o1, o3, Codex',
        placeholder: 'sk-proj-...',
        baseUrl: null,
        defaultModel: 'gpt-4o',
        modelHint: 'gpt-4o, gpt-4o-mini, o3, o4-mini',
        docsUrl: 'https://platform.openai.com/docs',
        color: '#10A37F',
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        sublabel: 'Gemini 2.5 Pro, Flash',
        placeholder: 'AIzaSy...',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-2.5-pro',
        modelHint: 'gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash',
        docsUrl: 'https://ai.google.dev/gemini-api/docs',
        color: '#4285F4',
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        sublabel: 'DeepSeek R2, V3 — very cheap',
        placeholder: 'sk-...',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-reasoner',
        modelHint: 'deepseek-reasoner, deepseek-chat',
        docsUrl: 'https://platform.deepseek.com/api-docs',
        color: '#2D5BE3',
    },
    {
        id: 'xai',
        label: 'xAI',
        sublabel: 'Grok 3, Grok 3 mini',
        placeholder: 'xai-...',
        baseUrl: 'https://api.x.ai/v1',
        defaultModel: 'grok-3',
        modelHint: 'grok-3, grok-3-mini, grok-3-fast',
        docsUrl: 'https://docs.x.ai/api',
        color: '#000000',
    },
    {
        id: 'mistral',
        label: 'Mistral AI',
        sublabel: 'Mistral Large, Codestral',
        placeholder: 'your-api-key',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultModel: 'mistral-large-latest',
        modelHint: 'mistral-large-latest, codestral-latest, mistral-small-latest',
        docsUrl: 'https://docs.mistral.ai/api',
        color: '#FF7000',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        sublabel: 'All models via one API',
        placeholder: 'sk-or-v1-...',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'anthropic/claude-sonnet-4-5',
        modelHint: 'anthropic/claude-..., openai/gpt-..., google/gemini-...',
        docsUrl: 'https://openrouter.ai/docs',
        color: '#6B3FA0',
    },
    {
        id: 'perplexity',
        label: 'Perplexity',
        sublabel: 'Sonar — live web search',
        placeholder: 'pplx-...',
        baseUrl: 'https://api.perplexity.ai',
        defaultModel: 'sonar-pro',
        modelHint: 'sonar-pro, sonar, sonar-reasoning-pro',
        docsUrl: 'https://docs.perplexity.ai',
        color: '#21808D',
    },
    {
        id: 'together',
        label: 'Together AI',
        sublabel: 'Open source models, fast',
        placeholder: 'your-api-key',
        baseUrl: 'https://api.together.xyz/v1',
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        modelHint: 'meta-llama/Llama-3.3-70B-..., Qwen/..., mistralai/...',
        docsUrl: 'https://docs.together.ai',
        color: '#FF4B4B',
    },
    {
        id: 'groq',
        label: 'Groq',
        sublabel: 'Free fast Llama / Mistral',
        placeholder: 'gsk_...',
        baseUrl: null,
        defaultModel: 'llama-3.3-70b-versatile',
        modelHint: 'llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768',
        docsUrl: 'https://console.groq.com/docs',
        color: '#F55036',
    },
    {
        id: 'ollama',
        label: 'Ollama',
        sublabel: 'Local models on your machine',
        placeholder: 'http://localhost:11434',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3',
        modelHint: 'llama3, mistral, phi3, codellama, qwen2',
        docsUrl: 'https://ollama.com/library',
        color: '#333333',
    },
    {
        id: 'custom',
        label: 'Custom Endpoint',
        sublabel: 'Any OpenAI-compatible API',
        placeholder: 'sk-...',
        baseUrl: '',
        defaultModel: '',
        modelHint: 'Enter the model name for your endpoint',
        docsUrl: null,
        color: '#8E8E93',
    },
] as const;

type ProviderId = typeof PROVIDERS[number]['id'];

function ProviderDot({ color }: { color: string }) {
    return (
        <View style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: color, marginRight: 10,
        }} />
    );
}

export default function AIApiSettingsScreen() {
    const { theme } = useUnistyles();
    const [selectedProvider, setSelectedProvider] = React.useState<ProviderId>(
        (aiConfigStorage.getString('provider') as ProviderId) || 'anthropic'
    );
    const [apiKey, setApiKey] = React.useState(aiConfigStorage.getString('api_key') || '');
    const [baseUrl, setBaseUrl] = React.useState(aiConfigStorage.getString('base_url') || '');
    const [model, setModel] = React.useState(aiConfigStorage.getString('model') || '');
    const [testing, setTesting] = React.useState(false);
    const [showAll, setShowAll] = React.useState(false);

    const provider = (PROVIDERS.find(p => p.id === selectedProvider) ?? PROVIDERS[0]) as { id: string; label: string; sublabel: string; placeholder: string; baseUrl: string | null; defaultModel: string; modelHint: string; docsUrl: string | null; color: string };
    const displayedProviders = showAll ? PROVIDERS : PROVIDERS.slice(0, 6);

    const inputStyle = {
        backgroundColor: theme.colors.input.background,
        color: theme.colors.text,
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.colors.divider,
    };

    const selectProvider = (id: ProviderId) => {
        const p = PROVIDERS.find(pr => pr.id === id)!;
        setSelectedProvider(id);
        aiConfigStorage.set('provider', id);
        if (p.baseUrl !== null) {
            setBaseUrl(p.baseUrl);
        }
        setModel('');
    };

    const save = () => {
        aiConfigStorage.set('provider', selectedProvider);
        aiConfigStorage.set('api_key', apiKey);
        aiConfigStorage.set('base_url', baseUrl);
        aiConfigStorage.set('model', model);
        Alert.alert('Saved', `${provider.label} API settings saved.`);
    };

    const testConnection = async () => {
        if (!apiKey && selectedProvider !== 'ollama') {
            Alert.alert('No API Key', 'Please enter your API key before testing.');
            return;
        }
        setTesting(true);
        try {
            const { getServerUrl } = require('@/sync/serverConfig');
            const serverUrl = getServerUrl();
            const body: Record<string, string> = { provider: selectedProvider };
            if (apiKey) body.api_key = apiKey;
            if (baseUrl) body.base_url = baseUrl;
            if (model) body.model = model;
            const resp = await fetch(`${serverUrl}/v1/ai/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await resp.json();
            if (result.success) {
                Alert.alert('Connected', `${provider.label} responded successfully!`);
            } else {
                Alert.alert('Failed', result.error || 'Connection test failed.');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not reach server.');
        } finally {
            setTesting(false);
        }
    };

    const clear = () => {
        Alert.alert('Clear Settings', `Remove ${provider.label} API key and settings?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: () => {
                    setApiKey(''); setBaseUrl(''); setModel('');
                    ['api_key', 'base_url', 'model'].forEach(k => aiConfigStorage.delete(k));
                    Alert.alert('Cleared', 'API settings cleared.');
                }
            },
        ]);
    };

    return (
        <>
            <Stack.Screen options={{ title: 'AI API Settings' }} />
            <ItemList>
                {/* Provider Selector */}
                <ItemGroup title="Provider" footer="Your API key is stored locally and never sent to NasTech servers.">
                    {(displayedProviders as typeof PROVIDERS[number][]).map(p => (
                        <Pressable
                            key={p.id}
                            onPress={() => selectProvider(p.id)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 13,
                                paddingHorizontal: 16,
                                backgroundColor: selectedProvider === p.id
                                    ? (theme.dark ? p.color + '22' : p.color + '18')
                                    : theme.colors.surface,
                                borderBottomWidth: 0.5,
                                borderBottomColor: theme.colors.divider,
                            }}
                        >
                            <Ionicons
                                name={selectedProvider === p.id ? 'radio-button-on' : 'radio-button-off'}
                                size={20}
                                color={selectedProvider === p.id ? p.color : theme.colors.textSecondary}
                                style={{ marginRight: 10 }}
                            />
                            <ProviderDot color={p.color} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, color: theme.colors.text, fontWeight: selectedProvider === p.id ? '600' : '400' }}>
                                    {p.label}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 }}>
                                    {p.sublabel}
                                </Text>
                            </View>
                            {selectedProvider === p.id && (
                                <Ionicons name="checkmark-circle" size={20} color={p.color} />
                            )}
                        </Pressable>
                    ))}
                    {!showAll && (
                        <Pressable
                            onPress={() => setShowAll(true)}
                            style={{ paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', backgroundColor: theme.colors.surface }}
                        >
                            <Text style={{ color: '#007AFF', fontSize: 14 }}>
                                Show all {PROVIDERS.length} providers…
                            </Text>
                        </Pressable>
                    )}
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
                        </View>
                    </ItemGroup>
                )}

                {/* Base URL */}
                {(selectedProvider === 'ollama' || selectedProvider === 'custom' ||
                  (provider.baseUrl && provider.baseUrl !== null)) && (
                    <ItemGroup title="Base URL" footer={selectedProvider === 'ollama' ? 'Make sure Ollama is running and accessible from your device.' : undefined}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                            <TextInput
                                style={inputStyle}
                                value={baseUrl}
                                onChangeText={setBaseUrl}
                                placeholder={
                                    selectedProvider === 'ollama' ? 'http://localhost:11434'
                                    : selectedProvider === 'custom' ? 'https://your-api.example.com'
                                    : (provider.baseUrl as string)
                                }
                                placeholderTextColor={theme.colors.textSecondary}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                            />
                        </View>
                    </ItemGroup>
                )}

                {/* Model */}
                <ItemGroup title="Model" footer={`Default: ${provider.defaultModel || 'provider default'}`}>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TextInput
                            style={inputStyle}
                            value={model}
                            onChangeText={setModel}
                            placeholder={provider.modelHint || provider.defaultModel || 'model-name'}
                            placeholderTextColor={theme.colors.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Leave blank to use the default: {provider.defaultModel || 'provider default'}
                        </Text>
                    </View>
                </ItemGroup>

                {/* Actions */}
                <ItemGroup>
                    <Pressable
                        onPress={save}
                        style={{
                            paddingVertical: 14, paddingHorizontal: 16,
                            backgroundColor: provider.color,
                            borderRadius: 10, margin: 12, alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Save Settings</Text>
                    </Pressable>
                    <Pressable
                        onPress={testConnection}
                        disabled={testing}
                        style={{
                            paddingVertical: 14, paddingHorizontal: 16,
                            backgroundColor: theme.colors.surface, borderRadius: 10,
                            marginHorizontal: 12, marginBottom: 8, alignItems: 'center',
                            borderWidth: 1, borderColor: provider.color,
                            opacity: testing ? 0.6 : 1,
                        }}
                    >
                        <Text style={{ color: provider.color, fontWeight: '600', fontSize: 16 }}>
                            {testing ? 'Testing Connection…' : 'Test Connection'}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={clear}
                        style={{ paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 12, marginBottom: 12, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#FF3B30', fontSize: 15 }}>Clear API Settings</Text>
                    </Pressable>
                </ItemGroup>

                {/* All Providers Summary */}
                <ItemGroup title="All Supported Providers">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        {PROVIDERS.map(p => (
                            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <ProviderDot color={p.color} />
                                <Text style={{ fontSize: 13, color: theme.colors.text, fontWeight: '500', width: 110 }}>{p.label}</Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, flex: 1 }}>{p.sublabel}</Text>
                            </View>
                        ))}
                    </View>
                </ItemGroup>
            </ItemList>
        </>
    );
}
