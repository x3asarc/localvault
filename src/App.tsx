import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { env } from "@/lib/env";

const banner = [
  "             __            __  _",
  "  ____ _____/ /___ _____  / /_(_)   _____",
  " / __ `/ __  / __ `/ __ \\/ __/ / | / / _ \\",
  "/ /_/ / /_/ / /_/ / /_/ / /_/ /| |/ /  __/",
  "\\__,_/\\__,_/\\__,_/ .___/\\__/_/ |___/\\___/",
  "                /_/",
].join("\n");
console.log(
  `%c${banner}\n\n© ${new Date().getFullYear()} Adaptive Computer, Inc.\nEnv: ${env.VITE_NODE_ENV}`,
  "font-family: monospace; color: #4ade80;",
);

function App() {
  const healthQuery = useQuery({
    queryKey: ["healthCheck"],
    queryFn: () => client.health(),
  });

  const statusMessage = healthQuery.isPending
    ? "Checking app status..."
    : healthQuery.isError
      ? "The app is up, but the health check failed."
      : "All systems are running";
  const statusColor = healthQuery.isPending
    ? "text-muted-foreground"
    : healthQuery.isError
      ? "text-red-500"
      : "text-green-500";

  return (
    // Keep the app shell in normal document flow so the platform's root inset padding
    // protects content from the host top bar and bottom chat area.
    // Use flow layout or `sticky` for app-level headers, nav, composers, and bottom actions.
    // The principle is that app chrome should inherit inset-safe spacing automatically;
    // `fixed` should never be used here because it can bypass that flow and
    // overlap host UI or safe areas.
    <main className="flex min-h-screen items-center flex-col justify-center p-8 gap-16">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-3 p-8 text-center">
          <h1 className="font-semibold tracking-tight">
            Your agent is working on this app
          </h1>

          <p className="text-sm text-muted-foreground">
            Changes will show up here as your app takes shape.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground font-mono">
        <span className={statusColor}>•</span> {statusMessage}
      </p>
    </main>
  );
}

export default App;
