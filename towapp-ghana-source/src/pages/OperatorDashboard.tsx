import { useEffect, useState } from 'react'
import { listJobRequests, listOperators, updateJobStatus } from '../lib/dataStore'
import { REQUEST_TYPE_LABELS, type City, type JobRequest, type JobStatus, type Operator } from '../lib/types'

const CITIES: City[] = ['Kumasi', 'Accra']

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  assigned: 'en_route',
  en_route: 'in_progress',
  in_progress: 'completed',
}

const NEXT_LABEL: Partial<Record<JobStatus, string>> = {
  assigned: 'Start driving',
  en_route: 'Arrived — start job',
  in_progress: 'Mark completed',
}

export default function OperatorDashboard() {
  const [city, setCity] = useState<City>('Kumasi')
  const [operators, setOperators] = useState<Operator[]>([])
  const [actingAsOperatorId, setActingAsOperatorId] = useState<string>('')
  const [jobs, setJobs] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    const [ops, allJobs] = await Promise.all([listOperators(city), listJobRequests(city)])
    setOperators(ops)
    setJobs(allJobs)
    if (!actingAsOperatorId && ops.length > 0) setActingAsOperatorId(ops[0].id)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city])

  const openJobs = jobs.filter((j) => j.status === 'requested')
  const myJobs = jobs.filter((j) => j.assignedOperatorId === actingAsOperatorId && j.status !== 'requested' && j.status !== 'completed')

  async function acceptJob(jobId: string) {
    await updateJobStatus(jobId, 'assigned', actingAsOperatorId)
    refresh()
  }

  async function advance(job: JobRequest) {
    const next = NEXT_STATUS[job.status]
    if (!next) return
    await updateJobStatus(job.id, next)
    refresh()
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4">
      <h1 className="text-xl font-semibold mb-1">Operator view</h1>
      <p className="text-gray-500 text-sm mb-4">
        Prototype note: there's no login yet, so pick which operator you're "acting as" below.
      </p>

      <div className="flex gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value as City)}
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Acting as</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            value={actingAsOperatorId}
            onChange={(e) => setActingAsOperatorId(e.target.value)}
          >
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name} — {o.vehicleType}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-medium text-gray-800 mb-2">My active jobs</h2>
            {myJobs.length === 0 ? (
              <p className="text-sm text-gray-400">No active jobs right now.</p>
            ) : (
              <div className="space-y-2">
                {myJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{REQUEST_TYPE_LABELS[job.requestType]}</div>
                      <div className="text-xs text-gray-500">{job.locationDescription} • {job.customerName} • {job.customerPhone}</div>
                      <div className="text-xs mt-1 inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{job.status.replace('_', ' ')}</div>
                      {job.estimatedArrivalAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Promised to customer: by{' '}
                          {new Date(job.estimatedArrivalAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    {NEXT_STATUS[job.status] && (
                      <button
                        onClick={() => advance(job)}
                        className="text-xs font-medium bg-[var(--color-brand)] text-white px-3 py-2 rounded-lg"
                      >
                        {NEXT_LABEL[job.status]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-medium text-gray-800 mb-2">Open requests in {city}</h2>
            {openJobs.length === 0 ? (
              <p className="text-sm text-gray-400">No open requests right now.</p>
            ) : (
              <div className="space-y-2">
                {openJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{REQUEST_TYPE_LABELS[job.requestType]}</div>
                      <div className="text-xs text-gray-500">{job.locationDescription} • {job.customerName}</div>
                    </div>
                    <button
                      onClick={() => acceptJob(job.id)}
                      className="text-xs font-medium bg-[var(--color-accent)] text-white px-3 py-2 rounded-lg"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
