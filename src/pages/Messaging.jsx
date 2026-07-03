import { useEffect, useState, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNotifPrefs } from "../context/NotifPrefsContext";
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

// Builds a readable thread name. For a 1-on-1 chat it's just the other
// person's name. For a group, it's the explicit group name if set,
// otherwise a comma-joined list of everyone else in the chat.
function threadDisplayName(thread, currentUid) {
  if (thread.isGroup) {
    if (thread.groupName?.trim()) return thread.groupName.trim();
    const others = thread.participants
      .filter(uid => uid !== currentUid)
      .map(uid => thread.participantNames?.[uid] || "Unknown");
    return others.join(", ");
  }
  const otherUid = thread.participants.find(uid => uid !== currentUid);
  return thread.participantNames?.[otherUid] || "Chat Partner";
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

const GroupIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(null);
  const { notifPrefs } = useNotifPrefs();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [expandedAnnId, setExpandedAnnId] = useState(null);

  // New Chat states — selectedUsers is now an array to support groups
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [newText, setNewText] = useState("");

  const messagesEndRef = useRef(null);
  const isGroupDraft = selectedUsers.length > 1;

  // 1. Auth Observer
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
    });
    return () => unsubscribeAuth();
  }, []);

  // 1b. Announcements fetch (respects the "Announcements" notification preference)
  useEffect(() => {
    if (!currentUser) return;

    if (!notifPrefs.announcements) {
      setAnnouncements([]);
      setAnnLoading(false);
      return;
    }

    let cancelled = false;
    setAnnLoading(true);
    (async () => {
      try {
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20));
        const annSnap = await getDocs(annQuery);
        if (!cancelled) setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      } finally {
        if (!cancelled) setAnnLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser, notifPrefs.announcements]);

  // 2. Live Conversations (Inbox) Listener
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribeThreads = onSnapshot(q, (snapshot) => {
      const fetchedThreads = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: threadDisplayName(data, currentUser.uid),
          ...data
        };
      });

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

    const threadRef = doc(db, "conversations", activeId);
    updateDoc(threadRef, {
      [`unread.${currentUser.uid}`]: false
    }).catch(err => console.error("Could not clear unread count:", err));

    return () => unsubscribeMessages();
  }, [activeId, currentUser]);

  // 4. Case-insensitive "contains" user search
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
              !selectedUsers.some(su => su.uid === u.uid) &&
              (u.fullName || "").toLowerCase().includes(needle)
            )
            .slice(0, 20)
        );
      } catch (e) {
        console.error("User query failed", e);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchName, currentUser, selectedUsers]);

  // Send Message Dispatcher — now marks unread for every other participant
  async function handleSend() {
    if (!input.trim() || !activeId || !currentUser) return;

    const messageText = input.trim();
    setInput("");

    try {
      const currentThread = threads.find(t => t.id === activeId);
      const otherParticipants = currentThread.participants.filter(uid => uid !== currentUser.uid);

      await addDoc(collection(db, "conversations", activeId, "messages"), {
        senderId: currentUser.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });

      const unreadUpdates = {};
      otherParticipants.forEach(uid => { unreadUpdates[`unread.${uid}`] = true; });

      await updateDoc(doc(db, "conversations", activeId), {
        preview: messageText,
        updatedAt: serverTimestamp(),
        ...unreadUpdates
      });
    } catch (err) {
      console.error("Error dispatching message:", err);
    }
  }

  function toggleSelectedUser(user) {
    setSelectedUsers(prev =>
      prev.some(u => u.uid === user.uid)
        ? prev.filter(u => u.uid !== user.uid)
        : [...prev, user]
    );
    setSearchName("");
    setSearchResults([]);
  }

  function removeSelectedUser(uid) {
    setSelectedUsers(prev => prev.filter(u => u.uid !== uid));
  }

  // Conversation Generator — supports 1-on-1 (existing behavior) and groups
  async function handleCreateThread() {
    if (selectedUsers.length === 0 || !newText.trim() || !currentUser) return;

    const group = selectedUsers.length > 1;

    try {
      // For 1-on-1 chats only: reuse an existing thread with that same person
      if (!group) {
        const existing = threads.find(t =>
          !t.isGroup &&
          t.participants.length === 2 &&
          t.participants.includes(selectedUsers[0].uid)
        );
        if (existing) {
          setActiveId(existing.id);
          setShowNewMsg(false);
          resetNewMsgForm();
          return;
        }
      }

      // Fetch sender's own display name
      let myName = "Student";
      try {
        const myDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", currentUser.uid)));
        if (!myDoc.empty) {
          myName = myDoc.docs[0].data().fullName || "Student";
        }
      } catch {
        if (currentUser.email) myName = currentUser.email.split("@")[0];
      }

      const participantNames = { [currentUser.uid]: myName };
      selectedUsers.forEach(u => { participantNames[u.uid] = u.fullName || "User"; });

      const unread = { [currentUser.uid]: false };
      selectedUsers.forEach(u => { unread[u.uid] = true; });

      const newConvRef = await addDoc(collection(db, "conversations"), {
        participants: [currentUser.uid, ...selectedUsers.map(u => u.uid)],
        participantNames,
        isGroup: group,
        groupName: group ? groupName.trim() : "",
        preview: newText.trim(),
        category: "Courses",
        updatedAt: serverTimestamp(),
        unread
      });

      await addDoc(collection(db, "conversations", newConvRef.id, "messages"), {
        senderId: currentUser.uid,
        text: newText.trim(),
        createdAt: serverTimestamp()
      });

      setActiveId(newConvRef.id);
      setShowNewMsg(false);
      resetNewMsgForm();
    } catch (e) {
      console.error("Failed creating thread setup", e);
    }
  }

  function resetNewMsgForm() {
    setSelectedUsers([]);
    setGroupName("");
    setSearchName("");
    setNewText("");
  }

  function handleKeyDown(e) { if (e.key === "Enter") handleSend(); }
  function handleCloseThread() { setActiveId(null); }
  function handleCancelNewThread() { setShowNewMsg(false); resetNewMsgForm(); }
  function toggleReadMore(id) { setExpandedAnnId(prev => prev === id ? null : id); }

  const activeThread = threads.find(t => t.id === activeId);

  return (
    <AppLayout>
      <div className="messaging-layout">
        {/* Inbox sidebar */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-header"><h3>Inbox</h3></div>
          <div className="thread-list">
            {threads.length === 0 && <p className="thread-empty">No conversations found.</p>}
            {threads.map(t => (
              <div key={t.id} className={`thread-item ${t.id === activeId ? "active" : ""} ${t.unread?.[currentUser?.uid] ? "unread-highlight" : ""}`} onClick={() => setActiveId(t.id)}>
                <div className="thread-meta-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4>{t.isGroup && "👥 "}{t.name}</h4>
                  {t.unread?.[currentUser?.uid] && <span className="unread-dot" style={{ width: "8px", height: "8px", backgroundColor: "#ff4d4d", borderRadius: "50%" }} />}
                </div>
                <p style={{ fontWeight: t.unread?.[currentUser?.uid] ? "bold" : "normal" }}>{t.preview}</p>
              </div>
            ))}
          </div>
          <div className="msg-add-area">
            {showNewMsg ? (
              <div className="new-msg-form">
                {selectedUsers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                    {selectedUsers.map(u => (
                      <span key={u.uid} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "var(--accent-light, #eef2ff)", borderRadius: "999px", fontSize: "12px" }}>
                        {u.fullName}
                        <button onClick={() => removeSelectedUser(u.uid)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "12px", lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  className="msg-input"
                  placeholder={selectedUsers.length > 0 ? "Add another person..." : "Type name to look up..."}
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                />
                <div className="search-results-box" style={{ background: "var(--background-card, #fff)", border: "1px solid var(--border, #eee)", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", margin: "4px 0" }}>
                  {searchResults.length === 0 && searchName.trim() && <p style={{ padding: "8px", fontSize: "12px", color: "var(--muted)" }}>No matches found</p>}
                  {searchResults.map(u => (
                    <div key={u.uid} className="search-user-row" onClick={() => toggleSelectedUser(u)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid var(--border, #f9f9f9)", fontSize: "13px" }}>
                      {u.fullName} ({u.email})
                    </div>
                  ))}
                </div>

                {isGroupDraft && (
                  <input
                    className="msg-input"
                    placeholder="Group name (optional)"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                )}

                <textarea className="new-msg-textarea" placeholder="Type your first message..." value={newText} onChange={e => setNewText(e.target.value)}></textarea>
                <div className="new-msg-actions">
                  <button className="btn-send" onClick={handleCreateThread} disabled={selectedUsers.length === 0}>
                    {isGroupDraft ? "Create Group" : "Start"}
                  </button>
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
                <h3>{activeThread.isGroup ? <GroupIcon /> : <UserIcon />} {activeThread.name}</h3>
                <button className="close-x" onClick={handleCloseThread}>✕</button>
              </div>
              <div className="msg-body">
                {messages.map((msg) => {
                  const isMine = msg.senderId === currentUser?.uid;
                  const senderName = activeThread.participantNames?.[msg.senderId];
                  return (
                    <div key={msg.id} className={isMine ? "bubble-out" : "bubble-in"}>
                      {activeThread.isGroup && !isMine && (
                        <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.7, marginBottom: "2px" }}>
                          {senderName}
                        </div>
                      )}
                      {msg.text}
                    </div>
                  );
                })}
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
          {annLoading ? (
            <p className="thread-empty">Loading announcements...</p>
          ) : !notifPrefs.announcements ? (
            <p className="thread-empty">Announcement notifications are turned off. Enable them in Settings to see updates here.</p>
          ) : announcements.length === 0 ? (
            <p className="thread-empty">No announcements in this category.</p>
          ) : (
            announcements.map(a => {
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