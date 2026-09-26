import { useEffect, useState } from 'react'
import { listJobRequests, listOperators } from '../lib/dataStore'
import { REQUEST_TYPE_LABELS, type City, type JobRequest, type Operator } from '../lib/types'

const CITIES: City[] = ['Kumasi', 'Accra']

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-700',
  assigned: 'bg-blue-100 text-blue-700',
  en_route: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function AdminDashboard() {
  const [jobs, setJobs] = useState<JobRequest[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [allJobs, allOps] = await Promise.all([listJobRequests(), listOperators()])
      setJobs(allJobs)
      setOperators(allOps)
      setLoading(false)
    }
    load()
  }, [])

  function countFor(city: City) {
    const cityJobs = jobs.filter((j) => j.city === city)
    return {
      total: cityJobs.length,
      open: cityJobs.filter((j) => j.status === 'requested').length,
      active: cityJobs.filter((j) => ['assigned', 'en_route', 'in_progress'].includes(j.status)).length,
      completed: cityJobs.filter((j) => j.status === 'completed').length,
    }
  }

  return (
    <div className="max-w-4xl mx-auto mt-6 px-4">
      <h1 className="text-xl font-semibold mb-1">Dispatch overview</h1>
      <p className="text-gray-500 text-sm mb-6">
        This is the founder/ops view — everything happening across both cities in one place.
      </p>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {CITIES.map((city) => {
              const c = countFor(city)
              return (
                <div key={city} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="font-semibold mb-2">{city}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-400">Total:</span> {c.total}</div>
                    <div><span className="text-gray-400">Open:</span> {c.open}</div>
                    <div><span className="text-gray-400">Active:</span> {c.active}</div>
                    <div><span className="text-gray-400">Completed:</span> {c.completed}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <section className="mb-8">
            <h2 className="font-medium text-gray-800 mb-2">All jobs</h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-400">No requests yet — try submitting one from the Request Help tab.</p>
            ) : (
              <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">City</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Location</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">ETA</th>
                      <th className="text-left px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{job.city}</td>
                        <td className="px-3 py-2">{REQUEST_TYPE_LABELS[job.requestType]}</td>
                        <td className="px-3 py-2">{job.customerName}</td>
                        <td className="px-3 py-2 text-gray-500">{job.locationDescription}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[job.status]}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {job.scheduledFor
                            ? `Reserved: ${new Date(job.scheduledFor).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                            : job.estimatedArrivalAt
                              ? `By ${new Date(job.estimatedArrivalAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                              : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-400">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-medium text-gray-800 mb-2">Operators ({operators.length})</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {operators.map((op) => (
                <div key={op.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="font-medium">{op.name}</div>
                  <div className="text-gray-500">{op.city} • {op.vehicleType}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    License: {op.licenseVerified ? '✅ verified' : '⏳ pending'} · Insurance:{' '}
                    {op.insuranceVerified ? '✅ verified' : '⏳ pending'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
