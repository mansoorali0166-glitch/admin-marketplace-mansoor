import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AllOrders.css";
import { adminSupabase } from "../shared/supabase";

const statusOptions = [
  { value: "Pending Payment", label: "Pending Pay" },
  { value: "Paid", label: "Paid" },
  { value: "Pending Ship", label: "Pending Ship" },
  { value: "Pending Receive", label: "Pending Receive" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Refund", label: "Refund" },
];

const filterTabs = ["All", ...statusOptions.map(({ label }) => label)];
const statusAliases = {
  "pending pay": "Pending Payment", "pending payment": "Pending Payment",
  paid: "Paid", "pending ship": "Pending Ship", "pending receive": "Pending Receive",
  completed: "Completed", rejected: "Rejected", cancelled: "Cancelled",
  canceled: "Cancelled", refund: "Refund", refunded: "Refund",
};
const normalizeStatus = (status) => statusAliases[String(status || "").trim().toLowerCase()] || "Pending Payment";
const filterStatus = (filter) => filter === "All" ? "All" : normalizeStatus(filter);

const mapOrder = (row, profileMap) => {
  const quantity = Number(row.quantity || 1);
  const sellPrice = Number(row.sell_price ?? row.price ?? row.amount ?? 0);
  const costPrice = Number(row.cost_price ?? 0);
  const seller = profileMap.get(row.seller_id);
  return {
    dbId: row.id,
    id: String(row.order_no || row.order_number || row.id),
    seller: seller?.display_name || seller?.email || row.seller_name || row.customer_name || "Seller",
    product: row.product_name || row.product || "Product",
    price: `$ ${(sellPrice * quantity).toFixed(2)}`,
    profit: `$ ${((sellPrice - costPrice) * quantity).toFixed(2)}`,
    status: normalizeStatus(row.status),
    date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
  };
};

export default function AllOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!adminSupabase) {
      setMessage("Supabase is not configured. Add the database environment variables and redeploy.");
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setMessage("");
    const directResult = await adminSupabase.from("orders").select("*").order("created_at", { ascending: false });
    let rawOrders = directResult.data || [];
    let ordersError = directResult.error;

    // Some existing deployments have an older orders RLS policy that returns
    // an empty set to admins. The protected RPC verifies the admin role and
    // reads the complete table without exposing it to sellers or agents.
    if (ordersError || rawOrders.length === 0) {
      const rpcResult = await adminSupabase.rpc("admin_list_orders");
      if (!rpcResult.error) {
        rawOrders = rpcResult.data || [];
        ordersError = null;
      }
    }

    if (ordersError) {
      setOrders([]);
      setMessage(`Could not load orders: ${ordersError.message}`);
      setLoading(false);
      return;
    }
    const sellerIds = [...new Set((rawOrders || []).map((row) => row.seller_id).filter(Boolean))];
    const profileMap = new Map();
    if (sellerIds.length) {
      const { data: profiles, error: profilesError } = await adminSupabase.from("profiles").select("id,display_name,email").in("id", sellerIds);
      if (!profilesError) (profiles || []).forEach((profile) => profileMap.set(profile.id, profile));
    }
    setOrders((rawOrders || []).map((row) => mapOrder(row, profileMap)));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
    if (!adminSupabase) return undefined;
    const channel = adminSupabase.channel("admin-all-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders({ quiet: true })).subscribe();
    return () => adminSupabase.removeChannel(channel);
  }, [loadOrders]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const selectedStatus = filterStatus(activeFilter);
    return orders.filter((order) => {
      const matchesFilter = selectedStatus === "All" || order.status === selectedStatus;
      const matchesSearch = !term || [order.id, order.seller, order.product].some((value) => String(value).toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [orders, search, activeFilter]);

  const updateStatus = async (order, status) => {
    const previousStatus = order.status;
    setMessage("");
    setUpdatingId(order.dbId);
    setOrders((current) => current.map((item) => item.dbId === order.dbId ? { ...item, status } : item));
    const directUpdate = await adminSupabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", order.dbId).select("id").maybeSingle();
    let error = directUpdate.error;
    if (error || !directUpdate.data) {
      const rpcResult = await adminSupabase.rpc("admin_update_order_status", { order_id: order.dbId, new_status: status });
      error = rpcResult.error;
    }
    if (error) {
      setOrders((current) => current.map((item) => item.dbId === order.dbId ? { ...item, status: previousStatus } : item));
      setMessage(`Could not update order ${order.id}: ${error.message}`);
    }
    setUpdatingId(null);
  };

  return <section className="all-orders-page">
    <header className="orders-heading"><h2>Order Management</h2><p>View and manage all orders. Changing status updates the database directly.</p></header>
    <label className="orders-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search order no. or seller..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search orders" /></label>
    <div className="order-filter-tabs" aria-label="Filter orders by status">{filterTabs.map((filter) => <button type="button" key={filter} className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div>
    {message && <p className="orders-message" role="alert">{message}</p>}
    <div className="orders-table-wrap"><table className="orders-table">
      <thead><tr><th>ORDER NO.</th><th>SELLER</th><th>PRODUCT</th><th>SELL PRICE</th><th>PROFIT</th><th>STATUS</th><th>DATE</th></tr></thead>
      <tbody>{loading ? <tr><td className="orders-empty" colSpan="7">Loading orders from database...</td></tr> : visibleOrders.length === 0 ? <tr><td className="orders-empty" colSpan="7">No orders found.</td></tr> : visibleOrders.map((order) => <tr key={order.dbId}>
        <td className="order-number">{order.id}</td><td className="order-seller">{order.seller}</td><td>{order.product}</td><td className="order-price">{order.price}</td><td className="order-profit">{order.profit}</td>
        <td><select className={`order-status status-${order.status.toLowerCase().replaceAll(" ", "-")}`} value={order.status} disabled={updatingId === order.dbId} onChange={(event) => updateStatus(order, event.target.value)} aria-label={`Status for order ${order.id}`}>{statusOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></td>
        <td className="order-date">{order.date}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
