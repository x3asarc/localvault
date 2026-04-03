import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import JSZip from "jszip";
import {
  Download,
  Upload,
  FolderOpen,
  CheckCircle,
  Loader2,
  FileText,
  Info,
  CopyX,
} from "lucide-react";

export function ExportInbox({ onInboxIngested }: { onInboxIngested: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportState, setExportState] = useState<"idle" | "building" | "done">("idle");
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inboxFiles, setInboxFiles] = useState<{ name: string; content: string }[]>([]);

  useEffect(() => {
    return () => { if (exportTimerRef.current) clearTimeout(exportTimerRef.current); };
  }, []);
  const [ingestResults, setIngestResults] = useState<{ title: string; id: string; duplicate?: boolean; failed?: boolean }[]>([]);
  const [ingestProgress, setIngestProgress] = useState(0);

  // ── Export vault ──────────────────────────────
  async function handleExport() {
    setExportState("building");
    try {
      const { files } = await client.exportObsidianVault();
      const zip = new JSZip();

      for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `knowledge-base-vault-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportState("done");
      exportTimerRef.current = setTimeout(() => setExportState("idle"), 3000);
    } catch (e) {
      console.error(e);
      setExportState("idle");
    }
  }

  // ── Inbox file picker ─────────────────────────
  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    const readers = mdFiles.map(
      (file) =>
        new Promise<{ name: string; content: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, content: reader.result as string });
          reader.readAsText(file);
        }),
    );
    Promise.all(readers).then((results) => {
      setInboxFiles(results);
      setIngestResults([]);
    });
    // Reset input so same files can be re-picked
    e.target.value = "";
  }

  // ── Ingest inbox ──────────────────────────────
  async function handleIngest() {
    if (inboxFiles.length === 0) return;
    setIngestProgress(0);
    setIngestResults([]);

    const results: { title: string; id: string; duplicate?: boolean; failed?: boolean }[] = [];
    for (let i = 0; i < inboxFiles.length; i++) {
      const f = inboxFiles[i];
      try {
        const res = await client.ingestInboxFile({ filename: f.name, content: f.content });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isDupe = (res as any).duplicate === true;
        results.push({ title: res.title, id: res.articleId, duplicate: isDupe });
      } catch (e) {
        console.error("Failed to ingest", f.name, e);
        results.push({ title: f.name, id: "", failed: true });
      }
      setIngestProgress(Math.round(((i + 1) / inboxFiles.length) * 100));
      setIngestResults([...results]);
    }

    queryClient.invalidateQueries({ queryKey: ["articles"] });
    queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
    onInboxIngested();
    setInboxFiles([]);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        {/* ── Export section ─────────────────── */}
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-base">Export as Obsidian Vault</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Download your entire knowledge base as a structured Obsidian vault — markdown files, YAML frontmatter, wiki-links, concept MOCs, and a home page.
            </p>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Vault structure</p>
            <div className="font-mono text-xs text-muted-foreground space-y-0.5">
              <p><span className="text-foreground">📁 articles/</span> — one .md per article</p>
              <p><span className="text-foreground">📁 concepts/</span> — auto-generated concept MOCs</p>
              <p><span className="text-foreground">📁 inbox/</span> — drop new files here</p>
              <p><span className="text-foreground">📄 Home.md</span> — master index</p>
              <p><span className="text-foreground">📄 Q&A Log.md</span> — all your saved queries</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Setup in Obsidian</p>
            <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Download the zip and extract it anywhere on your computer</li>
              <li>Open Obsidian → <em>Open folder as vault</em> → select the extracted folder</li>
              <li>Install the <strong>Obsidian Web Clipper</strong> browser extension to add new content</li>
              <li>Open <strong>Home.md</strong> to navigate your library</li>
            </ol>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleExport}
            disabled={exportState === "building"}
          >
            {exportState === "building" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building vault…</>
            ) : exportState === "done" ? (
              <><CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Downloaded!</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Download Obsidian Vault</>
            )}
          </Button>
        </div>

        <div className="border-t border-border" />

        {/* ── Inbox section ──────────────────── */}
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-base">Upload from Inbox</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drop new <code className="text-xs bg-muted px-1 rounded">.md</code> files into the vault's <code className="text-xs bg-muted px-1 rounded">inbox/</code> folder locally, then upload them here to run the full AI pipeline.
            </p>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen className="w-8 h-8 text-muted-foreground/60" />
            <div className="text-center">
              <p className="font-medium text-sm">Select .md files from inbox/</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click to browse, or drag & drop</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
          </div>

          {/* Selected files preview */}
          {inboxFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {inboxFiles.length} file{inboxFiles.length !== 1 ? "s" : ""} selected
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {inboxFiles.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs shrink-0">
                      {(f.content.length / 1000).toFixed(1)}k chars
                    </span>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={handleIngest}>
                <Upload className="w-4 h-4 mr-2" />
                Ingest {inboxFiles.length} file{inboxFiles.length !== 1 ? "s" : ""} → AI Pipeline
              </Button>
            </div>
          )}

          {/* Ingest progress */}
          {ingestProgress > 0 && ingestProgress < 100 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Ingesting…</span>
                <span>{ingestProgress}%</span>
              </div>
              <Progress value={ingestProgress} />
            </div>
          )}

          {/* Results */}
          {ingestResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Results</p>
              {ingestResults.map((r) => (
                <div key={r.id || r.title} className="flex items-center gap-2 text-sm">
                  {r.failed ? (
                    <Info className="w-4 h-4 text-destructive shrink-0" />
                  ) : r.duplicate ? (
                    <CopyX className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <span className="truncate">{r.title}</span>
                  <span className="text-xs ml-auto shrink-0 text-muted-foreground">
                    {r.failed ? "error" : r.duplicate ? "already exists" : "queued"}
                  </span>
                </div>
              ))}
              {ingestProgress === 100 && (
                <p className="text-xs text-muted-foreground mt-1">
                  AI is processing in the background. Check the Library tab for status.
                </p>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Workflow tip</p>
            <p>Use <strong>Obsidian Web Clipper</strong> to clip articles directly into <code className="bg-muted px-1 rounded">inbox/</code> as markdown. Then come here to sync them into your AI knowledge base.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
