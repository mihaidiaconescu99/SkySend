import { redirect } from "next/navigation";

export default function LegacyCheckoutRedirect() {
  redirect("/client/create-delivery?checkout=moved");
}
