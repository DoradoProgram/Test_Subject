import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TIMES = [
  "7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM",
  "10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM",
  "1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
  "4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM","6:30 PM","7:00 PM",
];

function toMinutes(t) {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function getRowSpan(startTime, endTime) {
  const diff = toMinutes(endTime) - toMinutes(startTime);
  return Math.max(1, Math.round(diff / 30));
}

const ROW_HEIGHT = 36;

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const selectStyle = {
  width: "100%", height: "42px", border: "1.5px solid var(--border)",
  borderRadius: "var(--r)", padding: "0 14px", fontSize: "14px",
  background: "var(--white)", color: "var(--text)",
};

export default function Schedule() {
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [form, setForm] = useState({ name: "", room: "", day: "MON", startTime: "8:00 AM", endTime: "9:00 AM" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchClasses();
    });
    return () => unsubscribe();
  }, []);

  async function fetchClasses() {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "classes"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ── Overlap handling ──────────────────────────────────────────────
  // Existing classes on the currently-selected day, as [startIdx, endIdx)
  // index ranges into TIMES, so start/end options in the form can be
  // checked against them. The class being edited is excluded so it
  // doesn't collide with itself.
  function occupiedRangesFor(day, excludeId) {
    return classes
      .filter(c => c.day === day && c.id !== excludeId)
      .map(c => ({
        id: c.id,
        startIdx: TIMES.indexOf(c.startTime || c.time),
        endIdx: TIMES.indexOf(c.endTime || c.startTime || c.time),
      }))
      .filter(r => r.startIdx !== -1 && r.endIdx !== -1)
      .sort((a, b) => a.startIdx - b.startIdx);
  }

  const dayOccupied = occupiedRangesFor(form.day, editingClass?.id ?? null);

  function isStartTimeOccupied(idx, occupied = dayOccupied) {
    return occupied.some(r => idx >= r.startIdx && idx < r.endIdx);
  }

  function computeEndOptions(startIdx, occupied = dayOccupied) {
    const nextOccupiedStart = occupied
      .map(r => r.startIdx)
      .filter(idx => idx > startIdx)
      .sort((a, b) => a - b)[0];
    const maxEndIdx = nextOccupiedStart !== undefined ? nextOccupiedStart : TIMES.length - 1;
    return TIMES.slice(startIdx + 1, maxEndIdx + 1);
  }

  const startIndex = TIMES.indexOf(form.startTime);
  const endOptions = computeEndOptions(startIndex);

  function handleStartTimeChange(e) {
    const newStart = e.target.value;
    const newStartIdx = TIMES.indexOf(newStart);
    const validEnds = computeEndOptions(newStartIdx);
    setForm(f => ({
      ...f,
      startTime: newStart,
      endTime: validEnds.includes(f.endTime) ? f.endTime : (validEnds[0] || ""),
    }));
  }

  function handleDayChange(e) {
    // Day changed — occupied ranges are different now, so re-derive valid
    // end options for the currently chosen start time.
    const newDay = e.target.value;
    const newOccupied = occupiedRangesFor(newDay, editingClass?.id ?? null);
    const curStartIdx = TIMES.indexOf(form.startTime);
    const validEnds = computeEndOptions(curStartIdx, newOccupied);
    setForm(f => ({
      ...f,
      day: newDay,
      endTime: validEnds.includes(f.endTime) ? f.endTime : (validEnds[0] || ""),
    }));
  }

  function openAddModal() {
    setEditingClass(null);
    setError("");
    setForm({ name: "", room: "", day: "MON", startTime: "8:00 AM", endTime: "9:00 AM" });
    setShowModal(true);
  }

  function openEditModal(cls) {
    setEditingClass(cls);
    setError("");
    setForm({
      name: cls.name, room: cls.room, day: cls.day,
      startTime: cls.startTime || cls.time || "8:00 AM",
      endTime: cls.endTime || "9:00 AM",
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const user = auth.currentUser;
    if (!user) return;

    if (!form.endTime || TIMES.indexOf(form.endTime) <= startIndex) {
      setError("End time must be after start time.");
      return;
    }
    if (isStartTimeOccupied(startIndex)) {
      setError("That start time overlaps with an existing class.");
      return;
    }
    if (TIMES.indexOf(form.endTime) > (endOptions.length ? TIMES.indexOf(endOptions[endOptions.length - 1]) : -1)) {
      setError("End time overlaps with an existing class.");
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: form.name, room: form.room, day: form.day,
        startTime: form.startTime, endTime: form.endTime,
        time: form.startTime, uid: user.uid,
      };
      if (editingClass) {
        await updateDoc(doc(db, "classes", editingClass.id), data);
      } else {
        await addDoc(collection(db, "classes"), data);
      }
      setShowModal(false);
      setEditingClass(null);
      fetchClasses();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this class?")) return;
    await deleteDoc(doc(db, "classes", id));
    fetchClasses();
  }

  function buildSkipSet() {
    const skip = new Set();
    classes.forEach(cls => {
      const startIdx = TIMES.indexOf(cls.startTime || cls.time);
      const span = getRowSpan(cls.startTime || cls.time, cls.endTime || cls.startTime || cls.time);
      for (let i = 1; i < span; i++) {
        skip.add(`${cls.day}-${startIdx + i}`);
      }
    });
    return skip;
  }

  function getClassAt(day, time) {
    return classes.filter(c => (c.startTime || c.time) === time && c.day === day);
  }

  const skipSet = buildSkipSet();

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/schedule" className="tab active">Class Schedule</Link>
        <Link to="/schedule-events" className="tab">Event Calendar</Link>
      </div>

      <div className="tab-content">
        <div className="schedule-toolbar">
          <button className="btn-outline" onClick={openAddModal}>
            <PlusIcon /> Add Class
          </button>
        </div>

        <div className="weekly-grid">
          <table style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "70px" }}></th>
                {DAYS.map(d => <th key={d}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, timeIdx) => (
                <tr key={time} style={{ height: `${ROW_HEIGHT}px` }}>
                  <td className="time-cell" style={{ fontSize: "11px", padding: "0 8px", verticalAlign: "middle", textAlign: "right" }}>
                    {time.includes(":00") ? time : ""}
                  </td>
                  {DAYS.map(day => {
                    if (skipSet.has(`${day}-${timeIdx}`)) return null;
                    const clsList = getClassAt(day, time);
                    if (clsList.length > 0) {
                      const cls = clsList[0];
                      const span = getRowSpan(cls.startTime || cls.time, cls.endTime || cls.startTime || cls.time);
                      const blockHeight = span * ROW_HEIGHT - 4;
                      return (
                        <td key={day} rowSpan={span} style={{ verticalAlign: "top", padding: "2px" }}>
                          <div
                            className="class-block"
                            style={{
                              height: `${blockHeight}px`,
                              boxSizing: "border-box",
                              position: "relative",
                              overflow: "hidden",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "4px",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "11px" }}>{cls.name}</div>
                              {cls.room && <div style={{ fontSize: "10px", opacity: 0.7 }}>{cls.room}</div>}
                              <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "2px" }}>
                                {cls.startTime || cls.time} – {cls.endTime}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                              <button
                                onClick={() => openEditModal(cls)}
                                title="Edit"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "11px", opacity: 0.75, padding: 0 }}
                              >✎</button>
                              <button
                                onClick={() => handleDelete(cls.id)}
                                title="Delete"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "11px", opacity: 0.75, padding: 0 }}
                              >✕</button>
                            </div>
                          </div>
                        </td>
                      );
                    }
                    return <td key={day} style={{ padding: 0 }}></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "var(--white)", borderRadius: "12px", padding: "32px", width: "400px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: "18px", marginBottom: "20px" }}>
              {editingClass ? "Edit Class" : "Add Class"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Class Name</label>
                <div className="input-wrap">
                  <input type="text" placeholder="e.g. Math 101"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Room</label>
                <div className="input-wrap">
                  <input type="text" placeholder="e.g. Room 301"
                    value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Day</label>
                <div className="input-wrap">
                  <select value={form.day} onChange={handleDayChange} style={selectStyle}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <div className="input-wrap">
                  <select value={form.startTime} onChange={handleStartTimeChange} style={selectStyle}>
                    {TIMES.map((t, idx) => (
                      <option key={t} value={t} disabled={isStartTimeOccupied(idx)}>
                        {t}{isStartTimeOccupied(idx) ? " (occupied)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>End Time</label>
                <div className="input-wrap">
                  <select value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                    style={selectStyle} disabled={endOptions.length === 0}>
                    {endOptions.length === 0 && <option value="">No valid end time</option>}
                    {endOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button type="submit" className="btn-submit" disabled={loading || endOptions.length === 0 || isStartTimeOccupied(startIndex)}>
                  {loading ? "Saving..." : editingClass ? "Save Changes" : "Add Class"}
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