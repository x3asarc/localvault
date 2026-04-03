import { formatDistanceToNow } from "date-fns";
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  title: string;
  url?: string | null;
  sourceType: string;
  summary?: string | null;
  topics: string[];
  tags: string[];
  aiStatus: string;
  createdAt: Date;
}

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
}

const sourceTypeColors: Record<string, string> = {
  twitter: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  podcast: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  url: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  note: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  text: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const sourceTypeLabels: Record<string, string> = {
  twitter: "Thread",
  podcast: "Podcast",
  url: "Article",
  note: "Note",
  text: "Text",
};

function AIStatusBadge({ status }: { status: string }) {
  if (status === "pending") return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "processing") return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
  if (status === "done") return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "failed") return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  return null;
}

export function ArticleCard({ article, onClick }: ArticleCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-4 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title row */}
          <div className="flex items-start gap-2">
            <span className="font-medium text-sm leading-snug line-clamp-2 flex-1">
              {article.title}
            </span>
            {article.url && (
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>

          {/* Summary */}
          {article.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          )}

          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                sourceTypeColors[article.sourceType] || "bg-muted text-muted-foreground",
              )}
            >
              {sourceTypeLabels[article.sourceType] || article.sourceType}
            </span>
            {article.topics.slice(0, 2).map((topic) => (
              <span
                key={topic}
                className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <AIStatusBadge status={article.aiStatus} />
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </button>
  );
}
