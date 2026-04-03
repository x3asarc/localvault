import { useQuery, useMutation } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, Trash2, Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ArticleDetailProps {
  articleId: string;
  onBack: () => void;
  onDeleted: () => void;
}

function AIStatusRow({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: <Clock className="w-4 h-4" />, label: "Queued for processing", color: "text-muted-foreground" },
    processing: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: "AI is analyzing...", color: "text-blue-500" },
    done: { icon: <CheckCircle className="w-4 h-4" />, label: "Indexed", color: "text-emerald-500" },
    failed: { icon: <AlertCircle className="w-4 h-4" />, label: "Processing failed", color: "text-destructive" },
  };
  const s = map[status] || map.pending;
  return (
    <div className={cn("flex items-center gap-2 text-sm", s.color)}>
      {s.icon}
      <span>{s.label}</span>
    </div>
  );
}

export function ArticleDetail({ articleId, onBack, onDeleted }: ArticleDetailProps) {
  const { data: article, isLoading } = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => client.getArticle(articleId),
    refetchInterval: (query) => {
      const status = query.state.data?.aiStatus;
      if (status === "pending" || status === "processing") return 5000;
      return false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.deleteArticle(articleId),
    onSuccess: onDeleted,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!article) return null;

  const keyPoints: string[] = article.keyPoints as string[];
  const topics: string[] = article.topics as string[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm leading-tight line-clamp-2">{article.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
          </p>
        </div>
        {article.url && (
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <AIStatusRow status={article.aiStatus} />

        {/* Topics */}
        {topics.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {topics.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Summary
            </h3>
            <p className="text-sm leading-relaxed">{article.summary}</p>
          </div>
        )}

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Key Points
            </h3>
            <ul className="space-y-2">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0 mt-0.5">·</span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tags
            </h3>
            <div className="flex gap-1.5 flex-wrap">
          {(article.tags as string[]).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            </div>
          </div>
        )}

        {/* Connections */}
        {article.connections && article.connections.length > 0 && (
          <div>
            <Separator className="mb-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Connected Articles
            </h3>
            <div className="space-y-3">
              {(article.connections as Array<{id: string; reason: string; strength: number; article: {id: string; title: string; summary: string | null}}>).map((conn) => (
                <div key={conn.id} className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-sm font-medium line-clamp-1">{conn.article.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{conn.reason}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${conn.strength * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(conn.strength * 100)}% match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Original content */}
        <div>
          <Separator className="mb-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Original Content
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {article.content.slice(0, 3000)}
            {article.content.length > 3000 && "..."}
          </p>
        </div>
      </div>
    </div>
  );
}
