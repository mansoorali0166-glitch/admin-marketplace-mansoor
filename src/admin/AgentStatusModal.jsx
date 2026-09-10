import React, { useState } from "react";
import { adminSupabase } from "../shared/supabase";
import "./AgentStatusModal.css";

export default function AgentStatusModal({ agent, onClose, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!agent) return null;

  const changeStatus = async (status) => {
    setSaving(true);
    setError("");
    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({
        status,
        allow_login: status === "Active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.dbId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message || "Could not update this agent.");
      return;
    }

    await onChanged?.();
    onClose();
  };

  return (
    <div
      className="agent-status-modal-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="agent-status-modal" role="dialog" aria-modal="true" aria-labelledby="agent-status-title">
        <header>
          <div>
            <h3 id="agent-status-title">Manage Agent</h3>
            <p>{agent.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <p className="agent-status-help">Choose whether this agent can access the agent portal.</p>
        {error && <p className="agent-status-error">{error}</p>}
        <div className="agent-status-modal-actions">
          <button
            type="button"
            className="activate"
            disabled={saving || agent.status === "Active"}
            onClick={() => changeStatus("Active")}
          >
            {saving ? "Updating…" : "Activate Agent"}
          </button>
          <button
            type="button"
            className="suspend"
            disabled={saving || agent.status === "Suspended"}
            onClick={() => changeStatus("Suspended")}
          >
            {saving ? "Updating…" : "Suspend Agent"}
          </button>
        </div>
      </section>
    </div>
  );
}
