import { Badge } from "./ui/badge";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  XCircle,
  AlertCircle,
  Upload,
  Eye,
  FileText,
  TrendingUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatusBadgeProps {
  status: string;
}

const statusConfig = {
  new: {
    label: "Nová",
    variant: "secondary" as const,
    icon: Clock,
    description: "Udalosť vytvorená, pripravená na nahranie dokumentov",
  },
  in_progress: {
    label: "V procese",
    variant: "default" as const,
    icon: Loader2,
    description: "Dokumenty sa nahrávajú",
  },
  completed: {
    label: "Dokončená",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
    description: "Všetky dokumenty spracované a reporty vygenerované",
  },
  rejected: {
    label: "Zamietnutá",
    variant: "destructive" as const,
    icon: XCircle,
    description: "Udalosť zamietnutá",
  },
  uploaded: {
    label: "Nahraný",
    variant: "secondary" as const,
    icon: Upload,
    description: "Dokumenty nahrané, čaká sa na OCR spracovanie",
  },
  ocr_processing: {
    label: "OCR spracovanie",
    variant: "default" as const,
    icon: Loader2,
    description: "Prebieha extrakcia textu z dokumentov",
  },
  ocr_complete: {
    label: "OCR hotové",
    variant: "default" as const,
    icon: FileCheck,
    description: "Text extrahovaný, pripravený na anonymizáciu",
  },
  anonymizing: {
    label: "Anonymizácia",
    variant: "default" as const,
    icon: Loader2,
    description: "Prebieha anonymizácia citlivých údajov",
  },
  anonymized: {
    label: "Anonymizovaný",
    variant: "default" as const,
    icon: FileCheck,
    description: "Text anonymizovaný a vyčistený",
  },
  ready_for_review: {
    label: "Pripravený na kontrolu",
    variant: "default" as const,
    icon: Eye,
    className: "bg-warning text-warning-foreground",
    description: "Dokumenty spracované a pripravené na kontrolu",
  },
  approved: {
    label: "Schválený",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
    description: "Dokumenty schválené, pripravené na generovanie reportu",
  },
  report_generated: {
    label: "Report vygenerovaný",
    variant: "default" as const,
    icon: FileCheck,
    className: "bg-success text-success-foreground",
    description: "Report analýzy úspešne vygenerovaný",
  },
  no_documents: {
    label: "Čaká na dokumenty",
    variant: "secondary" as const,
    icon: AlertCircle,
    description: "Zatiaľ neboli nahrané žiadne dokumenty",
  },
  processing: {
    label: "Dokumenty sa spracovávajú",
    variant: "default" as const,
    icon: Loader2,
    description: "OCR extrakcia, anonymizácia a čistenie textu v procese",
  },
  pending_approval: {
    label: "Čaká na schválenie",
    variant: "default" as const,
    icon: Eye,
    className: "bg-primary text-primary-foreground",
    description: "Dokumenty čakajú na manuálne schválenie",
  },
  awaiting_analysis: {
    label: "Čaká na analýzu",
    variant: "default" as const,
    icon: Clock,
    className: "bg-primary text-primary-foreground",
    description: "Dokumenty schválené, čaká sa na generovanie reportov",
  },
  analysis_in_progress: {
    label: "Analýza prebieha",
    variant: "default" as const,
    icon: TrendingUp,
    description: "AI analýza reportov prebieha",
  },
  analysis_complete: {
    label: "Analýza dokončená",
    variant: "default" as const,
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
    description: "Všetky dokumenty spracované a reporty vygenerované",
  },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: "secondary" as const,
    icon: Clock,
    description: "Informácie o stave nie sú k dispozícii",
  };

  const Icon = config.icon;
  const className = "className" in config ? (config.className as string) : undefined;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={className}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
