import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { Library } from "@/components/Library";
import { AddContent } from "@/components/AddContent";
import { QueryInterface } from "@/components/QueryInterface";
import { ConceptsView } from "@/components/ConceptsView";
import { BookOpen, Plus, Search, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "library" | "add" | "query" | "concepts";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["libraryStats"],
    queryFn: () => client.getLibraryStats(),
    refetchInterval: 15000,
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "library",
      label: "Library",
      icon: <BookOpen className="w-4 h-4" />,
      badge: stats?.totalArticles,
    },
    {
      id: "add",
      label: "Add",
      icon: <Plus className="w-4 h-4" />,
    },
    {
      id: "query",
      label: "Ask",
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: "concepts",
      label: "Concepts",
      icon: <Layers className="w-4 h-4" />,
      badge: stats?.totalConcepts,
    },
  ];

  return (
    <main className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg tracking-tight">Knowledge Base</h1>
          {stats && (
            <p className="text-xs text-muted-foreground">
              {stats.totalArticles} items · {stats.processedArticles} indexed · {stats.totalConcepts} concepts
            </p>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "library" && (
          <Library onArticleProcessed={() => queryClient.invalidateQueries({ queryKey: ["libraryStats"] })} />
        )}
        {activeTab === "add" && (
          <AddContent
            onAdded={() => {
              queryClient.invalidateQueries({ queryKey: ["libraryStats"] });
              setActiveTab("library");
            }}
          />
        )}
        {activeTab === "query" && <QueryInterface />}
        {activeTab === "concepts" && <ConceptsView />}
      </div>

      {/* Bottom Navigation */}
      <nav className="border-t border-border bg-card">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-primary text-primary-foreground rounded-full text-[9px] font-bold px-1 min-w-[14px] text-center">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

export default App;
