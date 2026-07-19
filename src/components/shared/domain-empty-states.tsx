import {
  BellOff,
  CreditCard,
  PackageSearch,
  ShieldAlert,
  WalletMinimal,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function OrdersEmptyState() {
  return (
    <EmptyState
      title="Nu există comenzi încă"
      description="Comenzile de livrare vor apărea aici după ce clientul creează prima comandă."
      icon={<PackageSearch className="size-6" />}
      primaryAction={{ label: "Creează comandă", href: "/client/create-delivery" }}
      secondaryAction={{ label: "Verifică acoperirea", href: "/#coverage" }}
    />
  );
}

export function FailedOrdersEmptyState() {
  return (
    <EmptyState
      title="Nu există comenzi eșuate în această perioadă"
      description="Excepțiile operaționale și livrările blocate vor apărea aici când necesită verificare."
      icon={<ShieldAlert className="size-6" />}
      primaryAction={{ label: "Înapoi la prezentare", href: "/operator" }}
    />
  );
}

export function NotificăriEmptyState() {
  return (
    <EmptyState
      title="Nu există notificări acum"
      description="Alertele, etapele livrării și actualizările de cont vor apărea aici când contează."
      icon={<BellOff className="size-6" />}
      primaryAction={{ label: "Go to Dashboard", href: "/client" }}
    />
  );
}

export function PaymentsEmptyState() {
  return (
    <EmptyState
      title="Nu există activitate de plată încă"
      description="Facturile, metodele salvate și istoricul tranzacțiilor vor apărea aici după prima livrare plătită."
      icon={<CreditCard className="size-6" />}
      primaryAction={{ label: "Vezi tarifele", href: "/pricing" }}
      secondaryAction={{ label: "Contact", href: "/contact" }}
    />
  );
}

export function PaymentMethodsEmptyState() {
  return (
    <EmptyState
      title="Nu există metode de plată salvate"
      description="Adaugă o metodă de plată când fluxul de facturare este activ."
      icon={<WalletMinimal className="size-6" />}
      primaryAction={{ label: "Deschide plățile", href: "/client" }}
    />
  );
}
