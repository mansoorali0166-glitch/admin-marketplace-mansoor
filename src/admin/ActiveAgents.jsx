import React, { useEffect, useState } from "react";
import "./ActiveAgents.css";
import { adminSupabase } from "../shared/supabase";
import AgentStatusModal from "./AgentStatusModal";

export default function ActiveAgents({
  onNavigateToChat,
  onNavigateToMerchants,
  onManageAgent,
}) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [managedAgent, setManagedAgent] = useState(null);

  // Fetch active agents dynamically from Supabase
  const loadActiveAgents = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await adminSupabase
        .from("profiles")
        .select("*")
        .eq("role", "agent")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (profiles) {
        setAgents(
          profiles
            .filter((p) => p.role && p.role.toLowerCase() === "agent")
            .filter((p) => p.allow_login !== false && (!p.status || p.status.toLowerCase() === "active"))
            .map((p) => ({
              id: p.id ? p.id.slice(0, 8).toUpperCase() : "AGT00000",
              dbId: p.id,
              name: p.display_name || p.full_name || p.email || "Active Agent",
              email: p.email,
              company: p.company_name || "—",
              invitationCode: p.invitation_code || "••••••••",
              status: p.status || "Active",
              sellers: p.seller_count || 0,
              approvedSellers: p.approved_sellers || 0,
              pendingSellers: p.pending_sellers || 0,
              commissionRate: p.commission_rate || 0,
              walletBalance: p.wallet_balance || 0,
              lastLogin: p.last_login
                ? new Date(p.last_login).toLocaleDateString()
                : "—",
              unread: p.unread_messages || 0,
            })),
        );
      }
    } catch (err) {
      console.error("Error loading active agents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveAgents();
  }, []);

  const filteredAgents = agents.filter((agent) => {
    const val = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(val) ||
      agent.email.toLowerCase().includes(val) ||
      agent.company.toLowerCase().includes(val) ||
      agent.id.toLowerCase().includes(val)
    );
  });

  // Calculate dynamic metrics from loaded data
  const totalSellers = agents.reduce(
    (sum, a) => sum + (Number(a.sellers) || 0),
    0,
  );
  const totalApproved = agents.reduce(
    (sum, a) => sum + (Number(a.approvedSellers) || 0),
    0,
  );
  const totalWallet = agents.reduce(
    (sum, a) => sum + (Number(a.walletBalance) || 0),
    0,
  );

  return (
    <div className="active-agents-page">
      {/* HEADER */}
      <div className="active-agents-header">
        <div>
          <h2>Active Agents</h2>
          <p>
            Monitor currently active agents and their assigned merchant
            networks.
          </p>
        </div>

        <button
          className="agents-refresh-btn"
          onClick={loadActiveAgents}
          type="button"
        >
          ↻ Refresh
        </button>
      </div>

      {/* STATS SUMMARY */}
      <div className="agent-stat-grid">
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♙</div>
          <strong>{agents.length}</strong>
          <span>Active Agents</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♧</div>
          <strong>{totalSellers}</strong>
          <span>Linked Sellers</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">✓</div>
          <strong>{totalApproved}</strong>
          <span>Approved Merchants</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">$</div>
          <strong>$ {totalWallet.toFixed(2)}</strong>
          <span>Total Agent Wallets</span>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="agents-search-box">
        <span className="agents-search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search active agents by name, email, company or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* AGENTS TABLE */}
      <div className="agents-table-wrapper">
        <table className="agents-table">
          <thead>
            <tr>
              <th>AGENT</th>
              <th>COMPANY</th>
              <th>INVITATION CODE</th>
              <th>SELLERS</th>
              <th>PENDING</th>
              <th>COMMISSION RATE</th>
              <th>WALLET BALANCE</th>
              <th>LAST LOGIN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="9"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  Loading active agents from database...
                </td>
              </tr>
            ) : filteredAgents.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No active agents found in database.
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => (
                <tr key={agent.dbId || agent.id}>
                  <td>
                    <div className="agent-profile">
                      <div className="agent-avatar">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="agent-profile-text">
                        <strong>{agent.name}</strong>
                        <span>{agent.email}</span>
                        <small>{agent.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{agent.company}</td>
                  <td className="invitation-code">{agent.invitationCode}</td>
                  <td>
                    <span className="seller-count">{agent.sellers}</span>
                    <span className="seller-approved">
                      {" "}
                      ({agent.approvedSellers} approved)
                    </span>
                  </td>
                  <td className="pending-count">{agent.pendingSellers}</td>
                  <td>{agent.commissionRate}%</td>
                  <td>$ {agent.walletBalance.toFixed(2)}</td>
                  <td className="last-login">{agent.lastLogin}</td>
                  <td>
                    <div className="agent-actions">
                      <button
                        className="agent-action manage"
                        type="button"
                        onClick={() => {
                          setManagedAgent(agent);
                          onManageAgent?.(agent.dbId);
                        }}
                      >
                        Manage
                      </button>
                      <button
                        className="agent-action merchants"
                        type="button"
                        onClick={() =>
                          onNavigateToMerchants &&
                          onNavigateToMerchants(agent.dbId)
                        }
                      >
                        ♧ View Merchants
                      </button>
                      <button
                        className="agent-action message"
                        type="button"
                        onClick={() =>
                          onNavigateToChat && onNavigateToChat(agent.dbId)
                        }
                      >
                        ◯ Message
                        {agent.unread > 0 && (
                          <span className="message-badge">{agent.unread}</span>
                        )}
                      </button>
                    </div>
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
        onChanged={loadActiveAgents}
      />
    </div>
  );
}
