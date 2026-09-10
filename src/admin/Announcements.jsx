import React, { useEffect, useState } from 'react';
import './Announcements.css';
import { adminSupabase } from '../shared/supabase';

const initialAnnouncements = [
  { id: 1, title: 'orders', message: 'hey', audience: 'All Agents', date: 'Aug 8, 2026, 04:05 PM' },
];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState(() => {
    try { return JSON.parse(localStorage.getItem('marketplace_announcements')) || initialAnnouncements; }
    catch { return initialAnnouncements; }
  });
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', audience: 'All Agents' });
  useEffect(() => { localStorage.setItem('marketplace_announcements', JSON.stringify(announcements)); }, [announcements]);
  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    const { data } = await adminSupabase.from('announcements').select('*').order('created_at', { ascending:false });
    if (data?.length) setAnnouncements(data.map((item) => ({id:item.id,title:item.title,message:item.message,audience:'All Agents',date:new Date(item.created_at).toLocaleString()})));
    setRefreshing(false);
  };

  const [sendError, setSendError] = useState('');
  const sendAnnouncement = async (event) => {
    event.preventDefault();
    setSendError('');
    const { data: auth, error: authError } = await adminSupabase.auth.getUser();
    if (authError || !auth?.user) { setSendError('Your admin session has expired. Please sign in again.'); return; }
    const { data, error } = await adminSupabase
      .from('announcements')
      .insert({
        title: form.title,
        message: form.message,
      })
      .select()
      .single();
    if (error) { setSendError(`Could not send announcement: ${error.message}`); return; }
    setAnnouncements((current) => [{ id: data.id, title: form.title, message: form.message, audience: 'All Agents', date: new Date(data.created_at).toLocaleString() }, ...current]);
    setForm({ title: '', message: '', audience: 'All Agents' });
    setShowModal(false);
  };

  const deleteAnnouncement = async (announcement) => {
    setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
    if (typeof announcement.id === 'string') await adminSupabase.from('announcements').delete().eq('id',announcement.id);
  };

  return (
    <section className="announcements-page">
      <header className="announcements-heading">
        <div><h2>Announcements</h2><p>Send notices and messages to agents individually, selectively, or all at once.</p></div>
        <div className="announcement-header-actions">
          <button type="button" className={refreshing ? 'announcement-refresh refreshing' : 'announcement-refresh'} onClick={refresh} aria-label="Refresh announcements">↻</button>
          <button type="button" className="new-announcement-btn" onClick={() => setShowModal(true)}>＋ New Announcement</button>
        </div>
      </header>

      <div className="announcement-list">
        {announcements.map((announcement) => <article className="announcement-card" key={announcement.id}>
          <button type="button" className="delete-announcement" onClick={() => deleteAnnouncement(announcement)} aria-label={`Delete ${announcement.title}`}>♲</button>
          <div className="announcement-title-line"><h3>{announcement.title}</h3><span>♙ {announcement.audience}</span></div>
          <p>{announcement.message}</p>
          <small>Sent by Admin · {announcement.date}</small>
        </article>)}
        {announcements.length === 0 && <div className="announcements-empty">No announcements.</div>}
      </div>

      {showModal && <div className="announcement-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)}>
        <div className="announcement-modal">
          <div className="announcement-modal-header"><h3>New Announcement</h3><button type="button" onClick={() => setShowModal(false)}>×</button></div>
          <form onSubmit={sendAnnouncement}>
            <label>Title *<input required placeholder="Announcement title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Message *<textarea required placeholder="Write your announcement message here..." value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} /></label>
            <fieldset><legend>Send To *</legend><div className="audience-options">
              {['All Agents', 'Specific Agents'].map((audience) => <button type="button" key={audience} className={form.audience === audience ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, audience }))}>♙ {audience}</button>)}
            </div></fieldset>
            <div className="announcement-modal-actions"><button type="button" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" disabled={!form.title.trim() || !form.message.trim()}>⚑ Send Announcement</button></div>
          </form>
        </div>
      </div>}
    </section>
  );
}
