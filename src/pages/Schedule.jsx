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

export default function Schedule() {
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [form, setForm] = useState({ name: "", room: "", day: "MON", startTime: "8:00 AM", endTime: "9:00 AM" });
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

  function openAddModal() {
    setEditingClass(null);
    setForm({ name: "", room: "", day: "MON", startTime: "8:00 AM", endTime: "9:00 AM" });
    setShowModal(true);
  }

  function openEditModal(cls) {
    setEditingClass(cls);
    setForm({
      name: cls.name, room: cls.room, day: cls.day,
      startTime: cls.startTime || cls.time || "8:00 AM",
      endTime: cls.endTime || "9:00 AM",
    });
    setSelectedClass(null);
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      alert("End time must be after start time.");
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
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this class?")) return;
    await deleteDoc(doc(db, "classes", id));
    setSelectedClass(null);
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
      {selectedClass && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setSelectedClass(null)} />
      )}

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
                      const isSelected = selectedClass?.id === cls.id;
                      const blockHeight = span * ROW_HEIGHT - 4;
                      return (
                        <td key={day} rowSpan={span} style={{ verticalAlign: "top", padding: "2px", position: "relative", zIndex: isSelected ? 20 : 1 }}>
                          <div
                            onClick={e => { e.stopPropagation(); setSelectedClass(isSelected ? null : cls); }}
                            className="class-block"
                            style={{
                              height: `${blockHeight}px`,
                              boxSizing: "border-box",
                              cursor: "pointer",
                              position: "relative",
                              overflow: "hidden",
                              border: isSelected ? "2px solid var(--primary)" : undefined,
                              transition: "border 0.15s",
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: "11px" }}>{cls.name}</div>
                            {cls.room && <div style={{ fontSize: "10px", opacity: 0.7 }}>{cls.room}</div>}
                            <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "2px" }}>
                              {cls.startTime || cls.time} – {cls.endTime}
                            </div>
                            {isSelected && (
                              <div style={{
                                position: "absolute", bottom: 4, left: 0, right: 0,
                                display: "flex", justifyContent: "center", gap: "6px",
                                background: "var(--white)", padding: "4px 0",
                              }}>
                                <button
                                  onClick={e => { e.stopPropagation(); openEditModal(cls); }}
                                  style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "var(--nav)", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer" }}
                                >Edit</button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDelete(cls.id); }}
                                  style={{ fontSize: "10px", fontWeight: 600, color: "white", background: "#dc2626", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer" }}
                                >Delete</button>
                              </div>
                            )}
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
                  <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}
                    style={{ width: "100%", height: "42px", border: "1.5px solid var(--border)", borderRadius: "var(--r)", padding: "0 14px", fontSize: "14px", background: "var(--white)", color: "var(--text)" }}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <div className="input-wrap">
                  <select value={form.startTime}onChange={e => {
                                                const start = e.target.value;
                                                const startIdx = TIMES.indexOf(start);
                                                const endIdx = Math.min(startIdx + 2, TIMES.length - 1);
                                                setForm({ ...form, startTime: start, endTime: TIMES[endIdx] });
                                              }}
                    style={{ width: "100%", height: "42px", border: "1.5px solid var(--border)", borderRadius: "var(--r)", padding: "0 14px", fontSize: "14px", background: "var(--white)", color: "var(--text)" }}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>End Time</label>
                <div className="input-wrap">
                  <select value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                    style={{ width: "100%", height: "42px", border: "1.5px solid var(--border)", borderRadius: "var(--r)", padding: "0 14px", fontSize: "14px", background: "var(--white)", color: "var(--text)" }}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button type="submit" className="btn-submit" disabled={loading}>
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