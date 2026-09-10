import React, { useEffect, useMemo, useRef, useState } from "react";
import { agentSupabase } from "../shared/supabase";
import MerchantFinanceModals from "../shared/MerchantFinanceModals";
import MerchantControlModals from "../shared/MerchantControlModals";
import MerchantActivityModals from "../shared/MerchantActivityModals";
import { readImageFile, resizeImageToDataUrl } from "../shared/avatar";
import AvatarCropper from "../shared/AvatarCropper";
import {
  merchantActionKind,
  normalizeMerchantAction,
} from "../shared/merchantActions";
import {
  fetchPagedRows,
  fetchWalletTransactions,
  formatUsd,
  parseMoney,
  rowSellerId,
  walletTotalsBySeller,
} from "../shared/wallet";
import "./AgentPortal.css";
import "./AgentTeam.css";
import "./AgentUnregistered.css";
import "./AgentApplications.css";
import "./AgentApplicationList.css";
import "./AgentMerchantList.css";
import "./AgentShowcase.css";
import "./AgentBoundAddresses.css";
import "./AgentCreditLogs.css";
import "./AgentBalanceLocks.css";
import "./AgentOrderManagement.css";
import "./AgentMessagingEnhancements.css";
import "./AgentMessagingEnhancements.css";
import "./AgentOrderList.css";
import "./AgentBatchShip.css";
import "./AgentBatchReceive.css";
import "./AgentAutoOrder.css";
import "./AgentOrderRecords.css";
import "./AgentGeneralConfig.css";
import "./AgentMessages.css";
import "./AgentAnnouncements.css";
import "./AgentRechargeOrders.css";
import "./AgentWithdrawOrders.css";
import "./AgentSellerChat.css";
// import "./AgentSellerChatReply.css";
import "./AgentVirtualBuyers.css";
import "./AgentBuyerMessages.css";
// import "./AgentBuyerProductFilters.css";
// import "./AgentVirtualBuyerBackend.css";
import "./AgentFinalPages.css";
// import "../shared/BuyerImageEditor.css";

const buyerCountries = [
  ["Afghanistan", "+93"],
  ["Australia", "+61"],
  ["Bangladesh", "+880"],
  ["Brazil", "+55"],
  ["Canada", "+1"],
  ["China", "+86"],
  ["France", "+33"],
  ["Germany", "+49"],
  ["India", "+91"],
  ["Indonesia", "+62"],
  ["Italy", "+39"],
  ["Japan", "+81"],
  ["Malaysia", "+60"],
  ["Mexico", "+52"],
  ["Netherlands", "+31"],
  ["New Zealand", "+64"],
  ["Nigeria", "+234"],
  ["Pakistan", "+92"],
  ["Philippines", "+63"],
  ["Saudi Arabia", "+966"],
  ["Singapore", "+65"],
  ["South Africa", "+27"],
  ["South Korea", "+82"],
  ["Spain", "+34"],
  ["Sri Lanka", "+94"],
  ["Thailand", "+66"],
  ["Turkey", "+90"],
  ["United Arab Emirates", "+971"],
  ["United Kingdom", "+44"],
  ["United States", "+1"],
  ["Vietnam", "+84"],
].map(([name, code]) => ({ name, code }));

const callingCodeFor = (country) =>
  buyerCountries.find((item) => item.name === country)?.code || "";

const nationalPhone = (phone, country) => {
  const code = callingCodeFor(country);
  return code && String(phone || "").startsWith(code)
    ? String(phone).slice(code.length).trim()
    : String(phone || "").replace(/^\+\d+\s*/, "");
};

const groups = [
  { label: "", items: [["Dashboard", "▦"]] },
  { label: "AGENT SYSTEM", items: [["Agents", "♧"]] },
  {
    label: "MERCHANTS",
    items: [
      ["Unregistered", "♙"],
      ["Applications", "▤"],
      ["Merchant List", "♧"],
      ["Showcases", "⌂"],
      ["Bound Addresses", "⌖"],
      ["Credit Logs", "▭"],
      ["Balance Locks", "▣"],
    ],
  },
  {
    label: "ORDERS",
    items: [
      ["Order Management", "▣"],
      ["Order List", "▤"],
      ["Batch Ship", "♧"],
      ["Batch Receive", "◇"],
      ["Auto Order", "ϟ"],
      ["Order Records", "◴"],
      ["General Config", "⚙"],
      ["Messages", "✉"],
      ["Announcements", "▤"],
    ],
  },
  {
    label: "FINANCE",
    items: [
      ["Recharge Orders", "▣"],
      ["Withdraw Orders", "▥"],
      ["Chat", "◯"],
      ["Virtual Buyer – Shop", "♙"],
      ["Buyer Messages", "✉"],
      ["Shop – System", "▣"],
    ],
  },
  {
    label: "OTHER",
    items: [
      ["Earnings", "$"],
      ["Feedbacks", "▤"],
      ["Audit Logs", "▧"],
      ["My Account", "♧"],
    ],
  },
];

const notifications = [
  [
    "Order Paid — Pending Shipment",
    "Order TT6133610796740 has been paid ($160.08). The seller will ship it shortly.",
    "Aug 10, 2026",
  ],
  ["📣 orders", "hey", "Aug 8, 2026"],
  ["Seller Replied", "Khan321 replied: “Hello”", "Aug 8, 2026"],
  ["Seller Replied", "Khan replied: “Hello”", "Aug 5, 2026"],
  ["Seller Replied", "Khan replied: “Yes this available”", "Aug 5, 2026"],
  [
    "New Withdrawal Request",
    "Khan has submitted a withdrawal request of $155.00 via Bank Card.",
    "Aug 4, 2026",
  ],
  ["Seller Replied", "Khan replied: “Yes”", "Aug 4, 2026"],
  [
    "Order Shipped — Pending Receipt",
    "Order TT5768241121650 (HEADPHONES) has been shipped by the seller.",
    "Aug 3, 2026",
  ],
];

const stats = [
  ["♧", "3", "Total Sellers", "mint"],
  ["◷", "0", "Pending Applications", "amber"],
  ["⊙", "3", "Approved Sellers", "mint"],
  ["⊗", "0", "Rejected Sellers", "red"],
  ["▤", "7", "Total Orders", "blue"],
  ["↗", "$340.10", "Total Revenue", "indigo"],
  ["$", "$0.00", "Total Commission", "violet"],
  ["▣", "$0.00", "Wallet Balance", "pink"],
];

export default function AgentPortal({ onLogout }) {
  const [active, setActive] = useState("Dashboard");
  const [copied, setCopied] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [agentProfile, setAgentProfile] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changeFormOpen, setChangeFormOpen] = useState(false);
  const [profileRequest, setProfileRequest] = useState({ display_name: "", company_name: "", phone: "" });
  const [requestNotice, setRequestNotice] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [inviteCode, setPortalInviteCode] = useState("");
  const [inviteCodeEnabled, setInviteCodeEnabled] = useState(true);
  const inviteLink = inviteCodeEnabled && inviteCode
    ? `${window.location.origin}/seller/register?code=${inviteCode}`
    : "Invitation code disabled";

  useEffect(() => {
    let mounted = true;
    const loadAgentProfile = async () => {
      const { data } = await agentSupabase.auth.getUser();
      if (!mounted) return;
      if (data?.user) {
        const { data: profile } = await agentSupabase.from("profiles")
          .select("id,display_name,email,phone,company_name,avatar_url,invitation_code,invitation_code_enabled")
          .eq("id", data.user.id).maybeSingle();
        if (mounted) {
          const resolvedProfile = profile || { id: data.user.id, display_name: data.user.user_metadata?.display_name || data.user.email?.split("@")[0], email: data.user.email };
          setAgentProfile(resolvedProfile);
          setProfileRequest({ display_name: resolvedProfile.display_name || "", company_name: resolvedProfile.company_name || "", phone: resolvedProfile.phone || "" });
          setAgentAvatar(profile?.avatar_url || data.user.user_metadata?.avatar_url || "");
          setPortalInviteCode(profile?.invitation_code || "");
          setInviteCodeEnabled(profile?.invitation_code_enabled !== false);
        }
      }
    };
    loadAgentProfile();
    window.addEventListener("agent-avatar-changed", loadAgentProfile);
    return () => {
      mounted = false;
      window.removeEventListener("agent-avatar-changed", loadAgentProfile);
    };
  }, []);

  const agentName = agentProfile?.display_name || agentProfile?.email?.split("@")[0] || "Agent";
  const agentInitial = agentName.trim().charAt(0).toUpperCase() || "A";

  const uploadAgentAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const avatarUrl = await resizeImageToDataUrl(file, 240);
      const { data } = await agentSupabase.auth.getUser();
      if (!data?.user) throw new Error("Your session has expired. Please sign in again.");
      const { error: profileError } = await agentSupabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", data.user.id);
      if (profileError) throw profileError;
      const { error: authError } = await agentSupabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (authError) throw authError;
      setAgentAvatar(avatarUrl);
      setAgentProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current);
      window.dispatchEvent(new CustomEvent("agent-avatar-changed"));
    } catch (error) {
      setAvatarError(error.message || "Could not update your profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitProfileRequest = async (event) => {
    event.preventDefault();
    setRequestBusy(true);
    setRequestNotice("");
    try {
      const { data } = await agentSupabase.auth.getUser();
      if (!data?.user) throw new Error("Your session has expired. Please sign in again.");
      const payload = {
        agent_id: data.user.id,
        requested_display_name: profileRequest.display_name.trim(),
        requested_company_name: profileRequest.company_name.trim() || null,
        requested_phone: profileRequest.phone.trim() || null,
        status: "pending",
      };
      if (!payload.requested_display_name) throw new Error("Name is required.");
      const { error } = await agentSupabase.from("agent_profile_change_requests").insert(payload);
      if (error) throw error;
      setRequestNotice("Your request was sent to the admin for approval.");
      setChangeFormOpen(false);
    } catch (error) {
      setRequestNotice(error.message || "Could not send the request.");
    } finally {
      setRequestBusy(false);
    }
  };

  const copy = async (text, label) => {
    await navigator.clipboard?.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1400);
  };

  return (
    <main className="agent-portal">
      <aside className="agent-sidebar">
        <header>
          <h1>Agent Portal</h1>
        </header>
        <div className="agent-id-card">
          <span>
            AGENT ID <b>AGT000004</b>
          </span>
          <span>INVITATION CODE</span>
          <strong>{inviteCodeEnabled ? (inviteCode || "Not assigned") : "Disabled"}</strong>
          <button
            type="button"
            aria-label="Copy invitation code"
            disabled={!inviteCodeEnabled || !inviteCode}
            onClick={() => copy(inviteCode, "sidebar")}
          >
            ▢
          </button>
          {copied === "sidebar" && <small>Copied</small>}
        </div>
        <nav>
          {groups.map((group, groupIndex) => (
            <section key={`${group.label}-${groupIndex}`}>
              {group.label && <h2>{group.label}</h2>}
              {group.items.map(([label, icon]) => (
                <button
                  key={label}
                  type="button"
                  className={active === label ? "active" : ""}
                  onClick={() => setActive(label)}
                >
                  <i>{icon}</i>
                  <span>{label}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
        <button className="agent-signout" type="button" onClick={onLogout}>
          <i>↪</i> Sign Out
        </button>
      </aside>

      <section className="agent-workspace">
        <header className="agent-topbar">
          <span>Agent Control Panel</span>
          <div className="agent-topbar-profile">
            <button className="agent-topbar-profile-button" type="button" title="View profile" aria-label="View profile" onClick={() => setProfileOpen(true)}>
            {agentAvatar ? (
              <img className="agent-topbar-avatar" src={agentAvatar} alt="" />
            ) : (
              <b>{agentInitial}</b>
            )}
            <span>{avatarBusy ? "Uploading…" : agentName}</span>
            </button>
            {avatarError && <small className="agent-topbar-profile-error">{avatarError}</small>}
          </div>
        </header>
        {active === "Dashboard" ? (
          <AgentDashboard
            inviteCode={inviteCodeEnabled ? inviteCode : ""}
            inviteLink={inviteLink}
            inviteCodeEnabled={inviteCodeEnabled}
            copy={copy}
            copied={copied}
            agentName={agentName}
          />
        ) : active === "Agents" ? (
          <AgentTeam agentProfile={agentProfile} inviteCode={inviteCode} />
        ) : active === "Unregistered" ? (
          <AgentUnregistered />
        ) : active === "Applications" ? (
          <AgentApplications />
        ) : active === "Merchant List" ? (
          <AgentMerchantList />
        ) : active === "Showcases" ? (
          <AgentShowcase />
        ) : active === "Bound Addresses" ? (
          <AgentBoundAddresses />
        ) : active === "Credit Logs" ? (
          <AgentCreditLogs />
        ) : active === "Balance Locks" ? (
          <AgentBalanceLocks />
        ) : active === "Order Management" ? (
          <AgentOrderManagement />
        ) : active === "Order List" ? (
          <AgentOrderList />
        ) : active === "Batch Ship" ? (
          <AgentBatchShip />
        ) : active === "Batch Receive" ? (
          <AgentBatchReceive />
        ) : active === "Auto Order" ? (
          <AgentAutoOrder />
        ) : active === "Order Records" ? (
          <AgentOrderRecords />
        ) : active === "General Config" ? (
          <AgentGeneralConfig />
        ) : active === "Messages" ? (
          <AgentMessages />
        ) : active === "Announcements" ? (
          <AgentAnnouncements />
        ) : active === "Recharge Orders" ? (
          <AgentRechargeOrders />
        ) : active === "Withdraw Orders" ? (
          <AgentWithdrawOrders />
        ) : active === "Chat" ? (
          <AgentSellerChat />
        ) : active === "Virtual Buyer – Shop" ? (
          <AgentVirtualBuyers />
        ) : active === "Buyer Messages" ? (
          <AgentBuyerMessages />
        ) : active === "Shop – System" ? (
          <AgentShopSystem />
        ) : active === "Earnings" ? (
          <AgentEarnings />
        ) : active === "Feedbacks" ? (
          <AgentFeedbacks />
        ) : active === "Audit Logs" ? (
          <AgentAuditLogs />
        ) : active === "My Account" ? (
          <AgentMyAccount agentProfile={agentProfile} />
        ) : (
          <section className="agent-coming-soon">
            <div>◇</div>
            <h2>{active}</h2>
            <p>
              This section is ready for the design and features you send next.
            </p>
            <button type="button" onClick={() => setActive("Dashboard")}>
              Back to Dashboard
            </button>
          </section>
        )}
      </section>
      {profileOpen && (
        <div className="agent-profile-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}>
          <section className="agent-profile-modal" role="dialog" aria-modal="true" aria-labelledby="agent-profile-title">
            <header><div><h2 id="agent-profile-title">My Profile</h2><p>Your current approved information</p></div><button type="button" onClick={() => setProfileOpen(false)}>×</button></header>
            <div className="agent-profile-photo-block">
              {agentAvatar ? <img src={agentAvatar} alt="Agent profile" /> : <b>{agentInitial}</b>}
              <button type="button" disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>{avatarBusy ? "Uploading…" : "Change photo"}</button>
              <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={uploadAgentAvatar} />
            </div>
            {avatarError && <p className="agent-profile-modal-notice error">{avatarError}</p>}
            <dl className="agent-profile-info">
              <div><dt>Name</dt><dd>{agentName}</dd></div>
              <div><dt>Email</dt><dd>{agentProfile?.email || "—"}</dd></div>
              <div><dt>Company</dt><dd>{agentProfile?.company_name || "—"}</dd></div>
              <div><dt>Phone</dt><dd>{agentProfile?.phone || "—"}</dd></div>
              <div><dt>Agent ID</dt><dd>{agentProfile?.id ? `AGT${agentProfile.id.slice(0, 8).toUpperCase()}` : "—"}</dd></div>
            </dl>
            {requestNotice && <p className="agent-profile-modal-notice">{requestNotice}</p>}
            {!changeFormOpen ? <button className="agent-profile-request-button" type="button" onClick={() => setChangeFormOpen(true)}>Request profile information change</button> : (
              <form className="agent-profile-request-form" onSubmit={submitProfileRequest}>
                <label>Full name<input required value={profileRequest.display_name} onChange={(e) => setProfileRequest({ ...profileRequest, display_name: e.target.value })} /></label>
                <label>Company<input value={profileRequest.company_name} onChange={(e) => setProfileRequest({ ...profileRequest, company_name: e.target.value })} /></label>
                <label>Phone<input value={profileRequest.phone} onChange={(e) => setProfileRequest({ ...profileRequest, phone: e.target.value })} /></label>
                <div><button type="button" onClick={() => setChangeFormOpen(false)}>Cancel</button><button type="submit" disabled={requestBusy}>{requestBusy ? "Sending…" : "Send request"}</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

const demoOrderRecords = [];

const defaultAgentConfig = {
  displayName: "Demo Agent",
  company: "Demo Company",
  phone: "+1 ••• ••• 0100",
  emailNotifications: true,
  newOrderAlerts: true,
  timezone: "UTC",
  currency: "USD",
};

function AgentMessages() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: auth } = await agentSupabase.auth.getUser();
      if (!auth?.user) return;
      const { data, error } = await agentSupabase
        .from("messages")
        .select("*")
        .eq("channel", "agent")
        .or(`sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`)
        .order("created_at");
      if (error) console.log("AGENT-ADMIN MESSAGES LOAD ERROR:", error);
      if (mounted)
        setMessages(
          (data || []).map((item) => ({
            id: item.id,
            mine: item.sender_id === auth.user.id,
            text: item.body,
            image: item.image_url,
            date: new Date(item.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          })),
        );
    };
    load();
    const channel = agentSupabase
      .channel("agent-admin-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        load,
      )
      .subscribe();
    return () => {
      mounted = false;
      agentSupabase.removeChannel(channel);
    };
  }, []);

  const send = async (event) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setSendError("");
    const text = message.trim();
    const fallback = {
      id: Date.now(),
      mine: true,
      text,
      date: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    const { data: auth } = await agentSupabase.auth.getUser();
    const { data: admins } = await agentSupabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (!auth?.user || !admins?.[0]) {
      setSendError("Could not find the administrator account. Please refresh and try again.");
      setSending(false);
      return;
    }
    const response = await agentSupabase
        .from("messages")
        .insert({
          sender_id: auth.user.id,
          recipient_id: admins[0].id,
          channel: "agent",
          body: text,
        })
        .select()
        .single();
    if (response.error) {
      setSendError(`Message was not sent: ${response.error.message}`);
      setSending(false);
      return;
    }
    setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, { ...fallback, id: response.data.id }]);
    setMessage("");
    setSending(false);
  };
  return (
    <div className="agent-messages-page">
      <header>
        <h2>Messages</h2>
        <p>Private conversation with the Super Admin.</p>
      </header>
      <section className="agent-messages-panel">
        <div className="agent-message-stream">
          {messages.map((item) => (
            <article key={item.id} className={item.mine ? "mine" : "admin"}>
              <strong>{item.mine ? "Demo Agent" : "Super Admin"}</strong>
              {item.image ? (
                <img src={item.image} alt={item.text} />
              ) : (
                <p>{item.text}</p>
              )}
              <time>{item.date}</time>
            </article>
          ))}
          {!messages.length && (
            <div className="agent-messages-empty">
              No messages yet. Send a message to start the conversation.
            </div>
          )}
        </div>
        {sendError && <p className="agent-message-error" role="alert">{sendError}</p>}
        <form onSubmit={send} className="agent-messages-form">
          <div className="agent-messages-input-row">
            <textarea
              className="agent-msg-textarea"
              aria-label="Message"
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              value={message}
              rows={1}
              onChange={(event) => {
                setMessage(event.target.value);
                // auto-grow
                const el = event.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 160) + "px";
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(event);
                }
              }}
            />
            <button
              type="submit"
              className="agent-msg-send-btn"
              disabled={!message.trim() || sending}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AgentAnnouncements() {
  const fallback = [
    {
      id: "demo-announcement",
      title: "Welcome to the agent portal",
      message: "Admin announcements will appear here automatically.",
      created_at: "2026-08-23T12:00:00Z",
    },
  ];
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const { data, error } = await agentSupabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setAnnouncements(data || []);
    else setAnnouncements(fallback);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const channel = agentSupabase
      .channel("agent-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        refresh,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);
  return (
    <div className="agent-announcements-page">
      <header>
        <div>
          <h2>Announcements</h2>
          <p>Notices and messages from the Super Admin.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh announcements"
        >
          {loading ? "…" : "↻"}
        </button>
      </header>
      <section>
        {announcements.map((item) => (
          <article key={item.id}>
            <span>⚑</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <time>
                From Admin ·{" "}
                {new Date(item.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </article>
        ))}
        {!loading && !announcements.length && (
          <div className="agent-announcements-empty">No announcements yet.</div>
        )}
      </section>
    </div>
  );
}

function AgentRechargeOrders() {
  const [tab, setTab] = useState("requests");
  const [orders, setOrders] = useState([]);
  const [methods, setMethods] = useState([]);
  const [search, setSearch] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("All merchants");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [showMethod, setShowMethod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState({
    name: "",
    type: "Bank Transfer",
    bank: "",
    accountName: "",
    accountNumber: "",
    routing: "",
    order: 0,
  });

  const load = async () => {
    const { data } = await agentSupabase
      .from("recharge_requests")
      .select(
        "*,seller:profiles!recharge_requests_seller_id_fkey(display_name,email)",
      )
      .order("created_at", { ascending: false });
    setOrders(
      (data || []).map((row) => ({
        id: row.id,
        merchant: row.seller?.display_name || row.seller?.email || "Seller",
        sellerId: row.seller_id,
        amount: Number(row.amount),
        status: row.status,
        date: new Date(row.created_at).toLocaleString(),
      })),
    );
  };

  useEffect(() => {
    load();
    try {
      setMethods(
        JSON.parse(localStorage.getItem("agent_demo_payment_methods") || "[]"),
      );
    } catch {
      /* ignore */
    }
    const channel = agentSupabase
      .channel("agent-recharge-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recharge_requests" },
        load,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);

  const saveMethods = (next) => {
    setMethods(next);
    localStorage.setItem("agent_demo_payment_methods", JSON.stringify(next));
  };
  const createMethod = (event) => {
    event.preventDefault();
    saveMethods([...methods, { id: Date.now(), ...method }]);
    setShowMethod(false);
    setMethod({
      name: "",
      type: "Bank Transfer",
      bank: "",
      accountName: "",
      accountNumber: "",
      routing: "",
      order: 0,
    });
  };

  const approveRequest = async (order) => {
    setBusy(true);
    const { error: updateError } = await agentSupabase
      .from("recharge_requests")
      .update({ status: "Approved", reviewed_at: new Date().toISOString() })
      .eq("id", order.id);
    if (!updateError) {
      await agentSupabase.from("wallet_transactions").insert({
        seller_id: order.sellerId,
        type: "Agent Credit",
        amount: order.amount,
        note: `Recharge request #${order.id} approved`,
      });
    }
    setBusy(false);
    await load();
  };
  const rejectRequest = async (order) => {
    setBusy(true);
    await agentSupabase
      .from("recharge_requests")
      .update({ status: "Rejected", reviewed_at: new Date().toISOString() })
      .eq("id", order.id);
    setBusy(false);
    await load();
  };

  const visible = orders.filter(
    (item) =>
      (merchantFilter === "All merchants" ||
        item.merchant === merchantFilter) &&
      (statusFilter === "All statuses" || item.status === statusFilter) &&
      String(item.merchant || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const merchantNames = [...new Set(orders.map((item) => item.merchant))];

  return (
    <div className="agent-recharge-page">
      <header>
        <h2>Recharge Orders</h2>
        <p>Review and approve merchant recharge requests.</p>
      </header>
      <nav className="agent-recharge-tabs">
        <button
          type="button"
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          Recharge Requests
        </button>
        <button
          type="button"
          className={tab === "methods" ? "active" : ""}
          onClick={() => setTab("methods")}
        >
          ⚙ Payment Methods
        </button>
      </nav>
      {tab === "requests" ? (
        <>
          <div className="agent-recharge-tools">
            <label>
              <span>⌕</span>
              <input
                placeholder="Search merchant"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              value={merchantFilter}
              onChange={(event) => setMerchantFilter(event.target.value)}
            >
              <option>All merchants</option>
              {merchantNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option>All statuses</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
          <section className="agent-recharge-list">
            {visible.map((item) => (
              <article key={item.id}>
                <code>#{item.id}</code>
                <strong>{item.merchant}</strong>
                <span>${item.amount.toFixed(2)}</span>
                <em>{item.status}</em>
                <time>{item.date}</time>
                {item.status === "Pending" && (
                  <span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approveRequest(item)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rejectRequest(item)}
                    >
                      × Reject
                    </button>
                  </span>
                )}
              </article>
            ))}
            {!visible.length && <p>No recharge requests found.</p>}
          </section>
        </>
      ) : (
        <section className="agent-payment-methods">
          <header>
            <div>
              <h3>Configured Payment Channels</h3>
              <p>
                Sellers will see these methods and their demo account details
                when requesting a recharge.
              </p>
            </div>
            <button type="button" onClick={() => setShowMethod(true)}>
              ＋ Add Method
            </button>
          </header>
          {methods.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.type}</span>
              </div>
              <p>
                {item.bank || "Demo payment channel"} · Account details hidden
              </p>
              <button
                type="button"
                onClick={() =>
                  saveMethods(methods.filter((entry) => entry.id !== item.id))
                }
              >
                Remove
              </button>
            </article>
          ))}
          {!methods.length && (
            <div className="agent-method-empty">
              No payment methods configured yet.
              <small>
                Add at least one demo method to preview the seller experience.
              </small>
            </div>
          )}
        </section>
      )}
      {showMethod && (
        <div
          className="agent-recharge-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setShowMethod(false)
          }
        >
          <form className="agent-method-modal" onSubmit={createMethod}>
            <h3>New Payment Method</h3>
            <div className="agent-method-fields">
              <label>
                Method Name *
                <input
                  required
                  placeholder="e.g. Bank Transfer — Demo"
                  value={method.name}
                  onChange={(event) =>
                    setMethod({ ...method, name: event.target.value })
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={method.type}
                  onChange={(event) =>
                    setMethod({ ...method, type: event.target.value })
                  }
                >
                  <option>Bank Transfer</option>
                  <option>Crypto</option>
                  <option>Other</option>
                </select>
              </label>
              <h4>Account Details</h4>
              <label className="wide">
                Bank Name
                <input
                  placeholder="e.g. Demo Bank"
                  value={method.bank}
                  onChange={(event) =>
                    setMethod({ ...method, bank: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                Account Name
                <input
                  placeholder="e.g. Demo Account"
                  value={method.accountName}
                  onChange={(event) =>
                    setMethod({ ...method, accountName: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                Account Number
                <input
                  placeholder="Hidden in this public demo"
                  value={method.accountNumber}
                  onChange={(event) =>
                    setMethod({ ...method, accountNumber: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                Routing / SWIFT
                <input
                  placeholder="Demo routing code"
                  value={method.routing}
                  onChange={(event) =>
                    setMethod({ ...method, routing: event.target.value })
                  }
                />
              </label>
              <label>
                Display Order
                <input
                  type="number"
                  min="0"
                  value={method.order}
                  onChange={(event) =>
                    setMethod({ ...method, order: event.target.value })
                  }
                />
                <small>Lower = shown first to sellers</small>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setShowMethod(false)}>
                Cancel
              </button>
              <button type="submit">Save Method</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function AgentWithdrawOrders() {
  const [filter, setFilter] = useState("All");
  const [withdrawals, setWithdrawals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data } = await agentSupabase
      .from("withdrawals")
      .select(
        "*,seller:profiles!withdrawals_seller_id_profiles_fkey(display_name,email)",
      )
      .order("created_at", { ascending: false });
    setWithdrawals(
      (data || []).map((row) => ({
        id: row.id,
        seller: row.seller?.display_name || row.seller?.email || "Seller",
        sellerId: row.seller_id,
        amount: Number(row.amount),
        method: row.method,
        account: row.account_details,
        status: row.status,
        note: row.rejection_reason || "—",
        requested: new Date(row.created_at).toLocaleString(),
      })),
    );
  };

  useEffect(() => {
    load();
    const channel = agentSupabase
      .channel("agent-live-withdrawals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals" },
        load,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);

  const approve = async (item) => {
    setBusy(true);
    const { error } = await agentSupabase
      .from("withdrawals")
      .update({ status: "Approved", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (!error) {
      await agentSupabase.from("wallet_transactions").insert({
        seller_id: item.sellerId,
        type: "Agent Debit",
        amount: -Math.abs(item.amount),
        note: `Withdrawal #${item.id} approved`,
      });
    }
    setBusy(false);
    await load();
  };
  const submitReject = async (event) => {
    event.preventDefault();
    setBusy(true);
    await agentSupabase
      .from("withdrawals")
      .update({
        status: "Rejected",
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rejecting.id);
    setBusy(false);
    setRejecting(null);
    setReason("");
    await load();
  };

  const visible =
    filter === "All"
      ? withdrawals
      : withdrawals.filter((item) => item.status === filter);
  const pendingTotal = withdrawals
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="agent-withdraw-orders-page">
      <header>
        <h2>Finance — Withdrawals</h2>
        <p>
          Withdrawal requests from your sellers. Pending total: $
          {pendingTotal.toFixed(2)}
        </p>
      </header>
      <nav>
        {["All", "Pending", "Approved", "Rejected"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <section className="agent-withdraw-table">
        <div className="agent-withdraw-head">
          <span>SELLER</span>
          <span>AMOUNT</span>
          <span>METHOD</span>
          <span>ACCOUNT</span>
          <span>STATUS</span>
          <span>NOTE</span>
          <span>REQUESTED</span>
          <span>ACTIONS</span>
        </div>
        {visible.map((item) => (
          <article key={item.id}>
            <span className="agent-withdraw-seller">
              <b>{item.seller[0]}</b>
              <strong>{item.seller}</strong>
            </span>
            <strong>${item.amount.toFixed(2)}</strong>
            <span>{item.method}</span>
            <code>{item.account}</code>
            <span>
              <em className={item.status.toLowerCase()}>{item.status}</em>
            </span>
            <span title={item.note}>{item.note}</span>
            <time>{item.requested}</time>
            {item.status === "Pending" ? (
              <span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => approve(item)}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejecting(item)}
                >
                  × Reject
                </button>
              </span>
            ) : (
              <small>{item.status}</small>
            )}
          </article>
        ))}
        {!visible.length && (
          <div className="agent-withdraw-empty">
            No {filter.toLowerCase()} withdrawal requests.
          </div>
        )}
      </section>
      {rejecting && (
        <div
          className="agent-recharge-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setRejecting(null)
          }
        >
          <form className="agent-recharge-modal" onSubmit={submitReject}>
            <h3>Reject Withdrawal</h3>
            <label>
              Reason
              <textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this withdrawal being rejected?"
              />
            </label>
            <footer>
              <button type="button" onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button type="submit" disabled={busy}>
                Confirm Reject
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function AgentSellerChat() {
  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState("");
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [thread, setThread] = useState(null);
  const [threadReply, setThreadReply] = useState("");

  const loadSellers = async () => {
    const { data } = await agentSupabase
      .from("profiles")
      .select("id,display_name,email")
      .eq("role", "seller")
      .order("display_name");
    setSellers(
      (data || []).map((item) => ({
        id: item.id,
        name: item.display_name || item.email.split("@")[0],
      })),
    );
  };

  const loadHistory = async () => {
    const { data: auth } = await agentSupabase.auth.getUser();
    if (!auth?.user) return;
    const { data, error } = await agentSupabase
      .from("messages")
      .select("*,product:products(id,name,product_code,sell_price,image_url)")
      .eq("channel", "agent")
      .order("created_at", { ascending: false });
    if (error) console.log("AGENT HISTORY LOAD ERROR:", error);
    const partnerIds = [...new Set((data || []).map((item) => item.sender_id === auth.user.id ? item.recipient_id : item.sender_id).filter(Boolean))];
    const { data: partnerProfiles } = partnerIds.length
      ? await agentSupabase.from("profiles").select("id,display_name,email,role").in("id", partnerIds)
      : { data: [] };
    const profileById = new Map((partnerProfiles || []).map((profile) => [profile.id, profile]));
    setHistory(
      (data || []).map((item) => {
        const partnerId = item.sender_id === auth.user.id ? item.recipient_id : item.sender_id;
        const partner = profileById.get(partnerId);
        return {
          id: item.id,
          sellerId: partnerId,
          partnerName: partner?.role === "admin" ? "Super Admin" : partner?.display_name || partner?.email || "Seller",
          partnerRole: partner?.role || "seller",
          mine: item.sender_id === auth.user.id,
          text: item.body,
          product: item.product,
          productId: item.product?.id || item.product_id || null,
          date: new Date(item.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        };
      }),
    );
  };

  useEffect(() => {
    loadSellers();
    loadHistory();
    const channel = agentSupabase
      .channel("agent-seller-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        loadHistory,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (!sellerId) {
      setSellerProducts([]);
      setProductId("");
      return;
    }
    agentSupabase
      .from("showcase_products")
      .select("on_shelf,products(id,name,product_code,sell_price,image_url)")
      .eq("seller_id", sellerId)
      .then(({ data }) => {
        setSellerProducts(
          (data || [])
            .filter((row) => row.on_shelf && row.products)
            .map((row) => row.products),
        );
        setProductId("");
      });
  }, [sellerId]);

  const sellerName = (id) =>
    sellers.find((item) => item.id === id)?.name || "Seller";

  const send = async (event) => {
    event.preventDefault();
    if (!sellerId || !message.trim()) return;
    const { data: auth } = await agentSupabase.auth.getUser();
    if (!auth?.user) return;
    const { error } = await agentSupabase.from("messages").insert({
      sender_id: auth.user.id,
      recipient_id: sellerId,
      channel: "agent",
      body: message.trim(),
      product_id: productId || null,
    });
    if (error) {
      console.log("AGENT CHAT SEND ERROR:", error);
      return;
    }
    setMessage("");
    setProductId("");
  };

  const sendThreadReply = async (event) => {
    event.preventDefault();
    if (!thread?.sellerId || !threadReply.trim()) return;
    const { data: auth } = await agentSupabase.auth.getUser();
    if (!auth?.user) return;
    const { error } = await agentSupabase.from("messages").insert({
      sender_id: auth.user.id,
      recipient_id: thread.sellerId,
      channel: "agent",
      body: threadReply.trim(),
      product_id: thread.productId || null,
    });
    if (error) return console.log("AGENT CHAT REPLY ERROR:", error);
    setThreadReply("");
    await loadHistory();
  };

  return (
    <div className="agent-seller-chat-page">
      <header>
        <h2>Chat</h2>
        <p>Send messages to your sellers and reply to conversations.</p>
      </header>
      <form className="agent-chat-new" onSubmit={send}>
        {/* ── Row 1: Merchant + Product ── */}
        <div className="agent-chat-new-selects">
          <small>New Message</small>
          <select
            required
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
          >
            <option value="">Select seller...</option>
            {sellers.map((seller) => (
              <option value={seller.id} key={seller.id}>
                {seller.name}
              </option>
            ))}
          </select>
          {sellerId && (
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">No specific product</option>
              {sellerProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name || product.product_code} · $
                  {Number(product.sell_price || 0).toFixed(2)}
                </option>
              ))}
            </select>
          )}
          {sellerId && !sellerProducts.length && (
            <small className="agent-chat-no-products">
              This seller has no on-shelf products.
            </small>
          )}
        </div>

        {/* ── Divider ── */}
        <hr />

        {/* ── Row 2: Message + Send ── */}
        <div className="agent-chat-new-message">
          <textarea
            className="agent-chat-message-input"
            placeholder="Write your message… (Enter to send, Shift+Enter for new line)"
            value={message}
            rows={3}
            onChange={(event) => {
              setMessage(event.target.value);
              const el = event.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 180) + "px";
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (sellerId && message.trim()) send(event);
              }
            }}
          />
          <button type="submit" disabled={!sellerId || !message.trim()}>
            ➤ Send
          </button>
        </div>
      </form>
      <div className="agent-chat-history-title">
        <span>Message History</span>
        <button type="button" onClick={loadHistory}>
          ↻
        </button>
      </div>
      <section className="agent-chat-history">
        {history.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.mine
                  ? `To: ${item.partnerName}`
                  : `From: ${item.partnerName}`}
              </strong>
              {item.product && (
                <span className="agent-chat-product-tag">
                  {item.product.image_url && (
                    <img src={item.product.image_url} alt="" />
                  )}
                  {item.product.name || item.product.product_code} · $
                  {Number(item.product.sell_price || 0).toFixed(2)}
                </span>
              )}
              <p>{item.text}</p>
            </div>
            <aside>
              <time>{item.date}</time>
              <button
                type="button"
                onClick={() =>
                  setThread({
                    sellerId: item.sellerId,
                    partnerName: item.partnerName,
                    partnerRole: item.partnerRole,
                    productId: item.productId,
                    product: item.product,
                  })
                }
              >
                ▢ View Thread
              </button>
            </aside>
          </article>
        ))}
        {!history.length && (
          <div className="agent-chat-empty">No message history yet.</div>
        )}
      </section>
      {thread && (
        <div
          className="agent-chat-thread-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setThread(null)
          }
        >
          <section>
            <header>
              <div>
                <h3>{thread.partnerName || sellerName(thread.sellerId)}</h3>
                <p>
                  {thread.product
                    ? `${thread.product.name || thread.product.product_code} · $${Number(thread.product.sell_price || 0).toFixed(2)}`
                    : "General conversation · No specific product"}
                </p>
              </div>
              <button type="button" onClick={() => setThread(null)}>
                ×
              </button>
            </header>
            <div>
              {history
                .filter(
                  (item) =>
                    item.sellerId === thread.sellerId &&
                    String(item.productId || "general") ===
                      String(thread.productId || "general"),
                )
                .slice()
                .reverse()
                .map((item) => (
                  <article
                    key={item.id}
                    className={item.mine ? "mine" : item.partnerRole === "admin" ? "admin" : "seller"}
                  >
                    {item.product && (
                      <span className="agent-chat-product-tag">
                        {item.product.name || item.product.product_code} · $
                        {Number(item.product.sell_price || 0).toFixed(2)}
                      </span>
                    )}
                    <p>{item.text}</p>
                    <time>{item.date}</time>
                  </article>
                ))}
            </div>
            <form
              className="agent-chat-thread-reply"
              onSubmit={sendThreadReply}
            >
              <input
                autoFocus
                placeholder="Write a reply..."
                value={threadReply}
                onChange={(event) => setThreadReply(event.target.value)}
              />
              <button type="submit" disabled={!threadReply.trim()}>
                Send
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

const emptyBuyer = {
  name: "",
  phone: "",
  email: "",
  country: "",
  state: "",
  city: "",
  postal: "",
  address: "",
  notes: "",
  image: "",
};
const safeDemoBuyers = [
  {
    id: 1,
    name: "Demo Buyer One",
    phone: "+1 ••• ••• 0101",
    email: "bu•••@example.com",
    country: "United States",
    state: "California",
    city: "Demo City",
    postal: "•••••",
    address: "Demo shipping address",
    notes: "Sample profile",
    added: "Aug 8, 2026",
  },
  {
    id: 2,
    name: "Demo Buyer Two",
    phone: "+44 •••• ••• 202",
    email: "bu•••@example.com",
    country: "United Kingdom",
    state: "Greater London",
    city: "London",
    postal: "••••••",
    address: "Demo shipping address",
    notes: "Sample profile",
    added: "Jul 28, 2026",
  },
  {
    id: 3,
    name: "Demo Buyer Three",
    phone: "+65 •••• 0303",
    email: "bu•••@example.com",
    country: "Singapore",
    state: "Central",
    city: "Singapore",
    postal: "••••••",
    address: "Demo shipping address",
    notes: "Sample profile",
    added: "Jul 26, 2026",
  },
];

function AgentVirtualBuyers() {
  const [buyers, setBuyers] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBuyer);
  const [buyerError, setBuyerError] = useState("");
  const [savingBuyer, setSavingBuyer] = useState(false);
  const [imageEditor, setImageEditor] = useState(null);
  const dragRef = useRef(null);
  const mapBuyer = (item) => ({
    id: item.id,
    name: item.name,
    phone: item.phone || "",
    email: item.email || "",
    country: item.country || "",
    state: item.state || "",
    city: item.city || "",
    postal: item.postal || "",
    address: item.address || "",
    notes: item.notes || "",
    image: item.image_url || "",
    added: new Date(item.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  });
  const loadBuyers = async () => {
    let { data, error } = await agentSupabase
      .from("virtual_buyers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return setBuyerError(`Could not load buyers: ${error.message}`);
    if (!data?.length) {
      let legacyBuyers = [];
      try {
        legacyBuyers = JSON.parse(
          localStorage.getItem("agent_virtual_buyers") || "[]",
        );
      } catch {
        legacyBuyers = [];
      }
      if (legacyBuyers.length) {
        const { data: auth } = await agentSupabase.auth.getUser();
        const { error: importError } = await agentSupabase
          .from("virtual_buyers")
          .insert(
            legacyBuyers.map((buyer) => ({
              agent_id: auth.user?.id,
              name: buyer.name,
              phone: buyer.phone || null,
              email: buyer.email || null,
              country: buyer.country || null,
              state: buyer.state || null,
              city: buyer.city || null,
              postal: buyer.postal || null,
              address: buyer.address || null,
              notes: buyer.notes || null,
              image_url: buyer.image || buyer.buyer_image || null,
            })),
          );
        if (!importError) {
          ({ data, error } = await agentSupabase
            .from("virtual_buyers")
            .select("*")
            .order("created_at", { ascending: false }));
          if (!error) localStorage.removeItem("agent_virtual_buyers");
        }
      }
    }
    setBuyerError("");
    setBuyers((data || []).map(mapBuyer));
  };
  useEffect(() => {
    loadBuyers();
    const channel = agentSupabase
      .channel("agent-virtual-buyers-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "virtual_buyers" },
        loadBuyers,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);
  const visible = buyers.filter((item) =>
    [item.name, item.email, item.phone].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const openAdd = () => {
    setForm(emptyBuyer);
    setEditing("new");
  };
  const openEdit = (item) => {
    setForm(item);
    setEditing(item.id);
  };
  const save = async (event) => {
    event.preventDefault();
    setSavingBuyer(true);
    setBuyerError("");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      country: form.country.trim() || null,
      state: form.state.trim() || null,
      city: form.city.trim() || null,
      postal: form.postal.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      image_url: form.image || null,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editing === "new") {
      const { data: auth } = await agentSupabase.auth.getUser();
      ({ error } = await agentSupabase
        .from("virtual_buyers")
        .insert({ ...payload, agent_id: auth.user?.id }));
    } else {
      ({ error } = await agentSupabase
        .from("virtual_buyers")
        .update(payload)
        .eq("id", editing));
    }
    setSavingBuyer(false);
    if (error) return setBuyerError(`Could not save buyer: ${error.message}`);
    await loadBuyers();
    window.dispatchEvent(new CustomEvent("agent-virtual-buyers-changed"));
    setEditing(null);
  };
  const deleteBuyer = async (id) => {
    const { error } = await agentSupabase
      .from("virtual_buyers")
      .delete()
      .eq("id", id);
    if (error) return setBuyerError(`Could not delete buyer: ${error.message}`);
    await loadBuyers();
    window.dispatchEvent(new CustomEvent("agent-virtual-buyers-changed"));
  };
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const prepareVirtualBuyerImage = (file) => {
    if (!file?.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      setImageEditor({ src: reader.result, x: 50, y: 50, zoom: 1 });
    reader.readAsDataURL(file);
  };
  const applyVirtualBuyerImage = () => {
    if (!imageEditor) return;
    const image = new Image();
    image.onload = () => {
      const size =
        Math.min(image.naturalWidth, image.naturalHeight) / imageEditor.zoom;
      const sx = (image.naturalWidth - size) * (imageEditor.x / 100);
      const sy = (image.naturalHeight - size) * (imageEditor.y / 100);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      canvas
        .getContext("2d")
        .drawImage(image, sx, sy, size, size, 0, 0, 320, 320);
      update("image", canvas.toDataURL("image/jpeg", 0.86));
      setImageEditor(null);
    };
    image.src = imageEditor.src;
  };
  const moveImage = (event) => {
    if (!dragRef.current || !imageEditor) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setImageEditor((current) => ({
      ...current,
      x: Math.max(0, Math.min(100, current.x - dx / 2)),
      y: Math.max(0, Math.min(100, current.y - dy / 2)),
    }));
  };
  const pasteVirtualBuyerImage = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      prepareVirtualBuyerImage(file);
    }
  };
  return (
    <div className="agent-buyers-page">
      <header>
        <div>
          <h2>Virtual Buyers</h2>
          <p>
            Create and manage buyer profiles used for seller orders and
            conversations.
          </p>
        </div>
        <button type="button" onClick={openAdd}>
          ＋ Add Buyer
        </button>
      </header>
      <label className="agent-buyers-search">
        <span>⌕</span>
        <input
          placeholder="Search by name, email or phone..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {buyerError && <p className="agent-buyers-error">{buyerError}</p>}
      <section className="agent-buyers-grid">
        {visible.map((item) => (
          <article key={item.id} className="buyer-card">
            <div className="buyer-card-body">
              {item.image ? (
                <img
                  className="agent-virtual-buyer-avatar"
                  src={item.image}
                  alt={item.name}
                />
              ) : (
                <span className="buyer-card-avatar">☺</span>
              )}
              <div className="buyer-card-info">
                <h3>{item.name}</h3>
                <p>
                  <i>☏</i>
                  {item.phone || "No phone"}
                </p>
                <p>
                  <i>✉</i>
                  {item.email || "No email"}
                </p>
                <p>
                  <i>⌖</i>
                  {[item.city, item.state, item.country]
                    .filter(Boolean)
                    .join(", ") || "No location"}
                </p>
                <p>
                  {item.address || "No shipping address"} {item.postal}
                </p>
                <p>
                  <i>▤</i>
                  {item.notes || "No notes"}
                </p>
                <small>Added {item.added}</small>
              </div>
            </div>
            <footer className="buyer-card-actions">
              <button
                type="button"
                className="buyer-card-edit"
                onClick={() => openEdit(item)}
              >
                ✎ Edit
              </button>
              <button
                type="button"
                className="buyer-card-delete"
                onClick={() => deleteBuyer(item.id)}
              >
                ♲ Delete
              </button>
            </footer>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-buyers-empty">No virtual buyers found.</div>
        )}
      </section>
      {editing && (
        <div
          className="agent-buyers-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setEditing(null)
          }
        >
          <form onSubmit={save}>
            <header>
              <h3>{editing === "new" ? "Add Virtual Buyer" : "Edit Buyer"}</h3>
              <button type="button" onClick={() => setEditing(null)}>
                ×
              </button>
            </header>
            <div className="agent-buyer-fields">
              <label className="wide">
                Buyer Name *
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <div
                className="wide buyer-image-editor"
                onPaste={pasteVirtualBuyerImage}
              >
                {form.image ? (
                  <img src={form.image} alt="Buyer profile" />
                ) : (
                  <span>Buyer photo</span>
                )}
                <div>
                  <input
                    type="url"
                    placeholder="Paste image URL"
                    value={form.image.startsWith("data:") ? "" : form.image}
                    onChange={(event) => update("image", event.target.value)}
                  />
                  <label>
                    Upload or paste image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        prepareVirtualBuyerImage(event.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </div>
              <label>
                Email
                <input
                  type="email"
                  placeholder="buyer@example.com"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>
              <label>
                Country
                <select
                  value={form.country}
                  onChange={(event) => {
                    const country = event.target.value;
                    const number = nationalPhone(form.phone, form.country);
                    const code = callingCodeFor(country);
                    setForm((current) => ({
                      ...current,
                      country,
                      phone: number ? `${code} ${number}` : "",
                    }));
                  }}
                >
                  <option value="">Select country</option>
                  {buyerCountries.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phone Number
                <div className="agent-phone-input">
                  <span>{callingCodeFor(form.country) || "—"}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    disabled={!form.country}
                    placeholder={
                      form.country ? "Phone number" : "Select country first"
                    }
                    value={nationalPhone(form.phone, form.country)}
                    onChange={(event) => {
                      const local = event.target.value.replace(
                        /[^\d\s()-]/g,
                        "",
                      );
                      const code = callingCodeFor(form.country);
                      update("phone", local.trim() ? `${code} ${local}` : "");
                    }}
                  />
                </div>
              </label>
              <label>
                Province / State
                <input
                  placeholder="e.g. California"
                  value={form.state}
                  onChange={(event) => update("state", event.target.value)}
                />
              </label>
              <label>
                City
                <input
                  placeholder="e.g. Los Angeles"
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </label>
              <label>
                Postal Code
                <input
                  placeholder="e.g. 90001"
                  value={form.postal}
                  onChange={(event) => update("postal", event.target.value)}
                />
              </label>
              <label className="wide">
                Shipping Address
                <textarea
                  placeholder="Street address, apartment, suite..."
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  placeholder="Optional notes about this buyer..."
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" disabled={savingBuyer}>
                {savingBuyer
                  ? "Saving…"
                  : `✓ ${editing === "new" ? "Add Buyer" : "Save Changes"}`}
              </button>
            </footer>
          </form>
        </div>
      )}
      {imageEditor && (
        <div
          className="buyer-crop-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust profile photo"
        >
          <section className="buyer-crop-dialog">
            <header>
              <h3>Adjust profile photo</h3>
              <button type="button" onClick={() => setImageEditor(null)}>
                ×
              </button>
            </header>
            <div
              className="buyer-crop-preview"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerMove={moveImage}
              onPointerUp={() => {
                dragRef.current = null;
              }}
            >
              <img
                src={imageEditor.src}
                alt="Profile crop preview"
                style={{
                  objectPosition: `${imageEditor.x}% ${imageEditor.y}%`,
                  transform: `scale(${imageEditor.zoom})`,
                }}
              />
              <i />
            </div>
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={imageEditor.zoom}
                onChange={(event) =>
                  setImageEditor({
                    ...imageEditor,
                    zoom: Number(event.target.value),
                  })
                }
              />
            </label>
            <p>Drag the photo to choose what appears in the profile.</p>
            <footer>
              <button type="button" onClick={() => setImageEditor(null)}>
                Cancel
              </button>
              <button type="button" onClick={applyVirtualBuyerImage}>
                Use photo
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

const demoBuyerThreads = [
  {
    id: 1,
    buyer: "Demo Buyer One",
    phone: "+1 ••• ••• 0101",
    seller: "Demo Merchant 1",
    message: "Is this product available?",
    product: "Classic Laptop Bag",
    sku: "DEMO-SKU-149127",
    price: 172.79,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=160&q=80",
    date: "Aug 8, 2026 01:17 AM",
    unread: false,
    replies: [],
  },
  {
    id: 2,
    buyer: "Demo Buyer Two",
    phone: "+44 •••• ••• 202",
    seller: "Demo Merchant 1",
    message: "Can you tell me more about this item?",
    product: "Minimal Desk Accessory",
    sku: "DEMO-SKU-058814",
    price: 8,
    image:
      "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=160&q=80",
    date: "Aug 4, 2026 12:37 AM",
    unread: true,
    replies: [
      {
        author: "Demo Merchant 1",
        text: "Hello! Yes, it is ready to order.",
        date: "Aug 8, 2026 01:06 AM",
      },
    ],
  },
  {
    id: 3,
    buyer: "Demo Buyer Three",
    phone: "+65 •••• 0303",
    seller: "Demo Merchant 2",
    message: "Is this available in another color?",
    product: "Wireless Headphones",
    sku: "DEMO-SKU-552893",
    price: 20,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=160&q=80",
    date: "Aug 3, 2026 10:22 AM",
    unread: true,
    replies: [],
  },
];

function AgentBuyerMessages() {
  const buyerMarker = (buyer, product) =>
    `virtual-buyer:${encodeURIComponent(
      JSON.stringify({
        id: buyer.id,
        name: buyer.name,
        phone: buyer.phone,
        image: buyer.image || buyer.buyer_image || "",
        product: product
          ? {
              id: product.id,
              name: product.name || product.product_code,
              sku: product.sku || product.product_code,
              price: Number(product.sell_price || 0),
              image: product.image_url || "",
            }
          : undefined,
      }),
    )}`;
  const readBuyerMarker = (value) => {
    if (!value?.startsWith("virtual-buyer:")) return null;
    try {
      return JSON.parse(
        decodeURIComponent(value.slice("virtual-buyer:".length)),
      );
    } catch {
      return null;
    }
  };
  const [threads, setThreads] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("agent_buyer_messages") || "null") ||
        demoBuyerThreads
      );
    } catch {
      return demoBuyerThreads;
    }
  });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [openThread, setOpenThread] = useState(null);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    buyer: "",
    seller: "",
    product: "",
    message: "",
  });
  const [productFilter, setProductFilter] = useState("ordered");
  const [sellerOptions, setSellerOptions] = useState([]);
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [agentUserId, setAgentUserId] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  useEffect(() => {
    const refreshBuyers = async () => {
      const { data, error } = await agentSupabase
        .from("virtual_buyers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return setSendError(`Could not load buyers: ${error.message}`);
      setBuyers(
        (data || []).map((buyer) => ({
          id: buyer.id,
          name: buyer.name,
          phone: buyer.phone || "",
          email: buyer.email || "",
          country: buyer.country || "",
          state: buyer.state || "",
          city: buyer.city || "",
          postal: buyer.postal || "",
          address: buyer.address || "",
          notes: buyer.notes || "",
          image: buyer.image_url || "",
        })),
      );
    };
    refreshBuyers();
    window.addEventListener("agent-virtual-buyers-changed", refreshBuyers);
    return () => {
      window.removeEventListener("agent-virtual-buyers-changed", refreshBuyers);
    };
  }, []);
  useEffect(() => {
    let active = true;
    agentSupabase
      .from("profiles")
      .select("id,display_name,email")
      .eq("role", "seller")
      .order("display_name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setSendError(`Could not load sellers: ${error.message}`);
        else setSellerOptions(data || []);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!form.seller || !form.buyer) {
      setAvailableProducts([]);
      return;
    }
    let active = true;
    const loadProducts = async () => {
      const buyer = buyers.find((item) => String(item.id) === form.buyer);
      const [{ data: showcaseRows }, { data: orderRows }] = await Promise.all([
        agentSupabase
          .from("showcase_products")
          .select(
            "on_shelf,products(id,name,product_code,sku,sell_price,image_url)",
          )
          .eq("seller_id", form.seller)
          .eq("on_shelf", true),
        agentSupabase
          .from("orders")
          .select("product_name")
          .eq("seller_id", form.seller)
          .eq("customer_name", buyer?.name || ""),
      ]);
      if (!active) return;
      const orderedNames = new Set(
        (orderRows || []).map((row) => row.product_name),
      );
      setAvailableProducts(
        (showcaseRows || [])
          .filter((row) => row.products)
          .map((row) => ({
            ...row.products,
            ordered: orderedNames.has(row.products.name),
          })),
      );
    };
    loadProducts();
    return () => {
      active = false;
    };
  }, [form.seller, form.buyer, buyers]);
  useEffect(() => {
    let active = true;
    let channel;
    const loadMessages = async () => {
      const { data: authData } = await agentSupabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId || !active) return;
      setAgentUserId(userId);
      const { data, error } = await agentSupabase
        .from("messages")
        .select("*")
        .eq("channel", "buyer")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) setSendError(`Could not load messages: ${error.message}`);
      else setLiveMessages(data || []);
    };
    loadMessages();
    channel = agentSupabase
      .channel(`agent-buyer-messages-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        loadMessages,
      )
      .subscribe();
    return () => {
      active = false;
      if (channel) agentSupabase.removeChannel(channel);
    };
  }, []);
  const persist = (next) => {
    setThreads(next);
    localStorage.setItem("agent_buyer_messages", JSON.stringify(next));
  };
  const buyerContextForMessage = (message) => {
    const explicit = readBuyerMarker(message.image_url);
    if (explicit || message.sender_id === agentUserId) return explicit;
    const messageIndex = liveMessages.findIndex(
      (item) => item.id === message.id,
    );
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      const candidate = liveMessages[index];
      if (
        candidate.channel === "buyer" &&
        candidate.sender_id === agentUserId &&
        candidate.recipient_id === message.sender_id
      ) {
        const inferred = readBuyerMarker(candidate.image_url);
        if (inferred) return inferred;
      }
    }
    return null;
  };
  const messagesForThread = (thread) =>
    thread.sellerId
      ? liveMessages.filter((message) => {
          const participantsMatch =
            (message.sender_id === agentUserId &&
              message.recipient_id === thread.sellerId) ||
            (message.sender_id === thread.sellerId &&
              message.recipient_id === agentUserId);
          const buyer = buyerContextForMessage(message);
          return (
            participantsMatch &&
            String(buyer?.id) === String(thread.buyerId || thread.buyer) &&
            String(buyer?.product?.id || "general") ===
              String(thread.productId || "general")
          );
        })
      : [];
  const visible = threads
    .map((item) => {
      const conversation = messagesForThread(item);
      const latest = conversation.at(-1);
      return {
        ...item,
        latestMessage:
          latest?.body || item.replies.at(-1)?.text || item.message,
        latestDate: latest?.created_at || item.date,
        latestDateLabel: latest?.created_at
          ? new Date(latest.created_at).toLocaleString()
          : item.date,
      };
    })
    .filter((item) =>
      [item.buyer, item.seller, item.latestMessage, item.product].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    )
    .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
  const unread = threads.filter((item) => item.unread).length;
  const markAllRead = () =>
    persist(threads.map((item) => ({ ...item, unread: false })));
  const viewThread = (id) => {
    const next = threads.map((item) =>
      item.id === id ? { ...item, unread: false } : item,
    );
    persist(next);
    setOpenThread(id);
  };
  const create = async (event) => {
    event.preventDefault();
    const seller = sellerOptions.find((item) => item.id === form.seller);
    const buyer = buyers.find((item) => String(item.id) === form.buyer);
    const product = availableProducts.find(
      (item) => String(item.id) === form.product,
    );
    if (!seller || !buyer || !form.message.trim()) return;
    setSending(true);
    setSendError("");
    const { data: authData, error: authError } =
      await agentSupabase.auth.getUser();
    if (authError || !authData.user) {
      setSendError(authError?.message || "Your agent session has expired.");
      setSending(false);
      return;
    }
    const { data: saved, error } = await agentSupabase
      .from("messages")
      .insert({
        sender_id: authData.user.id,
        recipient_id: seller.id,
        channel: "buyer",
        body: form.message.trim(),
        image_url: buyerMarker(buyer, product),
      })
      .select("*")
      .single();
    if (error) {
      setSendError(`Message was not sent: ${error.message}`);
      setSending(false);
      return;
    }
    setLiveMessages((current) =>
      current.some((item) => item.id === saved.id)
        ? current
        : [...current, saved],
    );
    const nextThread = {
      id: saved.id,
      buyer: buyer.name,
      buyerId: buyer?.id,
      phone: buyer?.phone || "•••",
      seller: seller.display_name || seller.email,
      sellerId: seller.id,
      message: form.message.trim(),
      productId: product?.id || null,
      product: product?.name || product?.product_code || "",
      sku: product?.sku || product?.product_code || "",
      price: product ? Number(product.sell_price || 0) : null,
      image: product?.image_url || "",
      date: new Date(saved.created_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      unread: true,
      replies: [],
    };
    const existingThread = threads.find(
      (item) =>
        item.sellerId === seller.id &&
        String(item.buyerId || item.buyer) === String(buyer.id) &&
        String(item.productId || "general") ===
          String(product?.id || "general"),
    );
    persist(
      existingThread
        ? [
            {
              ...existingThread,
              message: nextThread.message,
              date: nextThread.date,
              unread: true,
            },
            ...threads.filter((item) => item.id !== existingThread.id),
          ]
        : [nextThread, ...threads],
    );
    setForm({ buyer: "", seller: "", product: "", message: "" });
    setCreating(false);
    setSending(false);
  };
  const sendReply = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    const thread = threads.find((item) => item.id === openThread);
    if (thread?.sellerId) {
      const { data: authData } = await agentSupabase.auth.getUser();
      const { data: saved, error } = await agentSupabase
        .from("messages")
        .insert({
          sender_id: authData.user?.id,
          recipient_id: thread.sellerId,
          channel: "buyer",
          body: reply.trim(),
          image_url: buyerMarker(
            {
              id: thread.buyerId || thread.buyer,
              name: thread.buyer,
              phone: thread.phone,
            },
            thread.productId
              ? {
                  id: thread.productId,
                  name: thread.product,
                  sku: thread.sku,
                  sell_price: thread.price,
                  image_url: thread.image,
                }
              : null,
          ),
        })
        .select("*")
        .single();
      if (error) {
        setSendError(`Reply was not sent: ${error.message}`);
        return;
      }
      setLiveMessages((current) =>
        current.some((item) => item.id === saved.id)
          ? current
          : [...current, saved],
      );
    }
    persist(
      threads.map((item) =>
        item.id === openThread
          ? {
              ...item,
              replies: [
                ...item.replies,
                {
                  author: "Demo Agent",
                  text: reply.trim(),
                  date: new Date().toLocaleString(),
                },
              ],
            }
          : item,
      ),
    );
    setReply("");
  };
  const activeThread = threads.find((item) => item.id === openThread);
  const activeMessages = activeThread?.sellerId
    ? liveMessages.filter((item) => {
        const participantsMatch =
          (item.sender_id === agentUserId &&
            item.recipient_id === activeThread.sellerId) ||
          (item.sender_id === activeThread.sellerId &&
            item.recipient_id === agentUserId);
        const buyer = buyerContextForMessage(item);
        return (
          participantsMatch &&
          String(buyer?.id) ===
            String(activeThread.buyerId || activeThread.buyer) &&
          String(buyer?.product?.id || "general") ===
            String(activeThread.productId || "general")
        );
      })
    : [];
  return (
    <div className="agent-buyer-messages-page">
      <header>
        <div>
          <h2>Buyer Messages</h2>
          <p>
            Messages from virtual buyers about products in your sellers’ stores.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)}>
          ＋ New Message
        </button>
      </header>
      <div className="agent-buyer-message-tools">
        <label>
          <span>⌕</span>
          <input
            placeholder="Search messages..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button type="button" onClick={markAllRead} disabled={!unread}>
          ✓ Mark all read ({unread})
        </button>
      </div>
      <section className="agent-buyer-thread-list">
        {visible.map((item) => (
          <article key={item.id} className={item.unread ? "unread" : ""}>
            <div className="agent-buyer-thread-title">
              <b>{item.buyer[5] || "B"}</b>
              <div>
                <strong>{item.buyer}</strong>
                <small>{item.phone}</small>
                <span>Store: {item.seller}</span>
                <p>{item.latestMessage}</p>
              </div>
              {item.unread && <i aria-label="Unread" />}
            </div>
            {item.product ? (
              <div className="agent-buyer-product">
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.product}</strong>
                  <span>SKU: {item.sku}</span>
                  <b>${Number(item.price || 0).toFixed(2)}</b>
                </div>
              </div>
            ) : (
              <div className="agent-buyer-general-chat">
                General conversation · No product selected
              </div>
            )}
            <footer>
              <time>{item.latestDateLabel}</time>
              <button type="button" onClick={() => viewThread(item.id)}>
                ▢{" "}
                {messagesForThread(item).length > 1 || item.replies.length
                  ? "View Thread"
                  : "Open Chat"}
              </button>
            </footer>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-buyer-message-empty">
            No buyer messages found.
          </div>
        )}
      </section>
      {creating && (
        <div
          className="agent-buyer-message-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCreating(false)
          }
        >
          <form className="agent-buyer-message-modal" onSubmit={create}>
            <header>
              <h3>▢ &nbsp; New Buyer Message</h3>
              <button type="button" onClick={() => setCreating(false)}>
                ×
              </button>
            </header>
            {sendError && <p className="agent-login-error">{sendError}</p>}
            <label>
              Buyer *
              <select
                required
                value={form.buyer}
                onChange={(event) =>
                  setForm({ ...form, buyer: event.target.value, product: "" })
                }
              >
                <option value="">— Select buyer —</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name} · {buyer.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seller store *
              <select
                required
                value={form.seller}
                onChange={(event) =>
                  setForm({ ...form, seller: event.target.value, product: "" })
                }
              >
                <option value="">— Select seller —</option>
                {sellerOptions.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.display_name || seller.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="buyer-product-label">
                Product <small>(optional)</small>
              </span>
              <div className="buyer-product-filter-buttons">
                <button
                  type="button"
                  className={productFilter === "ordered" ? "active" : ""}
                  onClick={() => {
                    setProductFilter("ordered");
                    setForm({ ...form, product: "" });
                  }}
                >
                  Ordered products
                </button>
                <button
                  type="button"
                  className={productFilter === "unordered" ? "active" : ""}
                  onClick={() => {
                    setProductFilter("unordered");
                    setForm({ ...form, product: "" });
                  }}
                >
                  Not yet ordered products
                </button>
              </div>
              <select
                value={form.product}
                onChange={(event) =>
                  setForm({ ...form, product: event.target.value })
                }
                disabled={!form.buyer || !form.seller}
              >
                <option value="">— No product (general conversation) —</option>
                {availableProducts
                  .filter((product) =>
                    productFilter === "ordered"
                      ? product.ordered
                      : !product.ordered,
                  )
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · $
                      {Number(product.sell_price || 0).toFixed(2)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Message *
              <textarea
                required
                placeholder="Write the buyer's message..."
                value={form.message}
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
              />
            </label>
            <footer>
              <button type="button" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  sending || !form.buyer || !form.seller || !form.message.trim()
                }
              >
                {sending ? "Sending…" : "Send Message"}
              </button>
            </footer>
          </form>
        </div>
      )}
      {activeThread && (
        <div
          className="agent-buyer-message-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpenThread(null)
          }
        >
          <section className="agent-buyer-chat-modal">
            <header>
              <div>
                <h3>{activeThread.buyer}</h3>
                <p>
                  {activeThread.seller} ·{" "}
                  {activeThread.product || "General conversation"}
                </p>
              </div>
              <button type="button" onClick={() => setOpenThread(null)}>
                ×
              </button>
            </header>
            <div className="agent-buyer-chat-stream">
              {activeMessages.length ? (
                activeMessages.map((item) => (
                  <article
                    className={
                      item.sender_id === agentUserId ? "mine" : "theirs"
                    }
                    key={item.id}
                    style={{
                      justifySelf:
                        item.sender_id === agentUserId ? "end" : "start",
                      background:
                        item.sender_id === agentUserId ? "#dff8f4" : "#f1f4f6",
                    }}
                  >
                    <p>{item.body}</p>
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                  </article>
                ))
              ) : (
                <>
                  <article
                    className="mine"
                    style={{ justifySelf: "end", background: "#dff8f4" }}
                  >
                    <p>{activeThread.message}</p>
                    <time>{activeThread.date}</time>
                  </article>
                  {activeThread.replies.map((item, index) => (
                    <article
                      className="mine"
                      style={{ justifySelf: "end", background: "#dff8f4" }}
                      key={`${item.date}-${index}`}
                    >
                      <p>{item.text}</p>
                      <time>{item.date}</time>
                    </article>
                  ))}
                </>
              )}
            </div>
            <form onSubmit={sendReply}>
              <input
                placeholder="Write a reply..."
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
              <button type="submit" disabled={!reply.trim()}>
                Send
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function AgentShopSystem() {
  const seed = [
    {
      id: 1,
      name: "Demo Merchant 1",
      visible: true,
      traffic: true,
      clicks: 10025,
      credit: 95,
    },
    {
      id: 2,
      name: "Demo Merchant 2",
      visible: true,
      traffic: false,
      clicks: 4111,
      credit: 100,
    },
    {
      id: 3,
      name: "Demo Merchant 3",
      visible: true,
      traffic: false,
      clicks: 0,
      credit: 100,
    },
  ];
  const [shops, setShops] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("agent_shop_system") || "null") || seed
      );
    } catch {
      return seed;
    }
  });
  const toggle = (id, field) => {
    const next = shops.map((shop) =>
      shop.id === id ? { ...shop, [field]: !shop[field] } : shop,
    );
    setShops(next);
    localStorage.setItem("agent_shop_system", JSON.stringify(next));
  };
  return (
    <div className="agent-final-page agent-shop-page">
      <header>
        <h2>Shop — System</h2>
        <p>
          System-level shop switches for each of your merchants. Locked shops
          can only be unlocked by the platform.
        </p>
      </header>
      <section className="agent-final-table">
        <div className="shop-head">
          <span>SHOP</span>
          <span>STATUS</span>
          <span>SHOWCASE VISIBLE</span>
          <span>TRAFFIC ENABLED</span>
          <span>CLICKS</span>
          <span>CREDIT</span>
        </div>
        {shops.map((shop) => (
          <article className="shop-row" key={shop.id}>
            <span className="final-merchant">
              <b>{shop.name.at(-1)}</b>
              <strong>{shop.name}</strong>
            </span>
            <span>
              <em className="normal">♙ Normal</em>
            </span>
            <button
              aria-label="Toggle showcase"
              type="button"
              className={`final-switch ${shop.visible ? "on" : ""}`}
              onClick={() => toggle(shop.id, "visible")}
            >
              <i />
            </button>
            <button
              aria-label="Toggle traffic"
              type="button"
              className={`final-switch ${shop.traffic ? "on" : ""}`}
              onClick={() => toggle(shop.id, "traffic")}
            >
              <i />
            </button>
            <span>{shop.clicks.toLocaleString()}</span>
            <span>{shop.credit}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

function AgentEarnings() {
  return (
    <div className="agent-final-page">
      <header>
        <h2>Earnings</h2>
        <p>Your commission history and wallet balance.</p>
      </header>
      <section className="earning-cards">
        <article>
          <b>▣</b>
          <strong>$0.00</strong>
          <span>Wallet Balance</span>
        </article>
        <article>
          <b>$</b>
          <strong>$0.00</strong>
          <span>Total Commission</span>
        </article>
        <article>
          <b>%</b>
          <strong>5.0%</strong>
          <span>Commission Rate</span>
        </article>
      </section>
      <section className="agent-final-table earning-history">
        <h3>Commission History</h3>
        <div className="earning-head">
          <span>DATE</span>
          <span>DESCRIPTION</span>
          <span>SELLER</span>
          <span>AMOUNT</span>
        </div>
        <p>No commission records yet.</p>
      </section>
    </div>
  );
}

const safeAuditRows = [
  [
    "Demo Merchant 2",
    "Automation",
    "stop_automation",
    "Agent",
    "Aug 23, 2026 02:05 AM",
  ],
  [
    "Demo Merchant 2",
    "Automation",
    "resume_automation",
    "Agent",
    "Aug 23, 2026 02:05 AM",
  ],
  [
    "Demo Merchant 1",
    "Automation",
    "stop_automation",
    "Agent",
    "Aug 23, 2026 02:05 AM",
  ],
  [
    "Demo Merchant 1",
    "Orders",
    "auto_order_run",
    "Agent",
    "Aug 23, 2026 02:05 AM",
  ],
  [
    "Demo Merchant 1",
    "Login",
    "login_success",
    "Seller",
    "Aug 20, 2026 08:09 PM",
  ],
  [
    "Demo Merchant 3",
    "Login",
    "login_success",
    "Seller",
    "Aug 16, 2026 10:02 PM",
  ],
  [
    "Demo Merchant 2",
    "Orders",
    "order_status_updated",
    "Agent",
    "Aug 10, 2026 01:58 AM",
  ],
  [
    "Demo Merchant 1",
    "Showcase",
    "showcase_enabled",
    "Agent",
    "Aug 8, 2026 04:05 PM",
  ],
];

function AgentAuditLogs() {
  const [search, setSearch] = useState("");
  const visible = safeAuditRows.filter((row) =>
    row.some((value) => value.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <div className="agent-final-page audit-page">
      <header>
        <h2>Audit Logs</h2>
        <p>Activity trail for your sellers’ accounts.</p>
      </header>
      <label className="audit-search">
        <span>⌕</span>
        <input
          placeholder="Search action, category, seller..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <section className="agent-final-table">
        <div className="audit-head">
          <span>SELLER</span>
          <span>CATEGORY</span>
          <span>ACTION</span>
          <span>ROLE</span>
          <span>IP</span>
          <span>TIME</span>
        </div>
        {visible.map((row, index) => (
          <article className="audit-row" key={`${row[2]}-${index}`}>
            <span className="final-merchant">
              <b>{row[0].at(-1)}</b>
              <strong>{row[0]}</strong>
            </span>
            <span>{row[1]}</span>
            <code>{row[2]}</code>
            <span>{row[3]}</span>
            <span>—</span>
            <time>{row[4]}</time>
          </article>
        ))}
        {!visible.length && <p>No matching audit records.</p>}
      </section>
    </div>
  );
}

function AgentFeedbacks() {
  const seed = [
    {
      id: 1,
      seller: "Demo Merchant 1",
      type: "Problem",
      title: "Demo support request",
      content: "This is a sample feedback ticket for the public demonstration.",
      status: "Open",
      submitted: "Aug 23, 2026 12:14 AM",
      reply: "",
    },
  ];
  const [tickets, setTickets] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("agent_feedback_tickets") || "null") ||
        seed
      );
    } catch {
      return seed;
    }
  });
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  useEffect(() => {
    const load = async () => {
      const { data, error } = await agentSupabase
        .from("feedback_tickets")
        .select(
          "*,seller:profiles!feedback_tickets_seller_id_fkey(display_name,email)",
        )
        .order("created_at", { ascending: false });
      if (!error && data)
        setTickets(
          data.map((row) => ({
            id: row.id,
            seller: row.seller?.display_name || row.seller?.email || "Seller",
            type: row.type,
            title: row.title,
            content: row.message,
            status: row.status,
            submitted: new Date(row.created_at).toLocaleString(),
            reply: row.admin_response || "",
          })),
        );
    };
    load();
    const channel = agentSupabase
      .channel("agent-live-feedback")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_tickets" },
        load,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);
  const visible = tickets.filter(
    (ticket) => filter === "All" || ticket.status === filter,
  );
  const resolve = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    await agentSupabase
      .from("feedback_tickets")
      .update({
        status: "Resolved",
        admin_response: reply.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected);
    const next = tickets.map((ticket) =>
      ticket.id === selected
        ? { ...ticket, status: "Resolved", reply: reply.trim() }
        : ticket,
    );
    setTickets(next);
    setSelected(null);
    setReply("");
  };
  const ticket = tickets.find((item) => item.id === selected);
  return (
    <div className="agent-final-page feedback-page">
      <header>
        <h2>Feedbacks</h2>
        <p>Feedback and support tickets submitted by your sellers.</p>
      </header>
      <nav className="feedback-tabs">
        {["All", "Open", "Resolved"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <section className="agent-final-table feedback-table">
        <div className="feedback-head">
          <span>SELLER</span>
          <span>TYPE</span>
          <span>TITLE</span>
          <span>STATUS</span>
          <span>SUBMITTED</span>
          <span />
        </div>
        {visible.map((item) => (
          <article key={item.id}>
            <span className="final-merchant">
              <b>{item.seller.at(-1)}</b>
              <strong>{item.seller}</strong>
            </span>
            <span>{item.type}</span>
            <span>{item.title}</span>
            <span>
              <em className={item.status.toLowerCase()}>{item.status}</em>
            </span>
            <time>{item.submitted}</time>
            <button
              type="button"
              onClick={() => {
                setSelected(item.id);
                setReply(item.reply || "");
              }}
            >
              View
            </button>
          </article>
        ))}
        {!visible.length && <p>No {filter.toLowerCase()} tickets.</p>}
      </section>
      {ticket && (
        <div
          className="feedback-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <form onSubmit={resolve}>
            <header>
              <h3>Feedback Details</h3>
              <button type="button" onClick={() => setSelected(null)}>
                ×
              </button>
            </header>
            <dl>
              <div>
                <dt>SELLER</dt>
                <dd>{ticket.seller}</dd>
              </div>
              <div>
                <dt>TYPE</dt>
                <dd>{ticket.type}</dd>
              </div>
              <div>
                <dt>TITLE</dt>
                <dd>{ticket.title}</dd>
              </div>
              <div>
                <dt>CONTENT</dt>
                <dd>{ticket.content}</dd>
              </div>
              <div>
                <dt>STATUS</dt>
                <dd>{ticket.status}</dd>
              </div>
            </dl>
            <label>
              REPLY TO SELLER
              <textarea
                disabled={ticket.status === "Resolved"}
                placeholder="Write a reply — it will be sent to the seller and mark this ticket as resolved..."
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
            </label>
            {ticket.status === "Open" ? (
              <button type="submit" disabled={!reply.trim()}>
                ➤ Send Reply &amp; Resolve
              </button>
            ) : (
              <div className="feedback-resolved">
                ✓ This ticket has been resolved.
              </div>
            )}
            <small>
              SUBMITTED<strong>{ticket.submitted}</strong>
            </small>
          </form>
        </div>
      )}
    </div>
  );
}

function AgentMyAccount({ agentProfile }) {
  return (
    <div className="agent-final-page account-page">
      <header>
        <h2>My Account</h2>
        <p>Your agent account details are managed by the platform admin.</p>
      </header>
      <section className="account-card">
        <h3>♧ &nbsp; Profile</h3>
        <div>
          <label>
            AGENT NAME<strong>{agentProfile?.display_name || "Agent"}</strong>
          </label>
          <label>
            AGENT ID<strong>{agentProfile?.id ? `AGT${agentProfile.id.slice(0, 8).toUpperCase()}` : "—"}</strong>
          </label>
          <label>
            EMAIL<strong>{agentProfile?.email || "—"}</strong>
          </label>
          <label>
            STATUS<strong>Active</strong>
          </label>
          <label>
            COMMISSION RATE<strong>5.0%</strong>
          </label>
          <label>
            MEMBER SINCE<strong>Aug 23, 2026</strong>
          </label>
        </div>
        <p className="account-notice">Only your profile photo can be changed. Click your photo in the top-right corner to upload a new one.</p>
      </section>
    </div>
  );
}

function AgentGeneralConfig() {
  const [config, setConfig] = useState(() => {
    try {
      return {
        ...defaultAgentConfig,
        ...JSON.parse(
          localStorage.getItem("agent_general_preferences") || "{}",
        ),
      };
    } catch {
      return defaultAgentConfig;
    }
  });
  const [saved, setSaved] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropSource, setCropSource] = useState("");

  useEffect(() => {
    agentSupabase.auth.getUser().then(({ data }) => {
      setAvatar(data?.user?.user_metadata?.avatar_url || "");
    });
  }, []);

  const pickAvatarFile = async (file) => {
    if (!file) return;
    setAvatarError("");
    try {
      setCropSource(await readImageFile(file));
    } catch (err) {
      setAvatarError(err.message || "Could not read that image.");
    }
  };
  const onAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    pickAvatarFile(file);
  };
  const onAvatarPaste = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      pickAvatarFile(file);
    }
  };
  const confirmAvatarCrop = async (croppedDataUrl) => {
    setCropSource("");
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const { error } = await agentSupabase.auth.updateUser({
        data: { avatar_url: croppedDataUrl },
      });
      if (error) throw error;
      setAvatar(croppedDataUrl);
      window.dispatchEvent(new CustomEvent("agent-avatar-changed"));
    } catch (err) {
      setAvatarError(err.message || "Could not update photo.");
    }
    setAvatarBusy(false);
  };

  const update = (field, value) =>
    setConfig((current) => ({ ...current, [field]: value }));
  const save = (event) => {
    event.preventDefault();
    localStorage.setItem("agent_general_preferences", JSON.stringify(config));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="agent-general-page">
      <header>
        <h2>General Config</h2>
        <p>Your agent profile and portal preferences.</p>
      </header>
      <form onSubmit={save}>
        <section className="agent-general-card">
          <h3>Profile</h3>
          <div
            className="agent-avatar-row"
            tabIndex={0}
            onPaste={onAvatarPaste}
          >
            {avatar ? (
              <img className="agent-avatar-preview" src={avatar} alt="" />
            ) : (
              <div className="agent-avatar-placeholder">K</div>
            )}
            <label className="agent-avatar-upload">
              {avatarBusy ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/*"
                onChange={onAvatarFileChange}
                hidden
              />
            </label>
            <small className="agent-avatar-hint">or click here and paste</small>
          </div>
          {avatarError && <p className="account-notice">{avatarError}</p>}
          {cropSource && (
            <AvatarCropper
              src={cropSource}
              onCancel={() => setCropSource("")}
              onConfirm={confirmAvatarCrop}
            />
          )}
          <div className="agent-general-grid">
            <label>
              Display name *
              <input
                required
                value={config.displayName}
                onChange={(event) => update("displayName", event.target.value)}
              />
            </label>
            <label>
              Company
              <input
                value={config.company}
                onChange={(event) => update("company", event.target.value)}
              />
            </label>
            <label>
              Phone
              <input
                value={config.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <label>
              Login email
              <input disabled value="ag•••@example.com" />
            </label>
            <label>
              Agent number
              <input disabled value="AGT000004" />
            </label>
            <label>
              Commission rate
              <input disabled value="5.0%" />
            </label>
          </div>
        </section>
        <section className="agent-general-card agent-preferences-card">
          <h3>Preferences</h3>
          <label className="agent-general-check">
            <span>Email notifications</span>
            <input
              type="checkbox"
              checked={config.emailNotifications}
              onChange={(event) =>
                update("emailNotifications", event.target.checked)
              }
            />
          </label>
          <label className="agent-general-check">
            <span>New order alerts</span>
            <input
              type="checkbox"
              checked={config.newOrderAlerts}
              onChange={(event) =>
                update("newOrderAlerts", event.target.checked)
              }
            />
          </label>
          <div className="agent-general-grid agent-select-grid">
            <label>
              Timezone
              <select
                value={config.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              >
                {[
                  "UTC",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Europe/London",
                  "Asia/Singapore",
                  "Asia/Shanghai",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select
                value={config.currency}
                onChange={(event) => update("currency", event.target.value)}
              >
                {["USD", "EUR", "GBP", "SGD"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <div className="agent-general-save">
          <button type="submit">Save changes</button>
          {saved && <span>Changes saved</span>}
        </div>
      </form>
    </div>
  );
}

function AgentOrderRecords() {
  return (
    <div className="agent-order-records-page">
      <header>
        <h2>Order Records</h2>
        <p>
          A full trail of every order action you have performed for your
          merchants.
        </p>
      </header>
      <section>
        <div className="agent-records-head">
          <span>TIME</span>
          <span>MERCHANT</span>
          <span>ACTION</span>
          <span>DETAILS</span>
        </div>
        {demoOrderRecords.map(([time, action, details], index) => (
          <article key={`${time}-${index}`}>
            <time>{time}</time>
            <span className="agent-record-merchant">
              <b>D</b>
              <strong>Demo Merchant</strong>
            </span>
            <span>
              <em>{action}</em>
            </span>
            <span>{details}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

function AgentAutoOrder() {
  const [merchants, setMerchants] = useState([
    { id: 1, name: "Demo Merchant 1", active: true, quantity: 1, result: "" },
    { id: 2, name: "Demo Merchant 2", active: false, quantity: 1, result: "" },
    { id: 3, name: "Demo Merchant 3", active: true, quantity: 1, result: "" },
  ]);
  const [history, setHistory] = useState([]);
  const toggle = (id) =>
    setMerchants((current) =>
      current.map((item) =>
        item.id === id ? { ...item, active: !item.active, result: "" } : item,
      ),
    );
  const updateQuantity = (id, quantity) =>
    setMerchants((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Number(quantity) || 1) }
          : item,
      ),
    );
  const generate = (merchant) => {
    const orderNumbers = Array.from(
      { length: merchant.quantity },
      (_, index) => `DEMO-AUTO-${Date.now().toString().slice(-5)}${index + 1}`,
    );
    setHistory((current) => [
      {
        id: Date.now(),
        date: new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        merchant: merchant.name,
        count: merchant.quantity,
        orderNumbers: orderNumbers.join(", "),
      },
      ...current,
    ]);
    setMerchants((current) =>
      current.map((item) =>
        item.id === merchant.id
          ? { ...item, result: `Created ${merchant.quantity} order(s).` }
          : item,
      ),
    );
  };
  return (
    <div className="agent-auto-order-page">
      <header>
        <h2>Auto Order</h2>
        <p>
          Automatically generate orders from each merchant’s on-shelf showcase
          products, and control per-merchant automation.
        </p>
      </header>
      <section className="agent-auto-merchants">
        <div className="agent-auto-head">
          <span>MERCHANT</span>
          <span>AUTOMATION</span>
          <span>ORDERS TO CREATE</span>
          <span>RUN</span>
          <span>RESULT</span>
        </div>
        {merchants.map((merchant) => (
          <article key={merchant.id}>
            <span className="agent-auto-name">
              <b>{merchant.name[5] || "D"}</b>
              <strong>{merchant.name}</strong>
            </span>
            <button
              type="button"
              className={merchant.active ? "active" : "paused"}
              onClick={() => toggle(merchant.id)}
            >
              {merchant.active
                ? "▷ Active — click to pause"
                : "Ⅱ Paused — click to resume"}
            </button>
            <input
              type="number"
              min="1"
              max="25"
              value={merchant.quantity}
              onChange={(event) =>
                updateQuantity(merchant.id, event.target.value)
              }
            />
            <button
              type="button"
              className="generate"
              disabled={!merchant.active}
              onClick={() => generate(merchant)}
            >
              ϟ &nbsp; Generate
            </button>
            <span className="agent-auto-result">{merchant.result}</span>
          </article>
        ))}
      </section>
      <h3>◴ &nbsp; AUTO ORDER HISTORY</h3>
      <section className="agent-auto-history">
        <div className="agent-auto-history-head">
          <span>DATE</span>
          <span>MERCHANT</span>
          <span>ORDERS CREATED</span>
          <span>ORDER NUMBERS</span>
        </div>
        {history.map((item) => (
          <article key={item.id}>
            <time>{item.date}</time>
            <span className="agent-auto-name">
              <b>{item.merchant[5] || "D"}</b>
              <strong>{item.merchant}</strong>
            </span>
            <strong>{item.count}</strong>
            <code>{item.orderNumbers}</code>
          </article>
        ))}
        {!history.length && (
          <div className="agent-auto-empty">No auto orders generated yet.</div>
        )}
      </section>
    </div>
  );
}

function AgentBatchReceive() {
  const [orders, setOrders] = useState(
    demoManagedOrders.filter((order) => order.status === "Pending Receive"),
  );
  const [selected, setSelected] = useState(
    () => new Set(),
  );
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(
      selected.size === orders.length
        ? new Set()
        : new Set(orders.map((order) => order.id)),
    );
  const receiveSelected = () => {
    setOrders((current) => current.filter((order) => !selected.has(order.id)));
    setSelected(new Set());
  };
  return (
    <div className="agent-batch-receive-page">
      <header>
        <h2>Batch Receive</h2>
        <p>
          Select shipped orders and mark them as received (completed) in one
          batch.
        </p>
      </header>
      <button
        className="agent-receive-selected"
        type="button"
        disabled={!selected.size}
        onClick={receiveSelected}
      >
        ◇ &nbsp; Receive selected ({selected.size})
      </button>
      <section className="agent-batch-receive-table">
        <div className="agent-batch-receive-head">
          <span />
          <span>ORDER NO</span>
          <span>SELLER</span>
          <span>PRODUCT</span>
          <span>QTY</span>
          <span>AMOUNT</span>
          <span>STATUS</span>
          <span>DATE</span>
        </div>
        <div className="agent-select-all">
          <input
            type="checkbox"
            checked={orders.length > 0 && selected.size === orders.length}
            onChange={toggleAll}
          />{" "}
          <span>Select all ({orders.length})</span>
        </div>
        {orders.map((order) => (
          <article key={order.id}>
            <input
              type="checkbox"
              checked={selected.has(order.id)}
              onChange={() => toggle(order.id)}
            />
            <code>{order.id}</code>
            <span className="agent-receive-seller">
              <b>{order.seller[0]}</b>
              <strong>{order.seller}</strong>
            </span>
            <span>{order.product}</span>
            <span>{order.qty}</span>
            <strong>${order.sale.toFixed(2)}</strong>
            <span>
              <em>Pending Receive</em>
            </span>
            <time>{order.date}</time>
          </article>
        ))}
        {!orders.length && (
          <div className="agent-batch-receive-empty">
            No pending orders to receive.
          </div>
        )}
      </section>
    </div>
  );
}

function AgentBatchShip() {
  const [carrier, setCarrier] = useState("TT-Express");
  const selectedCount = 0;
  return (
    <div className="agent-batch-ship-page">
      <header>
        <h2>Batch Ship</h2>
        <p>
          Select pending orders and ship them in one batch. Tracking numbers are
          generated automatically.
        </p>
      </header>
      <div className="agent-batch-ship-tools">
        <select
          value={carrier}
          onChange={(event) => setCarrier(event.target.value)}
        >
          <option>TT-Express</option>
          <option>Standard Delivery</option>
          <option>Priority Courier</option>
        </select>
        <button type="button" disabled={!selectedCount}>
          ♧ &nbsp; Ship selected ({selectedCount})
        </button>
      </div>
      <section>
        <p>No pending orders to ship.</p>
      </section>
    </div>
  );
}

function AgentOrderList() {
  const [orders, setOrders] = useLiveAgentOrders();
  const [status, setStatus] = useState("All Statuses");
  const [search, setSearch] = useState("");
  const [step, setStep] = useState(0);
  const [sellers, setSellers] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [draft, setDraft] = useState({
    sellerId: "",
    productId: "",
    productName: "",
    sellPrice: "",
    costPrice: "",
    qty: 1,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 1 || sellers.length) return;
    agentSupabase
      .from("profiles")
      .select("id,display_name,email")
      .eq("role", "seller")
      .order("display_name")
      .then(({ data }) => {
        setSellers(
          (data || []).map((item) => ({
            id: item.id,
            name: item.display_name || item.email.split("@")[0],
          })),
        );
      });
  }, [step, sellers.length]);

  const selectSeller = (sellerId) => {
    setDraft((current) => ({
      ...current,
      sellerId,
      productId: "",
      productName: "",
      sellPrice: "",
      costPrice: "",
    }));
    if (sellerId) {
      agentSupabase
        .from("showcase_products")
        .select("on_shelf,products(id,name,product_code,sell_price,cost_price)")
        .eq("seller_id", sellerId)
        .then(({ data }) => {
          setSellerProducts(
            (data || [])
              .filter((row) => row.on_shelf && row.products)
              .map((row) => row.products),
          );
        });
    } else {
      setSellerProducts([]);
    }
  };

  const selectProduct = (productId) => {
    const product = sellerProducts.find(
      (item) => String(item.id) === productId,
    );
    setDraft((current) => ({
      ...current,
      productId,
      productName: product?.name || product?.product_code || "",
      sellPrice: product ? String(product.sell_price ?? "") : "",
      costPrice: product ? String(product.cost_price ?? "") : "",
    }));
  };

  const visible = orders.filter(
    (order) =>
      (status === "All Statuses" || order.status === status) &&
      [order.id, order.product, order.seller].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
  );
  const close = () => {
    setStep(0);
    setDraft({
      sellerId: "",
      productId: "",
      productName: "",
      sellPrice: "",
      costPrice: "",
      qty: 1,
    });
    setSellerProducts([]);
  };
  const addOrder = async (event) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await agentSupabase.from("orders").insert({
      seller_id: draft.sellerId,
      order_no: `MH${Date.now()}`,
      product_name: draft.productName,
      customer_name: "Demo Customer",
      quantity: Number(draft.qty || 1),
      sell_price: Number(draft.sellPrice || 0),
      cost_price: Number(draft.costPrice || 0),
      status: "Pending Ship",
    });
    setBusy(false);
    if (!error) close();
  };
  return (
    <div className="agent-order-list-page">
      <header>
        <div>
          <h2>Seller Orders</h2>
          <p>
            Orders from sellers in your network. Create new orders on their
            behalf.
          </p>
        </div>
        <button type="button" onClick={() => setStep(1)}>
          ＋ New Order
        </button>
      </header>
      <div className="agent-order-list-tools">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {[
            "All Statuses",
            "Pending Ship",
            "Pending Receive",
            "Shipped",
            "Completed",
            "Refund",
            "Cancelled",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <label>
          <span>⌕</span>
          <input
            type="search"
            placeholder="Order no, product, seller..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <section className="agent-order-list-table">
        <div className="agent-order-list-head">
          <span>ORDER NO</span>
          <span>SELLER</span>
          <span>PRODUCT</span>
          <span>QTY</span>
          <span>AMOUNT</span>
          <span>PROFIT</span>
          <span>STATUS</span>
          <span>DATE</span>
        </div>
        {visible.map((order) => (
          <article key={order.id}>
            <code>{order.id}</code>
            <span>{order.seller}</span>
            <strong>{order.product}</strong>
            <span>{order.qty}</span>
            <strong>${order.sale.toFixed(2)}</strong>
            <strong className="profit">${order.profit.toFixed(2)}</strong>
            <span>
              <em
                className={`status-${String(order.status || "")
                  .toLowerCase()
                  .replace(" ", "-")}`}
              >
                {order.status}
              </em>
            </span>
            <time>{order.date}</time>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-order-list-empty">No orders found.</div>
        )}
      </section>
      {step > 0 && (
        <div
          className="agent-new-order-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <form
            className="agent-new-order-modal"
            onSubmit={
              step === 1
                ? (event) => {
                    event.preventDefault();
                    if (draft.sellerId) setStep(2);
                  }
                : addOrder
            }
          >
            <header>
              <h3>▣ &nbsp; New Order — Step {step} of 2</h3>
              <button type="button" onClick={close}>
                ×
              </button>
            </header>
            {step === 1 ? (
              <label>
                Seller *
                <select
                  required
                  value={draft.sellerId}
                  onChange={(event) => selectSeller(event.target.value)}
                >
                  <option value="">— Select seller —</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="agent-new-order-fields">
                <label>
                  Product *
                  <select
                    required
                    value={draft.productId}
                    onChange={(event) => selectProduct(event.target.value)}
                  >
                    <option value="">— Select product from showcase —</option>
                    {sellerProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name || product.product_code} · $
                        {Number(product.sell_price || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {!sellerProducts.length && (
                    <small>This seller has no on-shelf products.</small>
                  )}
                </label>
                <label>
                  Quantity *
                  <input
                    type="number"
                    min="1"
                    value={draft.qty}
                    onChange={(event) =>
                      setDraft({ ...draft, qty: event.target.value })
                    }
                  />
                </label>
                <label>
                  Sell Price *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.sellPrice}
                    onChange={(event) =>
                      setDraft({ ...draft, sellPrice: event.target.value })
                    }
                  />
                </label>
                <label>
                  Cost Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.costPrice}
                    onChange={(event) =>
                      setDraft({ ...draft, costPrice: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <footer>
              <button
                type="button"
                onClick={step === 1 ? close : () => setStep(1)}
              >
                {step === 1 ? "Cancel" : "Back"}
              </button>
              <button
                type="submit"
                disabled={(step === 1 && !draft.sellerId) || busy}
              >
                {step === 1 ? "Next ›" : busy ? "Creating…" : "Create Order"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

const demoManagedOrders = [];

const agentOrderStatuses = [
  { value: "Pending Payment", label: "Pending Pay" },
  { value: "Paid", label: "Paid" },
  { value: "Pending Ship", label: "Pending Ship" },
  { value: "Pending Receive", label: "Pending Receive" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Refund", label: "Refund" },
];

const agentOrderStatusAliases = {
  "pending pay": "Pending Payment",
  "pending payment": "Pending Payment",
  paid: "Paid",
  "pending ship": "Pending Ship",
  "pending receive": "Pending Receive",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  refund: "Refund",
  refunded: "Refund",
};

const normalizeAgentOrderStatus = (status) =>
  agentOrderStatusAliases[String(status || "").trim().toLowerCase()] ||
  "Pending Payment";

function useLiveAgentOrders() {
  const [orders, setOrders] = useState([]);
  const load = React.useCallback(async () => {
    const { data, error } = await agentSupabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) console.log("ORDERS LOAD ERROR:", error);
    if (!error && data) {
      const sellerIds = [...new Set(data.map((row) => row.seller_id).filter(Boolean))];
      const profileMap = new Map();
      if (sellerIds.length) {
        const { data: profiles } = await agentSupabase.from("profiles").select("id,display_name,email").in("id", sellerIds);
        (profiles || []).forEach((profile) => profileMap.set(profile.id, profile));
      }
      setOrders(
        data.map((row) => {
          const seller = profileMap.get(row.seller_id);
          return {
          dbId: row.id,
          id: row.order_no || row.id,
          seller: seller?.display_name || seller?.email || row.seller_name || "Seller",
          sellerId: row.seller_id,
          product: row.product_name || "Product",
          customer: row.customer_name || "Customer",
          qty: Number(row.quantity || 1),
          sale: Number(row.sell_price || 0) * Number(row.quantity || 1),
          profit:
            (Number(row.sell_price || 0) - Number(row.cost_price || 0)) *
            Number(row.quantity || 1),
          status: normalizeAgentOrderStatus(row.status),
          date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
        };
        }),
      );
    }
  }, []);
  useEffect(() => {
    load();
    const channel = agentSupabase
      .channel(`agent-orders-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        load,
      )
      .subscribe();
    const refreshTimer = window.setInterval(load, 15000);
    const refreshOnFocus = () => load();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      agentSupabase.removeChannel(channel);
    };
  }, [load]);
  return [orders, setOrders, load];
}

function AgentOrderManagement() {
  const [orders, setOrders, reloadOrders] = useLiveAgentOrders();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const tabs = ["All", ...agentOrderStatuses.map(({ label }) => label)];
  const selectedStatus = tab === "All" ? "All" : normalizeAgentOrderStatus(tab);
  const visible = orders.filter(
    (order) =>
      (selectedStatus === "All" || order.status === selectedStatus) &&
      [order.id, order.product, order.seller, order.customer].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
  );
  const changeStatus = async (order, status) => {
    const previousStatus = order.status;
    setMessage("");
    setUpdatingId(order.dbId);
    setOrders((current) =>
      current.map((item) => (item.dbId === order.dbId ? { ...item, status } : item)),
    );
    const { error } = await agentSupabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", order.dbId);
    if (error) {
      setOrders((current) => current.map((item) => item.dbId === order.dbId ? { ...item, status: previousStatus } : item));
      setMessage(`Could not update order ${order.id}: ${error.message}`);
    }
    setUpdatingId(null);
  };
  return (
    <div className="agent-orders-page">
      <header>
        <div>
          <h2>Order Management</h2>
          <p>
            Manage orders for your assigned sellers. Status changes notify the
            seller immediately.
          </p>
        </div>
        <button type="button" onClick={reloadOrders}>↻ Refresh</button>
      </header>
      <nav>
        {tabs.map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
            <b>{item === "All" ? orders.length : orders.filter((order) => order.status === normalizeAgentOrderStatus(item)).length}</b>
          </button>
        ))}
      </nav>
      <label className="agent-orders-search">
        <span>⌕</span>
        <input
          type="search"
          placeholder="Order no, product, seller, customer..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {message && <p className="agent-orders-error" role="alert">{message}</p>}
      <section className="agent-orders-table">
        <div className="agent-orders-head">
          <span>ORDER NO.</span>
          <span>SELLER</span>
          <span>PRODUCT</span>
          <span>CUSTOMER</span>
          <span>QTY</span>
          <span>SALE</span>
          <span>PROFIT</span>
          <span>STATUS</span>
          <span>DATE</span>
        </div>
        {visible.map((order) => (
          <article key={order.id}>
            <code>{order.id}</code>
            <strong>{order.seller}</strong>
            <span>{order.product}</span>
            <span>{order.customer}</span>
            <span>{order.qty}</span>
            <strong>${order.sale.toFixed(2)}</strong>
            <strong className="agent-order-profit">
              ${order.profit.toFixed(2)}
            </strong>
            <select
              className={`status-${String(order.status || "")
                .toLowerCase()
                .replace(" ", "-")}`}
              value={order.status || ""}
              disabled={updatingId === order.dbId}
              onChange={(event) => changeStatus(order, event.target.value)}
            >
              {agentOrderStatuses.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <time>{order.date}</time>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-orders-empty">No orders found.</div>
        )}
      </section>
      <p className="agent-orders-count">{visible.length} orders</p>
    </div>
  );
}

const demoBalanceLocks = [
  {
    id: "demo-lock-1",
    seller: "Demo Merchant",
    amount: "$0.00",
    reason: "Demo balance hold",
    status: "Active",
    locked: "Aug 23, 2026 01:08 AM",
    released: "—",
  },
];
function AgentBalanceLocks() {
  const [filter, setFilter] = useState("All");
  const visible = demoBalanceLocks.filter(
    (item) => filter === "All" || item.status === filter,
  );
  return (
    <div className="agent-locks-page">
      <header>
        <h2>Balance Locks</h2>
        <p>Balance locks placed on your sellers’ wallets (managed by admin).</p>
      </header>
      <nav>
        {["All", "Active", "Released"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <section className="agent-locks-table">
        <div className="agent-locks-head">
          <span>SELLER</span>
          <span>AMOUNT</span>
          <span>REASON</span>
          <span>STATUS</span>
          <span>LOCKED</span>
          <span>RELEASED</span>
        </div>
        {visible.map((item) => (
          <article key={item.id}>
            <span className="agent-lock-seller">
              <b>{item.seller[0]}</b>
              <strong>{item.seller}</strong>
            </span>
            <strong>{item.amount}</strong>
            <span>{item.reason}</span>
            <span>
              <em>{item.status === "Active" ? "Locked" : "Released"}</em>
            </span>
            <time>{item.locked}</time>
            <time>{item.released}</time>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-locks-empty">
            No {filter.toLowerCase()} balance locks.
          </div>
        )}
      </section>
    </div>
  );
}

function AgentCreditLogs() {
  const [filter, setFilter] = useState("All");
  return (
    <div className="agent-credit-page">
      <header>
        <h2>Credit Logs</h2>
        <p>Credit score changes for your sellers.</p>
      </header>
      <nav>
        {["All", "Increase", "Decrease"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <section>
        <p>
          No {filter === "All" ? "" : `${filter.toLowerCase()} `}credit logs.
        </p>
      </section>
    </div>
  );
}

const emptyAddress = {
  merchant: "Demo Merchant",
  label: "",
  recipient: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  address: "",
  postal: "",
  isDefault: false,
};
const demoAddresses = [
  {
    id: 1,
    merchant: "Demo Merchant",
    label: "Main warehouse",
    recipient: "Demo Recipient",
    phone: "+1 ••• ••• 0100",
    country: "United States",
    state: "California",
    city: "San Francisco",
    address: "Demo shipping address",
    postal: "•••••",
    isDefault: true,
    added: "Aug 23, 2026 07:36 PM",
  },
];

function AgentBoundAddresses() {
  const [addresses, setAddresses] = useState(demoAddresses);
  const [merchant, setMerchant] = useState("All merchants");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAddress);
  const filtered =
    merchant === "All merchants"
      ? addresses
      : addresses.filter((item) => item.merchant === merchant);
  const openAdd = () => {
    setForm(emptyAddress);
    setEditing("new");
  };
  const openEdit = (address) => {
    setForm(address);
    setEditing(address.id);
  };
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const save = (event) => {
    event.preventDefault();
    if (!form.recipient.trim() || !form.address.trim()) return;
    let next = addresses;
    if (form.isDefault)
      next = next.map((item) => ({ ...item, isDefault: false }));
    if (editing === "new")
      next = [
        ...next,
        {
          ...form,
          id: Date.now(),
          added: new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        },
      ];
    else
      next = next.map((item) =>
        item.id === editing ? { ...item, ...form } : item,
      );
    setAddresses(next);
    setEditing(null);
  };
  return (
    <div className="agent-bound-page">
      <header>
        <div>
          <h2>Bound Addresses</h2>
          <p>Shipping addresses bound to your merchants’ shops.</p>
        </div>
      </header>
      <div className="agent-bound-tools">
        <select
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        >
          <option>All merchants</option>
          <option>Demo Merchant</option>
        </select>
        <button type="button" onClick={openAdd}>
          ＋ Add Address
        </button>
      </div>
      <section className="agent-bound-table">
        <div className="agent-bound-head">
          <span>MERCHANT</span>
          <span>LABEL</span>
          <span>RECIPIENT</span>
          <span>PHONE</span>
          <span>ADDRESS</span>
          <span>DEFAULT</span>
          <span>ADDED</span>
          <span />
        </div>
        {filtered.map((item) => (
          <article key={item.id}>
            <span className="agent-bound-merchant">
              <b>{item.merchant[0]}</b>
              <strong>{item.merchant}</strong>
            </span>
            <span>{item.label || "—"}</span>
            <strong>{item.recipient}</strong>
            <span>{item.phone || "—"}</span>
            <span
              title={`${item.address}, ${item.city}, ${item.state}, ${item.country}`}
            >
              {[item.address, item.city, item.state, item.country]
                .filter(Boolean)
                .join(", ")}
            </span>
            <span className="agent-bound-star">
              {item.isDefault ? "★" : "☆"}
            </span>
            <time>{item.added}</time>
            <span className="agent-bound-actions">
              <button
                type="button"
                onClick={() => openEdit(item)}
                aria-label="Edit address"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() =>
                  setAddresses(
                    addresses.filter((address) => address.id !== item.id),
                  )
                }
                aria-label="Delete address"
              >
                ♲
              </button>
            </span>
          </article>
        ))}
        {!filtered.length && (
          <div className="agent-bound-empty">No bound addresses.</div>
        )}
      </section>
      {editing && (
        <div
          className="agent-address-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <form className="agent-address-modal" onSubmit={save}>
            <h3>{editing === "new" ? "Add Address" : "Edit Address"}</h3>
            {editing === "new" && (
              <label className="wide">
                Merchant
                <select
                  value={form.merchant}
                  onChange={(event) => update("merchant", event.target.value)}
                >
                  <option>Demo Merchant</option>
                </select>
              </label>
            )}
            <div className="agent-address-fields">
              <label>
                Label
                <input
                  value={form.label}
                  placeholder="Warehouse, Home..."
                  onChange={(event) => update("label", event.target.value)}
                />
              </label>
              <label>
                Recipient *
                <input
                  required
                  value={form.recipient}
                  onChange={(event) => update("recipient", event.target.value)}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>
              <label>
                Country
                <input
                  value={form.country}
                  onChange={(event) => update("country", event.target.value)}
                />
              </label>
              <label>
                State
                <input
                  value={form.state}
                  onChange={(event) => update("state", event.target.value)}
                />
              </label>
              <label>
                City
                <input
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                />
              </label>
              <label className="wide">
                Address line *
                <input
                  required
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </label>
              <label>
                Postal code
                <input
                  value={form.postal}
                  onChange={(event) => update("postal", event.target.value)}
                />
              </label>
              <label className="agent-default-check">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    update("isDefault", event.target.checked)
                  }
                />{" "}
                Default address
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function AgentShowcase() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    sellPrice: "",
    costPrice: "",
    category: "",
    image: "",
  });
  const [productError, setProductError] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const loadProducts = async () => {
    const { data, error } = await agentSupabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const initialLoad = async () => {
      const { data, error } = await agentSupabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (mounted && !error) setProducts(data || []);
      if (mounted) setLoading(false);
    };
    initialLoad();
    const channel = agentSupabase
      .channel("agent-global-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        loadProducts,
      )
      .subscribe();
    return () => {
      mounted = false;
      agentSupabase.removeChannel(channel);
    };
  }, []);

  const pickProductImageFile = (file) => {
    if (!file?.type?.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      setProductForm((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  };
  const uploadProductImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    pickProductImageFile(file);
  };
  const pasteProductImage = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      pickProductImageFile(file);
    }
  };
  (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      pickProductImageFile(file);
    }
  };
  const createProduct = async (event) => {
    event.preventDefault();
    const sellPrice = Number(productForm.sellPrice);
    if (!productForm.name.trim())
      return setProductError("Enter a product name.");
    if (!sellPrice || sellPrice <= 0)
      return setProductError("Enter a valid sell price.");
    setSavingProduct(true);
    setProductError("");
    const productCode = `CR${Date.now().toString().slice(-6)}`;
    const { error } = await agentSupabase.from("products").insert({
      product_code: productCode,
      sku: productForm.sku.trim() || `P${Date.now()}`,
      name: productForm.name.trim(),
      sell_price: sellPrice,
      cost_price: Number(productForm.costPrice || 0),
      category: productForm.category.trim() || "Other",
      image_url: productForm.image.trim() || null,
      admin_on_shelf: true,
    });
    setSavingProduct(false);
    if (error) return setProductError(error.message);
    setProductForm({
      name: "",
      sku: "",
      sellPrice: "",
      costPrice: "",
      category: "",
      image: "",
    });
    setCreating(false);
    await loadProducts();
  };

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.product_code, product.sku, product.name, product.category].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
      ),
    );
  }, [products, search]);

  return (
    <div className="agent-showcase-page">
      <header>
        <h2>Global Showcase</h2>
        <p>
          Products in the global showcase are managed by admin and visible to
          all sellers.
        </p>
      </header>
      <div className="agent-showcase-create-row">
        <button
          type="button"
          className="agent-showcase-create-btn"
          onClick={() => setCreating(true)}
        >
          ＋ Create Product
        </button>
      </div>
      {creating && (
        <div
          className="agent-product-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCreating(false)
          }
        >
          <form className="agent-product-modal" onSubmit={createProduct}>
            <header>
              <h3>＋ Create Product</h3>
              <button type="button" onClick={() => setCreating(false)}>
                ×
              </button>
            </header>
            {productError && (
              <p className="agent-product-error">{productError}</p>
            )}
            <label>
              Name *
              <input
                required
                value={productForm.name}
                onChange={(event) =>
                  setProductForm({ ...productForm, name: event.target.value })
                }
              />
            </label>
            <label>
              SKU
              <input
                placeholder="Auto-generated if left blank"
                value={productForm.sku}
                onChange={(event) =>
                  setProductForm({ ...productForm, sku: event.target.value })
                }
              />
            </label>
            <label>
              Sell Price *
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={productForm.sellPrice}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    sellPrice: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Cost Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.costPrice}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    costPrice: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Category
              <input
                placeholder="Other"
                value={productForm.category}
                onChange={(event) =>
                  setProductForm({
                    ...productForm,
                    category: event.target.value,
                  })
                }
              />
            </label>
            <label className="wide">
              Product Image
              <div className="buyer-image-editor" onPaste={pasteProductImage}>
                {productForm.image ? (
                  <img src={productForm.image} alt="Product preview" />
                ) : (
                  <span>Product photo</span>
                )}
                <div>
                  <label>
                    Upload or paste image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadProductImage}
                    />
                  </label>
                </div>
              </div>
            </label>
            <footer>
              <button
                type="button"
                className="agent-product-cancel"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="agent-product-submit"
                disabled={savingProduct}
              >
                {savingProduct ? "Saving…" : "Create Product"}
              </button>
            </footer>
          </form>
        </div>
      )}
      <div className="agent-showcase-tools">
        <label>
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span>
          {loading
            ? "Loading products…"
            : `${products.length} products in global showcase`}
        </span>
      </div>
      <section className="agent-showcase-grid">
        {visibleProducts.map((product) => {
          const sellPrice = Number(product.sell_price || 0);
          const costPrice = Number(product.cost_price || 0);
          return (
            <article key={product.id}>
              <div className="agent-showcase-image">
                <img
                  src={product.image_url}
                  alt={product.name || product.product_code}
                />
              </div>
              <div className="agent-showcase-details">
                <strong>{product.product_code}</strong>
                <code>{product.sku}</code>
                <b>${sellPrice.toFixed(2)}</b>
                <p>
                  Cost: ${costPrice.toFixed(2)}{" "}
                  <em>+${Math.max(0, sellPrice - costPrice).toFixed(2)}</em>
                </p>
                <small>{product.category || "Other"}</small>
                <span className={product.admin_on_shelf ? "on" : "off"}>
                  {product.admin_on_shelf ? "On Shelf" : "Off Shelf"}
                </span>
              </div>
            </article>
          );
        })}
        {!visibleProducts.length && (
          <div className="agent-showcase-empty">
            No products match your search.
          </div>
        )}
      </section>
    </div>
  );
}

const merchantRows = [
  {
    id: "DEMO0001",
    initial: "A",
    name: "Demo Merchant 1",
    email: "demo•••@example.com",
    balance: "Not connected",
    frozen: "Demo account",
    credit: 100,
    status: "Active",
    joined: "Aug 9, 2026",
  },
  {
    id: "DEMO0002",
    initial: "C",
    name: "Demo Merchant 2",
    email: "demo•••@example.com",
    balance: "Not connected",
    frozen: "Demo account",
    credit: 100,
    status: "Active",
    joined: "Aug 8, 2026",
  },
  {
    id: "DEMO0003",
    initial: "K",
    name: "Demo Merchant 3",
    email: "demo•••@example.com",
    balance: "Not connected",
    frozen: "Demo account",
    credit: 95,
    status: "Active",
    joined: "Jul 26, 2026",
  },
];

function AgentMerchantList() {
  const [merchants, setMerchants] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [recentMerchantId, setRecentMerchantId] = useState(null);
  const loadMerchants = async () => {
    setLoading(true);
    const [profileRes, transactions, lockRows, rechargeRows, withdrawalRows] =
      await Promise.all([
        agentSupabase
          .from("profiles")
          .select(
            "id,email,display_name,created_at,credit_score,allow_login,shop_locked,avatar_url,registration_status",
          )
          .eq("role", "seller")
          .order("created_at", { ascending: false }),
        fetchWalletTransactions(agentSupabase),
        fetchPagedRows(agentSupabase, "balance_locks"),
        fetchPagedRows(agentSupabase, "recharge_requests"),
        fetchPagedRows(agentSupabase, "withdrawals"),
      ]);
    if (profileRes.error) {
      const retry = await agentSupabase
        .from("profiles")
        .select(
          "id,email,display_name,created_at,credit_score,allow_login,shop_locked,avatar_url,registration_status",
        )
        .eq("role", "seller")
        .order("created_at", { ascending: false });
      if (!retry.error) profileRes.data = retry.data;
      profileRes.error = retry.error;
    }
    if (!profileRes.error) {
      const balances = walletTotalsBySeller(
        transactions,
        rechargeRows,
        withdrawalRows,
      );
      const frozen = (lockRows || [])
        .filter((row) => String(row.status).toLowerCase() === "active")
        .reduce((map, row) => {
          const id = rowSellerId(row);
          if (!id) return map;
          return map.set(id, (map.get(id) || 0) + parseMoney(row.amount));
        }, new Map());
      setMerchants(
        (profileRes.data || [])
          .filter(
            (profile) =>
              !profile.registration_status ||
              profile.registration_status === "Approved",
          )
          .map((profile) => {
            const id = String(profile.id);
            const total = balances.has(id) ? balances.get(id) : 0;
            return {
              userId: profile.id,
              id: profile.id.slice(0, 8).toUpperCase(),
              avatar: profile.avatar_url || "",
              initial: (profile.display_name ||
                profile.email ||
                "S")[0].toUpperCase(),
              name: profile.display_name || profile.email.split("@")[0],
              email: profile.email,
              balance: formatUsd(total),
              frozen: `${formatUsd(frozen.get(id) || 0)} frozen`,
              credit: profile.credit_score ?? 100,
              status: profile.allow_login === false ? "Suspended" : "Active",
              shopLocked: profile.shop_locked === true,
              joined: new Date(profile.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            };
          }),
      );
    }
    setLoading(false);
  };
  useEffect(() => {
    loadMerchants();
  }, []);
  const visible = merchants
    .filter(
      (merchant) =>
        (filter === "All" || merchant.status === filter) &&
        [merchant.name, merchant.email, merchant.id].some((value) =>
          value.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) =>
      a.userId === recentMerchantId
        ? -1
        : b.userId === recentMerchantId
          ? 1
          : 0,
    );
  const refreshChangedMerchant = () => {
    if (modal?.merchant?.userId) setRecentMerchantId(modal.merchant.userId);
    loadMerchants();
  };
  const actionsForMerchant = (merchant) => [
    "Balance",
    "Reset Pwd",
    merchant.status === "Suspended" ? "Unlock Account" : "Lock Account",
    "Login",
    "Logs",
    "Showcase",
    "Add Clicks",
    "Stop Clicks",
    merchant.shopLocked ? "Unlock Shop" : "Lock Shop",
    "Freeze",
    "Unfreeze",
    "Payment",
    "✎ Edit",
    "◉ Risk",
    "Order",
    "Click Logs",
  ];
  return (
    <div className="agent-merchant-page">
      <header>
        <div>
          <h2>Merchant List</h2>
          <p>
            Active merchants registered with your code <strong>P516326U</strong>
            . {visible.length} of {merchants.length} shown
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh merchant list"
          onClick={loadMerchants}
          disabled={loading}
        >
          {loading ? "…" : "↻"}
        </button>
      </header>
      <div className="agent-merchant-tools">
        <label>
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <nav>
          {["All", "Active", "Suspended"].map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <section className="agent-merchant-table">
        <div className="agent-merchant-head">
          <span>ID</span>
          <span>MERCHANT</span>
          <span>EMAIL</span>
          <span>BALANCE</span>
          <span>CREDIT</span>
          <span>STATUS</span>
          <span>JOINED</span>
          <span />
        </div>
        {visible.map((merchant) => (
          <article key={merchant.userId}>
            <code>{merchant.id}</code>
            <div className="agent-merchant-name">
              {merchant.avatar ? (
                <img
                  className="agent-merchant-avatar"
                  src={merchant.avatar}
                  alt=""
                />
              ) : (
                <b>{merchant.initial}</b>
              )}
              <strong>{merchant.name}</strong>
            </div>
            <span>{merchant.email}</span>
            <div className="agent-balance">
              <b>{merchant.balance}</b>
              <small
                className={merchant.frozen !== "$0.00 frozen" ? "locked" : ""}
              >
                {merchant.frozen !== "$0.00 frozen" ? "▣ " : ""}
                {merchant.frozen}
              </small>
            </div>
            <span>
              <em className="agent-credit">{merchant.credit}</em>
            </span>
            <span>
              <em className="agent-merchant-status">{merchant.status}</em>
            </span>
            <time>{merchant.joined}</time>
            <div className="agent-merchant-actions">
              {actionsForMerchant(merchant).map((action, index) => (
                <button
                  type="button"
                  className={`tone-${index % 8}`}
                  key={action}
                  onClick={() =>
                    setModal({
                      merchant,
                      action: normalizeMerchantAction(action),
                      kind: merchantActionKind(action),
                    })
                  }
                >
                  {action}
                </button>
              ))}
              <p>
                <button
                  type="button"
                  onClick={() =>
                    setModal({ merchant, action: "Order", kind: "activity" })
                  }
                >
                  Details ›
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModal({ merchant, action: "Manage", kind: "activity" })
                  }
                >
                  Manage ›
                </button>
              </p>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="agent-merchant-none">
            {loading ? "Loading sellers…" : "No merchants found."}
          </div>
        )}
      </section>
      {modal?.kind === "finance" && (
        <MerchantFinanceModals
          client={agentSupabase}
          merchant={modal.merchant}
          action={modal.action}
          actor="Agent"
          onClose={() => setModal(null)}
          onChanged={refreshChangedMerchant}
        />
      )}
      {modal?.kind === "control" && (
        <MerchantControlModals
          client={agentSupabase}
          merchant={modal.merchant}
          action={modal.action}
          onClose={() => setModal(null)}
          onChanged={refreshChangedMerchant}
        />
      )}
      {modal?.kind === "activity" && (
        <MerchantActivityModals
          client={agentSupabase}
          merchant={modal.merchant}
          action={modal.action}
          actor="Agent"
          onClose={() => setModal(null)}
          onChanged={refreshChangedMerchant}
          openAction={(action) =>
            setModal({
              merchant: modal.merchant,
              action: normalizeMerchantAction(action),
              kind: merchantActionKind(action),
            })
          }
        />
      )}
    </div>
  );
}

function AgentApplications() {
  const [tab, setTab] = useState("Pending");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const load = async () => {
    setLoading(true);
    setMessage("");
    const { data: auth } = await agentSupabase.auth.getUser();
    if (auth.user) {
      const { error: syncError } = await agentSupabase.rpc(
        "sync_agent_merchant_applications",
      );
      const [
        { data: rows, error: applicationsError },
        { data: profile, error: profileError },
      ] = await Promise.all([
        agentSupabase
          .from("merchant_applications")
          .select("*")
          .eq("agent_id", auth.user.id)
          .order("created_at", { ascending: false }),
        agentSupabase
          .from("profiles")
          .select("invitation_code,invitation_code_enabled")
          .eq("id", auth.user.id)
          .maybeSingle(),
      ]);
      setApplications(rows || []);
      if (profile?.invitation_code_enabled === false) setInviteCode("Disabled");
      else if (profile?.invitation_code) setInviteCode(profile.invitation_code);
      if (syncError || applicationsError || profileError)
        setMessage(
          syncError?.message ||
            applicationsError?.message ||
            profileError.message,
        );
    } else {
      setApplications([]);
      setMessage("Your agent session has expired. Please sign in again.");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    const channel = agentSupabase
      .channel("agent-registration-applications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_applications" },
        load,
      )
      .subscribe();
    return () => agentSupabase.removeChannel(channel);
  }, []);
  const decide = async (application, decision) => {
    setBusyId(application.id);
    setMessage("");
    const { error } = await agentSupabase.rpc("decide_merchant_application", {
      application_id_input: application.id,
      decision_input: decision,
    });
    setBusyId("");
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      decision === "Approved"
        ? "Merchant approved and added to Merchant List."
        : "Application denied.",
    );
    await load();
  };
  const visible = applications.filter((item) => item.status === tab);
  return (
    <div className="agent-applications-page">
      <header>
        <h2>Applications</h2>
        <p>
          Registration applications submitted with your invitation code{" "}
          <strong>{inviteCode}</strong>. Sellers cannot log in until you approve
          them.
        </p>
      </header>
      <nav>
        <button
          type="button"
          className={tab === "Pending" ? "active" : ""}
          onClick={() => setTab("Pending")}
        >
          Pending (
          {applications.filter((item) => item.status === "Pending").length})
        </button>
        <button
          type="button"
          className={tab === "Rejected" ? "active" : ""}
          onClick={() => setTab("Rejected")}
        >
          Rejected (
          {applications.filter((item) => item.status === "Rejected").length})
        </button>
      </nav>
      {message && <p className="agent-application-message">{message}</p>}
      <section className="agent-application-list">
        {visible.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>
                {item.email} · {item.phone || "No phone"}
              </span>
              <small>{item.address}</small>
              <time>{new Date(item.created_at).toLocaleString()}</time>
            </div>
            <em className={item.status.toLowerCase()}>{item.status}</em>
            {item.status === "Pending" && (
              <span>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => decide(item, "Approved")}
                >
                  ✓ Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => decide(item, "Rejected")}
                >
                  × Deny
                </button>
              </span>
            )}
          </article>
        ))}
        {!visible.length && (
          <div className="agent-applications-empty">
            <div>▱</div>
            <p>
              {loading
                ? "Loading applications…"
                : `No ${tab.toLowerCase()} applications.`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function AgentUnregistered() {
  const [search, setSearch] = useState("");
  return (
    <div className="agent-unregistered-page">
      <header>
        <h2>Unregistered Sellers</h2>
        <p>
          Accounts that signed up with your code but have not completed
          registration, plus rejected applications.
        </p>
      </header>
      <label className="agent-unregistered-search">
        <span>⌕</span>
        <input
          type="search"
          aria-label="Search unregistered sellers"
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <section className="agent-unregistered-empty">
        {search ? (
          <>No unregistered sellers matching “{search}”.</>
        ) : (
          <>No unregistered sellers.</>
        )}
      </section>
    </div>
  );
}

function AgentTeam({ agentProfile, inviteCode }) {
  const summaries = [
    ["⌂", "ASSIGNED MERCHANTS", "3"],
    ["♧", "ACTIVE MERCHANTS", "3"],
    ["⊙", "COMMISSION RATE", "5.0%"],
    ["⊙", "TOTAL COMMISSION", "$0.00"],
  ];
  return (
    <div className="agent-team-page">
      <header className="agent-team-heading">
        <h2>Agents</h2>
        <p>Your agent profile and team overview.</p>
      </header>
      <section className="agent-team-summaries">
        {summaries.map(([icon, label, value]) => (
          <article key={label}>
            <i>{icon}</i>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </section>
      <section className="agent-roster-section">
        <h3>TEAM ROSTER</h3>
        <div className="agent-roster-table">
          <div className="agent-roster-head">
            <span>AGENT</span>
            <span>AGENT NO</span>
            <span>INVITE CODE</span>
            <span>EMAIL</span>
            <span>ROLE</span>
            <span>MERCHANTS</span>
            <span>COMMISSION RATE</span>
          </div>
          <div className="agent-roster-row">
            <span className="agent-roster-name">
              <b>{(agentProfile?.display_name || "Agent").charAt(0).toUpperCase()}</b>
              <strong>{agentProfile?.display_name || "Agent"}</strong>
            </span>
            <code>{agentProfile?.id ? `AGT${agentProfile.id.slice(0, 8).toUpperCase()}` : "—"}</code>
            <code>{inviteCode || "—"}</code>
            <span>✉ {agentProfile?.email || "—"}</span>
            <span>
              <em>Lead agent</em>
            </span>
            <strong>3</strong>
            <strong>5.0%</strong>
          </div>
        </div>
        <p>Sub-agent invitations are managed by the platform admin.</p>
      </section>
      <section className="agent-commissions">
        <h3>RECENT COMMISSIONS</h3>
        <div>No commissions yet.</div>
      </section>
    </div>
  );
}

function AgentDashboard({ inviteCode, inviteLink, inviteCodeEnabled, copy, copied, agentName }) {
  return (
    <div className="agent-dashboard">
      <div className="agent-welcome">
        <h2>Welcome back, {agentName}</h2>
        <p>Here’s an overview of your seller network.</p>
      </div>
      <section className="agent-invite-grid">
        <article className="code-card">
          <small>MY INVITATION CODE</small>
          <strong>{inviteCodeEnabled ? (inviteCode || "Not assigned") : "Disabled"}</strong>
          <button type="button" disabled={!inviteCodeEnabled || !inviteCode} onClick={() => copy(inviteCode, "code")}>
            ▢ {copied === "code" ? "Copied" : "Copy Code"}
          </button>
        </article>
        <article className="link-card">
          <small>SELLER INVITE LINK</small>
          <code>{inviteLink}</code>
          <button type="button" disabled={!inviteCodeEnabled} onClick={() => copy(inviteLink, "link")}>
            ▢ {copied === "link" ? "Copied" : "Copy Link"}
          </button>
        </article>
        <article className="qr-card">
          <small>INVITE QR CODE</small>
          <div className="fake-qr" aria-label="Invitation QR code preview" />
          <button type="button" disabled={!inviteCodeEnabled} onClick={() => copy(inviteLink, "qr")}>
            ▢ {copied === "qr" ? "Copied" : "Copy QR Link"}
          </button>
          <p>Sellers can register with your code</p>
        </article>
      </section>
      <section className="agent-stat-grid">
        {stats.map(([icon, value, label, tone]) => (
          <article key={label}>
            <i className={tone}>{icon}</i>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <section className="agent-dashboard-lower">
        <article className="agent-orders-chart">
          <h3>Orders — Last 14 Days</h3>
          <div className="agent-chart-lines">
            {Array.from({ length: 13 }, (_, index) => (
              <i key={index} style={{ height: `${index % 2 ? 8 : 18}px` }} />
            ))}
          </div>
          <div className="agent-chart-labels">
            {[
              "Aug 10",
              "Aug 12",
              "Aug 14",
              "Aug 16",
              "Aug 18",
              "Aug 20",
              "Aug 22",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
        <article className="agent-notifications">
          <h3>♧ Notifications</h3>
          {notifications.map(([title, message, date], index) => (
            <div key={`${title}-${index}`}>
              <button type="button" aria-label="Dismiss notification">
                ×
              </button>
              <strong>{title}</strong>
              <p>{message}</p>
              <time>{date}</time>
            </div>
          ))}
        </article>
      </section>
      <section className="agent-recent">
        <h3>Recent Seller Activity</h3>
        <div className="agent-recent-head">
          <span>SELLER</span>
          <span>STATUS</span>
          <span>JOINED</span>
        </div>
        {[
          ["agent1111", "Aug 9, 2026"],
          ["chaudhary", "Aug 8, 2026"],
          ["Khan321", "Jul 26, 2026"],
        ].map(([name, date]) => (
          <div key={name}>
            <strong>{name}</strong>
            <b>active</b>
            <time>{date}</time>
          </div>
        ))}
      </section>
    </div>
  );
}
