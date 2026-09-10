import React, { useEffect, useMemo, useState } from "react";
import "./AllOrders.css";
import { adminSupabase } from "../shared/supabase";

const statusOptions = [
  "Pending Payment",
  "Paid",
  "Pending Ship",
  "Pending Receive",
  "Completed",
  "Rejected",
  "Cancelled",
  "Refund",
];

const filterTabs = [
  "All",
  "Pending Pay",
  "Paid",
  "Pending Ship",
  "Pending Receive",
  "Completed",
  "Rejected",
  "Cancelled",
  "Refund",
];

const statusForFilter = (filter) =>
  filter === "Pending Pay" ? "Pending Payment" : filter;

export default function AllOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Load orders using the exact foreign key constraint and math as the Agent Portal
  const loadOrders = async () => {
    setLoading(true);
    try {
      // 1. Fetch orders joining profiles via orders_seller_id_profiles_fkey
      let { data, error } = await adminSupabase
        .from("orders")
        .select(
          "*,seller:profiles!orders_seller_id_profiles_fkey(display_name,email)",
        )
        .order("created_at", { ascending: false });

      // Fallback in case constraint alias differs
      if (error) {
        const fallback = await adminSupabase
          .from("orders")
          .select("*,seller:profiles(display_name,email)")
          .order("created_at", { ascending: false });
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      // Final fallback: manual profile map lookup if join returns null
      if (error || !data) {
        const { data: rawOrders } = await adminSupabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id,display_name,email");

        const profileMap = new Map();
        (profiles || []).forEach((p) => {
          profileMap.set(p.id, p.display_name || p.email);
        });

        data = (rawOrders || []).map((row) => ({
          ...row,
          seller: {
            display_name: profileMap.get(row.seller_id),
            email: "",
          },
        }));
      }

      // 2. Map row fields identical to Agent Portal hook
      setOrders(
        (data || []).map((row) => {
          const qty = Number(row.quantity || 1);
          const sellPrice = Number(row.sell_price || 0);
          const costPrice = Number(row.cost_price || 0);

          const sale = sellPrice * qty;
          const profit = (sellPrice - costPrice) * qty;

          const sellerName =
            row.seller?.display_name ||
            row.seller?.email ||
            row.seller_name ||
            "Seller";

          return {
            dbId: row.id,
            id: row.order_no || row.id,
            seller: sellerName,
            product: row.product_name || "Product",
            price: `$ ${sale.toFixed(2)}`,
            profit: `$ ${profit.toFixed(2)}`,
            status: row.status || "Pending Payment",
            date: row.created_at
              ? new Date(row.created_at).toLocaleString()
              : "—",
          };
        }),
      );
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Filter orders by search term and active status tab
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter =
        activeFilter === "All" ||
        order.status === statusForFilter(activeFilter);
      const matchesSearch =
        !term ||
        [order.id, order.seller, order.product].some((value) =>
          value.toLowerCase().includes(term),
        );
      return matchesFilter && matchesSearch;
    });
  }, [orders, search, activeFilter]);

  // Update order status directly in Supabase
  const updateStatus = async (id, status) => {
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order)),
    );

    const order = orders.find((item) => item.id === id);
    if (!order?.dbId) return;

    try {
      const { error } = await adminSupabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", order.dbId);

      if (error) {
        console.error("Failed to update order status in Supabase:", error);
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  return (
    <section className="all-orders-page">
      <header className="orders-heading">
        <h2>Order Management</h2>
        <p>
          View and manage all orders. Changing status updates the database
          directly.
        </p>
      </header>

      <label className="orders-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search order no. or seller..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search orders"
        />
      </label>

      <div className="order-filter-tabs" aria-label="Filter orders by status">
        {filterTabs.map((filter) => (
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

      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>ORDER NO.</th>
              <th>SELLER</th>
              <th>PRODUCT</th>
              <th>SELL PRICE</th>
              <th>PROFIT</th>
              <th>STATUS</th>
              <th>DATE</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="orders-empty" colSpan="7">
                  Loading orders from database...
                </td>
              </tr>
            ) : visibleOrders.length === 0 ? (
              <tr>
                <td className="orders-empty" colSpan="7">
                  No orders found.
                </td>
              </tr>
            ) : (
              visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td className="order-number">{order.id}</td>
                  <td className="order-seller">{order.seller}</td>
                  <td>{order.product}</td>
                  <td className="order-price">{order.price}</td>
                  <td className="order-profit">{order.profit}</td>
                  <td>
                    <select
                      className={`order-status status-${order.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                      value={order.status}
                      onChange={(event) =>
                        updateStatus(order.id, event.target.value)
                      }
                      aria-label={`Status for order ${order.id}`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="order-date">{order.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
