import React, { useEffect, useState } from "react";
import "./AllAgents.css";
import { adminSupabase } from "../shared/supabase";
import AgentStatusModal from "./AgentStatusModal";

export default function AllAgents({ onNavigateToChat, onNavigateToMerchants }) {
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [managedAgent, setManagedAgent] = useState(null);
  const [profileRequests, setProfileRequests] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [newAgent, setNewAgent] = useState({
    fullName: "",
    company: "",
    email: "",
    phone: "",
    password: "",
    commission: 5,
    status: "Active",
  });

  // Load agents dynamically from Supabase (strictly excluding sellers/admins)
  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: fetchErr } = await adminSupabase
        .from("profiles")
        .select("*")
        .eq("role", "agent")
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      if (profiles) {
        setAgents(
          profiles
            // Strict client-side filter to guarantee non-agent roles are excluded
            .filter((p) => p.role && p.role.toLowerCase() === "agent")
            .map((p) => ({
              id: p.id ? p.id.slice(0, 8).toUpperCase() : "AGT00000",
              dbId: p.id,
              name: p.display_name || p.full_name || p.email || "Agent",
              email: p.email,
              phone: p.phone || "—",
              company: p.company_name || "—",
              invitationCode: p.invitation_code || "••••••••",
              status: p.status || "Active",
              sellers: String(p.seller_count || 0),
              sellersDetail: `(${p.approved_sellers || 0} approved)`,
              pending: String(p.pending_sellers || 0),
              commission: `$ ${(p.commission_rate || 0).toFixed(2)}`,
              wallet: `$ ${(p.wallet_balance || 0).toFixed(2)}`,
              lastLogin: p.last_login
                ? new Date(p.last_login).toLocaleDateString()
                : "—",
              unread: p.unread_messages || 0,
            })),
        );
      }
      const { data: requests, error: requestError } = await adminSupabase
        .from("agent_profile_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (requestError && requestError.code !== "42P01") throw requestError;
      setProfileRequests(Object.fromEntries((requests || []).map((request) => [request.agent_id, request])));
    } catch (err) {
      console.error("Error loading agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const reviewProfileRequest = async (decision) => {
    if (!selectedRequest) return;
    setReviewBusy(true);
    setReviewError("");
    try {
      const { error } = await adminSupabase.rpc("review_agent_profile_change", {
        request_id: selectedRequest.id,
        decision,
      });
      if (error) throw error;
      setSelectedRequest(null);
      await loadAgents();
    } catch (err) {
      setReviewError(err.message || "Could not review this request.");
    } finally {
      setReviewBusy(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Handle actual agent creation in Supabase
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      let userId = null;

      // 1. Register in Supabase Auth
      const { data: authData, error: authErr } =
        await adminSupabase.auth.signUp({
          email: newAgent.email,
          password: newAgent.password,
          options: {
            data: {
              display_name: newAgent.fullName,
              role: "agent",
            },
          },
        });

      if (authErr) {
        if (authErr.message.includes("already registered")) {
          // If auth user already exists, retrieve existing profile ID
          const { data: existingProfile } = await adminSupabase
            .from("profiles")
            .select("id")
            .eq("email", newAgent.email)
            .maybeSingle();

          if (existingProfile) {
            userId = existingProfile.id;
          } else {
            throw new Error(
              "This user email already exists in Auth. Please enter a new email address.",
            );
          }
        } else {
          throw authErr;
        }
      } else {
        userId = authData.user?.id;
      }

      const generatedCode =
        "INV-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      // 2. Insert or update profile row in Supabase
      if (userId) {
        const { error: profileErr } = await adminSupabase
          .from("profiles")
          .upsert({
            id: userId,
            display_name: newAgent.fullName,
            email: newAgent.email,
            phone: newAgent.phone,
            company_name: newAgent.company,
            role: "agent",
            status: newAgent.status,
            commission_rate: Number(newAgent.commission),
            invitation_code: generatedCode,
          });

        if (profileErr) throw profileErr;
      }

      setShowNewAgentModal(false);
      setNewAgent({
        fullName: "",
        company: "",
        email: "",
        phone: "",
        password: "",
        commission: 5,
        status: "Active",
      });
      await loadAgents();
    } catch (err) {
      console.error("Failed to create agent:", err);
      setError(err.message || "Failed to create agent.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const val = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(val) ||
      agent.email.toLowerCase().includes(val) ||
      agent.company.toLowerCase().includes(val) ||
      agent.id.toLowerCase().includes(val)
    );
  });

  const activeCount = agents.filter((a) => a.status === "Active").length;
  const suspendedCount = agents.filter((a) => a.status === "Suspended").length;

  return (
    <div className="all-agents-page">
      {/* HEADER */}
      <div className="all-agents-header">
        <div>
          <h2>All Agents</h2>
          <p>
            Create agents, manage invitation codes, and track their seller
            networks.
          </p>
        </div>

        <div className="all-agents-header-actions">
          <button
            className="agents-refresh-btn"
            onClick={loadAgents}
            type="button"
          >
            ↻
          </button>
          <button
            className="new-agent-btn"
            onClick={() => setShowNewAgentModal(true)}
            type="button"
          >
            <span>♙</span> Add Agent
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="agent-stat-grid">
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♙</div>
          <strong>{agents.length}</strong>
          <span>Total Agents</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♙</div>
          <strong>{activeCount}</strong>
          <span>Active</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♙</div>
          <strong>{suspendedCount}</strong>
          <span>Suspended</span>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-icon">♙</div>
          <strong>
            {agents.reduce((sum, a) => sum + (parseInt(a.sellers, 10) || 0), 0)}
          </strong>
          <span>Total Linked Sellers</span>
        </div>
      </div>

      {/* SEARCH */}
      <div className="agents-search-box">
        <span className="agents-search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search agents by name, company, email or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="agents-table-wrapper">
        <table className="agents-table">
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
              <th>PROFILE REQUEST</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="11"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  Loading agents from database...
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
                    <span
                      className={`agent-status ${agent.status.toLowerCase()}`}
                    >
                      {agent.status}
                    </span>
                  </td>
                  <td>
                    <span className="seller-count">{agent.sellers}</span>
                    <span className="seller-approved">
                      {" "}
                      {agent.sellersDetail}
                    </span>
                  </td>
                  <td className="pending-count">{agent.pending}</td>
                  <td>{agent.commission}</td>
                  <td>{agent.wallet}</td>
                  <td className="last-login">{agent.lastLogin}</td>
                  <td>
                    {profileRequests[agent.dbId] ? (
                      <button className="profile-request-review" type="button" onClick={() => { setReviewError(""); setSelectedRequest({ ...profileRequests[agent.dbId], agent }); }}>Review request</button>
                    ) : <span className="profile-request-none">—</span>}
                  </td>
                  <td>
                    <div className="agent-actions">
                      <button
                        className="agent-action manage"
                        type="button"
                        onClick={() => setManagedAgent(agent)}
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
            {!loading && filteredAgents.length === 0 && (
              <tr>
                <td
                  colSpan="11"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No agents found in database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div className="profile-request-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedRequest(null)}>
          <section className="profile-request-modal" role="dialog" aria-modal="true">
            <header><div><h3>Profile change request</h3><p>{selectedRequest.agent.name} · {selectedRequest.agent.email}</p></div><button type="button" onClick={() => setSelectedRequest(null)}>×</button></header>
            <div className="profile-request-comparison">
              <div><span>FIELD</span><strong>CURRENT</strong><strong>REQUESTED</strong></div>
              <div><span>Name</span><p>{selectedRequest.agent.name}</p><p>{selectedRequest.requested_display_name || "—"}</p></div>
              <div><span>Company</span><p>{selectedRequest.agent.company}</p><p>{selectedRequest.requested_company_name || "—"}</p></div>
              <div><span>Phone</span><p>{selectedRequest.agent.phone}</p><p>{selectedRequest.requested_phone || "—"}</p></div>
            </div>
            {reviewError && <p className="profile-request-error">{reviewError}</p>}
            <footer><button type="button" disabled={reviewBusy} onClick={() => reviewProfileRequest("denied")}>Deny</button><button type="button" disabled={reviewBusy} onClick={() => reviewProfileRequest("approved")}>{reviewBusy ? "Saving…" : "Approve changes"}</button></footer>
          </section>
        </div>
      )}

      {/* CREATE AGENT MODAL */}
      {showNewAgentModal && (
        <div
          className="new-agent-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowNewAgentModal(false);
            }
          }}
        >
        <div
          className="new-agent-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-agent-title"
        >
          <div className="new-agent-modal-header">
            <h3 id="new-agent-title">Create New Agent</h3>
            <button
              className="new-agent-modal-close"
              type="button"
              onClick={() => setShowNewAgentModal(false)}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreateAgent}>
            {error && (
              <p style={{ color: "red", margin: "0 0 1rem 0" }}>{error}</p>
            )}

            <div className="new-agent-form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={newAgent.fullName}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, fullName: e.target.value })
                }
                required
              />
            </div>

            <div className="new-agent-form-group">
              <label>Company Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Smith Trading Ltd"
                value={newAgent.company}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, company: e.target.value })
                }
              />
            </div>

            <div className="new-agent-form-group">
              <label>Email *</label>
              <input
                type="email"
                placeholder="agent@example.com"
                value={newAgent.email}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, email: e.target.value })
                }
                required
              />
            </div>

            <div className="new-agent-form-group">
              <label>Phone Number *</label>
              <input
                type="text"
                placeholder="+92 300 1234567"
                value={newAgent.phone}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, phone: e.target.value })
                }
                required
              />
            </div>

            <div className="new-agent-form-group">
              <label>Password * (min 6 chars)</label>
              <input
                type="password"
                placeholder="Enter password"
                minLength="6"
                value={newAgent.password}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, password: e.target.value })
                }
                required
              />
            </div>

            <div className="new-agent-form-group">
              <label>Commission Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newAgent.commission}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, commission: e.target.value })
                }
              />
            </div>

            <div className="new-agent-modal-footer">
              <button
                type="submit"
                className="new-agent-create-btn"
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Create Agent"}
              </button>
            </div>
          </form>
        </div>
        </div>
      )}
      <AgentStatusModal
        agent={managedAgent}
        onClose={() => setManagedAgent(null)}
        onChanged={loadAgents}
      />
    </div>
  );
}
