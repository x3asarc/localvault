import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleDetail } from "@/components/ArticleDetail";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, BookOpen } from "lucide-react";

interface LibraryProps {
  onArticleProcessed: () => void;
}

export function Library({ onArticleProcessed }: LibraryProps) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: articles, isLoading } = useQuery({
    queryKey: ["articles", { search, tag: activeTag }],
    queryFn: () =>
      client.getArticles({
        search: search || undefined,
        tag: activeTag || undefined,
      }),
    refetchInterval: 10000,
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: () => client.getAllTags(),
    refetchInterval: 30000,
  });

  if (selectedArticleId) {
    return (
      <ArticleDetail
        articleId={selectedArticleId}
        onBack={() => setSelectedArticleId(null)}
        onDeleted={() => {
          setSelectedArticleId(null);
          queryClient.invalidateQueries({ queryKey: ["articles"] });
          queryClient.invalidateQueries({ queryKey: ["tags"] });
          onArticleProcessed();
        }}
        onNavigateToArticle={(id) => setSelectedArticleId(id)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 text-base"
            placeholder="Search your knowledge base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tag filters */}
        {tags && tags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {activeTag && (
              <Badge
                variant="secondary"
                className="cursor-pointer shrink-0 flex items-center gap-1"
                onClick={() => setActiveTag(null)}
              >
                <X className="w-3 h-3" /> Clear
              </Badge>
            )}
            {tags.slice(0, 15).map((tag) => (
              <Badge
                key={tag.name}
                variant={activeTag === tag.name ? "default" : "outline"}
                className="cursor-pointer shrink-0"
                onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
              >
                {tag.name} <span className="ml-1 opacity-60">{tag.count}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Articles list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : !articles || articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-8">
            <BookOpen className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">Your library is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add articles, notes, tweets, or any content and the AI will organize it for you.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => setSelectedArticleId(article.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
