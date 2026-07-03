import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, getDocs,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { useAdmin } from "../context/AdminContext";

function toDateSafe(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  return null;
}

function formatDate(ts) {
  const date = toDateSafe(ts);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function timeAgo(ts) {
  const date = toDateSafe(ts);
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusColors = {
  pending: "var(--warning)",
  approved: "var(--success)",
  rejected: "var(--error)",
  completed: "var(--success)",
  resolved: "var(--success)",
};

const REQUEST_STATUSES = ["pending", "approved", "rejected", "completed"];
const INQUIRY_STATUSES = ["pending", "approved", "rejected", "resolved"];

const SUB_TABS = [
  { key: "requests", label: "Request Forms", collection: "serviceRequests", statuses: REQUEST_STATUSES },
  { key: "inquiries", label: "Inquiries", collection: "serviceInquiries", statuses: INQUIRY_STATUSES },
  { key: "feedback", label: "Feedback", collection: "serviceFeedback", statuses: null },
];

export default function Admin() {
  const { isAdmin, adminLoading } = useAdmin();

  // ── Announcements ─────────────────────────────────────────────
  const [annForm, setAnnForm] = useState({ title: "", office: "", content: "" });
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annSaving, setAnnSaving] = useState(false);
  const [annError, setAnnError] = useState("");
  const [annSuccess, setAnnSuccess] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      collection(db, "announcements"),
      (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
        setAnnouncements(rows);
        setAnnLoading(false);
      },
      (err) => { console.error("Failed to load announcements:", err); setAnnLoading(false); }
    );
    return unsub;
  }, [isAdmin]);

  async function handlePostAnnouncement(e) {
    e.preventDefault();
    setAnnError("");
    setAnnSuccess("");
    if (!annForm.title || !annForm.office || !annForm.content) {
      setAnnError("Please fill in all fields.");
      return;
    }
    setAnnSaving(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: annForm.title,
        office: annForm.office,
        content: annForm.content,
        createdAt: serverTimestamp(),
      });
      setAnnForm({ title: "", office: "", content: "" });
      setAnnSuccess("Announcement posted!");
      setTimeout(() => setAnnSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setAnnError("Something went wrong. Please try again.");
    } finally {
      setAnnSaving(false);
    }
  }

  async function handleDeleteAnnouncement(id) {
    if (!window.confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
  }

  // ── Submissions ────────────────────────────────────────────────
  const [subTab, setSubTab] = useState("requests");
  const [submissions, setSubmissions] = useState([]);
  const [subLoading, setSubLoading] = useState(true);
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    if (!isAdmin) return;
    getDocs(collection(db, "users")).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data().fullName || d.data().email || d.id; });
      setUserMap(map);
    }).catch(err => console.error("Failed to load users:", err));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setSubLoading(true);
    const tab = SUB_TABS.find(t => t.key === subTab);
    const unsub = onSnapshot(
      collection(db, tab.collection),
      (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
        setSubmissions(rows);
        setSubLoading(false);
      },
      (err) => { console.error(`Failed to load ${tab.collection}:`, err); setSubLoading(false); }
    );
    return unsub;
  }, [isAdmin, subTab]);

  async function handleStatusChange(id, newStatus) {
    const tab = SUB_TABS.find(t => t.key === subTab);
    await updateDoc(doc(db, tab.collection, id), { status: newStatus });
  }

  function submitterName(uid, anonymous) {
    if (anonymous) return "Anonymous";
    return userMap[uid] || uid || "—";
  }

  // ── Access control ────────────────────────────────────────────
  if (adminLoading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const activeTab = SUB_TABS.find(t => t.key === subTab);

  return (
    <AppLayout>
      <div className="top-header">
        <div className="top-header-left">
          <h2>Admin Panel</h2>
        </div>
      </div>

      <div className="page-body">
        {/* Post Announcement */}
        <div className="services-content">
          <h2>Post Announcement</h2>

          {annError && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>{annError}</p>}
          {annSuccess && <div className="auth-success" style={{ marginBottom: "12px" }}>{annSuccess}</div>}

          <form className="svc-form" onSubmit={handlePostAnnouncement}>
            <div className="form-row">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Semestral Break Schedule"
                value={annForm.title}
                onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Office</label>
              <input
                type="text"
                placeholder="e.g. Registrar's Office"
                value={annForm.office}
                onChange={e => setAnnForm({ ...annForm, office: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Content</label>
              <textarea
                placeholder="Enter announcement details..."
                value={annForm.content}
                onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
              ></textarea>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn-submit" disabled={annSaving}>
                {annSaving ? "Posting..." : "Post Announcement"}
              </button>
            </div>
          </form>

          <h3 style={{ fontFamily: "var(--font-d)", fontSize: "15px", marginTop: "28px", marginBottom: "12px" }}>
            Posted Announcements
          </h3>
          {annLoading ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>No announcements posted yet.</p>
          ) : (
            announcements.map(a => (
              <div className="ann-item" key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <h4>{a.title}</h4>
                  <div className="ann-meta">{a.office} · {timeAgo(a.createdAt)}</div>
                  <p className="ann-body">{a.content}</p>
                </div>
                <button
                  onClick={() => handleDeleteAnnouncement(a.id)}
                  title="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "13px", padding: 0, flexShrink: 0 }}
                >✕</button>
              </div>
            ))
          )}
        </div>

        {/* Submissions */}
        <div className="services-content" style={{ marginTop: "28px" }}>
          <h2>Service Submissions</h2>

          <div className="tab-bar" style={{ marginTop: "12px", marginBottom: "16px" }}>
            {SUB_TABS.map(t => (
              <span
                key={t.key}
                className={`tab ${subTab === t.key ? "active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setSubTab(t.key)}
              >
                {t.label}
              </span>
            ))}
          </div>

          {subLoading ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>No {activeTab.label.toLowerCase()} submitted yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--border)" }}>
                    <th style={{ padding: "10px 8px" }}>Submitted By</th>
                    {subTab === "requests" && <>
                      <th style={{ padding: "10px 8px" }}>Type</th>
                      <th style={{ padding: "10px 8px" }}>Subject</th>
                      <th style={{ padding: "10px 8px" }}>Description</th>
                    </>}
                    {subTab === "inquiries" && <>
                      <th style={{ padding: "10px 8px" }}>Type</th>
                      <th style={{ padding: "10px 8px" }}>Directed To</th>
                      <th style={{ padding: "10px 8px" }}>Subject</th>
                      <th style={{ padding: "10px 8px" }}>Message</th>
                      <th style={{ padding: "10px 8px" }}>Attachment</th>
                    </>}
                    {subTab === "feedback" && <>
                      <th style={{ padding: "10px 8px" }}>Category</th>
                      <th style={{ padding: "10px 8px" }}>Rating</th>
                      <th style={{ padding: "10px 8px" }}>Liked</th>
                      <th style={{ padding: "10px 8px" }}>To Improve</th>
                    </>}
                    {activeTab.statuses && <th style={{ padding: "10px 8px" }}>Status</th>}
                    <th style={{ padding: "10px 8px" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px" }}>{submitterName(s.uid, s.anonymous)}</td>

                      {subTab === "requests" && <>
                        <td style={{ padding: "10px 8px" }}>{s.type}</td>
                        <td style={{ padding: "10px 8px" }}>{s.subject}</td>
                        <td style={{ padding: "10px 8px", maxWidth: "260px" }}>{s.description}</td>
                      </>}

                      {subTab === "inquiries" && <>
                        <td style={{ padding: "10px 8px" }}>{s.inquiryType}</td>
                        <td style={{ padding: "10px 8px" }}>{s.directedTo}</td>
                        <td style={{ padding: "10px 8px" }}>{s.subject}</td>
                        <td style={{ padding: "10px 8px", maxWidth: "260px" }}>{s.message}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {s.attachmentUrl
                            ? <a href={s.attachmentUrl} target="_blank" rel="noreferrer">{s.attachmentName || "View"}</a>
                            : "—"}
                        </td>
                      </>}

                      {subTab === "feedback" && <>
                        <td style={{ padding: "10px 8px" }}>{s.category}</td>
                        <td style={{ padding: "10px 8px" }}>{s.rating ? `${s.rating}/5` : "—"}</td>
                        <td style={{ padding: "10px 8px", maxWidth: "220px" }}>{s.liked || "—"}</td>
                        <td style={{ padding: "10px 8px", maxWidth: "220px" }}>{s.improve || "—"}</td>
                      </>}

                      {activeTab.statuses && (
                        <td style={{ padding: "10px 8px" }}>
                          <select
                            value={s.status || "pending"}
                            onChange={e => handleStatusChange(s.id, e.target.value)}
                            style={{
                              fontSize: "12px", fontWeight: 600, textTransform: "capitalize",
                              color: statusColors[s.status] || "var(--muted)",
                              border: "1px solid var(--border)", borderRadius: "6px",
                              padding: "4px 6px", background: "var(--white)",
                            }}
                          >
                            {activeTab.statuses.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                      )}

                      <td style={{ padding: "10px 8px", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}