import { StripeCheckoutView } from "@/components/checkout/stripe-checkout-view";
import { createPageMetadata } from "@/lib/metadata";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { orderId } = await params;

  return createPageMetadata(
    `Checkout ${orderId}`,
    "Complete the secure card payment before SkySend starts the live mission.",
  );
}

export default async function ClientCheckoutPage({ params }: PageProps) {
  const { orderId } = await params;

  return <StripeCheckoutView orderId={orderId} />;
}
