import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Twitter, Mic, Link, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddContentProps {
  onAdded: () => void;
}

type SourceType = "text" | "url" | "twitter" | "podcast" | "note";

const sourceTypes: { id: SourceType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  {
    id: "url",
    label: "Article / URL",
    icon: <Link className="w-4 h-4" />,
    placeholder: "Paste the full article text here (copy-paste from the web page)...",
  },
  {
    id: "twitter",
    label: "Thread",
    icon: <Twitter className="w-4 h-4" />,
    placeholder: "Paste the full thread text here...",
  },
  {
    id: "podcast",
    label: "Podcast / Talk",
    icon: <Mic className="w-4 h-4" />,
    placeholder: "Paste transcript or notes from the podcast/talk...",
  },
  {
    id: "note",
    label: "Note",
    icon: <StickyNote className="w-4 h-4" />,
    placeholder: "Write your own note, thoughts, or ideas...",
  },
  {
    id: "text",
    label: "Other Text",
    icon: <FileText className="w-4 h-4" />,
    placeholder: "Paste any text content here...",
  },
];

export function AddContent({ onAdded }: AddContentProps) {
  const [sourceType, setSourceType] = useState<SourceType>("url");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const [wasDuplicate, setWasDuplicate] = useState(false);

  const addMutation = useMutation({
    mutationFn: () =>
      client.addArticle({
        title: title.trim() || content.slice(0, 80),
        content,
        url: url.trim() || undefined,
        sourceType,
      }),
    onSuccess: (result) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isDupe = (result as any).duplicate === true;
      setWasDuplicate(isDupe);
      setJustAdded(true);
      if (!isDupe) {
        setTitle("");
        setUrl("");
        setContent("");
        setTimeout(() => {
          setJustAdded(false);
          onAdded();
        }, 1200);
      } else {
        setTimeout(() => {
          setJustAdded(false);
          setWasDuplicate(false);
        }, 3000);
      }
    },
  });

  const currentType = sourceTypes.find((s) => s.id === sourceType)!;
  const canSubmit = content.trim().length > 20 && !justAdded;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-5 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div>
          <h2 className="font-semibold text-base">Add to Library</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paste any content — the AI will read it, summarize it, and connect it to your existing knowledge.
          </p>
        </div>

        {/* Source type selector */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
            Content Type
          </Label>
          <div className="flex gap-2 flex-wrap">
            {sourceTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSourceType(type.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  sourceType === type.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm">
            Title <span className="text-muted-foreground">(optional — AI will auto-generate)</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this a title..."
            className="text-base"
          />
        </div>

        {/* URL (for article type) */}
        {(sourceType === "url" || sourceType === "twitter") && (
          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-sm">
              URL <span className="text-muted-foreground">(optional, for reference)</span>
            </Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="text-base"
              inputMode="url"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        )}

        {/* Content */}
        <div className="space-y-1.5">
          <Label htmlFor="content" className="text-sm">
            Content <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={currentType.placeholder}
            className="min-h-[200px] text-base resize-none"
            style={{ fontSize: "16px" }}
          />
          <p className="text-xs text-muted-foreground text-right">
            {content.length.toLocaleString()} characters
          </p>
        </div>

        {/* Tips */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium">Tips for best results:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>Paste the full text — more context = better analysis</li>
            <li>The AI will automatically extract key points, topics, and tags</li>
            <li>It will find connections to other items in your library</li>
            <li>Processing takes 1-2 minutes in the background</li>
          </ul>
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => addMutation.mutate()}
          disabled={!canSubmit || addMutation.isPending}
        >
          {addMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding to library...
            </>
          ) : justAdded && wasDuplicate ? (
            "Already in your library"
          ) : justAdded ? (
            "Added! ✓"
          ) : (
            "Add to Library"
          )}
        </Button>

        {justAdded && wasDuplicate && (
          <p className="text-sm text-amber-500 text-center">
            This content is already in your library — skipped to avoid duplicates.
          </p>
        )}

        {addMutation.isError && (
          <p className="text-sm text-destructive text-center">
            Failed to add: {addMutation.error?.message}
          </p>
        )}
      </div>
    </div>
  );
}
