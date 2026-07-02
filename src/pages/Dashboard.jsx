import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";

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

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Dashboard() {
  const [userData, setUserData] = useState(null);
  const [todayClasses, setTodayClasses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setUserData(docSnap.data());

      const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const today = days[new Date().getDay()];
      const q = query(
        collection(db, "classes"),
        where("uid", "==", user.uid),
        where("day", "==", today)
      );
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const toMinutes = t => {
            const [time, period] = t.split(" ");
            let [h, m] = time.split(":").map(Number);
            if (period === "PM" && h !== 12) h += 12;
            if (period === "AM" && h === 12) h = 0;
            return h * 60 + m;
          };
          return toMinutes(a.time) - toMinutes(b.time);
        });
      setTodayClasses(sorted);

      try {
        const annQuery = query(
          collection(db, "announcements"),
          orderBy("createdAt", "desc"),
          limit(3)
        );
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

  const displayName = userData?.fullName || auth.currentUser?.displayName || "Student";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AppLayout>
      <div className="top-header">
        <div className="top-header-left">
          <h2>Welcome back, {displayName}!</h2>
          <p>{today} · BSIT 2-1</p>
        </div>
        <div className="top-header-right">
          <button className="notif-btn">
            <BellIcon />
            <span className="notif-badge">3</span>
          </button>
          <button className="avatar-btn" style={{ overflow: "hidden", padding: 0 }}>
            {userData?.avatarUrl
              ? <img src={userData.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <UserIcon />
            }
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="stat-cards">
          <div className="stat-card">
            <div className="label">Today's Classes</div>
            <div className="value">{todayClasses.length}</div>
            <div className="sub">
              {todayClasses.length > 0
                ? `Next: ${todayClasses[0].name} – ${todayClasses[0].time}`
                : "No classes today"}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">Unread Messages</div>
            <div className="value">7</div>
            <div className="sub">Prof. Smith + 2 others</div>
          </div>
          <div className="stat-card">
            <div className="label">Pending Tasks</div>
            <div className="value">2</div>
            <div className="sub">1 form · 1 request</div>
          </div>
        </div>

        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Announcements</h3>
              <Link to="/messaging">View All</Link>
            </div>
            {annLoading ? (
              <p style={{ padding: "16px 20px", color: "var(--muted)", fontSize: "13px" }}>Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <p style={{ padding: "16px 20px", color: "var(--muted)", fontSize: "13px" }}>No announcements yet.</p>
            ) : (
              announcements.map(a => (
                <div className="ann-item" key={a.id}>
                  <h4>{a.title}</h4>
                  <div className="ann-meta">{a.office} · {timeAgo(a.createdAt)}</div>
                  <p className="ann-body">{a.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Today's Schedule</h3>
              <Link to="/schedule">View All</Link>
            </div>
            <div className="schedule-list">
              {todayClasses.length === 0 ? (
                <p style={{ padding: "4px 0", color: "var(--muted)", fontSize: "13px" }}>No classes today.</p>
              ) : (
                todayClasses.map(cls => (
                  <div className="sch-item" key={cls.id}>
                    <span className="sch-time">{cls.time}</span>
                    <div className="sch-block">
                      <div className="name">{cls.name}</div>
                      <div className="room">{cls.room}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}