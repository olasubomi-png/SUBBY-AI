import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="subby-auth-shell min-h-screen w-full flex items-center justify-center px-5">
      <div className="subby-auth-grid" aria-hidden="true" />
      <Card className="relative w-full max-w-lg border border-border bg-card shadow-none">
        <CardContent className="py-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
          </div>

          <p className="eyebrow">ROUTE UNAVAILABLE</p>
          <h1 className="mt-3 text-5xl font-bold tracking-[-0.06em] text-foreground">404</h1>

          <h2 className="mt-3 text-xl font-semibold text-foreground">
            Page Not Found
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The page you requested is not available in this workspace.
            <br />
            It may have been moved or removed.
          </p>

          <div
            id="not-found-button-group"
            className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <Button
              onClick={handleGoHome}
              className="px-6"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
