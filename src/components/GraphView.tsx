import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import * as d3 from "d3";
import { Loader2, ZoomIn, ZoomOut, Maximize2, Info, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArticleNode extends d3.SimulationNodeDatum {
  kind: "article";
  id: string;
  title: string;
  aiStatus: string;
  topics: string[];
  sourceType: string;
  radius: number;
  color: string;
}

interface ConceptNode extends d3.SimulationNodeDatum {
  kind: "concept";
  id: string;
  title: string;
  articleCount: number;
  radius: number;
  color: string;
}

type GraphNode = ArticleNode | ConceptNode;

interface Edge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
  reason: string;
  kind: "connection" | "concept-link";
}

const SOURCE_COLORS: Record<string, string> = {
  twitter: "#38bdf8",
  podcast: "#a78bfa",
  url: "#34d399",
  note: "#fbbf24",
  text: "#60a5fa",
};

const CONCEPT_COLOR = "#f97316";

const STATUS_OPACITY: Record<string, number> = {
  done: 1,
  processing: 0.7,
  pending: 0.4,
  failed: 0.3,
};

export function GraphView({ onNodeClick }: { onNodeClick: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, Edge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const resetZoomRef = useRef<(() => void) | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [showConcepts, setShowConcepts] = useState(false);

  const { data: graphData, isLoading } = useQuery({
    queryKey: ["graphData"],
    queryFn: () => client.getGraphData(),
    refetchInterval: 15000,
  });

  const buildGraph = useCallback(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // ── Article nodes ────────────────────────────────────────
    const articleNodes: ArticleNode[] = graphData.nodes.map((n) => ({
      kind: "article" as const,
      ...n,
      radius: 6 + Math.min(n.topics.length * 2, 10),
      color: SOURCE_COLORS[n.sourceType] ?? "#94a3b8",
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // ── Concept nodes (only if layer is on) ──────────────────
    const conceptNodes: ConceptNode[] = showConcepts
      ? graphData.concepts.map((c) => ({
          kind: "concept" as const,
          id: `concept-${c.id}`,
          title: c.name,
          articleCount: c.articleIds.length,
          radius: 14 + Math.min(c.articleIds.length * 2, 16),
          color: CONCEPT_COLOR,
          x: width / 2 + (Math.random() - 0.5) * 300,
          y: height / 2 + (Math.random() - 0.5) * 300,
        }))
      : [];

    const allNodes: GraphNode[] = [...articleNodes, ...conceptNodes];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // ── Edges ─────────────────────────────────────────────────
    const connectionEdges: Edge[] = graphData.edges
      .filter((e) => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map((e) => ({ ...e, kind: "connection" as const }));

    // Concept ↔ article edges
    const conceptEdges: Edge[] = showConcepts
      ? graphData.concepts.flatMap((c) => {
          const conceptNodeId = `concept-${c.id}`;
          return c.articleIds
            .filter((aid) => nodeMap.has(aid))
            .map((aid, idx) => ({
              id: `cedge-${c.id}-${idx}`,
              source: conceptNodeId,
              target: aid,
              strength: 0.3,
              reason: "concept member",
              kind: "concept-link" as const,
            }));
        })
      : [];

    const allEdges: Edge[] = [...connectionEdges, ...conceptEdges];

    // ── SVG setup ─────────────────────────────────────────────
    svg.attr("width", width).attr("height", height);

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -3 6 6")
      .attr("refX", 14)
      .attr("refY", 0)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-3L6,0L0,3")
      .attr("fill", "#475569");

    const g = svg.append("g");

    // ── Zoom ──────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setTooltip(null);
      });

    svg.call(zoom);

    // ── Edges ─────────────────────────────────────────────────
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(allEdges)
      .join("line")
      .attr("stroke", (d) => d.kind === "concept-link" ? CONCEPT_COLOR : "#334155")
      .attr("stroke-width", (d) => d.kind === "concept-link" ? 0.8 : Math.max(0.5, d.strength * 2.5))
      .attr("stroke-opacity", (d) => d.kind === "concept-link" ? 0.25 : Math.max(0.2, d.strength * 0.8))
      .attr("stroke-dasharray", (d) => d.kind === "concept-link" ? "3,3" : null)
      .attr("marker-end", (d) => d.kind === "connection" ? "url(#arrow)" : null);

    // ── Node groups ───────────────────────────────────────────
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(allNodes)
      .join("g")
      .attr("cursor", (d) => d.kind === "article" ? "pointer" : "default")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<any, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Article circles
    node.filter((d) => d.kind === "article")
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", (d) => STATUS_OPACITY[(d as ArticleNode).aiStatus] ?? 0.5)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5);

    // Concept hexagons (rendered as larger circles with ring)
    const conceptNodeSel = node.filter((d) => d.kind === "concept");
    conceptNodeSel.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", CONCEPT_COLOR)
      .attr("fill-opacity", 0.15)
      .attr("stroke", CONCEPT_COLOR)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.8);
    conceptNodeSel.append("circle")
      .attr("r", (d) => d.radius - 5)
      .attr("fill", CONCEPT_COLOR)
      .attr("fill-opacity", 0.3)
      .attr("stroke", "none");

    // Labels
    node.append("text")
      .attr("dy", (d) => d.radius + 11)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => d.kind === "concept" ? "10px" : "9px")
      .attr("font-weight", (d) => d.kind === "concept" ? "600" : "400")
      .attr("fill", (d) => d.kind === "concept" ? CONCEPT_COLOR : "#94a3b8")
      .attr("pointer-events", "none")
      .text((d) => d.title.slice(0, 22) + (d.title.length > 22 ? "…" : ""));

    // Hover & click
    node
      .on("mouseenter", (event: MouseEvent, d: GraphNode) => {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          node: d,
        });
        d3.select(event.currentTarget as SVGGElement)
          .select("circle")
          .attr("stroke-width", 3)
          .attr("stroke-opacity", 1);
      })
      .on("mouseleave", (event: MouseEvent, d: GraphNode) => {
        setTooltip(null);
        d3.select(event.currentTarget as SVGGElement)
          .select("circle")
          .attr("stroke-width", d.kind === "concept" ? 2 : 1.5)
          .attr("stroke-opacity", d.kind === "concept" ? 0.8 : 0.5);
      })
      .on("click", (_event: MouseEvent, d: GraphNode) => {
        if (d.kind === "article") onNodeClick(d.id);
      });

    // ── Force simulation ──────────────────────────────────────
    const simulation = d3.forceSimulation<GraphNode>(allNodes)
      .force("link", d3.forceLink<GraphNode, Edge>(allEdges)
        .id((d) => d.id)
        .distance((d) => {
          if (d.kind === "concept-link") return 120;
          return 80 + (1 - (d as Edge).strength) * 60;
        })
        .strength((d) => {
          if (d.kind === "concept-link") return 0.05;
          return (d as Edge).strength * 0.4;
        })
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength((d) => d.kind === "concept" ? -200 : -120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 8))
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    simulationRef.current = simulation;

    const resetZoom = () => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1).translate(-width / 2, -height / 2)
      );
    };

    zoomRef.current = zoom;
    resetZoomRef.current = resetZoom;

  }, [graphData, onNodeClick, showConcepts]);

  useEffect(() => {
    buildGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [buildGraph]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => buildGraph());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [buildGraph]);

  function zoomIn() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.4);
  }

  function zoomOut() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 0.7);
  }

  function resetZoom() {
    resetZoomRef.current?.();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading graph…
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <Info className="w-10 h-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium">Graph is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add articles and let the AI process them — connections will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full bg-background" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-card border border-border rounded-lg shadow-lg p-3 max-w-[220px] z-10"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-medium text-sm leading-tight mb-1">{tooltip.node.title}</p>
          {tooltip.node.kind === "article" && (tooltip.node as ArticleNode).topics.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-1">
              {(tooltip.node as ArticleNode).topics.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
          {tooltip.node.kind === "concept" && (
            <p className="text-xs text-orange-400 mb-1">
              Concept · {(tooltip.node as ConceptNode).articleCount} articles
            </p>
          )}
          {tooltip.node.kind === "article" && (
            <p className="text-[10px] text-muted-foreground capitalize">
              {(tooltip.node as ArticleNode).sourceType} · {(tooltip.node as ArticleNode).aiStatus}
            </p>
          )}
          {tooltip.node.kind === "article" && (
            <p className="text-[10px] text-primary mt-1">Click to open →</p>
          )}
        </div>
      )}

      {/* Concept layer toggle */}
      <div className="absolute top-3 left-3">
        <Button
          size="sm"
          variant={showConcepts ? "default" : "secondary"}
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowConcepts((v) => !v)}
        >
          <Layers className="w-3.5 h-3.5" />
          Concepts
          {graphData.concepts.length > 0 && (
            <span className="ml-0.5 opacity-70">{graphData.concepts.length}</span>
          )}
        </Button>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button size="icon" variant="secondary" className="w-8 h-8" onClick={zoomIn}>
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="w-8 h-8" onClick={zoomOut}>
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="secondary" className="w-8 h-8" onClick={resetZoom}>
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border border-border rounded-lg p-2.5 space-y-1.5 text-[10px]">
        <p className="font-medium text-muted-foreground uppercase tracking-wider mb-1">Source</p>
        {Object.entries(SOURCE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
        {showConcepts && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: CONCEPT_COLOR, background: "transparent" }} />
            <span className="text-muted-foreground">Concept</span>
          </div>
        )}
        <p className="text-muted-foreground mt-1.5">
          <span className="font-medium">{graphData.nodes.length}</span> nodes ·{" "}
          <span className="font-medium">{graphData.edges.length}</span> edges
        </p>
      </div>
    </div>
  );
}
