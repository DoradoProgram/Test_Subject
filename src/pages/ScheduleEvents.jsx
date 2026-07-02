import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function ScheduleEvents() {
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", date: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "events"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !form.name || !form.date) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "events"), {
        name: form.name,
        date: form.date,
        uid: user.uid,
        createdAt: Timestamp.now(),
      });
      setForm({ name: "", date: "" });
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db, "events", id));
    fetchEvents();
  }

  function prevMonth() { setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1)); }
  function nextMonth() { setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1)); }

  function buildCalendar() {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks = [];
    let day = 1 - firstDay;
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++, day++) {
        week.push(day > 0 && day <= daysInMonth ? day : null);
      }
      if (week.some(d => d !== null)) weeks.push(week);
    }
    return weeks;
  }

  function getEventsForDay(day) {
    if (!day) return [];
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return events.filter(e => e.date === `${year}-${month}-${d}`);
  }

  function isToday(day) {
    const now = new Date();
    return day === now.getDate() && current.getMonth() === now.getMonth() && current.getFullYear() === now.getFullYear();
  }

  const upcoming = [...events]
    .filter(e => e.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const weeks = buildCalendar();

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/schedule" className="tab">Class Schedule</Link>
        <Link to="/schedule-events" className="tab active">Event Calendar</Link>
      </div>

      <div className="tab-content">
        <div className="cal-wrapper">
          <div className="cal-box">
            <div className="cal-header">
              <h3>{MONTHS[current.getMonth()]} {current.getFullYear()}</h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft /></button>
                <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight /></button>
              </div>
            </div>

            <div className="cal-grid">
              <table>
                <thead>
                  <tr>{DAYS.map(d => <th key={d}>{d}</th>)}</tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => (
                        <td key={di} className={isToday(day) ? "today" : ""}>
                          {day && (
                            <>
                              <span style={{ fontWeight: isToday(day) ? 700 : 400 }}>{day}</span>
                              {getEventsForDay(day).map(ev => (
                                <span
                                  key={ev.id}
                                  className="event-pill"
                                  title={ev.name}
                                  onClick={() => handleDelete(ev.id)}
                                  style={{ cursor: "pointer", whiteSpace: "normal", overflow: "visible", textOverflow: "unset" }}
                                >
                                  {ev.name}
                                </span>
                              ))}
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="events-sidebar">
            <h3>Upcoming Events</h3>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>No upcoming events.</p>
            ) : (
              upcoming.map(ev => (
                <div key={ev.id} className="event-entry" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="ename">{ev.name}</div>
                    <div className="edate">{new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                  </div>
                  <span onClick={() => handleDelete(ev.id)} style={{ cursor: "pointer", color: "var(--muted)", fontSize: "12px", marginTop: "2px" }}>✕</span>
                </div>
              ))
            )}
            <button className="btn-add-event" onClick={() => setShowModal(true)}>
              <PlusIcon /> Add Event
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: "18px", marginBottom: "20px" }}>Add Event</h3>
            <form onSubmit={handleAddEvent}>
              <div className="form-group">
                <label>Event Name</label>
                <div className="input-wrap">
                  <input type="text" placeholder="e.g. Science Fair"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Date</label>
                <div className="input-wrap">
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? "Saving..." : "Add Event"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}