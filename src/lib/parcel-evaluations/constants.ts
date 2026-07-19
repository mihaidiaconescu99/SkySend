import type {
  OperatorParcelEvaluationStatus,
  OperatorParcelWarning,
} from "@/types/operator-parcel-evaluation";

export const operatorParcelEvaluationStatusLabels: Record<OperatorParcelEvaluationStatus, string> = {
  in_evaluation: "În evaluare",
  waiting_customer: "Așteaptă clientul",
  customer_replied: "Răspuns primit",
  finalized: "Finalizat",
  closed: "Închis",
};

export const operatorParcelWarningLabels: Record<OperatorParcelWarning, string> = {
  fragile: "Fragil",
  temperature: "Sensibil la temperatură",
  liquid: "Conține lichide",
  humidity: "Sensibil la umiditate",
  orientation: "Păstrează orientarea",
};
