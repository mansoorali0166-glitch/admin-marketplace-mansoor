import { useEffect, useMemo, useState } from 'react';
import './AgentInvitationCodes.css';
import { adminSupabase } from '../shared/supabase';

const generateInvitationCode = () => `P${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

export default function AgentInvitationCodes() {
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const loadAgents = async () => {
    setLoading(true);
    setMessage('');
    const { data, error } = await adminSupabase.from('profiles')
      .select('id,email,display_name,company_name,invitation_code,invitation_code_enabled,seller_count,created_at')
      .eq('role', 'agent').order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setAgents((data || []).map((profile) => ({
      id: profile.id.slice(0, 8).toUpperCase(), dbId: profile.id,
      name: profile.display_name || profile.email || 'Agent', email: profile.email,
      company: profile.company_name || '', invitationCode: profile.invitation_code || '',
      codeStatus: profile.invitation_code_enabled === false ? 'Disabled' : 'Enabled',
      sellersLinked: profile.seller_count || 0,
    })));
    setLoading(false);
  };

  useEffect(() => { loadAgents(); }, []);

  const updateCode = async (agent, changes) => {
    setBusyId(agent.dbId);
    setMessage('');
    const { error } = await adminSupabase.from('profiles')
      .update({ ...changes, updated_at: new Date().toISOString() }).eq('id', agent.dbId);
    if (error) setMessage(error.message);
    else await loadAgents();
    setBusyId(null);
  };

  const filteredAgents = useMemo(() => {
    const value = search.toLowerCase();
    return agents.filter((agent) => [agent.name, agent.email, agent.company, agent.id, agent.invitationCode]
      .some((field) => field.toLowerCase().includes(value)));
  }, [agents, search]);

  return <div className="invitation-codes-page">
    <div className="invitation-codes-header"><div><h2>Agent Invitation Codes</h2><p>View, copy, regenerate, enable or disable each agent&apos;s permanent invitation code.</p></div><button className="invitation-refresh-btn" type="button" onClick={loadAgents}>↻</button></div>
    <div className="invitation-search-box"><span className="invitation-search-icon">⌕</span><input type="text" placeholder="Search agents by name, company, email or code" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {message && <p className="invitation-error">{message}</p>}
    <div className="invitation-table-wrapper"><table className="invitation-table">
      <thead><tr><th>AGENT</th><th>INVITATION CODE</th><th>CODE STATUS</th><th>SELLERS LINKED</th><th>ACTIONS</th></tr></thead>
      <tbody>
        {loading ? <tr><td colSpan="5" className="invitation-empty">Loading invitation codes...</td></tr> : filteredAgents.map((agent) => <tr key={agent.dbId}>
          <td><div className="invitation-agent-profile"><div className="invitation-agent-avatar">{agent.name.charAt(0).toUpperCase()}</div><div className="invitation-agent-info"><strong>{agent.name}</strong><span>{agent.email}</span></div></div></td>
          <td className="invitation-code-value"><button type="button" className="invitation-copy-code" onClick={() => agent.invitationCode && navigator.clipboard?.writeText(agent.invitationCode)} title="Copy invitation code">{agent.invitationCode || 'No code'}</button></td>
          <td><span className={`invitation-status-${agent.codeStatus.toLowerCase()}`}>{agent.codeStatus}</span></td>
          <td className="invitation-sellers-linked">{agent.sellersLinked}</td>
          <td><div className="invitation-actions"><button className="invitation-regenerate-btn" type="button" disabled={busyId === agent.dbId} onClick={() => updateCode(agent, { invitation_code: generateInvitationCode(), invitation_code_enabled: true })}>↻ Regenerate</button><button className={agent.codeStatus === 'Enabled' ? 'invitation-disable-btn' : 'invitation-enable-btn'} type="button" disabled={busyId === agent.dbId} onClick={() => updateCode(agent, { invitation_code_enabled: agent.codeStatus !== 'Enabled' })}>{agent.codeStatus === 'Enabled' ? '⊘ Disable' : '✓ Enable'}</button></div></td>
        </tr>)}
        {!loading && filteredAgents.length === 0 && <tr><td colSpan="5" className="invitation-empty">No agents found.</td></tr>}
      </tbody>
    </table></div>
  </div>;
}
