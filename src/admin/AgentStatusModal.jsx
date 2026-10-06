import React, { useState } from "react";
import { adminSupabase } from "../shared/supabase";
import "./AgentStatusModal.css";
import "./AgentDeletion.css";

export default function AgentStatusModal({ agent, onClose, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [success, setSuccess] = useState("");

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

  const deleteAgent = async () => {
    setSaving(true);
    setError("");
    const { data: deleted, error: deleteError } = await adminSupabase.rpc("delete_agent_permanently", { target_agent_id: agent.dbId });
    setSaving(false);
    if (deleteError || !deleted) {
      setError(deleteError?.message || "Could not delete this agent.");
      return;
    }
    await onChanged?.();
    onClose();
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 6) return setError("The new password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setSaving(true);
    const { error: resetError } = await adminSupabase.rpc("reset_agent_password", {
      target_agent_id: agent.dbId,
      new_password: newPassword,
    });
    setSaving(false);
    if (resetError) return setError(resetError.message || "Could not reset this agent's password.");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordOpen(false);
    setSuccess("Password updated. The agent will need to sign in again.");
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
        <p className="agent-status-help">{confirmingDelete ? "This permanently removes the agent login and cannot be undone." : "Choose whether this agent can access the agent portal."}</p>
        {error && <p className="agent-status-error">{error}</p>}
        {success && <p className="agent-status-success">{success}</p>}
        {passwordOpen && <form className="agent-password-reset" onSubmit={resetPassword}><label>NEW PASSWORD<input autoFocus required minLength="6" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" /></label><label>CONFIRM NEW PASSWORD<input required minLength="6" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label><div><button type="button" disabled={saving} onClick={() => { setPasswordOpen(false); setNewPassword(""); setConfirmPassword(""); }}>Cancel</button><button type="submit" className="reset-password" disabled={saving}>{saving ? "Saving…" : "Save New Password"}</button></div></form>}
        <div className="agent-status-modal-actions">
          <button type="button" className="reset-password" disabled={saving || passwordOpen} onClick={() => { setError(""); setSuccess(""); setPasswordOpen(true); }}>Reset Password</button>
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
          <button type="button" className="delete" disabled={saving} onClick={() => confirmingDelete ? deleteAgent() : setConfirmingDelete(true)}>
            {saving && confirmingDelete ? "Deleting…" : confirmingDelete ? "Confirm Permanent Delete" : "Delete Agent"}
          </button>
          {confirmingDelete && <button type="button" className="cancel-delete" disabled={saving} onClick={() => setConfirmingDelete(false)}>Cancel Delete</button>}
        </div>
      </section>
    </div>
  );
}
