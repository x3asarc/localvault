import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Trash2, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const EXAMPLE_QUERIES = [
  "What are the common themes across my saved articles?",
  "What do I have on AI and machine learning?",
  "Summarize everything I've saved about productivity",
  "What's missing from my knowledge on this topic?",
  "Which ideas connect across different topics?",
];

function QueryResultCard({
  queryId,
  onDeleted,
}: {
  queryId: string;
  onDeleted: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["query", queryId],
    queryFn: () => client.getQueryStatus(queryId),
    refetchInterval: (query) => {
      if (!query.state.data?.isComplete) return 3000;
      return false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => client.deleteQuery(queryId),
    onSuccess: onDeleted,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Question */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{data.question}</p>
        <button
          onClick={() => deleteMutation.mutate()}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status */}
      {!data.isComplete ? (
        <div className="flex items-center gap-2 text-sm text-blue-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Searching your knowledge base...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Answer ready</span>
            <span className="text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
            </span>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.answer}</p>
          </div>
          {data.sources.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Based on {data.sources.length} source{data.sources.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function QueryInterface() {
  const [question, setQuestion] = useState("");
  const [activeQueryIds, setActiveQueryIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: savedQueries } = useQuery({
    queryKey: ["savedQueries"],
    queryFn: () => client.getSavedQueries(),
    refetchInterval: 15000,
  });

  const askMutation = useMutation({
    mutationFn: () => client.askQuestion(question),
    onSuccess: (data) => {
      setActiveQueryIds((prev) => [data.queryId, ...prev]);
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["savedQueries"] });
    },
  });

  const canAsk = question.trim().length > 5;

  // Combine active queries (in-session) with saved history
  // savedQueries is already capped at 20 server-side; show all of them
  const allQueryIds = [
    ...activeQueryIds,
    ...(savedQueries?.filter((q) => !activeQueryIds.includes(q.id)).map((q) => q.id) || []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Input area */}
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Ask Your Library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ask any question — the AI searches across everything you've saved.
          </p>
        </div>

        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to know?"
            className="resize-none text-base min-h-[80px]"
            style={{ fontSize: "16px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canAsk) {
                e.preventDefault();
                askMutation.mutate();
              }
            }}
          />
          <Button
            className="w-full"
            onClick={() => askMutation.mutate()}
            disabled={!canAsk || askMutation.isPending}
          >
            {askMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Ask
              </>
            )}
          </Button>
        </div>

        {/* Example queries */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="shrink-0 text-xs text-muted-foreground border border-border rounded-full px-3 py-1 hover:text-foreground hover:border-foreground/30 transition-colors whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {allQueryIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-8">
            <Clock className="w-8 h-8 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-sm">No questions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask a question above to search across your knowledge base.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allQueryIds.map((id) => (
              <QueryResultCard
                key={id}
                queryId={id}
                onDeleted={() => {
                  setActiveQueryIds((prev) => prev.filter((qId) => qId !== id));
                  queryClient.invalidateQueries({ queryKey: ["savedQueries"] });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
