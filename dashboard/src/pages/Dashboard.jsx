import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLeads, getCompanies } from '../services/api'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    totalCompanies: 0,
  })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [leadsRes, companiesRes] = await Promise.all([
          getLeads(),
          getCompanies(),
        ])
        const leads = leadsRes.data.leads
        const companies = companiesRes.data.companies
        setStats({
          totalLeads: leads.length,
          newLeads: leads.filter((l) => l.status === 'new').length,
          totalCompanies: companies.length,
        })
        setRecentLeads(leads.slice(0, 5))
      } catch (err) {
        console.error('Failed to fetch dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
          </h1>
          <p style={styles.subtitle}>Here's your lead generation overview</p>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Leads</p>
            <p style={styles.statValue}>{loading ? '—' : stats.totalLeads}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>New Leads</p>
            <p style={{...styles.statValue, color: '#2563eb'}}>
              {loading ? '—' : stats.newLeads}
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Companies</p>
            <p style={styles.statValue}>
              {loading ? '—' : stats.totalCompanies}
            </p>
          </div>
        </div>

        {/* Recent Leads */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Recent Leads</h2>
            <button
              style={styles.viewAllBtn}
              onClick={() => navigate('/leads')}
            >
              View all →
            </button>
          </div>

          {loading ? (
            <p style={styles.empty}>Loading...</p>
          ) : recentLeads.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No leads yet</p>
              <p style={styles.emptyText}>
                Use the Chrome extension on LinkedIn to extract your first leads.
              </p>
            </div>
          ) : (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span style={{...styles.tableCell, flex: 2}}>Name</span>
                <span style={{...styles.tableCell, flex: 2}}>Title</span>
                <span style={{...styles.tableCell, flex: 2}}>Company</span>
                <span style={{...styles.tableCell, flex: 1}}>Status</span>
              </div>
              {recentLeads.map((lead) => (
                <div key={lead.id} style={styles.tableRow}>
                  <span style={{...styles.tableCell, flex: 2}}>
                    {lead.name || '—'}
                  </span>
                  <span style={{...styles.tableCell, flex: 2, color: '#6b7280'}}>
                    {lead.title || '—'}
                  </span>
                  <span style={{...styles.tableCell, flex: 2, color: '#6b7280'}}>
                    {lead.company || '—'}
                  </span>
                  <span style={{...styles.tableCell, flex: 1}}>
                    <span style={{
                      ...styles.badge,
                      background: lead.status === 'new' ? '#eff6ff' : '#f3f4f6',
                      color: lead.status === 'new' ? '#2563eb' : '#6b7280',
                    }}>
                      {lead.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f9fafb',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  statCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px 24px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 8px',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  viewAllBtn: {
    background: 'transparent',
    border: 'none',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
  },
  tableHeader: {
    display: 'flex',
    padding: '8px 12px',
    background: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '4px',
  },
  tableRow: {
    display: 'flex',
    padding: '12px 12px',
    borderBottom: '1px solid #f3f4f6',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: '13px',
    color: '#111827',
    fontWeight: '400',
  },
  badge: {
    padding: '2px 10px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: '600',
  },
  empty: {
    color: '#6b7280',
    fontSize: '14px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 0',
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#374151',
    margin: '0 0 8px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
  },
}