import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SellerMessages.css";

const tabs = ["Announcements", "Order Notices", "Buyer Messages", "Platform Msgs"];

function getInitials(name = "") {
  return name.trim().slice(0, 2).toUpperCase() || "??";
}

const AVATAR_COLORS = [
  "#7c3aed", "#db2777", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#4f46e5", "#0284c7",
];

function avatarColor(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 42 }) {
  return (
    <div
      className="sm-avatar"
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: avatarColor(name),
        fontSize: size * 0.38,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const STATUS_COLORS = {
  pending:    { bg: "#fef9c3", text: "#a16207" },
  processing: { bg: "#dbeafe", text: "#1d4ed8" },
  shipped:    { bg: "#e0f2fe", text: "#0369a1" },
  delivered:  { bg: "#dcfce7", text: "#15803d" },
  cancelled:  { bg: "#fee2e2", text: "#b91c1c" },
  refunded:   { bg: "#f3e8ff", text: "#7e22ce" },
};

function statusStyle(status = "") {
  return STATUS_COLORS[status.toLowerCase()] || { bg: "#f1f5f9", text: "#475569" };
}

export default function SellerMessages({ client, sellerId, onBack }) {
  const [activeTab, setActiveTab]               = useState("Announcements");
  const [announcements, setAnnouncements]       = useState([]);
  const [notices, setNotices]                   = useState([]);
  const [buyerMessages, setBuyerMessages]       = useState([]);
  const [platformMessages, setPlatformMessages] = useState([]);
  const [openThread, setOpenThread]             = useState(null);
  const [reply, setReply]                       = useState("");
  const [loading, setLoading]                   = useState(true);

  const bubblesEndRef = useRef(null);
  const textareaRef   = useRef(null);

  useEffect(() => {
    if (!client || !sellerId) return;
    const load = async () => {
      setLoading(true);
      const [announcementsRes, messagesRes, ordersRes] = await Promise.all([
        client.from("announcements").select("*").order("created_at", { ascending: false }),
        client
          .from("messages")
          .select("*,product:products(id,name,product_code,sell_price,image_url)")
          .in("channel", ["platform", "buyer", "agent"])
          .or(`sender_id.eq.${sellerId},recipient_id.eq.${sellerId}`)
          .order("created_at", { ascending: true }),
        client
          .from("orders")
          .select("id,order_no,product_name,status,updated_at")
          .eq("seller_id", sellerId)
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);

      if (messagesRes.error) console.log("SELLER MESSAGES LOAD ERROR:", messagesRes.error);

      const partnerIds = [
        ...new Set(
          (messagesRes.data || []).map((item) =>
            item.sender_id === sellerId ? item.recipient_id : item.sender_id
          )
        ),
      ].filter(Boolean);

      const { data: partnerProfiles } = partnerIds.length
        ? await client.from("profiles").select("id,display_name,email").in("id", partnerIds)
        : { data: [] };

      const profileById = Object.fromEntries(
        (partnerProfiles || []).map((p) => [p.id, p])
      );

      setAnnouncements(
        (announcementsRes.data || []).map((item) => ({
          id:      item.id,
          title:   item.title,
          message: item.message,
          date:    new Date(item.created_at).toLocaleString(),
        }))
      );

      setNotices(
        (ordersRes.data || []).map((item) => ({
          id:      item.id,
          title:   `Order ${item.status || "Updated"}`,
          message: `${item.order_no || item.id} — ${item.product_name || "Order"}`,
          order:   item.order_no || item.id,
          status:  item.status || "updated",
          date:    new Date(item.updated_at).toLocaleString(),
        }))
      );

      const rows = (messagesRes.data || []).map((item) => ({
        ...item,
        sender:    profileById[item.sender_id],
        recipient: profileById[item.recipient_id],
      }));

      setBuyerMessages(rows.filter((item) => item.channel === "buyer"));
      setPlatformMessages(
        rows.filter((item) => item.channel === "platform" || item.channel === "agent")
      );
      setLoading(false);
    };

    load();

    const channel = client
      .channel("seller-message-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();

    return () => client.removeChannel(channel);
  }, [client, sellerId]);

  useEffect(() => {
    bubblesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openThread, buyerMessages, platformMessages]);

  const groupIntoThreads = (rows) => {
    const byPartner = new Map();
    const latestBuyerContext = new Map();
    rows.forEach((item) => {
      const partnerId      = item.sender_id === sellerId ? item.recipient_id : item.sender_id;
      const partnerProfile = item.sender_id === sellerId ? item.recipient : item.sender;
      const partnerName    = partnerProfile?.display_name || partnerProfile?.email || "User";
      const contextKey = `${partnerId}:${item.channel}`;
      const explicitBuyerContext =
        item.channel === "buyer" && item.image_url?.startsWith("virtual-buyer:")
          ? item.image_url
          : "";
      if (explicitBuyerContext) latestBuyerContext.set(contextKey, explicitBuyerContext);
      const buyerContext =
        explicitBuyerContext ||
        (item.channel === "buyer" ? latestBuyerContext.get(contextKey) || "" : "");
      const threadId = `${partnerId}:${item.channel}:${buyerContext}`;
      if (!byPartner.has(threadId)) {
        byPartner.set(threadId, {
          threadId,
          partnerId,
          partnerName,
          messages: [],
          channel: item.channel,
          buyerContext: buyerContext || null,
        });
      }
      const thread = byPartner.get(threadId);
      if (!thread.buyerContext && buyerContext) thread.buyerContext = buyerContext;
      thread.messages.push({
        id:        item.id,
        mine:      item.sender_id === sellerId,
        text:      item.body,
        product:   item.product,
        imageUrl:  item.image_url,
        date:      new Date(item.created_at).toLocaleString(),
        createdAt: item.created_at,
      });
    });
    return Array.from(byPartner.values())
      .map((thread) => ({ ...thread, lastMessage: thread.messages[thread.messages.length - 1] }))
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  };

  const buyerThreads    = useMemo(() => groupIntoThreads(buyerMessages),    [buyerMessages, sellerId]);
  const platformThreads = useMemo(() => groupIntoThreads(platformMessages), [platformMessages, sellerId]);

  const activeThread = useMemo(() => {
    if (!openThread) return null;
    const list = openThread.type === "buyer" ? buyerThreads : platformThreads;
    return list.find((thread) => thread.threadId === openThread.threadId) || null;
  }, [openThread, buyerThreads, platformThreads]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!openThread?.partnerId || !sellerId || !client || !reply.trim()) return;
    const { error } = await client.from("messages").insert({
      sender_id:    sellerId,
      recipient_id: openThread.partnerId,
      channel:      activeThread?.channel || openThread.type,
      body:         reply.trim(),
      image_url:    activeThread?.buyerContext || null,
    });
    if (error) { console.log("SEND REPLY ERROR:", error); return; }
    setReply("");
    if (textareaRef.current) textareaRef.current.style.height = "44px";
  };

  const handleTextareaInput = (e) => {
    setReply(e.target.value);
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply(e);
    }
  };

  /* ─── RENDER ─── */
  return (
    <div className="sm-root">
      {/* Header */}
      <header className="sm-header">
        {onBack && (
          <button className="sm-back-btn" onClick={onBack} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <h1 className="sm-header-title">Messages</h1>
      </header>

      {/* Tabs */}
      <nav className="sm-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={"sm-tab" + (activeTab === tab ? " sm-tab--active" : "")}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div className="sm-body">
        {loading ? (
          <div className="sm-loading">
            <span className="sm-spinner" />
            <p>Loading messages…</p>
          </div>
        ) : (
          <>
            {/* Announcements */}
            {activeTab === "Announcements" && (
              <ul className="sm-list">
                {announcements.length === 0 && <li className="sm-empty">No announcements yet.</li>}
                {announcements.map((ann) => (
                  <li key={ann.id} className="sm-announcement-card">
                    <div className="sm-announce-icon">📢</div>
                    <div className="sm-announce-body">
                      <p className="sm-announce-title">{ann.title}</p>
                      <p className="sm-announce-msg">{ann.message}</p>
                      <span className="sm-announce-date">{ann.date}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Order Notices */}
            {activeTab === "Order Notices" && (
              <ul className="sm-list">
                {notices.length === 0 && <li className="sm-empty">No order notices.</li>}
                {notices.map((notice) => {
                  const { bg, text } = statusStyle(notice.status);
                  return (
                    <li key={notice.id} className="sm-notice-card">
                      <div className="sm-notice-icon">🛍️</div>
                      <div className="sm-notice-body">
                        <div className="sm-notice-top">
                          <span className="sm-notice-order">{notice.order}</span>
                          <span className="sm-notice-badge" style={{ backgroundColor: bg, color: text }}>
                            {notice.status}
                          </span>
                        </div>
                        <p className="sm-notice-product">{notice.message}</p>
                        <span className="sm-notice-date">{notice.date}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Buyer Messages */}
            {activeTab === "Buyer Messages" && (
              <ul className="sm-list">
                {buyerThreads.length === 0 && <li className="sm-empty">No buyer conversations yet.</li>}
                {buyerThreads.map((thread) => (
                  <li key={thread.threadId}>
                    <article
                      className="sm-thread-card"
                      onClick={() => setOpenThread({ threadId: thread.threadId, partnerId: thread.partnerId, type: "buyer" })}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => e.key === "Enter" && setOpenThread({ threadId: thread.threadId, partnerId: thread.partnerId, type: "buyer" })}
                    >
                      <Avatar name={thread.partnerName} />
                      <div className="sm-thread-info">
                        <div className="sm-thread-row1">
                          <span className="sm-thread-name">{thread.partnerName}</span>
                          <span className="sm-thread-time">{formatTime(thread.lastMessage?.createdAt)}</span>
                        </div>
                        <p className="sm-thread-preview">
                          {thread.lastMessage?.mine ? "You: " : ""}
                          {thread.lastMessage?.text || ""}
                        </p>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}

            {/* Platform Messages */}
            {activeTab === "Platform Msgs" && (
              <ul className="sm-list">
                {platformThreads.length === 0 && <li className="sm-empty">No platform messages yet.</li>}
                {platformThreads.map((thread) => (
                  <li key={thread.threadId}>
                    <article
                      className="sm-thread-card"
                      onClick={() => setOpenThread({ threadId: thread.threadId, partnerId: thread.partnerId, type: "platform" })}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => e.key === "Enter" && setOpenThread({ threadId: thread.threadId, partnerId: thread.partnerId, type: "platform" })}
                    >
                      <Avatar name={thread.partnerName} />
                      <div className="sm-thread-info">
                        <div className="sm-thread-row1">
                          <span className="sm-thread-name">{thread.partnerName}</span>
                          <span className="sm-thread-time">{formatTime(thread.lastMessage?.createdAt)}</span>
                        </div>
                        <p className="sm-thread-preview">
                          {thread.lastMessage?.mine ? "You: " : ""}
                          {thread.lastMessage?.text || ""}
                        </p>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Reply Modal */}
      {openThread && activeThread && (
        <div className="sm-modal-backdrop" onClick={() => setOpenThread(null)}>
          <div
            className="sm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={"Conversation with " + activeThread.partnerName}
          >
            {/* Modal Header */}
            <div className="sm-modal-header">
              <Avatar name={activeThread.partnerName} size={38} />
              <div className="sm-modal-partner">
                <span className="sm-modal-partner-name">{activeThread.partnerName}</span>
                <span className="sm-modal-channel">
                  {openThread.type === "buyer" ? "Buyer" : "Platform"}
                </span>
              </div>
              <button className="sm-modal-close" onClick={() => setOpenThread(null)} aria-label="Close">
                ✕
              </button>
            </div>

            {/* Bubbles */}
            <div className="sm-bubbles">
              {activeThread.messages.map((msg) => (
                <div key={msg.id} className={"sm-bubble-wrap" + (msg.mine ? " sm-bubble-wrap--mine" : "")}>
                  {msg.product && (
                    <div className={"sm-product-tag" + (msg.mine ? " sm-product-tag--mine" : "")}>
                      🏷️ {msg.product.name || msg.product.product_code}
                    </div>
                  )}
                  <div className={"sm-bubble" + (msg.mine ? " sm-bubble--mine" : " sm-bubble--theirs")}>
                    {msg.text}
                  </div>
                  <span className={"sm-bubble-time" + (msg.mine ? " sm-bubble-time--mine" : "")}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              ))}
              <div ref={bubblesEndRef} />
            </div>

            {/* Compose */}
            <form className="sm-compose" onSubmit={sendReply}>
              <textarea
                ref={textareaRef}
                className="sm-compose-input"
                placeholder="Type a message…"
                value={reply}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                type="submit"
                className="sm-send-btn"
                disabled={!reply.trim()}
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
