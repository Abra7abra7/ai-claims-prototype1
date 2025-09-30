import { Badge } from "./ui/badge";
import { CheckCircle2, Clock, FileCheck, Loader2, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

const statusConfig = {
  new: {
    label: "Nová",
    variant: "secondary" as const,
    icon: Clock,
  },
  in_progress: {
    label: "V procese",
    variant: "default" as const,
    icon: Loader2,
  },
  completed: {
    label: "Dokončená",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
  rejected: {
    label: "Zamietnutá",
    variant: "destructive" as const,
    icon: XCircle,
  },
  uploaded: {
    label: "Nahraný",
    variant: "secondary" as const,
    icon: FileCheck,
  },
  ocr_processing: {
    label: "OCR spracovanie",
    variant: "default" as const,
    icon: Loader2,
  },
  ocr_complete: {
    label: "OCR hotové",
    variant: "default" as const,
    icon: FileCheck,
  },
  anonymizing: {
    label: "Anonymizácia",
    variant: "default" as const,
    icon: Loader2,
  },
  anonymized: {
    label: "Anonymizovaný",
    variant: "default" as const,
    icon: FileCheck,
  },
  ready_for_review: {
    label: "Pripravený na kontrolu",
    variant: "default" as const,
    icon: Clock,
    className: "bg-warning text-warning-foreground",
  },
  approved: {
    label: "Schválený",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
  report_generated: {
    label: "Report vygenerovaný",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
  no_documents: {
    label: "Čaká na dokumenty",
    variant: "secondary" as const,
    icon: FileCheck,
  },
  processing: {
    label: "Dokumenty sa spracovávajú",
    variant: "default" as const,
    icon: Loader2,
  },
  pending_approval: {
    label: "Čaká na schválenie",
    variant: "default" as const,
    icon: Clock,
    className: "bg-primary text-primary-foreground",
  },
  awaiting_analysis: {
    label: "Čaká na analýzu",
    variant: "default" as const,
    icon: Clock,
    className: "bg-primary text-primary-foreground",
  },
  analysis_in_progress: {
    label: "Analýza prebieha",
    variant: "default" as const,
    icon: Loader2,
  },
  analysis_complete: {
    label: "Analýza dokončená",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: "secondary" as const,
    icon: Clock,
  };

  const Icon = config.icon;
  const className = "className" in config ? (config.className as string) : undefined;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
