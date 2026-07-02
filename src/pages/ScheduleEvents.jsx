import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, Timestamp } from "firebase/firestore";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function generateTimeOptions() {
  const options = [];
  for (let hour = 6; hour <= 20; hour++) {   // 20 = 8:00 PM ceiling
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour <= 12 ? hour : hour - 12;
    options.push(`${displayHour}:00 ${period}`);
  }
  return options;
}
const TIMES = generateTimeOptions();

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

const selectStyle = {
  width: "100%", height: "42px", border: "1.5px solid var(--border)",
  borderRadius: "var(--r)", padding: "0 14px", fontSize: "14px",
  background: "var(--white)", color: "var(--text)",
};

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ScheduleEvents() {
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ name: "", date: "", endDate: "", startTime: "8:00 AM", endTime: "9:00 AM" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchEvents();
    });
    return () => unsubscribe();
  }, []);

  async function fetchEvents() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "events"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !form.name || !form.date) return;
    setLoading(true);
    try {
      const data = {
        name: form.name,
        date: form.date,
        endDate: form.endDate || form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        uid: user.uid,
      };
      if (editingEvent) {
        await updateDoc(doc(db, "events", editingEvent.id), data);
      } else {
        await addDoc(collection(db, "events"), { ...data, createdAt: Timestamp.now() });
      }
      setForm({ name: "", date: "", endDate: "", startTime: "8:00 AM", endTime: "9:00 AM" });
      setEditingEvent(null);
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingEvent(null);
    setForm({ name: "", date: "", endDate: "", startTime: "8:00 AM", endTime: "9:00 AM" });
    setShowModal(true);
  }

  function openEditModal(ev) {
    setEditingEvent(ev);
    setForm({
      name: ev.name,
      date: ev.date,
      endDate: ev.endDate || ev.date,
      startTime: ev.startTime || "8:00 AM",
      endTime: ev.endTime || "9:00 AM",
    });
    setShowModal(true);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", id));
    fetchEvents();
  }

  function handleStartTime(val) {
    const idx = TIMES.indexOf(val);
    const endIdx = Math.min(idx + 1, TIMES.length - 1);
    setForm({ ...form, startTime: val, endTime: TIMES[endIdx] });
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
    const dateStr = `${year}-${month}-${d}`;
    return events.filter(e => {
      const end = e.endDate || e.date;
      return dateStr >= e.date && dateStr <= end;
    });
  }

  function isToday(day) {
    const now = new Date();
    return day === now.getDate() && current.getMonth() === now.getMonth() && current.getFullYear() === now.getFullYear();
  }

  const upcoming = [...events]
    .filter(e => (e.endDate || e.date) >= new Date().toISOString().slice(0, 10))
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
                                  title={`${ev.name}${ev.startTime ? ` · ${ev.startTime}–${ev.endTime}` : ""}`}
                                  onClick={() => openEditModal(ev)}
                                  style={{
                                    cursor: "pointer", whiteSpace: "normal", overflow: "visible", textOverflow: "unset",
                                    display: "inline-flex", alignItems: "center", gap: "5px",
                                  }}
                                >
                                  {ev.name}
                                  <span
                                    onClick={e => { e.stopPropagation(); handleDelete(ev.id); }}
                                    title="Delete"
                                    style={{ opacity: 0.7, fontSize: "10px" }}
                                  >✕</span>
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
                    <div className="edate">
                      {formatDate(ev.date)}
                      {ev.endDate && ev.endDate !== ev.date && (
                        <> – {formatDate(ev.endDate)}</>
                      )}
                    </div>
                    {ev.startTime && (
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                        {ev.startTime} – {ev.endTime}
                      </div>
                    )}
                  </div>
                  <span style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "2px" }}>
                    <button
                      onClick={() => openEditModal(ev)}
                      title="Edit"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "12px", padding: 0 }}
                    >✎</button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      title="Delete"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "12px", padding: 0 }}
                    >✕</button>
                  </span>
                </div>
              ))
            )}
            <button className="btn-add-event" onClick={openAddModal}>
              <PlusIcon /> Add Event
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "var(--white)", borderRadius: "12px", padding: "32px", width: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: "18px", marginBottom: "20px" }}>
              {editingEvent ? "Edit Event" : "Add Event"}
            </h3>
            <form onSubmit={handleSubmit}>

              <div className="form-group">
                <label>Event Name</label>
                <div className="input-wrap">
                  <input type="text" placeholder="e.g. Science Fair"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>Start Date</label>
                <div className="input-wrap">
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value, endDate: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>End Date <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
                <div className="input-wrap">
                  <input type="date" value={form.endDate} min={form.date}
                    onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Start Time</label>
                <div className="input-wrap">
                  <select style={selectStyle} value={form.startTime} onChange={e => handleStartTime(e.target.value)}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>End Time</label>
                <div className="input-wrap">
                  <select style={selectStyle} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? "Saving..." : editingEvent ? "Save Changes" : "Add Event"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); setEditingEvent(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}