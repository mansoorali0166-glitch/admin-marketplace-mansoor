import React, { useEffect, useState } from 'react';
import './SuspendedAgents.css';
import { adminSupabase } from '../shared/supabase';
import AgentStatusModal from './AgentStatusModal';

export default function SuspendedAgents() {
  const [search, setSearch] = useState('');
  const [suspendedAgents, setSuspendedAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managedAgent, setManagedAgent] = useState(null);

  const loadSuspendedAgents = async () => {
    setLoading(true);
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .order('created_at', { ascending: false });

    if (!error) {
      setSuspendedAgents((data || [])
        .filter((profile) => profile.status?.toLowerCase() === 'suspended' || profile.allow_login === false)
        .map((profile) => ({
          id: profile.id.slice(0, 8).toUpperCase(),
          dbId: profile.id,
          name: profile.display_name || profile.full_name || profile.email || 'Agent',
          email: profile.email,
          company: profile.company_name || '—',
          invitationCode: profile.invitation_code || '••••••••',
          status: 'Suspended',
          sellers: profile.seller_count || 0,
          pending: profile.pending_sellers || 0,
          commission: `$ ${Number(profile.commission_rate || 0).toFixed(2)}`,
          wallet: `$ ${Number(profile.wallet_balance || 0).toFixed(2)}`,
          lastLogin: profile.last_login ? new Date(profile.last_login).toLocaleDateString() : '—',
        })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSuspendedAgents();
  }, []);

  const filteredAgents = suspendedAgents.filter((agent) => {
    const value = search.toLowerCase();

    return (
      agent.name.toLowerCase().includes(value) ||
      agent.email.toLowerCase().includes(value) ||
      agent.company.toLowerCase().includes(value) ||
      agent.id.toLowerCase().includes(value)
    );
  });

  return (
    <div className="suspended-agents-page">

      {/* ================= HEADER ================= */}

      <div className="suspended-agents-header">

        <div>
          <h2>Suspended Agents</h2>

          <p>
            Create agents, manage invitation codes, and track their seller
            networks.
          </p>
        </div>

        <button className="suspended-refresh-btn" type="button" onClick={loadSuspendedAgents}>
          ↻
        </button>

      </div>


      {/* ================= SEARCH ================= */}

      <div className="suspended-search-box">

        <span className="suspended-search-icon">
          ⌕
        </span>

        <input
          type="text"
          placeholder="Search agents by name, company, email or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>


      {/* ================= TABLE ================= */}

      <div className="suspended-table-wrapper">

        <table className="suspended-table">

          <thead>

            <tr>
              <th>AGENT</th>
              <th>COMPANY</th>
              <th>INVITATION CODE</th>
              <th>STATUS</th>
              <th>SELLERS</th>
              <th>PENDING</th>
              <th>COMMISSION</th>
              <th>WALLET</th>
              <th>LAST LOGIN</th>
              <th>ACTIONS</th>
            </tr>

          </thead>


          <tbody>

            {loading ? (
              <tr><td colSpan="10" className="suspended-empty-state">Loading suspended agents...</td></tr>
            ) : filteredAgents.length === 0 ? (

              <tr>
                <td
                  colSpan="10"
                  className="suspended-empty-state"
                >
                  No suspended agents.
                </td>
              </tr>

            ) : (

              filteredAgents.map((agent) => (

                <tr key={agent.id}>

                  <td>

                    <div className="suspended-agent-profile">

                      <div className="suspended-agent-avatar">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {agent.name}
                        </strong>

                        <span>
                          {agent.email}
                        </span>

                        <small>
                          {agent.id}
                        </small>
                      </div>

                    </div>

                  </td>

                  <td>
                    {agent.company}
                  </td>

                  <td>
                    {agent.invitationCode}
                  </td>

                  <td>
                    <span className="suspended-status-pill">
                      Suspended
                    </span>
                  </td>

                  <td>
                    {agent.sellers}
                  </td>

                  <td>
                    {agent.pending}
                  </td>

                  <td>
                    {agent.commission}
                  </td>

                  <td>
                    {agent.wallet}
                  </td>

                  <td>
                    {agent.lastLogin}
                  </td>

                  <td>
                    <button
                      className="suspended-manage-btn"
                      type="button"
                      onClick={() => setManagedAgent(agent)}
                    >
                      Manage
                    </button>
                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

      <AgentStatusModal
        agent={managedAgent}
        onClose={() => setManagedAgent(null)}
        onChanged={loadSuspendedAgents}
      />

    </div>
  );
}
