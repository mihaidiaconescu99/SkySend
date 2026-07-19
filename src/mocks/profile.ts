import type { UserProfile } from "@/types/entities";

export const mockProfiles: UserProfile[] = [
  {
    id: "profile_client_andrei_popescu",
    clerkUserId: "user_2xSkysendAndrei",
    role: "client",
    status: "active",
    fullName: "Andrei Popescu",
    email: "andrei.popescu@argesfresh.ro",
    phoneE164: "+40722111222",
    companyName: "Arges Fresh Logistics",
    defaultPaymentMethodId: "pm_card_mastercard_2048",
    defaultAddress: {
      formattedAddress: "Strada Victoriei 24, Pitesti 110017, Romania",
      city: "Pitesti",
      county: "Arges",
      country: "Romania",
      postalCode: "110017",
      location: {
        latitude: 44.8569,
        longitude: 24.8725,
      },
    },
    createdAt: "2026-03-08T08:12:00.000Z",
    updatedAt: "2026-04-23T08:45:00.000Z",
  },
  {
    id: "profile_admin_ioana_dumitrescu",
    clerkUserId: "user_2xSkysendIoana",
    role: "admin",
    status: "active",
    fullName: "Ioana Dumitrescu",
    email: "ioana.dumitrescu@skysend.ro",
    phoneE164: "+40733111333",
    companyName: "SkySend HQ",
    defaultAddress: {
      formattedAddress: "Bulevardul Republicii 91, Pitesti 110014, Romania",
      city: "Pitesti",
      county: "Arges",
      country: "Romania",
      postalCode: "110014",
      location: {
        latitude: 44.8587,
        longitude: 24.8765,
      },
    },
    createdAt: "2026-01-12T09:00:00.000Z",
    updatedAt: "2026-04-23T07:30:00.000Z",
  },
  {
    id: "profile_operator_maria_ionescu",
    clerkUserId: "user_2xSkysendMaria",
    role: "operator",
    status: "active",
    fullName: "Maria Ionescu",
    email: "maria.ionescu@skysend.ro",
    phoneE164: "+40744111444",
    companyName: "SkySend Operations",
    defaultAddress: {
      formattedAddress: "Strada Exercițiu 216, Pitesti 110242, Romania",
      city: "Pitesti",
      county: "Arges",
      country: "Romania",
      postalCode: "110242",
      location: {
        latitude: 44.8524,
        longitude: 24.8881,
      },
    },
    createdAt: "2026-01-15T07:45:00.000Z",
    updatedAt: "2026-04-23T06:55:00.000Z",
  },
];

export const mockUserProfile = mockProfiles[0];
export const mockAdminProfile = mockProfiles[1];
export const mockOperatorProfile = mockProfiles[2];
