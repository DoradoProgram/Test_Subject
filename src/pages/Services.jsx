import { useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function Services() {
  const [form, setForm] = useState({ type: "", subject: "", description: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.type || !form.subject || !form.description) {
      setError("Please fill out all fields.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to submit a request.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await addDoc(collection(db, "serviceRequests"), {
        type: form.type,
        subject: form.subject,
        description: form.description,
        uid: user.uid,
        status: "pending",
        createdAt: new Date(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setForm({ type: "", subject: "", description: "" });
    setError("");
  }

  function handleReset() {
    setForm({ type: "", subject: "", description: "" });
    setSubmitted(false);
  }

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/services" className="tab active">Request Forms</Link>
        <Link to="/services-inquiry" className="tab">Inquiry</Link>
        <Link to="/services-feedback" className="tab">Feedback</Link>
      </div>

      <div className="tab-content">
        <div className="services-content">
          {!submitted ? (
            <>
              <h2>Submit a Request</h2>

              <form className="svc-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <label>Request Type</label>
                  <select value={form.type} onChange={e => handleChange("type", e.target.value)}>
                    <option value="">Select Request Type</option>
                    <option>Certificate of Enrollment</option>
                    <option>Transcript of Records</option>
                    <option>Good Moral Certificate</option>
                    <option>Leave of Absence</option>
                  </select>
                </div>

                <div className="form-row">
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="Enter subject"
                    value={form.subject}
                    onChange={e => handleChange("subject", e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label>Description</label>
                  <textarea
                    placeholder="Enter description of your request..."
                    value={form.description}
                    onChange={e => handleChange("description", e.target.value)}
                  ></textarea>
                </div>

                {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

                <div className="btn-row">
                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                  <button type="button" className="btn-cancel" onClick={handleCancel}>Cancel</button>
                </div>
              </form>
            </>
          ) : (
            <div className="success-box">
              <div className="check-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3>Submission Successful!</h3>
              <p>Your request has been submitted.</p>
              <button className="btn-ok" onClick={handleReset}>OK</button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}