import React, { useEffect, useMemo, useState } from "react";
import "./CreditLogs.css";
import { adminSupabase } from "../shared/supabase";
import { parseMoney } from "../shared/wallet";

const filters = [
  "All",
  "Credit",
  "Debit",
  "Lock",
  "Unlock",
  "Fee",
  "Bonus",
  "Admin",
];

const classifyTxn = (row) => {
  const t = String(row.type || "").toLowerCase();
  if (t.includes("bonus")) return "Bonus";
  if (t.includes("fee")) return "Fee";
  if (t.includes("admin")) return "Admin";
  if (t.includes("debit") || parseMoney(row.amount) < 0) return "Debit";
  return "Credit";
};

export default function CreditLogs() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState({ credited: 0, debited: 0, locked: 0 });

  const load = async () => {
    const [profilesRes, txnRes, lockRes] = await Promise.all([
      adminSupabase.from("profiles").select("id,display_name,email"),
      adminSupabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: true }),
      adminSupabase
        .from("balance_locks")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    const nameById = new Map(
      (profilesRes.data || []).map((p) => [
        p.id,
        p.display_name || p.email || "Merchant",
      ]),
    );

    const runningBySeller = new Map();
    let totalCredited = 0;
    let totalDebited = 0;

    const txnRows = (txnRes.data || []).map((row) => {
      const sellerId = row.seller_id;
      const before = runningBySeller.get(sellerId) || 0;
      const amount = parseMoney(row.amount);
      const after = before + amount;
      runningBySeller.set(sellerId, after);
      if (amount >= 0) totalCredited += amount;
      else totalDebited += Math.abs(amount);
      return {
        id: `txn-${row.id}`,
        time: row.created_at,
        merchant: nameById.get(sellerId) || "Merchant",
        type: classifyTxn(row),
        amount,
        before,
        after,
        note: row.note || row.type || "—",
      };
    });

    const lockEvents = [];
    let totalLocked = 0;
    (lockRes.data || []).forEach((row) => {
      const merchant = nameById.get(row.seller_id) || "Merchant";
      const amount = parseMoney(row.amount);
      if (row.status === "Active") totalLocked += amount;
      lockEvents.push({
        id: `lock-${row.id}`,
        time: row.created_at,
        merchant,
        type: "Lock",
        amount,
        before: "—",
        after: "—",
        note: row.reason || "—",
      });
      if (row.released_at) {
        lockEvents.push({
          id: `unlock-${row.id}`,
          time: row.released_at,
          merchant,
          type: "Unlock",
          amount,
          before: "—",
          after: "—",
          note: row.reason || "—",
        });
      }
    });

    const combined = [...txnRows, ...lockEvents].sort(
      (a, b) => new Date(b.time) - new Date(a.time),
    );

    setLogs(combined);
    setTotals({
      credited: totalCredited,
      debited: totalDebited,
      locked: totalLocked,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = adminSupabase
      .channel("admin-credit-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balance_locks" },
        load,
      )
      .subscribe();
    return () => adminSupabase.removeChannel(channel);
  }, []);

  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesType = activeFilter === "All" || log.type === activeFilter;
      const matchesSearch = !term || log.merchant.toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
  }, [logs, search, activeFilter]);

  const refreshLogs = () => {
    setRefreshing(true);
    load().finally(() => window.setTimeout(() => setRefreshing(false), 400));
  };

  const fmt = (value) =>
    typeof value === "number" ? `$${value.toFixed(2)}` : value;

  return (
    <section className="credit-logs-page">
      <header className="credit-logs-heading">
        <div>
          <h2>Credit Logs</h2>
          <p>Full financial ledger of all balance movements.</p>
        </div>
        <button
          type="button"
          className={
            refreshing ? "credit-refresh refreshing" : "credit-refresh"
          }
          onClick={refreshLogs}
          aria-label="Refresh credit logs"
        >
          ↻
        </button>
      </header>

      <div className="credit-summary">
        <div>
          <span>Total Credited</span>
          <strong className="credited">${totals.credited.toFixed(2)}</strong>
        </div>
        <div>
          <span>Total Debited</span>
          <strong className="debited">${totals.debited.toFixed(2)}</strong>
        </div>
        <div>
          <span>Total Locked</span>
          <strong className="locked">${totals.locked.toFixed(2)}</strong>
        </div>
      </div>

      <div className="credit-toolbar">
        <label className="credit-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search by merchant..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="credit-filter-icon" aria-hidden="true">
          ▽
        </span>
        <div className="credit-filter-tabs">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter}
              className={activeFilter === filter ? "active" : ""}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="credit-table-wrap">
        <table className="credit-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>MERCHANT</th>
              <th>TYPE</th>
              <th>AMOUNT</th>
              <th>BEFORE</th>
              <th>AFTER</th>
              <th>NOTE</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.time).toLocaleString()}</td>
                <td>{log.merchant}</td>
                <td>{log.type}</td>
                <td className={log.amount < 0 ? "debited" : "credited"}>
                  {log.amount < 0 ? "-" : "+"}${Math.abs(log.amount).toFixed(2)}
                </td>
                <td>{fmt(log.before)}</td>
                <td>{fmt(log.after)}</td>
                <td>{log.note}</td>
              </tr>
            ))}
            {!loading && visibleLogs.length === 0 && (
              <tr>
                <td className="credit-empty" colSpan="7">
                  No credit logs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
