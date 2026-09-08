import React, { useEffect, useState } from 'react';
import { initialTickets } from '../admin/Feedbacks';
import './SellerFeedback.css';
import { sellerSupabase } from '../shared/supabase';

const loadTickets = () => {
  try { return JSON.parse(localStorage.getItem('seller_feedback_tickets')) || initialTickets; } catch { return initialTickets; }
};

export default function SellerFeedback({ onBack, client = sellerSupabase, sellerId }) {
  const [tab, setTab] = useState('Submit');
  const [type, setType] = useState('Suggestion');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState(loadTickets);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    client.from('feedback_tickets').select('*').eq('seller_id', sellerId).order('created_at',{ascending:false}).then(({data}) => {
      if (data?.length) setTickets(data.map((item) => ({id:item.id,title:item.title,seller:'Khan321',type:item.type,date:new Date(item.created_at).toLocaleDateString(),status:item.status,message:item.message})));
    });
  }, [client, sellerId]);

  const submit = async (event) => {
    event.preventDefault();
    const effectiveSellerId = sellerId || (await client.auth.getUser()).data.user?.id;
    const { data, error } = await client.from('feedback_tickets').insert({seller_id:effectiveSellerId,title:title.trim(),type,message:message.trim(),status:'Open'}).select().single();
    if (error) { setNotice(error.message); return; }
    const ticket = { id: data?.id || Date.now(), title: title.trim(), seller: 'Khan321', type, date: new Date(data?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Open', message: message.trim() };
    const next = [ticket, ...tickets];
    setTickets(next);
    localStorage.setItem('seller_feedback_tickets', JSON.stringify(next));
    setTitle(''); setMessage(''); setNotice('Feedback submitted successfully.');
    window.setTimeout(() => { setNotice(''); setTab('My Feedback'); }, 1400);
  };

  return <main className="seller-feedback-page"><div className="seller-feedback-shell">
    <header><button type="button" onClick={onBack}>‹</button><h1>Feedback</h1><span /></header>
    <nav className="seller-feedback-tabs"><button className={tab === 'Submit' ? 'active' : ''} type="button" onClick={() => setTab('Submit')}>Submit</button><button className={tab === 'My Feedback' ? 'active' : ''} type="button" onClick={() => setTab('My Feedback')}>My Feedback</button></nav>
    {notice && <div className="seller-feedback-notice">{notice}</div>}
    {tab === 'Submit' ? <form className="seller-feedback-form" onSubmit={submit}><h2>We welcome your suggestions.</h2><div className="seller-feedback-types">{['Suggestion', 'Problem', 'Complaint', 'Other'].map((item) => <button className={type === item ? 'active' : ''} type="button" key={item} onClick={() => setType(item)}>{item}</button>)}</div><input required placeholder="Enter feedback title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea required placeholder="For security, please do not include any personal information." value={message} onChange={(event) => setMessage(event.target.value)} /><button type="submit">Submit</button></form> : <section className="seller-feedback-list">{tickets.filter((ticket) => ticket.seller === 'Khan321').map((ticket) => <article key={ticket.id}><span className={`seller-ticket-status ${ticket.status.toLowerCase()}`}>{ticket.status}</span><h2>{ticket.title}</h2><small>{ticket.type.toLowerCase()} · {ticket.date}</small><p>{ticket.message}</p></article>)}{!tickets.length && <p className="seller-feedback-empty">No feedback submitted yet.</p>}</section>}
  </div></main>;
}
