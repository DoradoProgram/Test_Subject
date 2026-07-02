import { useEffect, useState, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, query, orderBy, limit, getDocs, doc, 
  addDoc, serverTimestamp, onSnapshot, where, updateDoc 
} from "firebase/firestore";

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
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("All");
  
  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [annFilter, setAnnFilter] = useState("All");
  const [expandedAnnId, setExpandedAnnId] = useState(null);

  // New Chat states
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newText, setNewText] = useState("");

  const messagesEndRef = useRef(null);

  // 1. Auth Observer & Announcements Initialization
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser(user);

      try {
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));
        const annSnap = await getDocs(annQuery);
        setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      } finally {
        setAnnLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Live Conversations (Inbox) Listener - Sorting complex index requirement removed
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribeThreads = onSnapshot(q, (snapshot) => {
      const fetchedThreads = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const otherParticipantName = data.participantNames?.[Object.keys(data.participantNames).find(uid => uid !== currentUser.uid)] || "Chat Partner";
        return {
          id: docSnap.id,
          name: otherParticipantName,
          ...data
        };
      });

      // Handle inbox sorting cleanly in JavaScript memory to avoid requiring a complex Firestore index
      fetchedThreads.sort((a, b) => {
        const timeA = a.updatedAt?.toDate() ? a.updatedAt.toDate().getTime() : 0;
        const timeB = b.updatedAt?.toDate() ? b.updatedAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setThreads(fetchedThreads);
    }, (error) => {
      console.error("Threads layout sync error:", error);
    });

    return () => unsubscribeThreads();
  }, [currentUser]);

  // 3. Live Active Chat Streamer
  useEffect(() => {
    if (!activeId || !currentUser) {
      setMessages([]);
      return;
    }

    const msgsQuery = query(
      collection(db, "conversations", activeId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(msgsQuery, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // Clear unread indicator instantly when opening a thread
    const threadRef = doc(db, "conversations", activeId);
    updateDoc(threadRef, {
      [`unread.${currentUser.uid}`]: false
    }).catch(err => console.error("Could not clear unread count:", err));

    return () => unsubscribeMessages();
  }, [activeId, currentUser]);

  // 4. Case-insensitive "contains" user search
  // Firestore range queries only support case-sensitive prefix matching, so
  // instead we pull the users collection and filter client-side. This keeps
  // matching correct regardless of case or where in the name the query
  // appears (e.g. "ann" matches "Ann Reyes" or "Marianne Cruz").
  useEffect(() => {
    if (!searchName.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const needle = searchName.trim().toLowerCase();
        const snap = await getDocs(collection(db, "users"));

        setSearchResults(
          snap.docs
            .map(d => ({ uid: d.id, ...d.data() }))
            .filter(u =>
              u.uid !== currentUser.uid &&
              (u.fullName || "").toLowerCase().includes(needle)
            )
            .slice(0, 20)
        );
      } catch (e) {
        console.error("User query failed", e);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchName, currentUser]);

  // Send Message Dispatcher
  async function handleSend() {
    if (!input.trim() || !activeId || !currentUser) return;

    const messageText = input.trim();
    setInput("");

    try {
      const currentThread = threads.find(t => t.id === activeId);
      const recipientUid = currentThread.participants.find(uid => uid !== currentUser.uid);

      await addDoc(collection(db, "conversations", activeId, "messages"), {
        senderId: currentUser.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "conversations", activeId), {
        preview: messageText,
        updatedAt: serverTimestamp(),
        [`unread.${recipientUid}`]: true
      });
    } catch (err) {
      console.error("Error dispatching message:", err);
    }
  }

  // Conversation Generator with custom profile fallback logic
  async function handleCreateThread() {
    if (!selectedUser || !newText.trim() || !currentUser) return;

    try {
      // 1. Check if a thread with this person is already listed in memory
      const existing = threads.find(t => t.participants.includes(selectedUser.uid));
      if (existing) {
        setActiveId(existing.id);
        setShowNewMsg(false);
        return;
      }

      // 2. Fetch sender profile details safely
      let myName = "Student";
      try {
        const myDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", currentUser.uid)));
        if (!myDoc.empty) {
          myName = myDoc.docs[0].data().fullName || "Student";
        }
      } catch (profileErr) {
        if (currentUser.email) myName = currentUser.email.split("@")[0];
      }

      // 3. Create pristine root conversation document
      const newConvRef = await addDoc(collection(db, "conversations"), {
        participants: [currentUser.uid, selectedUser.uid],
        participantNames: {
          [currentUser.uid]: myName,
          [selectedUser.uid]: selectedUser.fullName || "User"
        },
        preview: newText.trim(),
        category: "Courses",
        updatedAt: serverTimestamp(),
        unread: {
          [selectedUser.uid]: true,
          [currentUser.uid]: false
        }
      });

      // 4. Create the nested initial message document
      await addDoc(collection(db, "conversations", newConvRef.id, "messages"), {
        senderId: currentUser.uid,
        text: newText.trim(),
        createdAt: serverTimestamp()
      });

      setActiveId(newConvRef.id);
      setShowNewMsg(false);
      setSelectedUser(null);
      setSearchName("");
      setNewText("");
    } catch (e) {
      console.error("Failed creating thread setup", e);
    }
  }

  function handleKeyDown(e) { if (e.key === "Enter") handleSend(); }
  function handleCloseThread() { setActiveId(null); }
  function handleCancelNewThread() { setShowNewMsg(false); setSelectedUser(null); setSearchName(""); setNewText(""); }
  function toggleReadMore(id) { setExpandedAnnId(prev => prev === id ? null : id); }

  const filteredThreads = filter === "All" ? threads : threads.filter(t => t.category === filter);
  const filteredAnnouncements = annFilter === "All" ? announcements : announcements.filter(a => a.category === annFilter);
  const activeThread = threads.find(t => t.id === activeId);

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
            {filteredThreads.length === 0 && <p className="thread-empty">No conversations found.</p>}
            {filteredThreads.map(t => (
              <div key={t.id} className={`thread-item ${t.id === activeId ? "active" : ""} ${t.unread?.[currentUser?.uid] ? "unread-highlight" : ""}`} onClick={() => setActiveId(t.id)}>
                <div className="thread-meta-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4>{t.name}</h4>
                  {t.unread?.[currentUser?.uid] && <span className="unread-dot" style={{ width: "8px", height: "8px", backgroundColor: "#ff4d4d", borderRadius: "50%" }} />}
                </div>
                <p style={{ fontWeight: t.unread?.[currentUser?.uid] ? "bold" : "normal" }}>{t.preview}</p>
              </div>
            ))}
          </div>
          <div className="msg-add-area">
            {showNewMsg ? (
              <div className="new-msg-form">
                {!selectedUser ? (
                  <>
                    <input className="msg-input" placeholder="Type name to look up..." value={searchName} onChange={e => setSearchName(e.target.value)} />
                    <div className="search-results-box" style={{ background: "var(--background-card, #fff)", border: "1px solid var(--border, #eee)", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", margin: "4px 0" }}>
                      {searchResults.length === 0 && searchName.trim() && <p style={{ padding: "8px", fontSize: "12px", color: "var(--muted)" }}>No matches found</p>}
                      {searchResults.map(u => (
                        <div key={u.uid} className="search-user-row" onClick={() => setSelectedUser(u)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid var(--border, #f9f9f9)", fontSize: "13px" }}>
                          {u.fullName} ({u.email})
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="selected-user-tag" style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "var(--accent-light, #eef2ff)", borderRadius: "4px", fontSize: "13px", marginBottom: "6px" }}>
                    <span>To: <strong>{selectedUser.fullName}</strong></span>
                    <button onClick={() => setSelectedUser(null)} style={{ border: "none", background: "none", cursor: "pointer" }}>✕</button>
                  </div>
                )}
                <textarea className="new-msg-textarea" placeholder="Type your first message..." value={newText} onChange={e => setNewText(e.target.value)}></textarea>
                <div className="new-msg-actions">
                  <button className="btn-send" onClick={handleCreateThread} disabled={!selectedUser}>Start</button>
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
                <h3><UserIcon /> {activeThread.name}</h3>
                <button className="close-x" onClick={handleCloseThread}>✕</button>
              </div>
              <div className="msg-body">
                {messages.map((msg) => (
                  <div key={msg.id} className={msg.senderId === currentUser?.uid ? "bubble-out" : "bubble-in"}>
                    {msg.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="msg-composer">
                <input className="msg-input" placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} />
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
              <button key={f} className={`filter-pill ${annFilter === f ? "active" : ""}`} style={{ fontSize: "10px", padding: "3px 8px" }} onClick={() => setAnnFilter(f)}>{f}</button>
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
                  {isExpanded ? <p className="ann-full-text">{a.content}</p> : <><div className="ann-pline"></div><div className="ann-pline"></div></>}
                  <a className="read-more" onClick={() => toggleReadMore(a.id)} style={{ cursor: "pointer" }}>{isExpanded ? "Read Less" : "Read More"}</a>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}