import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Layers, BookOpen, Loader2 } from "lucide-react";

export function ConceptsView() {
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
            Topics the AI has identified across your library.
          </p>
        </div>

        <div className="grid gap-3">
          {concepts.map((concept) => {
            const conceptArticles = (concept.articleIds as string[])
              .map((id) => articleMap.get(id))
              .filter(Boolean);

            return (
              <div
                key={concept.id}
                className="border border-border rounded-xl p-4 space-y-3"
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
                </div>

                {/* Article list */}
                {conceptArticles.length > 0 && (
                  <div className="space-y-1.5 ml-11">
                    {conceptArticles.slice(0, 5).map((article) => (
                      <div key={article!.id} className="flex items-center gap-2 text-xs">
                        <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground line-clamp-1">{article!.title}</span>
                      </div>
                    ))}
                    {(concept.articleIds as string[]).length > 5 && (
                      <p className="text-xs text-muted-foreground ml-5">
                        +{(concept.articleIds as string[]).length - 5} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
