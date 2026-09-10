import React, { useEffect, useState } from "react";
import "./ChatCenter.css";
import "./ChatCenterEnhancements.css";
import { adminSupabase } from "../shared/supabase";

const templates = {
  Welcome: "Welcome! We are happy to have you on the platform.",
  "Payout Processing": "Your payout is currently being processed.",
  "Account Warning":
    "Please review your account activity and resolve the highlighted issue.",
  Maintenance: "Scheduled maintenance will begin shortly.",
};

const tabs = [
  "Send Message",
  "Seller Conversations",
  "Agent Chats",
  "Announcements",
];

export default function ChatCenter() {
  const [activeTab, setActiveTab] = useState("Send Message");
  const [sendMode, setSendMode] = useState("Individual"); // 'Individual' | 'Broadcast to All'
  const [recipientRole, setRecipientRole] = useState("seller"); // 'seller' | 'agent'
  const [recipientId, setRecipientId] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("seller"); // 'seller' | 'agent' | 'all'
  const [sender, setSender] = useState("Platform Support");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);

  // Loaded profiles
  const [allSellers, setAllSellers] = useState([]);
  const [allAgents, setAllAgents] = useState([]);

  // Conversations list
  const [sellersList, setSellersList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [published, setPublished] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Thread overlay
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadReply, setThreadReply] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Announcement form
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
  });

  // 1. Fetch current admin user ID & load profiles
  const loadProfiles = async () => {
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (auth?.user) setCurrentUserId(auth.user.id);

      // Fetch sellers
      const { data: sellersData } = await adminSupabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("role", "seller")
        .order("display_name");

      if (sellersData) {
        setAllSellers(
          sellersData.map((s) => ({
            id: s.id,
            name: s.display_name || s.email || "Seller",
            email: s.email,
          })),
        );
      }

      // Fetch agents
      const { data: agentsData } = await adminSupabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("role", "agent")
        .order("display_name");

      if (agentsData) {
        setAllAgents(
          agentsData.map((a) => ({
            id: a.id,
            name: a.display_name || a.email || "Agent",
            email: a.email,
          })),
        );
      }
    } catch (err) {
      console.error("Error loading profiles:", err);
    }
  };

  // 2. Fetch seller conversation list from messages
  const loadSellerConversations = async () => {
    setLoadingSellers(true);
    try {
      const { data: messagesData, error: messagesError } = await adminSupabase
        .from("messages")
        .select("*")
        .eq("channel", "service")
        .order("created_at", { ascending: false });
      if (messagesError) console.error("Error loading service messages:", messagesError);

      const { data: sellerProfiles } = await adminSupabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("role", "seller");

      if (sellerProfiles) {
        const conversations = sellerProfiles.map((profile) => {
          const userMsgs = (messagesData || []).filter(
            (m) => m.sender_id === profile.id || m.recipient_id === profile.id,
          );
          const latest = userMsgs[0];
          const unreadCount = userMsgs.filter(
            (m) => m.sender_id === profile.id && !m.read_at,
          ).length;

          return {
            id: profile.id,
            userId: profile.id,
            name: profile.display_name || profile.email || "Seller",
            email: profile.email,
            message: latest?.body || "No messages yet",
            meta: "Customer Service Channel",
            unread: unreadCount,
            date: latest ? new Date(latest.created_at).toLocaleString() : "—",
          };
        });

        setSellersList(conversations);
      }
    } catch (err) {
      console.error("Error loading seller conversations:", err);
    } finally {
      setLoadingSellers(false);
    }
  };

  // 3. Fetch agent conversation list from messages
  const loadAgentConversations = async () => {
    setLoadingAgents(true);
    try {
      const { data: messagesData } = await adminSupabase
        .from("messages")
        .select("*")
        .eq("channel", "agent")
        .order("created_at", { ascending: false });

      const { data: agentProfiles } = await adminSupabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("role", "agent");

      if (agentProfiles) {
        const conversations = agentProfiles.map((profile) => {
          const userMsgs = (messagesData || []).filter(
            (m) => m.sender_id === profile.id || m.recipient_id === profile.id,
          );
          const latest = userMsgs[0];
          const unreadCount = userMsgs.filter(
            (m) => m.sender_id === profile.id && !m.read_at,
          ).length;

          return {
            id: profile.id,
            userId: profile.id,
            name: profile.display_name || profile.email || "Agent",
            email: profile.email,
            message: latest?.body || "No messages yet",
            unread: unreadCount,
            date: latest ? new Date(latest.created_at).toLocaleString() : "—",
          };
        });

        setAgentsList(conversations);
      }
    } catch (err) {
      console.error("Error loading agent conversations:", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  // 4. Fetch announcements
  const loadAnnouncements = async () => {
    try {
      const { data } = await adminSupabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setPublished(
          data.map((item) => ({
            id: item.id,
            title: item.title,
            content: item.message,
            date: new Date(item.created_at).toLocaleDateString(),
          })),
        );
      }
    } catch (err) {
      console.error("Error loading announcements:", err);
    }
  };

  // Load message history for active thread modal
  const loadThreadHistory = async (targetUserId, channelType) => {
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      const adminId = auth?.user?.id;
      if (!adminId || !targetUserId) return;

      const channel = channelType === "agent" ? "agent" : "service";

      const { data } = await adminSupabase
        .from("messages")
        .select("*")
        .eq("channel", channel)
        .or(
          `and(sender_id.eq.${adminId},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${adminId})`,
        )
        .order("created_at", { ascending: true });

      if (data) {
        setThreadMessages(data);
        await adminSupabase.from("messages").update({ read_at: new Date().toISOString() }).eq("sender_id", targetUserId).eq("recipient_id", adminId).is("read_at", null);
      }
    } catch (err) {
      console.error("Error loading thread history:", err);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadSellerConversations();
    loadAgentConversations();
    loadAnnouncements();

    const channel = adminSupabase
      .channel("chat-center-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadSellerConversations();
          loadAgentConversations();
          if (activeThread) {
            loadThreadHistory(activeThread.userId, activeThread.type);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        loadAnnouncements,
      )
      .subscribe();

    return () => {
      adminSupabase.removeChannel(channel);
    };
  }, [activeThread]);

  // Handle open thread
  const openThreadModal = (userObj, type) => {
    const threadData = {
      type,
      userId: userObj.userId || userObj.id,
      name: userObj.name,
      email: userObj.email,
    };
    setActiveThread(threadData);
    loadThreadHistory(threadData.userId, type);
  };

  // Send message from 'Send Message' tab
  const sendMessage = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSending(true);
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) throw new Error("Your admin session has expired. Please sign in again.");

      if (sendMode === "Individual") {
        if (!recipientId) return;

        const channel = recipientRole === "agent" ? "agent" : "service";

        const { error } = await adminSupabase.from("messages").insert({
          sender_id: auth.user.id,
          recipient_id: recipientId,
          channel,
          body: message.trim(),
        });
        if (error) throw error;
      } else {
        // Broadcast Mode
        let recipients = [];
        if (broadcastTarget === "seller") {
          recipients = allSellers.map((s) => ({
            id: s.id,
            channel: "service",
          }));
        } else if (broadcastTarget === "agent") {
          recipients = allAgents.map((a) => ({ id: a.id, channel: "agent" }));
        } else {
          recipients = [
            ...allSellers.map((s) => ({ id: s.id, channel: "service" })),
            ...allAgents.map((a) => ({ id: a.id, channel: "agent" })),
          ];
        }

        if (recipients.length > 0) {
          const { error } = await adminSupabase.from("messages").insert(
            recipients.map((r) => ({
              sender_id: auth.user.id,
              recipient_id: r.id,
              channel: r.channel,
              body: message.trim(),
            })),
          );
          if (error) throw error;
        }
      }

      setMessage("");
      setRecipientId("");
      await Promise.all([loadSellerConversations(), loadAgentConversations()]);
      setFeedback("Message sent successfully.");
    } catch (err) {
      console.error("Error sending message:", err);
      setFeedback(`Message was not sent: ${err.message || "Database error"}`);
    } finally {
      setSending(false);
    }
  };

  // Send reply from Thread modal
  const sendThreadReply = async (e) => {
    e.preventDefault();
    if (!threadReply.trim() || !activeThread) return;

    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) return;

      const channel = activeThread.type === "agent" ? "agent" : "service";

      const { error } = await adminSupabase.from("messages").insert({
        sender_id: auth.user.id,
        recipient_id: activeThread.userId,
        channel,
        body: threadReply.trim(),
      });
      if (error) throw error;

      setThreadReply("");
      await loadThreadHistory(activeThread.userId, activeThread.type);
      await Promise.all([loadSellerConversations(), loadAgentConversations()]);
    } catch (err) {
      console.error("Error sending thread reply:", err);
      setFeedback(`Reply was not sent: ${err.message || "Database error"}`);
    }
  };

  // Publish announcement
  const publishAnnouncement = async (event) => {
    event.preventDefault();
    setFeedback("");
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) return;

      const { error } = await adminSupabase.from("announcements").insert({
        title: announcementForm.title.trim(),
        message: announcementForm.content.trim(),
        target_type: "all",
        created_by: auth.user.id,
      });
      if (error) throw error;

      setAnnouncementForm({ title: "", content: "" });
      await loadAnnouncements();
      setFeedback("Announcement published successfully.");
    } catch (err) {
      console.error("Error publishing announcement:", err);
      setFeedback(`Announcement was not published: ${err.message || "Database error"}`);
    }
  };

  const sellerUnreadCount = sellersList.reduce((sum, s) => sum + s.unread, 0);
  const agentUnreadCount = agentsList.reduce((sum, a) => sum + a.unread, 0);

  const activeRecipientOptions =
    recipientRole === "seller" ? allSellers : allAgents;

  return (
    <section className="chat-center-page">
      <header className="chat-center-heading">
        <h2>Message Center</h2>
        <p>
          Send messages, view conversations, and chat with agents and sellers.
        </p>
      </header>

      {/* TABS */}
      <nav className="message-tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "Send Message"
              ? "➤"
              : tab === "Seller Conversations"
                ? "▱"
                : tab === "Agent Chats"
                  ? "◯"
                  : "⚑"}{" "}
            {tab}
            {tab === "Seller Conversations" && sellerUnreadCount > 0 && (
              <b>{sellerUnreadCount}</b>
            )}
            {tab === "Agent Chats" && agentUnreadCount > 0 && (
              <b>{agentUnreadCount}</b>
            )}
          </button>
        ))}
      </nav>
      {feedback && <p className={`chat-feedback ${feedback.includes("not ") ? "error" : "success"}`} role="status">{feedback}</p>}

      {/* TAB 1: SEND MESSAGE */}
      {activeTab === "Send Message" && (
        <div className="send-message-view">
          <div className="send-mode-tabs">
            <button
              type="button"
              className={sendMode === "Individual" ? "active" : ""}
              onClick={() => setSendMode("Individual")}
            >
              Individual
            </button>
            <button
              type="button"
              className={sendMode === "Broadcast to All" ? "active" : ""}
              onClick={() => setSendMode("Broadcast to All")}
            >
              ♙ Broadcast to All
            </button>
          </div>

          <form className="send-message-card" onSubmit={sendMessage}>
            {sendMode === "Individual" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 2fr",
                    gap: "1rem",
                  }}
                >
                  <label>
                    Recipient Type
                    <select
                      value={recipientRole}
                      onChange={(e) => {
                        setRecipientRole(e.target.value);
                        setRecipientId("");
                      }}
                    >
                      <option value="seller">Seller / Merchant</option>
                      <option value="agent">Agent</option>
                    </select>
                  </label>

                  <label>
                    Select Recipient *
                    <select
                      required
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                    >
                      <option value="">
                        -- Choose{" "}
                        {recipientRole === "seller" ? "Seller" : "Agent"} --
                      </option>
                      {activeRecipientOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.email})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            ) : (
              <label>
                Broadcast Target Audience
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                >
                  <option value="seller">
                    All Sellers ({allSellers.length})
                  </option>
                  <option value="agent">All Agents ({allAgents.length})</option>
                  <option value="all">
                    Everyone ({allSellers.length + allAgents.length})
                  </option>
                </select>
              </label>
            )}

            <label>
              Sender Name
              <input
                required
                value={sender}
                onChange={(event) => setSender(event.target.value)}
              />
            </label>

            <div className="quick-templates">
              <span>Quick Templates</span>
              <div>
                {Object.keys(templates).map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => setMessage(templates[name])}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Message Body *
              <textarea
                required
                maxLength="1000"
                placeholder="Write your message here..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <small>{message.length} chars</small>
            </label>

            <button
              className="send-message-submit"
              type="submit"
              disabled={
                sending || !message.trim() || (sendMode === "Individual" && !recipientId)
              }
            >
              {sending ? "Sending…" : "➤ Send Message"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: SELLER CONVERSATIONS */}
      {activeTab === "Seller Conversations" && (
        <div className="conversations-view">
          <div className="message-section-header">
            <div>
              <h3>All Seller Conversations</h3>
              <p>
                All conversations with merchants. Click “Reply” to view full
                history and respond.
              </p>
            </div>
            <button type="button" onClick={loadSellerConversations}>
              ↻ Refresh
            </button>
          </div>

          <div className="conversation-list">
            {loadingSellers ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                Loading seller messages...
              </p>
            ) : sellersList.length === 0 ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                No seller profiles or messages found.
              </p>
            ) : (
              sellersList.map((seller) => (
                <article key={seller.id}>
                  <div className="chat-avatar">♙</div>
                  <div className="conversation-copy">
                    <strong>{seller.name}</strong>
                    <span>{seller.message}</span>
                    <small>
                      {seller.email}{" "}
                      {seller.unread > 0 && <b>{seller.unread} new</b>}
                    </small>
                  </div>
                  <time>{seller.date}</time>
                  <button
                    type="button"
                    className="reply-btn"
                    onClick={() => openThreadModal(seller, "seller")}
                  >
                    ↶ Reply
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AGENT CHATS */}
      {activeTab === "Agent Chats" && (
        <div className="agent-chats-view">
          <div className="message-section-header">
            <div>
              <h3>Agent Chat Channels</h3>
              <p>
                Private message channels between Super Admin and each registered
                agent.
              </p>
            </div>
            <button type="button" onClick={loadAgentConversations}>
              ↻ Refresh
            </button>
          </div>

          <div className="agent-channel-list">
            {loadingAgents ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                Loading agent chats...
              </p>
            ) : agentsList.length === 0 ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                No active agent accounts found.
              </p>
            ) : (
              agentsList.map((agent) => (
                <article key={agent.id}>
                  <div className="agent-chat-avatar">
                    {agent.name ? agent.name.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div>
                    <strong>{agent.name}</strong>
                    <span>{agent.email}</span>
                    <small>{agent.message}</small>
                  </div>
                  <time>{agent.date}</time>
                  {agent.unread > 0 && (
                    <b className="channel-unread">{agent.unread}</b>
                  )}
                  <button
                    type="button"
                    onClick={() => openThreadModal(agent, "agent")}
                  >
                    ◯ Open Chat
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ANNOUNCEMENTS */}
      {activeTab === "Announcements" && (
        <div className="chat-announcements-view">
          <form className="publish-card" onSubmit={publishAnnouncement}>
            <h3>Publish New Announcement</h3>
            <label>
              Title
              <input
                required
                placeholder="Announcement title..."
                value={announcementForm.title}
                onChange={(e) =>
                  setAnnouncementForm((current) => ({
                    ...current,
                    title: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              Content
              <textarea
                required
                placeholder="Write the announcement content..."
                value={announcementForm.content}
                onChange={(e) =>
                  setAnnouncementForm((current) => ({
                    ...current,
                    content: e.target.value,
                  }))
                }
              />
            </label>
            <button
              type="submit"
              disabled={
                !announcementForm.title.trim() ||
                !announcementForm.content.trim()
              }
            >
              ⚑ Publish Announcement
            </button>
          </form>

          <h3 className="published-heading">Published Announcements</h3>
          <div className="published-list">
            {published.length === 0 ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                No announcements published yet.
              </p>
            ) : (
              published.map((item) => (
                <article key={item.id}>
                  <strong style={{ color: "#0f172a", fontWeight: 600 }}>
                    {item.title}
                  </strong>
                  <span>{item.content}</span>
                  <small>{item.date}</small>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminSupabase
                        .from("announcements")
                        .delete()
                        .eq("id", item.id);
                      loadAnnouncements();
                    }}
                  >
                    ♲
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {/* THREAD OVERLAY MODAL */}
      {activeThread && (
        <div
          className="chat-thread-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setActiveThread(null)
          }
        >
          <div
            className="chat-thread-modal"
            style={{ maxWidth: "600px", width: "90%" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Chat with {activeThread.name}</h3>
                <small style={{ color: "#64748b" }}>{activeThread.email}</small>
              </div>
              <button
                type="button"
                onClick={() => setActiveThread(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* MESSAGE STREAM */}
            <div
              style={{
                maxHeight: "320px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "0.5rem",
                marginBottom: "1rem",
                background: "#f8fafc",
                borderRadius: "8px",
              }}
            >
              {threadMessages.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    padding: "1rem",
                  }}
                >
                  No previous messages. Start the conversation below!
                </p>
              ) : (
                threadMessages.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMine ? "flex-end" : "flex-start",
                        background: isMine ? "#2563eb" : "#ffffff",
                        color: isMine ? "#ffffff" : "#0f172a",
                        padding: "0.6rem 0.9rem",
                        borderRadius: "12px",
                        maxWidth: "80%",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        border: isMine ? "none" : "1px solid #e2e8f0",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.92rem",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.body}
                      </p>
                      <small
                        style={{
                          fontSize: "0.7rem",
                          opacity: 0.75,
                          display: "block",
                          textAlign: "right",
                          marginTop: "4px",
                        }}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  );
                })
              )}
            </div>

            {/* REPLY INPUT */}
            <form
              onSubmit={sendThreadReply}
              style={{ display: "flex", gap: "0.5rem" }}
            >
              <textarea
                required
                placeholder="Write a message..."
                value={threadReply}
                onChange={(event) => setThreadReply(event.target.value)}
                style={{
                  flex: 1,
                  padding: "0.6rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  resize: "vertical",
                  minHeight: "42px",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendThreadReply(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!threadReply.trim()}
                style={{
                  padding: "0.6rem 1.2rem",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
