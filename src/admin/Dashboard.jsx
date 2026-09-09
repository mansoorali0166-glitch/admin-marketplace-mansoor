import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { adminSupabase } from '../shared/supabase';

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
const last30Days = () => {
  const days = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
};

const buildPath = (values, max, height = 225) => {
  if (!values.length) return `M0 ${height} L1200 ${height}`;
  const step = 1200 / (values.length - 1 || 1);
  const scaled = values.map((v, i) => {
    const x = i * step;
    const y = max > 0 ? height - (v / max) * height : height;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${scaled.join(' L')}`;
};

export default function Dashboard({ onOpenMerchants }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSellers: 0,
    activeSellers: 0,
    suspendedSellers: 0,
    pendingApplications: 0,
    rejectedApplications: 0,
    totalRecharge: 0,
    todayRecharge: 0,
    totalWithdraw: 0,
    todayWithdraw: 0,
    pendingWithdraw: 0,
    pendingRecharge: 0,
    pendingFeedback: 0,
    todayRegisters: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [trend, setTrend] = useState({
    days: [],
    registers: [],
    recharge: [],
    withdraw: [],
    leftMax: 8,
    rightMax: 100,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const todayKey = dayKey(new Date());
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        profilesRes,
        rechargeRes,
        withdrawalsRes,
        feedbackRes,
      ] = await Promise.all([
        adminSupabase
          .from('profiles')
          .select('id,email,display_name,agent_id,allow_login,created_at')
          .eq('role', 'seller')
          .order('created_at', { ascending: false }),
        adminSupabase
          .from('recharge_requests')
          .select('amount,status,created_at,reviewed_at'),
        adminSupabase
          .from('withdrawals')
          .select('amount,status,created_at,updated_at'),
        adminSupabase
          .from('feedback_tickets')
          .select('id,status'),
      ]);

      const sellers = profilesRes.data || [];
      const recharges = rechargeRes.data || [];
      const withdrawals = withdrawalsRes.data || [];
      const feedback = feedbackRes.data || [];

      const approvedRecharges = recharges.filter((r) => r.status === 'Approved');
      const approvedWithdrawals = withdrawals.filter((w) => w.status === 'Approved');

      const totalRecharge = approvedRecharges.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const totalWithdraw = approvedWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const todayRecharge = approvedRecharges
        .filter((r) => dayKey(r.reviewed_at || r.created_at) === todayKey)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const todayWithdraw = approvedWithdrawals
        .filter((w) => dayKey(w.updated_at || w.created_at) === todayKey)
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const todayRegisters = sellers.filter((s) => dayKey(s.created_at) === todayKey).length;

      // Agent name lookup (manual join to avoid relying on FK constraint names)
      const agentIds = [...new Set(sellers.map((s) => s.agent_id).filter(Boolean))];
      let agentById = {};
      if (agentIds.length) {
        const { data: agentRows } = await adminSupabase
          .from('profiles')
          .select('id,display_name,email')
          .in('id', agentIds);
        agentById = Object.fromEntries((agentRows || []).map((a) => [a.id, a.display_name || a.email]));
      }

      setStats({
        totalSellers: sellers.length,
        activeSellers: sellers.filter((s) => s.allow_login !== false).length,
        suspendedSellers: sellers.filter((s) => s.allow_login === false).length,
        pendingApplications: 0, // no application-status column found in schema yet
        rejectedApplications: 0, // same as above
        totalRecharge,
        todayRecharge,
        totalWithdraw,
        todayWithdraw,
        pendingWithdraw: withdrawals.filter((w) => w.status === 'Pending').length,
        pendingRecharge: recharges.filter((r) => r.status === 'Pending').length,
        pendingFeedback: feedback.filter((f) => f.status === 'Open').length,
        todayRegisters,
      });

      setRecentUsers(
        sellers.slice(0, 10).map((s) => ({
          id: s.id.slice(0, 8).toUpperCase(),
          store: s.display_name || s.email.split('@')[0],
          email: s.email,
          agent: agentById[s.agent_id] || '—',
          registerTime: new Date(s.created_at).toLocaleString('en-US', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
          }),
        })),
      );

      // 30-day trend
      const days = last30Days();
      const registersByDay = days.map(
        (day) => sellers.filter((s) => dayKey(s.created_at) === day).length,
      );
      const rechargeByDay = days.map((day) =>
        approvedRecharges
          .filter((r) => dayKey(r.reviewed_at || r.created_at) === day)
          .reduce((sum, r) => sum + Number(r.amount || 0), 0),
      );
      const withdrawByDay = days.map((day) =>
        approvedWithdrawals
          .filter((w) => dayKey(w.updated_at || w.created_at) === day)
          .reduce((sum, w) => sum + Number(w.amount || 0), 0),
      );
      const leftMax = Math.max(...registersByDay, 1);
      const rightMax = Math.max(...rechargeByDay, ...withdrawByDay, 1);

      setTrend({ days, registers: registersByDay, recharge: rechargeByDay, withdraw: withdrawByDay, leftMax, rightMax });
      setLoading(false);
    };
    load();

    const channel = adminSupabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recharge_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_tickets' }, load)
      .subscribe();
    return () => adminSupabase.removeChannel(channel);
  }, []);

  const xAxisLabels = trend.days.length
    ? [0, 4, 8, 12, 16, 20, 24, 29].map((i) => trend.days[Math.min(i, trend.days.length - 1)]?.slice(5))
    : [];
  const leftAxisLabels = [trend.leftMax, trend.leftMax * 0.75, trend.leftMax * 0.5, trend.leftMax * 0.25, 0].map((v) => Math.round(v));
  const rightAxisLabels = [trend.rightMax, trend.rightMax * 0.75, trend.rightMax * 0.5, trend.rightMax * 0.25, 0].map((v) => Math.round(v));

  return (
    <div className="dashboard-page">
      <div className="dashboard-top-tabs">
        <div className="dashboard-top-left">
          <button className="dashboard-tab-button active">Dashboard</button>
          <button className="dashboard-tab-button" onClick={onOpenMerchants}>Merchant List</button>
        </div>
        <button className="refresh-button" onClick={() => window.location.reload()}>↻</button>
      </div>

      <section className="dashboard-panel">
        <h2 className="dashboard-section-title">Seller Performance</h2>
        <div className="performance-cards">
          <div className="performance-card">
            <span className="small-label">Total Sellers</span>
            <strong className="performance-value">{stats.totalSellers}</strong>
            <span className="today-text">Today: <b>{stats.todayRegisters}</b></span>
          </div>
          <div className="performance-card">
            <span className="small-label">Total Recharge</span>
            <strong className="performance-value">{stats.totalRecharge.toFixed(2)}</strong>
            <span className="today-text">Today: {stats.todayRecharge.toFixed(2)}</span>
          </div>
        </div>
        <div className="sub-agent-section">
          <h3>Sub Agents</h3>
          <div className="empty-sub-agents">
            <div className="empty-user-icon">♙♙</div>
            <span>No sub agents</span>
          </div>
        </div>
      </section>

      <div className="seller-stat-grid">
        <div className="small-stat-card"><span className="stat-label">TOTAL SELLERS</span><strong>{stats.totalSellers}</strong></div>
        <div className="small-stat-card"><span className="stat-label">PENDING APPLICATIONS</span><strong className="blue-number">{stats.pendingApplications}</strong></div>
        <div className="small-stat-card"><span className="stat-label">APPROVED SELLERS</span><strong className="green-number">{stats.activeSellers}</strong></div>
        <div className="small-stat-card"><span className="stat-label">REJECTED</span><strong className="red-number">{stats.rejectedApplications}</strong></div>
      </div>

      <div className="finance-stat-grid">
        <div className="finance-stat-card">
          <span className="stat-label">TOTAL USERS</span>
          <strong className="blue-number">{stats.totalSellers}</strong>
          <span className="today-text">Today: {stats.todayRegisters}</span>
        </div>
        <div className="finance-stat-card">
          <span className="stat-label">RECHARGE USD</span>
          <strong className="green-number">{stats.totalRecharge.toFixed(2)}</strong>
          <span className="today-text">Today: {stats.todayRecharge.toFixed(2)}</span>
        </div>
        <div className="finance-stat-card">
          <span className="stat-label">WITHDRAW USD</span>
          <strong className="orange-number">{stats.totalWithdraw.toFixed(2)}</strong>
          <span className="today-text">Today: {stats.todayWithdraw.toFixed(2)}</span>
        </div>
      </div>

      <div className="pending-withdraw-card">
        <span className="stat-label">PENDING WITHDRAW</span>
        <strong>{stats.pendingWithdraw}</strong>
      </div>

      <section className="dashboard-panel trend-panel">
        <h2 className="dashboard-section-title">30-Day Trend</h2>
        <div className="trend-chart-wrapper">
          <div className="trend-left-axis">
            {leftAxisLabels.map((v, i) => <span key={i}>{v}</span>)}
          </div>
          <div className="trend-chart">
            <div className="trend-horizontal-line trend-h1"></div>
            <div className="trend-horizontal-line trend-h2"></div>
            <div className="trend-horizontal-line trend-h3"></div>
            <div className="trend-horizontal-line trend-h4"></div>
            <div className="trend-horizontal-line trend-h5"></div>
            <div className="trend-vertical-line trend-v1"></div>
            <div className="trend-vertical-line trend-v2"></div>
            <div className="trend-vertical-line trend-v3"></div>
            <div className="trend-vertical-line trend-v4"></div>
            <div className="trend-vertical-line trend-v5"></div>
            <div className="trend-vertical-line trend-v6"></div>
            <div className="trend-vertical-line trend-v7"></div>
            <svg viewBox="0 0 1200 230" preserveAspectRatio="none" className="dashboard-trend-svg">
              <path d={buildPath(trend.registers, trend.leftMax)} className="register-curve" fill="none" />
              <path d={buildPath(trend.recharge, trend.rightMax)} className="recharge-curve" fill="none" />
              <path d={buildPath(trend.withdraw, trend.rightMax)} className="withdraw-curve" fill="none" />
            </svg>
            <div className="trend-x-axis">
              {xAxisLabels.map((label, i) => <span key={i}>{label}</span>)}
            </div>
          </div>
          <div className="trend-right-axis">
            {rightAxisLabels.map((v, i) => <span key={i}>{v}</span>)}
          </div>
        </div>
        <div className="trend-legend">
          <span className="legend-item recharge"><i></i>Recharges</span>
          <span className="legend-item register"><i></i>Registers</span>
          <span className="legend-item withdraw"><i></i>Withdrawals</span>
        </div>
      </section>

      <section className="dashboard-panel">
        <h2 className="dashboard-section-title">Pending Review</h2>
        <div className="pending-review-grid">
          <div className="pending-review-card"><strong className="orange-number">0</strong><span>Pending KYC</span></div>
          <div className="pending-review-card"><strong className="blue-number">{stats.pendingRecharge}</strong><span>Pending Recharge</span></div>
          <div className="pending-review-card"><strong className="red-number">{stats.pendingWithdraw}</strong><span>Pending Withdraw</span></div>
          <div className="pending-review-card"><strong className="purple-number">{stats.pendingFeedback}</strong><span>Pending Feedback</span></div>
        </div>
      </section>

      <section className="dashboard-panel recent-users-panel">
        <h2 className="dashboard-section-title">Recent Users</h2>
        <div className="recent-users-scroll">
          <table className="recent-users-table">
            <thead>
              <tr><th>ID</th><th>STORE NAME</th><th>EMAIL</th><th>AGENT</th><th>REGISTER TIME</th></tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td className="store-name">{user.store}</td>
                  <td>{user.email}</td>
                  <td>{user.agent}</td>
                  <td>{user.registerTime}</td>
                </tr>
              ))}
              {!loading && !recentUsers.length && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No sellers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}