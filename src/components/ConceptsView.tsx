import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Layers, BookOpen, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { ArticleDetail } from "@/components/ArticleDetail";

interface ConceptsViewProps {
  onArticleProcessed?: () => void;
}

export function ConceptsView({ onArticleProcessed }: ConceptsViewProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const { data: concepts, isLoading } = useQuery({
    queryKey: ["concepts"],
    queryFn: () => client.getConcepts(),
    refetchInterval: 30000,
  });

  const { data: articles } = useQuery({
    queryKey: ["articles", {}],
    queryFn: () => client.getArticles(),
  });

  // Build an article lookup
  const articleMap = new Map(articles?.map((a) => [a.id, a]) || []);

  // ── Article detail overlay ──────────────────────────────
  if (selectedArticleId) {
    return (
      <ArticleDetail
        articleId={selectedArticleId}
        onBack={() => setSelectedArticleId(null)}
        onDeleted={() => {
          setSelectedArticleId(null);
          onArticleProcessed?.();
        }}
        onNavigateToArticle={(id) => setSelectedArticleId(id)}
      />
    );
  }

  // ── Concept drill-down view ─────────────────────────────
  if (selectedConceptId) {
    const concept = concepts?.find((c) => c.id === selectedConceptId);
    // If concept data hasn't loaded yet, show a spinner rather than
    // calling a state setter during render (which is illegal in React).
    if (!concept) {
      return (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      );
    }

    const conceptArticles = (concept.articleIds as string[])
      .map((id) => articleMap.get(id))
      .filter(Boolean);

    return (
      <div className="flex flex-col h-full">
        {/* Back header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={() => setSelectedConceptId(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Concepts
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium capitalize">{concept.name}</span>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-4 space-y-4">
            {/* Concept header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-base capitalize">{concept.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(concept.articleIds as string[]).length} article
                  {(concept.articleIds as string[]).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Articles list */}
            {conceptArticles.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <p className="text-sm text-muted-foreground">No indexed articles in this concept yet.</p>
                <p className="text-xs text-muted-foreground/60">
                  Articles appear here once AI processing completes.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conceptArticles.map((article) => (
                  <button
                    key={article!.id}
                    onClick={() => setSelectedArticleId(article!.id)}
                    className="w-full text-left border border-border rounded-xl p-3.5 hover:bg-muted/40 transition-colors flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{article!.title}</p>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(article as any).summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(article as any).summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <span className="text-[10px] text-muted-foreground/70 capitalize">{(article as any).sourceType}</span>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(article as any).aiStatus === "done" && (
                          <span className="text-[10px] text-emerald-500">● indexed</span>
                        )}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(article as any).aiStatus === "pending" && (
                          <span className="text-[10px] text-amber-500">● processing</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main concepts list ──────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!concepts || concepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-8">
        <Layers className="w-10 h-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium text-foreground">No concepts yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add articles to your library and the AI will automatically organize them into concepts and themes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="font-semibold text-base">Concept Map</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Topics the AI has identified across your library. Tap a concept to explore its articles.
          </p>
        </div>

        <div className="grid gap-3">
          {concepts.map((concept) => {
            const conceptArticles = (concept.articleIds as string[])
              .map((id) => articleMap.get(id))
              .filter(Boolean);

            return (
              <button
                key={concept.id}
                onClick={() => setSelectedConceptId(concept.id)}
                className="w-full text-left border border-border rounded-xl p-4 space-y-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
              >
                {/* Concept header */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm capitalize">{concept.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(concept.articleIds as string[]).length} article
                      {(concept.articleIds as string[]).length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>

                {/* Article preview */}
                {conceptArticles.length > 0 && (
                  <div className="space-y-1.5 ml-11">
                    {conceptArticles.slice(0, 3).map((article) => (
                      <div key={article!.id} className="flex items-center gap-2 text-xs">
                        <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground line-clamp-1">{article!.title}</span>
                      </div>
                    ))}
                    {(concept.articleIds as string[]).length > 3 && (
                      <p className="text-xs text-muted-foreground ml-5">
                        +{(concept.articleIds as string[]).length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
