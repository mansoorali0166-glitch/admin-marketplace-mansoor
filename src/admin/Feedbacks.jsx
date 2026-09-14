import React, { useEffect, useMemo, useState } from 'react';
import './Feedbacks.css';
import { adminSupabase } from '../shared/supabase';

export const initialTickets = [
  { id: 1, title: 'Hey', seller: 'Khan321', type: 'Problem', date: 'Jul 27, 2026', status: 'Open', message: 'I need help with my seller account. Please review this issue.' },
];

export default function Feedbacks() {
  const [tickets, setTickets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('seller_feedback_tickets')) || initialTickets; } catch { return initialTickets; }
  });
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    localStorage.setItem('seller_feedback_tickets', JSON.stringify(tickets));
  }, [tickets]);
  useEffect(() => {
    adminSupabase.from('feedback_tickets').select('*,profiles(display_name,email)').order('created_at',{ascending:false}).then(({data}) => {
      if (data?.length) setTickets(data.map((item) => ({id:item.id,title:item.title,seller:item.profiles?.email||'Seller',type:item.type,date:new Date(item.created_at).toLocaleDateString(),status:item.status,message:item.message})));
    });
  }, []);

  const visibleTickets = useMemo(() => activeFilter === 'All' ? tickets : tickets.filter((ticket) => ticket.status === activeFilter), [tickets, activeFilter]);

  const resolveTicket = async () => {
    setTickets((current) => current.map((ticket) => ticket.id === selectedTicket.id ? { ...ticket, status: 'Resolved' } : ticket));
    setSelectedTicket((current) => ({ ...current, status: 'Resolved' }));
    if (typeof selectedTicket.id === 'string') await adminSupabase.from('feedback_tickets').update({status:'Resolved',updated_at:new Date().toISOString()}).eq('id',selectedTicket.id);
  };

  return <section className="feedback-page">
    <header className="feedback-heading"><h2>Feedback &amp; Support</h2><p>Review seller feedback submissions and respond to support tickets.</p></header>
    <div className="feedback-filter-tabs">{['All', 'Open', 'Resolved'].map((filter) => <button type="button" key={filter} className={activeFilter === filter ? 'active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div>

    <div className="feedback-table-wrap"><table className="feedback-table">
      <thead><tr><th>TITLE</th><th>SELLER</th><th>TYPE</th><th>DATE</th><th>STATUS</th><th aria-label="Actions" /></tr></thead>
      <tbody>
        {visibleTickets.map((ticket) => <tr key={ticket.id}><td className="feedback-title">{ticket.title}</td><td>{ticket.seller}</td><td>{ticket.type}</td><td className="feedback-date">{ticket.date}</td><td><span className={`feedback-status ${ticket.status.toLowerCase()}`}>{ticket.status}</span></td><td><button type="button" className="view-feedback" onClick={() => setSelectedTicket(ticket)}>View</button></td></tr>)}
        {visibleTickets.length === 0 && <tr><td className="feedback-empty" colSpan="6">No tickets found.</td></tr>}
      </tbody>
    </table></div>

    {selectedTicket && <div className="feedback-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelectedTicket(null)}><div className="feedback-modal">
      <div className="feedback-modal-header"><div><h3>{selectedTicket.title}</h3><span className={`feedback-status ${selectedTicket.status.toLowerCase()}`}>{selectedTicket.status}</span></div><button type="button" onClick={() => setSelectedTicket(null)}>×</button></div>
      <dl><div><dt>Seller</dt><dd>{selectedTicket.seller}</dd></div><div><dt>Type</dt><dd>{selectedTicket.type}</dd></div><div><dt>Submitted</dt><dd>{selectedTicket.date}</dd></div></dl>
      <div className="feedback-message"><span>Message</span><p>{selectedTicket.message}</p></div>
      <label className="feedback-reply">Admin Response<textarea placeholder="Write a response to the seller..." /></label>
      <div className="feedback-modal-actions"><button type="button" onClick={() => setSelectedTicket(null)}>Close</button>{selectedTicket.status === 'Open' && <button type="button" onClick={resolveTicket}>Mark as Resolved</button>}</div>
    </div></div>}
  </section>;
}
