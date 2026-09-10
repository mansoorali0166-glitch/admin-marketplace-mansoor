import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './Withdrawals.css';
import { adminSupabase } from '../shared/supabase';

const filters = ['All', 'Pending', 'Approved', 'Rejected'];

export default function Withdrawals() {
  const [requests, setRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const loadRequests = useCallback(async () => {
    const { data, error } = await adminSupabase.from('withdrawals').select('*,profiles(display_name,email)').order('created_at',{ascending:false});
    if (!error) setRequests((data || []).map((item)=>({id:item.id,seller:item.profiles?.display_name||'Seller',email:item.profiles?.email||'',amount:Number(item.amount),method:item.method,account:item.account_details,date:new Date(item.created_at).toLocaleString(),status:item.status,reason:item.rejection_reason})));
  }, []);

  useEffect(() => {
    loadRequests();
    const channel = adminSupabase.channel('admin-live-withdrawals').on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, loadRequests).subscribe();
    const refreshOnFocus = () => loadRequests();
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      adminSupabase.removeChannel(channel);
    };
  }, [loadRequests]);

  const visibleRequests = useMemo(() => activeFilter === 'All' ? requests : requests.filter((request) => request.status === activeFilter), [activeFilter, requests]);

  return (
    <section className="withdrawals-page">
      <header className="withdrawals-heading"><h2>Withdrawal Requests</h2><p>Review and approve or reject seller withdrawal requests.</p></header>

      <div className="withdrawal-filter-tabs">
        {filters.map((filter) => <button type="button" key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}
      </div>

      <div className="withdrawals-table-wrap">
        <table className="withdrawals-table">
          <thead><tr><th>SELLER</th><th>AMOUNT</th><th>METHOD</th><th>DATE</th><th>STATUS</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {visibleRequests.map((request) => <tr key={request.id}>
              <td><strong>{request.seller}</strong><span>{request.email}</span></td>
              <td className="withdrawal-amount">${request.amount.toFixed(2)}</td>
              <td>{request.method}</td><td className="withdrawal-date">{request.date}</td>
              <td><span className={`withdrawal-status ${request.status.toLowerCase()}`}>{request.status}</span></td>
              <td><button type="button" className="withdrawal-review" onClick={() => setSelectedRequest(request)}>Review</button></td>
            </tr>)}
            {visibleRequests.length === 0 && <tr><td className="withdrawals-empty" colSpan="6">No withdrawal requests found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedRequest && <div className="withdrawal-drawer-layer" onMouseDown={(event) => event.target === event.currentTarget && setSelectedRequest(null)}>
        <aside className="withdrawal-review-drawer" aria-label="Withdrawal Review">
          <div className="withdrawal-drawer-header"><h3>Withdrawal Review</h3><button type="button" onClick={() => setSelectedRequest(null)}>×</button></div>
          <div className="withdrawal-drawer-content">
            <div><span>Seller</span><strong>{selectedRequest.seller}</strong></div>
            <div><span>Email</span><strong>{selectedRequest.email}</strong></div>
            <div><span>Amount</span><strong>${selectedRequest.amount.toFixed(2)}</strong></div>
            <div><span>Method</span><strong>{selectedRequest.method}</strong></div>
            <div><span>Account Details</span><strong>{selectedRequest.account}</strong></div>
            <div><span>Requested</span><strong>{selectedRequest.date}</strong></div>
            <div><span>Status</span><strong>{selectedRequest.status}</strong></div>
          </div>
        </aside>
      </div>}
    </section>
  );
}
