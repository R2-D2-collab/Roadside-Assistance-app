import { useEffect, useState } from 'react'
import { createJobRequest, getJobRequest, getOperatorById } from '../lib/dataStore'
import {
  PHASE_1_REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  formatEtaRange,
  formatScheduledTime,
  type City,
  type RequestType,
  type JobRequest,
  type Operator,
} from '../lib/types'

const CITIES: City[] = ['Kumasi', 'Accra']

// Earliest a customer can reserve for — at least 15 min out, formatted for
// <input type="datetime-local">'s "YYYY-MM-DDTHH:mm" requirement.
function minScheduleValue(): string {
  const d = new Date(Date.now() + 15 * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CustomerRequest() {
  const [city, setCity] = useState<City>('Kumasi')
  const [requestType, setRequestType] = useState<RequestType>('tow')
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedJob, setSubmittedJob] = useState<JobRequest | null>(null)
  const [trackedJob, setTrackedJob] = useState<JobRequest | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  // Once a request is submitted, poll it every few seconds so the customer sees status/ETA
  // changes without refreshing (e.g. as the operator dashboard accepts and advances the job).
  // A separate faster tick just re-renders the countdown between polls.
  useEffect(() => {
    if (!submittedJob) return
    setTrackedJob(submittedJob)

    let cancelled = false
    async function poll() {
      const latest = await getJobRequest(submittedJob!.id)
      if (cancelled || !latest) return
      setTrackedJob(latest)
      if (latest.assignedOperatorId) {
        const op = await getOperatorById(latest.assignedOperatorId)
        if (!cancelled) setOperator(op)
      }
    }
    poll()
    const pollId = setInterval(poll, 4000)
    const tickId = setInterval(() => setNow(Date.now()), 15000)
    return () => {
      cancelled = true
      clearInterval(pollId)
      clearInterval(tickId)
    }
  }, [submittedJob])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !phone.trim() || !location.trim()) {
      setError('Please fill in your name, phone number, and location.')
      return
    }

    let scheduledForIso: string | null = null
    if (isScheduled) {
      if (!scheduledDate) {
        setError('Please choose a date and time for your reservation.')
        return
      }
      const chosen = new Date(scheduledDate)
      if (chosen.getTime() <= Date.now()) {
        setError('Please choose a time in the future for your reservation.')
        return
      }
      scheduledForIso = chosen.toISOString()
    }

    setSubmitting(true)
    try {
      const job = await createJobRequest({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        city,
        requestType,
        locationDescription: location.trim(),
        notes: notes.trim(),
        scheduledFor: scheduledForIso,
      })
      setSubmittedJob(job)
    } catch (err) {
      setError('Something went wrong submitting your request. Please try again.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedJob) {
    const job = trackedJob ?? submittedJob
    const minutesLeft = job.estimatedArrivalAt
      ? Math.max(0, Math.round((new Date(job.estimatedArrivalAt).getTime() - now) / 60000))
      : null
    const arrivalTimeLabel = job.estimatedArrivalAt
      ? new Date(job.estimatedArrivalAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null

    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        {job.status === 'requested' && job.scheduledFor && (
          <>
            <div className="text-4xl mb-3">📅</div>
            <h2 className="text-xl font-semibold mb-2">Reservation confirmed</h2>
            <p className="text-gray-600 mb-4">
              Your {REQUEST_TYPE_LABELS[job.requestType].toLowerCase()} is reserved in {job.city} for{' '}
              <span className="font-medium text-gray-800">{formatScheduledTime(job.scheduledFor)}</span>. We'll
              match you with an operator closer to your pickup time.
            </p>
          </>
        )}

        {job.status === 'requested' && !job.scheduledFor && (
          <>
            <div className="text-4xl mb-3">🔎</div>
            <h2 className="text-xl font-semibold mb-2">Finding you help</h2>
            <p className="text-gray-600 mb-4">
              We've logged your {REQUEST_TYPE_LABELS[job.requestType].toLowerCase()} request in {job.city} and
              we're matching you with the nearest available operator.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
              Typical response time for this request in {job.city} right now:{' '}
              <span className="font-medium text-gray-800">{formatEtaRange(job.requestType)}</span>
            </div>
          </>
        )}

        {(job.status === 'assigned' || job.status === 'en_route' || job.status === 'in_progress') && (
          <>
            <div className="text-4xl mb-3">🚚</div>
            <h2 className="text-xl font-semibold mb-2">
              {job.status === 'in_progress' ? 'Operator is with you' : 'Help is on the way'}
            </h2>
            <p className="text-gray-600 mb-4">
              {operator ? `${operator.name} (${operator.vehicleType})` : 'An operator'} has your{' '}
              {REQUEST_TYPE_LABELS[job.requestType].toLowerCase()} request.
            </p>
            <div className="bg-[var(--color-brand)]/5 border border-[var(--color-brand)]/20 rounded-lg p-4 mb-4">
              {job.scheduledFor && job.status !== 'in_progress' ? (
                <>
                  <div className="text-2xl font-bold text-[var(--color-brand)]">Reserved</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Operator confirmed for {formatScheduledTime(job.scheduledFor)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-[var(--color-brand)]">
                    {job.status === 'in_progress'
                      ? 'On scene'
                      : minutesLeft !== null && minutesLeft > 0
                        ? `~${minutesLeft} min`
                        : 'Arriving now'}
                  </div>
                  {arrivalTimeLabel && job.status !== 'in_progress' && (
                    <div className="text-xs text-gray-500 mt-1">Estimated arrival by {arrivalTimeLabel}</div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {job.status === 'completed' && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-semibold mb-2">Job completed</h2>
            <p className="text-gray-600 mb-4">Thanks for using the service — we hope you're back on the road.</p>
          </>
        )}

        {job.status === 'cancelled' && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Request cancelled</h2>
            <p className="text-gray-600 mb-4">This request was cancelled. Submit a new one if you still need help.</p>
          </>
        )}

        <div className="text-left text-sm bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
          <div><span className="text-gray-500">Reference:</span> {job.id.slice(0, 8)}</div>
          <div><span className="text-gray-500">Status:</span> {job.status.replace('_', ' ')}</div>
          <div><span className="text-gray-500">Location:</span> {job.locationDescription}</div>
        </div>
        <button
          className="text-sm text-[var(--color-brand)] font-medium underline"
          onClick={() => {
            setSubmittedJob(null)
            setTrackedJob(null)
            setOperator(null)
          }}
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h1 className="text-xl font-semibold mb-1">Need roadside help?</h1>
      <p className="text-gray-500 text-sm mb-6">Tell us what's happening and where you are.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <div className="flex gap-2">
            {CITIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCity(c)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  city === c
                    ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What do you need?</label>
          <div className="grid grid-cols-1 gap-2">
            {PHASE_1_REQUEST_TYPES.map((rt) => (
              <button
                type="button"
                key={rt}
                onClick={() => setRequestType(rt)}
                className={`text-left px-3 py-2 rounded-lg border text-sm font-medium ${
                  requestType === rt
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-gray-300 text-gray-700'
                }`}
              >
                {REQUEST_TYPE_LABELS[rt]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">When do you need it?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsScheduled(false)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                !isScheduled
                  ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setIsScheduled(true)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                isScheduled
                  ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              Reserve for later
            </button>
          </div>
          {isScheduled && (
            <input
              type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2"
              value={scheduledDate}
              min={minScheduleValue()}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kofi Mensah"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 24 000 0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Where are you? (landmark or Ghana Post GPS code)
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Near Kejetia Market, or AK-039-5028"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anything else? (optional)</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[var(--color-brand)] text-white font-medium py-3 rounded-lg disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : isScheduled ? 'Reserve' : 'Request Help'}
        </button>
      </form>
    </div>
  )
}
