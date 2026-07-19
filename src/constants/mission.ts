import type {
  LockerState,
  MissionAction,
  MissionStatus,
} from "@/types/mission";

export const missionStatusLabels: Record<MissionStatus, string> = {
  mission_created: "Comandă plasată",
  preflight_checks: "Drona se pregătește",
  drone_dispatched: "Drona pleacă din centrul operațional",
  en_route_to_pickup: "Drona zboară spre ridicare",
  arrived_at_pickup: "Drona a ajuns la ridicare",
  awaiting_sender_position_confirmation: "Așteaptă confirmarea expeditorului",
  pickup_safety_check: "Drona verifică punctul de întâlnire",
  locker_descending_pickup: "Compartimentul coboară",
  awaiting_pickup_pin: "Compartimentul este pregătit",
  awaiting_parcel_load: "Colet pregătit pentru încărcare",
  locker_ascending_pickup: "Compartimentul se securizează",
  payload_verification: "Coletul este verificat",
  parcel_secured: "Colet securizat",
  en_route_to_dropoff: "Drona zboară spre destinatar",
  arrived_at_dropoff: "Drona a ajuns la predare",
  awaiting_recipient_position_confirmation: "Așteaptă confirmarea destinatarului",
  dropoff_safety_check: "Drona verifică punctul de întâlnire",
  locker_descending_dropoff: "Compartimentul coboară",
  awaiting_recipient_pin: "Compartimentul este pregătit",
  awaiting_parcel_collection: "Colet pregătit pentru ridicare",
  locker_ascending_dropoff: "Compartimentul se securizează",
  delivery_completed: "Livrare finalizată",
  proof_generated: "Dovadă generată",
  mission_closed: "Livrare închisă",
  returning_to_hub: "Drona se întoarce la centrul operațional",
  returned_to_hub: "Drona a revenit la centrul operațional",
  mission_failed: "Livrare oprită",
  fallback_required: "Suport necesar",
};

export const missionStatusDescriptions: Record<MissionStatus, string> = {
  mission_created: "Comanda este confirmată. Lansarea va porni în scurt timp.",
  preflight_checks:
    "SkySend alocă drona, verifică bateria și pregătește compartimentul.",
  drone_dispatched: "Drona pleacă din centrul operațional SkySend Pitești.",
  en_route_to_pickup:
    "Drona zboară spre punctul de întâlnire pentru ridicare.",
  arrived_at_pickup: "Drona este la punctul de ridicare.",
  awaiting_sender_position_confirmation:
    "Confirmă doar când vezi drona la punctul de ridicare.",
  pickup_safety_check:
    "Drona verifică punctul de întâlnire înainte de coborârea compartimentului.",
  locker_descending_pickup: "Compartimentul coboară pentru încărcarea coletului.",
  awaiting_pickup_pin:
    "Compartimentul este pregătit. Folosește PIN-ul pe tastatura compartimentului.",
  awaiting_parcel_load:
    "Introdu PIN-ul pe compartiment, nu pe site. Încarcă coletul, apoi confirmă.",
  locker_ascending_pickup:
    "Compartimentul urcă și securizează coletul pentru zbor.",
  payload_verification: "SkySend verifică dacă coletul este pregătit pentru zbor.",
  parcel_secured: "Coletul este securizat în compartiment.",
  en_route_to_dropoff: "Drona zboară spre destinatar.",
  arrived_at_dropoff: "Drona ajunge la punctul de întâlnire pentru predare.",
  awaiting_recipient_position_confirmation:
    "Confirmă doar când vezi drona la punctul de predare.",
  dropoff_safety_check:
    "Drona verifică punctul de întâlnire înainte de coborârea compartimentului.",
  locker_descending_dropoff: "Compartimentul coboară pentru ridicarea coletului.",
  awaiting_recipient_pin:
    "Compartimentul este pregătit. Folosește PIN-ul pe tastatura compartimentului.",
  awaiting_parcel_collection:
    "Introdu PIN-ul pe compartiment, nu pe site. Ridică coletul, apoi confirmă.",
  locker_ascending_dropoff: "Compartimentul se întoarce la dronă.",
  delivery_completed: "Coletul a fost ridicat cu succes.",
  proof_generated: "Detaliile livrării sunt salvate.",
  mission_closed: "Livrarea este completă.",
  returning_to_hub:
    "Drona se întoarce la centrul operațional SkySend după activarea rutei de rezervă.",
  returned_to_hub:
    "Drona a revenit la centrul operațional. Comanda rămâne oprită și rambursarea este în curs.",
  mission_failed: "Livrarea nu poate continua acum.",
  fallback_required: "Suportul SkySend va gestiona pasul următor.",
};

export const lockerStateLabels: Record<LockerState, string> = {
  attached: "Atașat",
  preparing_descent: "Verificare înainte de coborâre",
  descending: "Compartimentul coboară",
  ready_for_load: "Compartimentul este pregătit",
  loaded: "Colet încărcat",
  ascending: "Compartimentul se securizează",
  secured: "Securizat",
  ready_for_unload: "Compartimentul este pregătit",
  emptied: "Colet ridicat",
  locked: "Blocat",
};

export const missionActionLabels: Record<MissionAction, string> = {
  confirm_sender_position: "Confirmă că vezi drona",
  verify_pickup_pin: "PIN folosit pe compartiment",
  confirm_parcel_loaded: "Colet încărcat",
  confirm_recipient_position: "Confirmă că vezi drona",
  verify_recipient_pin: "PIN folosit pe compartiment",
  confirm_parcel_collected: "Colet ridicat",
  trigger_fallback: "Contactează suportul",
};

export type MissionDurationRange = {
  minSeconds: number;
  maxSeconds: number;
};

export type MissionDurationSeconds = number | MissionDurationRange;

export const defaultMissionDurations = {
  preflightChecks: 4,
  warehouseToPickup: {
    minSeconds: 20,
    maxSeconds: 35,
  },
  pickupSafetyCheck: 4,
  lockerDescent: 5,
  lockerAscent: 5,
  pickupToDropoff: {
    minSeconds: 25,
    maxSeconds: 40,
  },
  dropoffSafetyCheck: 4,
} satisfies Record<string, MissionDurationSeconds>;
