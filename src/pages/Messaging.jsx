import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

function timeAgo(timestamp) {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
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

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const initialThreads = [
  {
    id: 1, name: "Prof. Smith", category: "Courses", preview: "Assignment Due Tomorrow",
    messages: [
      { from: "them", text: "Don't forget the assignment is due tomorrow." },
      { from: "me", text: "Got it, thanks!" },
      { from: "them", text: "Please review Chapter 5 before class." },
    ],
  },
  { id: 2, name: "Science Club", category: "Courses", preview: "Meeting at 5 PM", messages: [{ from: "them", text: "Meeting at 5 PM today!" }] },
  { id: 3, name: "Admin Office", category: "Admin", preview: "Submit Forms Reminder", messages: [{ from: "them", text: "Please submit your forms before Friday." }] },
  { id: 4, name: "Section Chat", category: "Courses", preview: "Study Group Discussion", messages: [{ from: "them", text: "Who's joining the study group tonight?" }] },
];

export default function Messaging() {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(1);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("All");
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annFilter, setAnnFilter] = useState("All");
  const [expandedAnnId, setExpandedAnnId] = useState(null);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [newName, setNewName] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));
        const annSnap = await getDocs(annQuery);
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
        setAnnouncements([]);
      } finally {
        setAnnLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const activeThread = threads.find(t => t.id === activeId);
  const filteredThreads = filter === "All" ? threads : threads.filter(t => t.category === filter);
  const filteredAnnouncements = annFilter === "All" ? announcements : announcements.filter(a => a.category === annFilter);

  function handleSend() {
    if (!input.trim() || !activeThread) return;
    setThreads(prev => prev.map(t => t.id !== activeId ? t : {
      ...t, preview: input, messages: [...t.messages, { from: "me", text: input }],
    }));
    setInput("");
  }

  function handleKeyDown(e) { if (e.key === "Enter") handleSend(); }
  function handleCloseThread() { setActiveId(null); }

  function handleCreateThread() {
    if (!newName.trim() || !newText.trim()) return;
    const newId = Math.max(...threads.map(t => t.id), 0) + 1;
    const newThread = { id: newId, name: newName.trim(), category: "Courses", preview: newText.trim(), messages: [{ from: "me", text: newText.trim() }] };
    setThreads(prev => [newThread, ...prev]);
    setActiveId(newId);
    setShowNewMsg(false);
    setNewName("");
    setNewText("");
  }

  function handleCancelNewThread() { setShowNewMsg(false); setNewName(""); setNewText(""); }
  function toggleReadMore(id) { setExpandedAnnId(prev => prev === id ? null : id); }

  return (
    <AppLayout>
      <div className="messaging-layout">
        {/* Inbox sidebar */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-header"><h3>Inbox</h3></div>
          <div className="msg-filter">
            {["All", "Courses", "Admin"].map(f => (
              <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="thread-list">
            {filteredThreads.length === 0 && <p className="thread-empty">No conversations in this category.</p>}
            {filteredThreads.map(t => (
              <div key={t.id} className={`thread-item ${t.id === activeId ? "active" : ""}`} onClick={() => setActiveId(t.id)}>
                <h4>{t.name}</h4>
                <p>{t.preview}</p>
              </div>
            ))}
          </div>
          <div className="msg-add-area">
            {showNewMsg ? (
              <div className="new-msg-form">
                <input className="msg-input" placeholder="Recipient name" value={newName} onChange={e => setNewName(e.target.value)} />
                <textarea className="new-msg-textarea" placeholder="Type your first message..." value={newText} onChange={e => setNewText(e.target.value)}></textarea>
                <div className="new-msg-actions">
                  <button className="btn-send" onClick={handleCreateThread}>Start</button>
                  <button className="btn-cancel" onClick={handleCancelNewThread}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="msg-add-btn" onClick={() => setShowNewMsg(true)}>
                <PlusIcon /> New Message
              </button>
            )}
          </div>
        </div>

        {/* Chat pane */}
        <div className="msg-main">
          {activeThread ? (
            <>
              <div className="msg-top">
                <h3>
                  <UserIcon />
                  {activeThread.name}
                </h3>
                <button className="close-x" onClick={handleCloseThread}>✕</button>
              </div>
              <div className="msg-body">
                {activeThread.messages.map((msg, i) => (
                  <div key={i} className={msg.from === "me" ? "bubble-out" : "bubble-in"}>{msg.text}</div>
                ))}
              </div>
              <div className="msg-composer">
                <input className="msg-input" placeholder="Type a message..." value={input}
                  onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} />
                <button className="btn-send" onClick={handleSend}>Send</button>
              </div>
            </>
          ) : (
            <div className="msg-empty-state"><p>Select a conversation to start chatting.</p></div>
          )}
        </div>

        {/* Announcements panel */}
        <div className="ann-panel">
          <h3>Announcements</h3>
          <div className="msg-filter" style={{ padding: "0 0 12px" }}>
            {["All", "Course", "Events"].map(f => (
              <button key={f} className={`filter-pill ${annFilter === f ? "active" : ""}`}
                style={{ fontSize: "10px", padding: "3px 8px" }} onClick={() => setAnnFilter(f)}>{f}</button>
            ))}
          </div>
          {annLoading ? (
            <p className="thread-empty">Loading announcements...</p>
          ) : filteredAnnouncements.length === 0 ? (
            <p className="thread-empty">No announcements in this category.</p>
          ) : (
            filteredAnnouncements.map(a => {
              const isExpanded = expandedAnnId === a.id;
              return (
                <div className="ann-panel-entry" key={a.id}>
                  <h4>{a.title}</h4>
                  <p>{a.office} · {timeAgo(a.createdAt)}</p>
                  {isExpanded ? (
                    <p className="ann-full-text">{a.content}</p>
                  ) : (
                    <><div className="ann-pline"></div><div className="ann-pline"></div></>
                  )}
                  <a className="read-more" onClick={() => toggleReadMore(a.id)} style={{ cursor: "pointer" }}>
                    {isExpanded ? "Read Less" : "Read More"}
                  </a>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}