import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Cpu,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDER_META, PROVIDER_MODELS, DEFAULT_MODELS } from "@/api/ai";
import type { AIProvider } from "@/api/ai";

const PROVIDERS = Object.entries(PROVIDER_META) as [AIProvider, typeof PROVIDER_META[AIProvider]][];

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["aiSettings"],
    queryFn: () => client.getAISettings(),
  });

  const [provider, setProvider] = useState<AIProvider>("anthropic");
  const [model, setModel] = useState(DEFAULT_MODELS["anthropic"]);
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // Hydrate form from loaded settings
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setModel(settings.model);
      setOllamaUrl(settings.ollamaUrl);
      // Don't pre-fill the key — user must re-enter to change it
    }
  }, [settings]);

  // Reset model when provider changes if model isn't valid for new provider
  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (!models.includes(model)) {
      setModel(DEFAULT_MODELS[provider]);
    }
    setTestResult(null);
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: () =>
      client.saveAISettings({
        provider,
        model,
        apiKey: apiKey || undefined,
        ollamaUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiSettings"] });
      setApiKey(""); // Clear key field after save
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      client.testAIConnection({
        provider,
        model,
        apiKey: apiKey || (settings?.apiKeyPreview ? "existing" : ""),
        ollamaUrl,
      }),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ ok: false, error: err.message }),
  });

  const meta = PROVIDER_META[provider];
  const models = PROVIDER_MODELS[provider];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">

        {/* Header */}
        <div>
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" /> AI Provider
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose which AI powers your knowledge base. Works locally — your key, your data.
          </p>
        </div>

        {/* Provider grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDERS.map(([id, info]) => (
            <button
              key={id}
              onClick={() => setProvider(id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                provider === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-foreground/20 hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: info.color }}
                />
                <span className="text-xs font-semibold truncate flex-1">{info.label}</span>
                {provider === id && (
                  <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                {info.description}
              </p>
            </button>
          ))}
        </div>

        {/* Model selector */}
        <div className="space-y-1.5">
          <Label className="text-sm">Model</Label>
          <div className="flex gap-2 flex-wrap">
            {models.map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  model === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* API key / Ollama URL */}
        {meta.needsKey ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">API Key</Label>
              {meta.keyUrl && (
                <a
                  href={meta.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {settings?.apiKeySet && !apiKey && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Key saved: <span className="font-mono">{settings.apiKeyPreview}</span>
                <span className="ml-auto text-muted-foreground">(enter new key to replace)</span>
              </div>
            )}

            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.apiKeySet ? "Enter new key to replace…" : "sk-…"}
                className="pr-10 font-mono text-sm"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          // Ollama — no key, just URL
          <div className="space-y-1.5">
            <Label className="text-sm">Ollama URL</Label>
            <Input
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Make sure{" "}
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Ollama
              </a>{" "}
              is running locally. Pull a model first:{" "}
              <code className="bg-muted px-1 rounded">ollama pull llama3.2</code>
            </p>
          </div>
        )}

        {/* Test connection */}
        {testResult && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
              testResult.ok
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-destructive/10 border border-destructive/20 text-destructive",
            )}
          >
            {testResult.ok ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{testResult.ok ? "Connection successful!" : testResult.error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || (!meta.needsKey === false && !apiKey && !settings?.apiKeySet)}
            className="flex-1"
          >
            {testMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing…</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Test connection</>
            )}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : saveMutation.isSuccess ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
            ) : (
              "Save settings"
            )}
          </Button>
        </div>

        {/* Local-first callout */}
        <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm border border-border">
          <p className="font-medium flex items-center gap-2">
            <span>🔒</span> Your keys never leave your machine
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            API keys are stored in the local SQLite database only. When running locally
            (after cloning from GitHub), you can also set them in <code className="bg-muted px-1 rounded">.env</code> — 
            the app reads from there as a fallback. No keys are ever sent to any third party 
            other than the AI provider you choose.
          </p>
          <a
            href="https://github.com/x3asarc/localvault"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            View source on GitHub <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>
    </div>
  );
}
