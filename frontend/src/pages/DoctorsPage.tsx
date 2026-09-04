import { useMemo, useState } from 'react'
import doctors from '../mocks/fixtures/doctors.json'

type Doctor = {
  id: string
  name: string
  specialty: string
  department: string
  clinic_hours: string
  languages: string[]
  availability: string
  phone: string
  location: string
}

const allDoctors = doctors as Doctor[]

function availabilityClass(availability: string) {
  const a = availability.toLowerCase()
  if (a.includes('available') || a.includes('on shift')) return 'LOW'
  if (a.includes('limited')) return 'MEDIUM'
  return 'attention'
}

export function DoctorsPage() {
  const [q, setQ] = useState('')
  const [specialty, setSpecialty] = useState('all')

  const specialties = useMemo(() => {
    const set = new Set(allDoctors.map((d) => d.specialty))
    return ['all', ...Array.from(set).sort()]
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return allDoctors.filter((d) => {
      if (specialty !== 'all' && d.specialty !== specialty) return false
      if (!needle) return true
      return (
        d.name.toLowerCase().includes(needle) ||
        d.specialty.toLowerCase().includes(needle) ||
        d.department.toLowerCase().includes(needle)
      )
    })
  }, [q, specialty])

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0, fontFamily: 'var(--sc-font-display)' }}>Doctors</h1>
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Staff directory for SwiftCare Clinic — specialty, hours, and desk contacts.
        </p>
      </div>

      <form
        className="row"
        onSubmit={(e) => e.preventDefault()}
        style={{ alignItems: 'end' }}
      >
        <label style={{ flex: '1 1 220px' }}>
          <span className="muted">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, specialty, or department"
            aria-label="Search doctors"
          />
        </label>
        <label style={{ flex: '0 1 200px' }}>
          <span className="muted">Specialty</span>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            aria-label="Filter by specialty"
          >
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All specialties' : s}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <p className="empty" style={{ padding: 'var(--sc-space)' }}>
            No doctors match your filters.
          </p>
        ) : (
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialty</th>
                <th>Hours</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {d.department} · {d.phone}
                    </div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {d.languages.join(', ')}
                    </div>
                  </td>
                  <td>{d.specialty}</td>
                  <td>{d.clinic_hours}</td>
                  <td>{d.location}</td>
                  <td>
                    <span className={`chip ${availabilityClass(d.availability)}`}>
                      {d.availability}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
