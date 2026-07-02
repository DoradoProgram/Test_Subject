import { useState, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
      </div>
    </AppLayout>
  );
}