import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminSupabase } from '../shared/supabase';
import './AgentDeletion.css';

export default function DeletedAgents() {
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await adminSupabase.from('deleted_agents').select('*').order('deleted_at', { ascending: false });
    if (loadError) setError(loadError.message); else setAgents(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agents.filter((agent) => !term || [agent.display_name, agent.email, agent.company_name, agent.invitation_code].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [agents, search]);
  return <section className="deleted-agents-page">
    <header className="deleted-agents-header"><div><h2>Deleted Agents</h2><p>Permanent agent deletions retained for administrative records.</p></div><button type="button" onClick={load}>↻ Refresh</button></header>
    <input className="deleted-agents-search" type="search" placeholder="Search deleted agents..." value={search} onChange={(event) => setSearch(event.target.value)} />
    {error && <p className="agent-status-error">{error}</p>}
    <div className="deleted-agents-table-wrap"><table className="deleted-agents-table"><thead><tr><th>AGENT</th><th>COMPANY</th><th>INVITATION CODE</th><th>STATUS</th><th>DELETED</th></tr></thead><tbody>
      {loading ? <tr><td className="deleted-agents-empty" colSpan="5">Loading deleted agents…</td></tr> : visible.length ? visible.map((agent) => <tr key={agent.id}><td><strong>{agent.display_name || 'Agent'}</strong><span>{agent.email}</span></td><td>{agent.company_name || '—'}</td><td>{agent.invitation_code || '—'}</td><td><span className="deleted-agent-pill">Deleted</span></td><td>{new Date(agent.deleted_at).toLocaleString()}</td></tr>) : <tr><td className="deleted-agents-empty" colSpan="5">No deleted agents.</td></tr>}
    </tbody></table></div>
  </section>;
}
