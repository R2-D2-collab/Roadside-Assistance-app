import { supabase, isLiveMode } from './supabase'
import { ETA_RANGE_MINUTES } from './types'
import type { JobRequest, JobStatus, Operator, City, RequestType } from './types'

// Draws a plausible eta (minutes) once an operator accepts a job. See the TODO(maps) note in
// types.ts — this is a placeholder for a real Directions API driving-time calculation.
function randomEtaMinutes(requestType: RequestType): number {
  const [min, max] = ETA_RANGE_MINUTES[requestType]
  return Math.round(min + Math.random() * (max - min))
}

// --- Mock/local mode implementation -----------------------------------------
// Everything below persists to localStorage so the app is fully clickable today,
// with zero backend setup. Once Supabase is connected (see supabase.ts), swap
// each function's body to the commented-out Supabase version alongside it.

const STORAGE_KEYS = {
  operators: 'towapp_operators_v1',
  jobs: 'towapp_jobs_v1',
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage unavailable (private browsing etc.) — fail silently in mock mode
  }
}

function seedOperatorsIfEmpty(): Operator[] {
  const existing = readLocal<Operator[]>(STORAGE_KEYS.operators, [])
  if (existing.length > 0) return existing

  const seed: Operator[] = [
    {
      id: crypto.randomUUID(),
      name: 'Kwame Asante Towing',
      phone: '+233 24 000 0001',
      city: 'Kumasi',
      vehicleType: 'Flatbed tow truck',
      coverageArea: 'Suame, Bantama, Kejetia',
      licenseVerified: true,
      insuranceVerified: true,
      active: true,
      rating: 4.6,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: 'Ama Rescue Services',
      phone: '+233 24 000 0002',
      city: 'Kumasi',
      vehicleType: 'Motorbike (jumpstart/tire kit)',
      coverageArea: 'Ahodwo, Nhyiaeso',
      licenseVerified: true,
      insuranceVerified: false,
      active: true,
      rating: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: 'Accra Roadside Rescue',
      phone: '+233 20 000 0003',
      city: 'Accra',
      vehicleType: 'Flatbed tow truck',
      coverageArea: 'Osu, Labone, East Legon',
      licenseVerified: true,
      insuranceVerified: true,
      active: true,
      rating: 4.8,
      createdAt: new Date().toISOString(),
    },
  ]
  writeLocal(STORAGE_KEYS.operators, seed)
  return seed
}

// --- Public API used by pages ------------------------------------------------
// Each function checks isLiveMode and will call Supabase once a project is
// connected; today it always falls through to the local mock implementation.

export async function listOperators(city?: City): Promise<Operator[]> {
  if (isLiveMode && supabase) {
    let query = supabase.from('operators').select('*')
    if (city) query = query.eq('city', city)
    const { data, error } = await query
    if (error) throw error
    return data as Operator[]
  }
  const all = seedOperatorsIfEmpty()
  return city ? all.filter((o) => o.city === city) : all
}

export async function listJobRequests(city?: City): Promise<JobRequest[]> {
  if (isLiveMode && supabase) {
    let query = supabase.from('job_requests').select('*').order('createdAt', { ascending: false })
    if (city) query = query.eq('city', city)
    const { data, error } = await query
    if (error) throw error
    return data as JobRequest[]
  }
  const all = readLocal<JobRequest[]>(STORAGE_KEYS.jobs, [])
  const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return city ? sorted.filter((j) => j.city === city) : sorted
}

// Used by the customer-facing tracking screen to poll a single job for status/ETA changes.
export async function getJobRequest(id: string): Promise<JobRequest | null> {
  if (isLiveMode && supabase) {
    const { data, error } = await supabase.from('job_requests').select('*').eq('id', id).single()
    if (error) return null
    return data as JobRequest
  }
  const all = readLocal<JobRequest[]>(STORAGE_KEYS.jobs, [])
  return all.find((j) => j.id === id) ?? null
}

export async function getOperatorById(id: string): Promise<Operator | null> {
  if (isLiveMode && supabase) {
    const { data, error } = await supabase.from('operators').select('*').eq('id', id).single()
    if (error) return null
    return data as Operator
  }
  const all = seedOperatorsIfEmpty()
  return all.find((o) => o.id === id) ?? null
}

export async function createJobRequest(input: {
  customerName: string
  customerPhone: string
  city: City
  requestType: RequestType
  locationDescription: string
  notes: string
  scheduledFor?: string | null // ISO timestamp; omit/null for an ASAP request
}): Promise<JobRequest> {
  const job: JobRequest = {
    id: crypto.randomUUID(),
    customerId: crypto.randomUUID(),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    city: input.city,
    requestType: input.requestType,
    locationDescription: input.locationDescription,
    lat: null,
    lng: null,
    status: 'requested',
    assignedOperatorId: null,
    priceQuoted: null,
    etaMinutes: null,
    estimatedArrivalAt: null,
    scheduledFor: input.scheduledFor ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: input.notes,
  }

  if (isLiveMode && supabase) {
    const { data, error } = await supabase.from('job_requests').insert(job).select().single()
    if (error) throw error
    return data as JobRequest
  }

  const all = readLocal<JobRequest[]>(STORAGE_KEYS.jobs, [])
  all.push(job)
  writeLocal(STORAGE_KEYS.jobs, all)
  return job
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  assignedOperatorId?: string | null,
): Promise<void> {
  if (isLiveMode && supabase) {
    const patch: Partial<JobRequest> = { status, updatedAt: new Date().toISOString() }
    if (assignedOperatorId !== undefined) patch.assignedOperatorId = assignedOperatorId
    // The moment a job is accepted, lock in an ETA so the customer's tracking screen has
    // something to show. Requires one extra read here (for requestType); fine at this scale.
    if (status === 'assigned') {
      const { data: existing } = await supabase
        .from('job_requests')
        .select('requestType, scheduledFor')
        .eq('id', jobId)
        .single()
      if (existing) {
        const scheduledFor = existing.scheduledFor as string | null
        if (scheduledFor && new Date(scheduledFor).getTime() > Date.now()) {
          // Reserved job: the promise is the scheduled time itself, not "now + eta".
          patch.etaMinutes = Math.round((new Date(scheduledFor).getTime() - Date.now()) / 60_000)
          patch.estimatedArrivalAt = scheduledFor
        } else {
          const eta = randomEtaMinutes(existing.requestType as RequestType)
          patch.etaMinutes = eta
          patch.estimatedArrivalAt = new Date(Date.now() + eta * 60_000).toISOString()
        }
      }
    }
    const { error } = await supabase.from('job_requests').update(patch).eq('id', jobId)
    if (error) throw error
    return
  }

  const all = readLocal<JobRequest[]>(STORAGE_KEYS.jobs, [])
  const updated = all.map((j) => {
    if (j.id !== jobId) return j
    const next: JobRequest = {
      ...j,
      status,
      assignedOperatorId: assignedOperatorId !== undefined ? assignedOperatorId : j.assignedOperatorId,
      updatedAt: new Date().toISOString(),
    }
    if (status === 'assigned' && !next.etaMinutes) {
      if (j.scheduledFor && new Date(j.scheduledFor).getTime() > Date.now()) {
        next.etaMinutes = Math.round((new Date(j.scheduledFor).getTime() - Date.now()) / 60_000)
        next.estimatedArrivalAt = j.scheduledFor
      } else {
        const eta = randomEtaMinutes(j.requestType)
        next.etaMinutes = eta
        next.estimatedArrivalAt = new Date(Date.now() + eta * 60_000).toISOString()
      }
    }
    return next
  })
  writeLocal(STORAGE_KEYS.jobs, updated)
}
