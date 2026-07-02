import { useState, useRef, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

const statusColors = {
  pending: "var(--warning)",
  approved: "var(--success)",
  rejected: "var(--error)",
  resolved: "var(--success)",
};

export default function ServicesInquiry() {
  const [inquiryType, setInquiryType] = useState("");
  const [directedTo, setDirectedTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

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
      const q = query(collection(db, "serviceInquiries"), where("uid", "==", user.uid));
      unsubscribeSnap = onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
          setSubmissions(rows);
          setSubmissionsLoading(false);
        },
        (err) => {
          console.error("Failed to load inquiries:", err);
          setSubmissionsLoading(false);
        }
      );
    });
    return () => { unsubscribeAuth(); unsubscribeSnap(); };
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!inquiryType) newErrors.inquiryType = "Please select an inquiry type.";
    if (!directedTo) newErrors.directedTo = "Please select where to send this.";
    if (!subject.trim()) newErrors.subject = "Subject is required.";
    if (!message.trim()) newErrors.message = "Message is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const user = auth.currentUser;
    if (!user) {
      setErrors({ submit: "You must be logged in to send an inquiry." });
      return;
    }
    setLoading(true);
    try {
      let attachmentUrl = "";
      let attachmentName = "";
      if (file) {
        const fileRef = ref(storage, `inquiry-attachments/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        attachmentUrl = await getDownloadURL(fileRef);
        attachmentName = file.name;
      }

      await addDoc(collection(db, "serviceInquiries"), {
        inquiryType,
        directedTo,
        subject,
        message,
        attachmentUrl,
        attachmentName,
        uid: user.uid,
        status: "pending",
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
    setInquiryType("");
    setDirectedTo("");
    setSubject("");
    setMessage("");
    setFile(null);
    setErrors({});
  };

  const handleOk = () => {
    setSubmitted(false);
    resetForm();
  };

  const validateFile = (f) => {
    if (f.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: "File must be under 5MB." }));
      return false;
    }
    setErrors((prev) => ({ ...prev, file: undefined }));
    return true;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && validateFile(selected)) setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && validateFile(dropped)) setFile(dropped);
  };

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/services" className="tab">Request Forms</Link>
        <Link to="/services-inquiry" className="tab active">Inquiry</Link>
        <Link to="/services-feedback" className="tab">Feedback</Link>
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
              <h3>Inquiry Sent!</h3>
              <p>Your inquiry has been submitted. Expect a reply within 1–2 business days.</p>
              <button className="btn-ok" onClick={handleOk}>OK</button>
            </div>
          ) : (
            <>
              <h2>Send an Inquiry</h2>
              <p className="sub-desc">Have a question? Send it directly to the relevant office.</p>

              <div className="svc-form">
                <div className="form-row">
                  <label>Inquiry Type</label>
                  <select value={inquiryType} onChange={(e) => setInquiryType(e.target.value)}>
                    <option value="">Select Inquiry Type</option>
                    <option>Academic</option>
                    <option>Financial</option>
                    <option>Administrative</option>
                  </select>
                  {errors.inquiryType && <small className="error-text">{errors.inquiryType}</small>}
                </div>

                <div className="form-row">
                  <label>Directed To</label>
                  <select value={directedTo} onChange={(e) => setDirectedTo(e.target.value)}>
                    <option value="">Select Office / Instructor</option>
                    <option>Registrar</option>
                    <option>Dean's Office</option>
                    <option>Finance Office</option>
                  </select>
                  {errors.directedTo && <small className="error-text">{errors.directedTo}</small>}
                </div>

                <div className="form-row">
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="Enter subject of your inquiry"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  {errors.subject && <small className="error-text">{errors.subject}</small>}
                </div>

                <div className="form-row">
                  <label>Message</label>
                  <textarea
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  ></textarea>
                  {errors.message && <small className="error-text">{errors.message}</small>}
                </div>

                <div className="form-row">
                  <label>
                    Attachment <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div
                    className="upload-zone"
                    onClick={() => fileInputRef.current.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 16V4M12 4l-4 4M12 4l4 4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>
                      {file ? file.name : <>Drag &amp; drop or <a>browse file</a></>}
                    </p>
                    <small>PDF, DOCX, JPG – max 5MB</small>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.docx,.jpg,.jpeg"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                  </div>
                  {errors.file && <small className="error-text">{errors.file}</small>}
                </div>

                <div className="btn-row">
                  <button type="button" className="btn-submit" onClick={handleSubmit} disabled={loading}>
                    {loading ? "Sending..." : "Send Inquiry"}
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
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>You haven't sent any inquiries yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--border)" }}>
                    <th style={{ padding: "10px 8px" }}>Type</th>
                    <th style={{ padding: "10px 8px" }}>Directed To</th>
                    <th style={{ padding: "10px 8px" }}>Subject</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Date Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px" }}>{s.inquiryType}</td>
                      <td style={{ padding: "10px 8px" }}>{s.directedTo}</td>
                      <td style={{ padding: "10px 8px" }}>{s.subject}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{ color: statusColors[s.status] || "var(--muted)", fontWeight: 600, textTransform: "capitalize" }}>
                          {s.status || "pending"}
                        </span>
                      </td>
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