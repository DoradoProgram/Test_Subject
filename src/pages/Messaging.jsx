import { useEffect, useState, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNotifPrefs } from "../context/NotifPrefsContext";
import {
  collection, query, orderBy, limit, getDocs, doc,
  addDoc, serverTimestamp, onSnapshot, where, updateDoc,
  deleteDoc, arrayUnion, setDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── AI Assistant config ──────────────────────────────────────────────
// NOTE: this calls the Gemini API directly from the browser using a key
// in .env. That's fine for a school project demo, but it means the key
// is visible in the browser's network tab — anyone could copy it out of
// devtools. For anything beyond a class demo, this call should go
// through a small backend/Cloud Function that holds the key instead.
const AI_UID = "ai-assistant-bot";
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash"; // check aistudio.google.com if this model name changes

async function askGemini(history) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: history.map(m => ({
          role: m.senderId === AI_UID ? "model" : "user",
          parts: [{ text: m.text }],
        })),
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
}

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

// Resolves how to show a participant: nickname (if set) > real name > fallback.
function displayNameFor(thread, uid) {
  return thread.nicknames?.[uid] || thread.participantNames?.[uid] || "Unknown";
}

function threadDisplayName(thread, currentUid) {
  if (thread.isAI) return "AI Assistant";
  if (thread.isGroup) {
    if (thread.groupName?.trim()) return thread.groupName.trim();
    const others = thread.participants
      .filter(uid => uid !== currentUid)
      .map(uid => displayNameFor(thread, uid));
    return others.join(", ");
  }
  const otherUid = thread.participants.find(uid => uid !== currentUid);
  return displayNameFor(thread, otherUid);
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
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
  </svg>
);
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
);
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const RobotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(null);
  const { notifPrefs } = useNotifPrefs();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);

  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [expandedAnnId, setExpandedAnnId] = useState(null);

  const [showNewMsg, setShowNewMsg] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [newText, setNewText] = useState("");

  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [addingMember, setAddingMember] = useState(false);

  const [showMembers, setShowMembers] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const isGroupDraft = selectedUsers.length > 1;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
    });
    return () => unsubscribeAuth();
  }, []);

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

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );
    const unsubscribeThreads = onSnapshot(q, (snapshot) => {
      const fetchedThreads = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { id: docSnap.id, name: threadDisplayName(data, currentUser.uid), ...data };
      });
      fetchedThreads.sort((a, b) => {
        if (a.isAI) return -1;
        if (b.isAI) return 1;
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

  useEffect(() => {
    if (!activeId || !currentUser) { setMessages([]); return; }
    const msgsQuery = query(
      collection(db, "conversations", activeId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribeMessages = onSnapshot(msgsQuery, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    const threadRef = doc(db, "conversations", activeId);
    updateDoc(threadRef, { [`unread.${currentUser.uid}`]: false }).catch(err => console.error("Could not clear unread count:", err));
    return () => unsubscribeMessages();
  }, [activeId, currentUser]);

  useEffect(() => {
    if (!searchName.trim()) { setSearchResults([]); return; }
    const delayDebounce = setTimeout(async () => {
      try {
        const needle = searchName.trim().toLowerCase();
        const snap = await getDocs(collection(db, "users"));
        setSearchResults(
          snap.docs.map(d => ({ uid: d.id, ...d.data() }))
            .filter(u => u.uid !== currentUser.uid && !selectedUsers.some(su => su.uid === u.uid) && (u.fullName || "").toLowerCase().includes(needle))
            .slice(0, 20)
        );
      } catch (e) { console.error("User query failed", e); }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [searchName, currentUser, selectedUsers]);

  useEffect(() => {
    if (!showAddMember || !addMemberSearch.trim() || !currentUser) { setAddMemberResults([]); return; }
    const activeThread = threads.find(t => t.id === activeId);
    const delayDebounce = setTimeout(async () => {
      try {
        const needle = addMemberSearch.trim().toLowerCase();
        const snap = await getDocs(collection(db, "users"));
        setAddMemberResults(
          snap.docs.map(d => ({ uid: d.id, ...d.data() }))
            .filter(u => !activeThread?.participants.includes(u.uid) && (u.fullName || "").toLowerCase().includes(needle))
            .slice(0, 20)
        );
      } catch (e) { console.error("Add-member search failed", e); }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [addMemberSearch, showAddMember, activeId, threads, currentUser]);

  async function handleSend() {
    if (!input.trim() || !activeId || !currentUser) return;
    const messageText = input.trim();
    setInput("");
    const currentThread = threads.find(t => t.id === activeId);

    try {
      await addDoc(collection(db, "conversations", activeId, "messages"), {
        senderId: currentUser.uid, text: messageText, createdAt: serverTimestamp()
      });

      if (currentThread?.isAI) {
        await handleAiReply(currentThread, messageText);
        return;
      }

      const otherParticipants = currentThread.participants.filter(uid => uid !== currentUser.uid);
      const unreadUpdates = {};
      otherParticipants.forEach(uid => { unreadUpdates[`unread.${uid}`] = true; });

      await updateDoc(doc(db, "conversations", activeId), {
        preview: messageText, updatedAt: serverTimestamp(), ...unreadUpdates
      });
    } catch (err) {
      console.error("Error dispatching message:", err);
    }
  }

  async function handleAiReply(thread, latestUserText) {
    setAiThinking(true);
    try {
      const history = [...messages, { senderId: currentUser.uid, text: latestUserText }];
      const replyText = await askGemini(history);
      await addDoc(collection(db, "conversations", thread.id, "messages"), {
        senderId: AI_UID, text: replyText, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "conversations", thread.id), {
        preview: replyText.slice(0, 80), updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Gemini call failed:", err);
      await addDoc(collection(db, "conversations", thread.id, "messages"), {
        senderId: AI_UID, text: "Sorry, I couldn't reach the AI service. Check that VITE_GEMINI_API_KEY is set correctly.", createdAt: serverTimestamp()
      });
    } finally {
      setAiThinking(false);
    }
  }

  // Opens (or creates) the pinned AI Assistant thread
  async function openAiAssistant() {
    if (!currentUser) return;
    const convId = `ai_${currentUser.uid}`;
    await setDoc(doc(db, "conversations", convId), {
      participants: [currentUser.uid],
      participantNames: { [currentUser.uid]: "You" },
      isAI: true,
      isGroup: false,
      preview: "Ask me anything!",
      updatedAt: serverTimestamp(),
      unread: { [currentUser.uid]: false }
    }, { merge: true });
    setActiveId(convId);
  }

  async function handleDeleteMessage(msgId) {
    if (!window.confirm("Delete this message? This can't be undone.")) return;
    try {
      await deleteDoc(doc(db, "conversations", activeId, "messages", msgId));
    } catch (err) { console.error("Failed to delete message:", err); }
  }

  async function handleDeleteConversation(threadId) {
    const isCurrentlyOpen = threadId === activeId;
    if (!window.confirm("Delete this entire conversation for everyone? This can't be undone.")) return;
    try {
      const msgsSnap = await getDocs(collection(db, "conversations", threadId, "messages"));
      await Promise.all(msgsSnap.docs.map(m => deleteDoc(m.ref)));
      await deleteDoc(doc(db, "conversations", threadId));
      if (isCurrentlyOpen) setActiveId(null);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      alert("Couldn't delete this conversation. You may not have permission.");
    }
  }

  function toggleSelectedUser(user) {
    setSelectedUsers(prev => prev.some(u => u.uid === user.uid) ? prev.filter(u => u.uid !== user.uid) : [...prev, user]);
    setSearchName(""); setSearchResults([]);
  }
  function removeSelectedUser(uid) { setSelectedUsers(prev => prev.filter(u => u.uid !== uid)); }

  async function handleAddMember(user) {
    if (!activeId || addingMember) return;
    setAddingMember(true);
    try {
      await updateDoc(doc(db, "conversations", activeId), {
        participants: arrayUnion(user.uid),
        [`participantNames.${user.uid}`]: user.fullName || "User",
        [`unread.${user.uid}`]: true,
        isGroup: true,
        updatedAt: serverTimestamp()
      });
      setAddMemberSearch(""); setAddMemberResults([]); setShowAddMember(false);
    } catch (err) {
      console.error("Failed to add member:", err);
      alert("Couldn't add that member.");
    } finally { setAddingMember(false); }
  }

  // Rename a group's display name
  async function handleRenameGroup(thread) {
    const newName = window.prompt("Rename this group:", thread.groupName || "");
    if (newName === null) return;
    try {
      await updateDoc(doc(db, "conversations", thread.id), { groupName: newName.trim() });
    } catch (err) {
      console.error("Failed to rename group:", err);
      alert("Couldn't rename this group.");
    }
  }

  // Set a nickname for a specific participant, shared across the conversation
  async function handleSetNickname(thread, uid, currentNickname) {
    const realName = thread.participantNames?.[uid] || "this person";
    const newNick = window.prompt(`Set a nickname for ${realName}:`, currentNickname || "");
    if (newNick === null) return;
    try {
      await updateDoc(doc(db, "conversations", thread.id), {
        [`nicknames.${uid}`]: newNick.trim()
      });
    } catch (err) {
      console.error("Failed to set nickname:", err);
      alert("Couldn't save that nickname.");
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId || !currentUser) return;
    if (file.size > 10 * 1024 * 1024) { alert("File must be under 10MB."); return; }

    setUploading(true);
    try {
      const path = `chat-uploads/${activeId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const fileURL = await getDownloadURL(fileRef);
      const isImage = file.type.startsWith("image/");

      await addDoc(collection(db, "conversations", activeId, "messages"), {
        senderId: currentUser.uid,
        text: "",
        fileURL, fileName: file.name, fileType: file.type,
        createdAt: serverTimestamp()
      });

      const currentThread = threads.find(t => t.id === activeId);
      const otherParticipants = currentThread?.participants.filter(uid => uid !== currentUser.uid) || [];
      const unreadUpdates = {};
      otherParticipants.forEach(uid => { unreadUpdates[`unread.${uid}`] = true; });

      await updateDoc(doc(db, "conversations", activeId), {
        preview: isImage ? "📷 Photo" : `📎 ${file.name}`,
        updatedAt: serverTimestamp(),
        ...unreadUpdates
      });
    } catch (err) {
      console.error("File upload failed:", err);
      alert("Upload failed. Check your Storage rules and connection.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateThread() {
    if (selectedUsers.length === 0 || !newText.trim() || !currentUser) return;
    const group = selectedUsers.length > 1;

    try {
      if (!group) {
        const existing = threads.find(t => !t.isGroup && !t.isAI && t.participants.length === 2 && t.participants.includes(selectedUsers[0].uid));
        if (existing) {
          setActiveId(existing.id); setShowNewMsg(false); resetNewMsgForm(); return;
        }
      }

      let myName = "Student";
      try {
        const myDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", currentUser.uid)));
        if (!myDoc.empty) myName = myDoc.docs[0].data().fullName || "Student";
      } catch {
        if (currentUser.email) myName = currentUser.email.split("@")[0];
      }

      const participantNames = { [currentUser.uid]: myName };
      selectedUsers.forEach(u => { participantNames[u.uid] = u.fullName || "User"; });
      const unread = { [currentUser.uid]: false };
      selectedUsers.forEach(u => { unread[u.uid] = true; });

      const newConvRef = await addDoc(collection(db, "conversations"), {
        participants: [currentUser.uid, ...selectedUsers.map(u => u.uid)],
        participantNames, isGroup: group, groupName: group ? groupName.trim() : "",
        nicknames: {}, preview: newText.trim(), category: "Courses",
        updatedAt: serverTimestamp(), unread
      });

      await addDoc(collection(db, "conversations", newConvRef.id, "messages"), {
        senderId: currentUser.uid, text: newText.trim(), createdAt: serverTimestamp()
      });

      setActiveId(newConvRef.id); setShowNewMsg(false); resetNewMsgForm();
    } catch (e) { console.error("Failed creating thread setup", e); }
  }

  function resetNewMsgForm() { setSelectedUsers([]); setGroupName(""); setSearchName(""); setNewText(""); }
  function handleKeyDown(e) { if (e.key === "Enter") handleSend(); }
  function handleCloseThread() { setActiveId(null); setShowAddMember(false); setShowMembers(false); }
  function handleCancelNewThread() { setShowNewMsg(false); resetNewMsgForm(); }
  function toggleReadMore(id) { setExpandedAnnId(prev => prev === id ? null : id); }

  const activeThread = threads.find(t => t.id === activeId);

  return (
    <AppLayout>
      <div className="messaging-layout">
        {/* Inbox sidebar */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Inbox</h3>
            <button
              onClick={openAiAssistant}
              title="Chat with AI Assistant"
              style={{ border: "1px solid var(--border, #ddd)", background: "none", borderRadius: "6px", cursor: "pointer", padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
            >
              <RobotIcon /> AI
            </button>
          </div>
          <div className="thread-list">
            {threads.length === 0 && <p className="thread-empty">No conversations found.</p>}
            {threads.map(t => (
              <div key={t.id} className={`thread-item ${t.id === activeId ? "active" : ""} ${t.unread?.[currentUser?.uid] ? "unread-highlight" : ""}`} onClick={() => setActiveId(t.id)}>
                <div className="thread-meta-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4>{t.isAI ? "🤖 " : t.isGroup ? "👥 " : ""}{t.name}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {t.unread?.[currentUser?.uid] && <span className="unread-dot" style={{ width: "8px", height: "8px", backgroundColor: "#ff4d4d", borderRadius: "50%" }} />}
                    {!t.isAI && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(t.id); }}
                        title="Delete conversation"
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", padding: "2px", display: "flex" }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
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
                <input className="msg-input" placeholder={selectedUsers.length > 0 ? "Add another person..." : "Type name to look up..."} value={searchName} onChange={e => setSearchName(e.target.value)} />
                <div className="search-results-box" style={{ background: "var(--background-card, #fff)", border: "1px solid var(--border, #eee)", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", margin: "4px 0" }}>
                  {searchResults.length === 0 && searchName.trim() && <p style={{ padding: "8px", fontSize: "12px", color: "var(--muted)" }}>No matches found</p>}
                  {searchResults.map(u => (
                    <div key={u.uid} className="search-user-row" onClick={() => toggleSelectedUser(u)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid var(--border, #f9f9f9)", fontSize: "13px" }}>
                      {u.fullName} ({u.email})
                    </div>
                  ))}
                </div>
                {isGroupDraft && (
                  <input className="msg-input" placeholder="Group name (optional)" value={groupName} onChange={e => setGroupName(e.target.value)} style={{ marginTop: "4px" }} />
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
                <h3>{activeThread.isAI ? <RobotIcon /> : activeThread.isGroup ? <GroupIcon /> : <UserIcon />} {activeThread.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {activeThread.isGroup && (
                    <button onClick={() => handleRenameGroup(activeThread)} title="Rename group" style={{ border: "1px solid var(--border, #ddd)", background: "none", borderRadius: "6px", cursor: "pointer", padding: "4px 8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <EditIcon /> Rename
                    </button>
                  )}
                  {!activeThread.isAI && (
                    <button onClick={() => setShowMembers(s => !s)} title="Members & nicknames" style={{ border: "1px solid var(--border, #ddd)", background: "none", borderRadius: "6px", cursor: "pointer", padding: "4px 8px", fontSize: "12px" }}>
                      Members
                    </button>
                  )}
                  {activeThread.isGroup && (
                    <button onClick={() => setShowAddMember(s => !s)} title="Add member" style={{ border: "1px solid var(--border, #ddd)", background: "none", borderRadius: "6px", cursor: "pointer", padding: "4px 8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <PlusIcon /> Add
                    </button>
                  )}
                  {!activeThread.isAI && (
                    <button onClick={() => handleDeleteConversation(activeThread.id)} title="Delete conversation" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
                      <TrashIcon />
                    </button>
                  )}
                  <button className="close-x" onClick={handleCloseThread}>✕</button>
                </div>
              </div>

              {showMembers && !activeThread.isAI && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border, #eee)" }}>
                  {activeThread.participants.map(uid => (
                    <div key={uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: "13px" }}>
                      <span>
                        {activeThread.participantNames?.[uid]}
                        {activeThread.nicknames?.[uid] && <span style={{ color: "var(--muted)" }}> — “{activeThread.nicknames[uid]}”</span>}
                        {uid === currentUser?.uid && " (you)"}
                      </span>
                      <button onClick={() => handleSetNickname(activeThread, uid, activeThread.nicknames?.[uid])} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--primary, #6366f1)", fontSize: "12px" }}>
                        Set nickname
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddMember && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border, #eee)" }}>
                  <input className="msg-input" placeholder="Search a name to add..." value={addMemberSearch} onChange={e => setAddMemberSearch(e.target.value)} autoFocus />
                  <div style={{ maxHeight: "140px", overflowY: "auto", marginTop: "4px" }}>
                    {addMemberResults.length === 0 && addMemberSearch.trim() && <p style={{ padding: "6px 4px", fontSize: "12px", color: "var(--muted)" }}>No matches found</p>}
                    {addMemberResults.map(u => (
                      <div key={u.uid} onClick={() => handleAddMember(u)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid var(--border, #f9f9f9)", fontSize: "13px" }}>
                        {u.fullName} ({u.email})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="msg-body">
                {messages.map((msg) => {
                  const isMine = msg.senderId === currentUser?.uid;
                  const senderName = displayNameFor(activeThread, msg.senderId) || (msg.senderId === AI_UID ? "AI Assistant" : "");
                  const isImage = msg.fileType?.startsWith("image/");

                  return (
                    <div key={msg.id} className={isMine ? "bubble-out" : "bubble-in"} style={{ position: "relative", paddingRight: isMine ? "24px" : undefined }}>
                      {(activeThread.isGroup || activeThread.isAI) && !isMine && (
                        <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.7, marginBottom: "2px" }}>{senderName}</div>
                      )}

                      {msg.fileURL ? (
                        isImage ? (
                          <a href={msg.fileURL} target="_blank" rel="noreferrer">
                            <img src={msg.fileURL} alt={msg.fileName} style={{ maxWidth: "220px", maxHeight: "220px", borderRadius: "8px", display: "block" }} />
                          </a>
                        ) : (
                          <a href={msg.fileURL} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", color: "inherit", textDecoration: "underline" }}>
                            <FileIcon /> {msg.fileName}
                          </a>
                        )
                      ) : (
                        msg.text
                      )}

                      {isMine && (
                        <button onClick={() => handleDeleteMessage(msg.id)} title="Delete message" style={{ position: "absolute", top: "4px", right: "4px", border: "none", background: "none", cursor: "pointer", opacity: 0.6, color: "inherit", display: "flex", padding: 0 }}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  );
                })}
                {aiThinking && <div className="bubble-in" style={{ opacity: 0.6, fontStyle: "italic" }}>AI Assistant is typing...</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="msg-composer">
                {!activeThread.isAI && (
                  <>
                    <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelected} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Send a photo or file"
                      style={{ border: "1px solid var(--border, #ddd)", background: "none", borderRadius: "6px", cursor: "pointer", padding: "0 10px", display: "flex", alignItems: "center" }}
                    >
                      <PaperclipIcon />
                    </button>
                  </>
                )}
                <input className="msg-input" placeholder={uploading ? "Uploading..." : "Type a message..."} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={uploading} />
                <button className="btn-send" onClick={handleSend} disabled={uploading || aiThinking}>Send</button>
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