// Core data model for the TowApp Ghana platform.
// This mirrors what will become the Supabase Postgres schema once a project is connected.

export type City = 'Kumasi' | 'Accra'

export type RequestType = 'tow' | 'jumpstart' | 'tire_change' | 'fuel_delivery' | 'lockout'

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  tow: 'Towing',
  jumpstart: 'Battery Jumpstart',
  tire_change: 'Flat Tire Change',
  fuel_delivery: 'Fuel Delivery',
  lockout: 'Lockout Assistance',
}

// Phase 1 only supports these five request types (the "basic rescue" bundle + towing).
// Mechanic/repair dispatch is a deliberate Phase 2+ addition — do not add repair-type
// requests here without re-reading the feasibility report's liability discussion first.
export const PHASE_1_REQUEST_TYPES: RequestType[] = [
  'tow',
  'jumpstart',
  'tire_change',
  'fuel_delivery',
  'lockout',
]

export type JobStatus =
  | 'requested'      // customer submitted, not yet assigned
  | 'assigned'       // an operator has been matched/dispatched
  | 'en_route'       // operator is on the way
  | 'in_progress'    // operator is on scene working the job
  | 'completed'      // job finished, payment settled
  | 'cancelled'

export interface Customer {
  id: string
  name: string
  phone: string
  city: City
  createdAt: string
}

export interface Operator {
  id: string
  name: string
  phone: string
  city: City
  vehicleType: string // e.g. "Flatbed tow truck", "Motorbike (jumpstart/tire kit)"
  coverageArea: string // free-text neighborhood/zone description for MVP
  licenseVerified: boolean
  insuranceVerified: boolean
  active: boolean
  rating: number | null
  createdAt: string
}

export interface JobRequest {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  city: City
  requestType: RequestType
  locationDescription: string // free-text or Ghana Post GPS code at MVP stage
  lat: number | null
  lng: number | null
  status: JobStatus
  assignedOperatorId: string | null
  priceQuoted: number | null // GHS
  etaMinutes: number | null // set once an operator accepts; minutes-to-arrival at time of acceptance
  estimatedArrivalAt: string | null // ISO timestamp, set alongside etaMinutes
  createdAt: string
  updatedAt: string
  notes: string
}

// How long help typically takes to arrive once matched, by request type. Today this is a
// plausible estimate (not GPS-derived) so the customer sees SOMETHING useful before we have
// live operator locations and Google Maps driving-time data wired in. Tow trucks are slower
// because there are fewer of them and they're less maneuverable in traffic/unpaved access
// roads; jumpstart/lockout use motorbike operators who thread through traffic faster.
// TODO(maps): once operator GPS + Directions API are live, replace randomEtaMinutes() in
// dataStore.ts with a real driving-time lookup and keep this only as a pre-match fallback
// estimate for the "still finding you an operator" state.
export const ETA_RANGE_MINUTES: Record<RequestType, [number, number]> = {
  tow: [18, 35],
  jumpstart: [10, 20],
  tire_change: [12, 22],
  fuel_delivery: [15, 25],
  lockout: [10, 18],
}

export function formatEtaRange(requestType: RequestType): string {
  const [min, max] = ETA_RANGE_MINUTES[requestType]
  return `${min}–${max} min`
}
