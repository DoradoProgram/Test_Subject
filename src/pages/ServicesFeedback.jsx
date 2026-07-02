import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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

export default function ServicesFeedback() {
  const [category, setCategory] = useState("");
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnap = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnap();
      if (!user) {
        setSubmissions([]);
        setSubmissionsLoading(false);
        return;
      }
      const q = query(collection(db, "serviceFeedback"), where("uid", "==", user.uid));
      unsubscribeSnap = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
          setSubmissions(rows);
          setSubmissionsLoading(false);
        },
        (err) => {
          console.error("Failed to load feedback:", err);
          setSubmissionsLoading(false);
        }
      );
    });
    return () => { unsubscribeAuth(); unsubscribeSnap(); };
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!category) newErrors.category = "Please select a category.";
    if (rating === 0) newErrors.rating = "Please give a rating.";
    if (!liked.trim() && !improve.trim())
      newErrors.feedback = "Please share at least one comment.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const user = auth.currentUser;
    if (!user) {
      setErrors({ submit: "You must be logged in to submit feedback." });
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "serviceFeedback"), {
        category,
        rating,
        liked,
        improve,
        anonymous,
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCategory("");
    setRating(0);
    setLiked("");
    setImprove("");
    setAnonymous(false);
    setErrors({});
  };
  // resetForm already clears errors (including any submit error) via setErrors({})

  const handleOk = () => {
    setSubmitted(false);
    resetForm();
  };

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/services" className="tab">Request Forms</Link>
        <Link to="/services-inquiry" className="tab">Inquiry</Link>
        <Link to="/services-feedback" className="tab active">Feedback</Link>
      </div>

      <div className="tab-content">
        <div className="services-content">
          {submitted ? (
            <div className="success-box">
              <div className="check-ico">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Feedback Submitted!</h3>
              <p>Thank you for your feedback. It helps us improve Campus Connect.</p>
              <button className="btn-ok" onClick={handleOk}>OK</button>
            </div>
          ) : (
            <>
              <h2>Submit Feedback</h2>
              <p className="sub-desc">Help us improve by sharing your experience.</p>

              <div className="svc-form">
                <div className="form-row">
                  <label>Feedback Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Select Category</option>
                    <option>Academic Services</option>
                    <option>Campus Facilities</option>
                    <option>System / App</option>
                    <option>Administrative</option>
                  </select>
                  {errors.category && <small className="error-text">{errors.category}</small>}
                </div>

                <div className="form-row">
                  <label>Overall Rating</label>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`rating-btn ${num <= rating ? "filled" : ""}`}
                        onClick={() => setRating(num)}
                      >
                        {num}
                      </button>
                    ))}
                    <span className="rating-val">{rating > 0 ? `${rating}/5` : "—"}</span>
                  </div>
                  {errors.rating && <small className="error-text">{errors.rating}</small>}
                </div>

                <div className="form-row">
                  <label>What did you like?</label>
                  <textarea
                    placeholder="Share what worked well..."
                    value={liked}
                    onChange={(e) => setLiked(e.target.value)}
                  ></textarea>
                </div>

                <div className="form-row">
                  <label>What can be improved?</label>
                  <textarea
                    placeholder="Share suggestions for improvement..."
                    value={improve}
                    onChange={(e) => setImprove(e.target.value)}
                  ></textarea>
                  {errors.feedback && <small className="error-text">{errors.feedback}</small>}
                </div>

                <div className="form-row">
                  <label>Submit anonymously?</label>
                  <div className="toggle-row" onClick={() => setAnonymous(!anonymous)}>
                    <div className={`toggle-track ${anonymous ? "active" : ""}`}></div>
                    <span className="toggle-label">
                      {anonymous ? "Yes – submitting anonymously" : "No – submit with my name"}
                    </span>
                  </div>
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-submit" onClick={handleSubmit} disabled={loading}>
                    {loading ? "Sending..." : "Send Feedback"}
                  </button>
                  <button type="button" className="btn-cancel" onClick={resetForm}>Cancel</button>
                </div>
                {errors.submit && <small className="error-text">{errors.submit}</small>}
              </div>
            </>
          )}
        </div>

        <div className="services-content" style={{ marginTop: "28px" }}>
          <h2>My Submissions</h2>
          {submissionsLoading ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Loading submissions...</p>
          ) : submissions.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>You haven't submitted any feedback yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--border)" }}>
                    <th style={{ padding: "10px 8px" }}>Category</th>
                    <th style={{ padding: "10px 8px" }}>Rating</th>
                    <th style={{ padding: "10px 8px" }}>Anonymous</th>
                    <th style={{ padding: "10px 8px" }}>Date Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px" }}>{s.category}</td>
                      <td style={{ padding: "10px 8px" }}>{s.rating ? `${s.rating}/5` : "—"}</td>
                      <td style={{ padding: "10px 8px" }}>{s.anonymous ? "Yes" : "No"}</td>
                      <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{formatDate(s.createdAt)}</td>
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