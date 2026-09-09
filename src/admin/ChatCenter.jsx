import React, { useEffect, useState } from "react";
import "./ChatCenter.css";
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
  const [sendMode, setSendMode] = useState("Individual");
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("Platform Support");
  const [message, setMessage] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
  });
  const [published, setPublished] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [threadReply, setThreadReply] = useState("");
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Fetch sellers exclusively from Supabase
  const loadSellerMessages = async () => {
    setLoadingSellers(true);
    try {
      const { data } = await adminSupabase
        .from("messages")
        .select(
          "*, sender:profiles!messages_sender_id_fkey(display_name, email)",
        )
        .eq("channel", "service")
        .order("created_at", { ascending: false });

      if (data) {
        setSellers(
          data.map((item) => ({
            id: item.id,
            userId: item.sender_id,
            name: item.sender?.display_name || item.sender?.email || "Seller",
            message: item.body || "Image attachment",
            meta: "Customer service",
            unread: item.read_at ? 0 : 1,
            date: new Date(item.created_at).toLocaleString(),
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load seller messages:", err);
    } finally {
      setLoadingSellers(false);
    }
  };

  // Fetch agents exclusively from Supabase
  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("role", "agent")
        .order("display_name");

      const { data: rows } = await adminSupabase
        .from("messages")
        .select("*")
        .eq("channel", "agent")
        .order("created_at", { ascending: false });

      if (profiles) {
        setAgents(
          profiles.map((profile) => {
            const latest = (rows || []).find(
              (row) =>
                row.sender_id === profile.id || row.recipient_id === profile.id,
            );
            return {
              id: profile.id,
              userId: profile.id,
              name: profile.display_name || profile.email,
              email: profile.email,
              unread: latest && !latest.read_at ? 1 : 0,
              date: latest ? new Date(latest.created_at).toLocaleString() : "—",
              message: latest?.body || "",
            };
          }),
        );
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Fetch announcements exclusively from Supabase
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
      console.error("Failed to load announcements:", err);
    }
  };

  useEffect(() => {
    loadSellerMessages();
    loadAgents();
    loadAnnouncements();

    const channel = adminSupabase
      .channel("admin-message-center")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadSellerMessages();
          loadAgents();
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
  }, []);

  const sendMessage = async (event) => {
    event.preventDefault();
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) return;

      let query = adminSupabase
        .from("profiles")
        .select("id, role")
        .in("role", ["seller", "agent"]);
      if (sendMode === "Individual") {
        query = query.or(
          `email.ilike.%${recipient}%,display_name.ilike.%${recipient}%`,
        );
      }

      const { data: recipients } = await query;

      if (recipients?.length) {
        await adminSupabase.from("messages").insert(
          recipients.map((item) => ({
            sender_id: auth.user.id,
            recipient_id: item.id,
            channel: item.role === "agent" ? "agent" : "service",
            body: message,
          })),
        );
      }

      setMessage("");
      if (sendMode === "Individual") setRecipient("");
      await Promise.all([loadSellerMessages(), loadAgents()]);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const sendThreadReply = async () => {
    if (!threadReply.trim() || !activeThread) return;
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) return;

      await adminSupabase.from("messages").insert({
        sender_id: auth.user.id,
        recipient_id: activeThread.userId,
        channel: activeThread.type === "agent" ? "agent" : "service",
        body: threadReply.trim(),
      });

      setThreadReply("");
      setActiveThread(null);
      await Promise.all([loadSellerMessages(), loadAgents()]);
    } catch (err) {
      console.error("Error sending thread reply:", err);
    }
  };

  const publishAnnouncement = async (event) => {
    event.preventDefault();
    try {
      const { data: auth } = await adminSupabase.auth.getUser();
      if (!auth?.user) return;

      await adminSupabase.from("announcements").insert({
        title: announcementForm.title.trim(),
        message: announcementForm.content.trim(),
        target_type: "all",
        created_by: auth.user.id,
      });

      setAnnouncementForm({ title: "", content: "" });
      await loadAnnouncements();
    } catch (err) {
      console.error("Error publishing announcement:", err);
    }
  };

  const sellerUnreadCount = sellers.filter((s) => s.unread > 0).length;
  const agentUnreadCount = agents.filter((a) => a.unread > 0).length;

  return (
    <section className="chat-center-page">
      <header className="chat-center-heading">
        <h2>Message Center</h2>
        <p>Send messages, view conversations, and chat with agents.</p>
      </header>

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
            {sendMode === "Individual" && (
              <label>
                Recipient
                <input
                  required
                  placeholder="Search sellers or agents..."
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                />
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
              Message
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
                !message.trim() ||
                (sendMode === "Individual" && !recipient.trim())
              }
            >
              ➤ Send Message
            </button>
          </form>
        </div>
      )}

      {activeTab === "Seller Conversations" && (
        <div className="conversations-view">
          <div className="message-section-header">
            <div>
              <h3>All Seller Conversations</h3>
              <p>
                All messages sent to sellers. Click “Reply” to open the thread.
              </p>
            </div>
            <button type="button" onClick={loadSellerMessages}>
              ↻ Refresh
            </button>
          </div>

          <div className="conversation-list">
            {loadingSellers ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                Loading seller messages...
              </p>
            ) : sellers.length === 0 ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                No seller messages found in database.
              </p>
            ) : (
              sellers.map((seller) => (
                <article key={seller.id}>
                  <div className="chat-avatar">♙</div>
                  <div className="conversation-copy">
                    <strong>{seller.name}</strong>
                    <span>{seller.message}</span>
                    <small>
                      {seller.meta}{" "}
                      {seller.unread > 0 && <b>{seller.unread} new</b>}
                    </small>
                  </div>
                  <time>{seller.date}</time>
                  <button
                    type="button"
                    className="reply-btn"
                    onClick={() =>
                      setActiveThread({ type: "seller", ...seller })
                    }
                  >
                    ↶ Reply
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "Agent Chats" && (
        <div className="agent-chats-view">
          <div className="message-section-header">
            <div>
              <h3>Agent Chat Channels</h3>
              <p>Private conversations between Super Admin and each agent.</p>
            </div>
            <button type="button" onClick={loadAgents}>
              ↻ Refresh
            </button>
          </div>

          <div className="agent-channel-list">
            {loadingAgents ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                Loading agent chats...
              </p>
            ) : agents.length === 0 ? (
              <p style={{ padding: "1rem", color: "#64748b" }}>
                No active agent accounts found in database.
              </p>
            ) : (
              agents.map((agent) => (
                <article key={agent.id}>
                  <div className="agent-chat-avatar">
                    {agent.name ? agent.name.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div>
                    <strong>{agent.name}</strong>
                    <span>{agent.email}</span>
                    <small>{String(agent.id).slice(0, 8).toUpperCase()}</small>
                  </div>
                  <time>{agent.date}</time>
                  {agent.unread > 0 && (
                    <b className="channel-unread">{agent.unread}</b>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveThread({
                        type: "agent",
                        userId: agent.userId || agent.id,
                        ...agent,
                      })
                    }
                  >
                    ◯ Open Chat
                  </button>
                </article>
              ))
            )}
          </div>

          <p className="agent-chat-note">
            Each agent has a dedicated private chat channel. Agents can also
            message you from their portal.
          </p>
        </div>
      )}

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

      {activeThread && (
        <div
          className="chat-thread-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setActiveThread(null)
          }
        >
          <div className="chat-thread-modal">
            <div>
              <h3>
                {activeThread.type === "agent" ? "Chat with" : "Reply to"}{" "}
                {activeThread.name}
              </h3>
              <button type="button" onClick={() => setActiveThread(null)}>
                ×
              </button>
            </div>
            <p>
              {activeThread.message ||
                `Private agent channel for ${activeThread.email}`}
            </p>
            <textarea
              placeholder="Write a reply..."
              value={threadReply}
              onChange={(event) => setThreadReply(event.target.value)}
            />
            <button type="button" onClick={sendThreadReply}>
              Send Reply
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
