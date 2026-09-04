import announcements from '../mocks/fixtures/announcements.json'

type Announcement = {
  id: string
  title: string
  date: string
  body: string
  priority: 'high' | 'medium' | 'low' | string
  source: string
}

type NoticeBoardProps = {
  variant?: 'full' | 'compact'
  limit?: number
}

const items = announcements as Announcement[]

function priorityChip(priority: string) {
  if (priority === 'high') return 'attention'
  if (priority === 'medium') return 'info'
  return 'LOW'
}

export function NoticeBoard({ variant = 'full', limit }: NoticeBoardProps) {
  const list = typeof limit === 'number' ? items.slice(0, limit) : items
  const ticker = items[0]

  if (variant === 'compact') {
    return (
      <div className="notice-board notice-board--compact panel stack" style={{ gap: '0.5rem' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong style={{ fontFamily: 'var(--sc-font-display)', fontSize: '0.95rem' }}>
            Dean’s Office
          </strong>
          <span className="chip info">Notices</span>
        </div>
        {ticker ? (
          <p className="notice-ticker muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            <span className="notice-ticker__label">Latest:</span> {ticker.title}
          </p>
        ) : null}
        <ul className="notice-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {list.slice(0, limit ?? 2).map((a) => (
            <li key={a.id} className="list-row" style={{ padding: '0.45rem 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.title}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {a.date}
                </div>
              </div>
              <span className={`chip ${priorityChip(a.priority)}`}>{a.priority}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <aside className="notice-board panel stack" aria-label="Dean’s Office notice board">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--sc-font-display)',
            fontSize: '1.15rem',
          }}
        >
          Dean’s Office
        </h2>
        <span className="chip info">Running updates</span>
      </div>

      {ticker ? (
        <div className="notice-ticker" role="status">
          <span className="notice-ticker__track">
            <span className="notice-ticker__item">
              {ticker.date} — {ticker.title}: {ticker.body}
            </span>
            <span className="notice-ticker__item" aria-hidden="true">
              {ticker.date} — {ticker.title}: {ticker.body}
            </span>
          </span>
        </div>
      ) : null}

      <ul className="notice-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {list.map((a) => (
          <li key={a.id} className="list-row">
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: '0.4rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: 600 }}>{a.title}</span>
                <span className={`chip ${priorityChip(a.priority)}`}>{a.priority}</span>
              </div>
              <p className="muted" style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                {a.body}
              </p>
              <div className="muted" style={{ fontSize: '0.8rem' }}>
                {a.source} · {a.date}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
