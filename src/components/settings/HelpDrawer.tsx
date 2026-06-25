import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, ChevronLeft, ChevronRight, ExternalLink, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { openAffiliateLink } from "@/lib/affiliateLinks";
import type { HelpDrawerContent } from "./helpContent";

interface HelpDrawerProps {
  content: HelpDrawerContent | null;
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ content, open, onClose }: HelpDrawerProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  // Reset to step 1 whenever a new walkthrough is opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open, content?.provider]);

  if (!content) return null;

  const totalSteps = content.steps.length;
  const current = content.steps[step];

  const handleActionButton = async (btn: {
    label: string;
    href: string;
    isAffiliateLink?: boolean;
  }) => {
    if (btn.isAffiliateLink) {
      await openAffiliateLink(content.provider, "help_drawer");
    } else if (btn.href.startsWith("/")) {
      onClose();
      navigate({ to: btn.href as any });
    } else {
      window.open(btn.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-base font-bold">{content.title}</SheetTitle>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Takes about {content.estimatedSetupTime}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-accent transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        {/* Step progress dots */}
        <div className="px-5 py-3 flex items-center gap-1.5 border-b border-border">
          {content.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-5 bg-accent-primary"
                  : i < step
                    ? "w-1.5 bg-accent-primary/50"
                    : "w-1.5 bg-muted-foreground/30"
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full gradient-accent text-white text-xs font-bold shrink-0">
                {current.stepNumber}
              </span>
              <h3 className="font-semibold text-sm">{current.title}</h3>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

            {current.actionButton && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 w-full justify-center"
                onClick={() => handleActionButton(current.actionButton!)}
              >
                {current.actionButton.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {step === totalSteps - 1 && (
            <div className="mt-8 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Still stuck? Open the official guide:{" "}
              <a
                href={content.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-primary hover:underline"
              >
                Full docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < totalSteps - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={onClose} className="gradient-accent text-white border-0">
              Done ✓
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
