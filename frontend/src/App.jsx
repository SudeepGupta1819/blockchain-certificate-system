import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import VerifyPage from './VerifyPage';
import './App.css';

const SESSION_KEY = 'certificate-admin-session';
const CERTIFICATES_KEY = 'issued-certificates';
const getStored = (key, fallback) => {
  try {
    return JSON.parse(sessionStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};
const saveCertificates = (items) => sessionStorage.setItem(CERTIFICATES_KEY, JSON.stringify(items));
const isStrongPassword = (password) => password.length >= 8
  && /[A-Z]/.test(password)
  && /[a-z]/.test(password)
  && /[0-9]/.test(password);

const badge = (status) => ({
  VALID: 'bg-black text-white px-2 py-0.5 text-xs font-bold inline-block',
  REVOKED: 'text-black px-2 py-0.5 text-xs font-bold line-through inline-block',
  INVALID: 'text-black px-2 py-0.5 text-xs font-bold inline-block',
  NOT_FOUND: 'text-black px-2 py-0.5 text-xs font-bold inline-block'
}[status] || 'text-black px-2 py-0.5 text-xs inline-block');

function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className="py-2 text-sm text-black">
      <span className="font-bold">{notice.type === 'error' ? 'Error: ' : 'Notice: '}</span>
      {notice.text}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-black">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-black">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-black">{value || '—'}</dd>
    </div>
  );
}

function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-black">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-bold text-black">{title}</h1>
      {children}
    </div>
  );
}

function ProtectedRoute({ session, children }) {
  const location = useLocation();
  return session ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(() => location.state?.notice || null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const data = await api.login(form);
      onLogin({ token: data.token, user: data.user });
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* LEFT SIDE — About the application */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="max-w-xl">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-black">
            Blockchain-Based Certificate Verification
          </h1>
          <p className="mt-4 text-base text-black leading-relaxed">
            A secure credential verification system designed to prevent document fraud by synchronizing institutional records with an immutable blockchain ledger.
          </p>

          <div className="mt-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-black">
                1. Secure Certificate Issuance
              </h2>
              <p className="mt-1 text-sm text-black leading-normal">
                Certificates are issued by administrators and recorded using blockchain technology.
              </p>
            </div>

            <div>
              <h2 className="text-base font-bold text-black">
                2. Tamper Detection
              </h2>
              <p className="mt-1 text-sm text-black leading-normal">
                SHA-256 hashing helps detect modifications to certificate PDFs.
              </p>
            </div>

            <div>
              <h2 className="text-base font-bold text-black">
                3. Instant Verification
              </h2>
              <p className="mt-1 text-sm text-black leading-normal">
                Verify a certificate using its ID and original PDF.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <p className="text-xs font-semibold uppercase tracking-wider text-black">
              College DBMS Project
            </p>
          </div>
        </div>
      </section>

      {/* RIGHT SIDE — Sign-in options */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center lg:items-end px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black">Certificate Verification System</h2>
            <p className="mt-1 text-sm text-black">Administrator Sign In</p>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="admin@college.edu"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="Your password"
              />
            </Field>
            <Notice notice={notice} />
            <button disabled={loading} className="button w-full">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-black">
              Don&apos;t have an account?{' '}
              <NavLink to="/signup" className="font-semibold underline hover:opacity-80">
                Sign Up
              </NavLink>
            </p>
            <p className="text-sm text-black">
              <NavLink to="/verify" className="underline hover:opacity-80">
                Go to Public Certificate Verification →
              </NavLink>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SignUpPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async (event) => {
    if (event) event.preventDefault();
    setNotice(null);

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setNotice({ type: 'error', text: 'All fields are required.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setNotice({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (!isStrongPassword(password)) {
      setNotice({ type: 'error', text: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number. Special characters are optional.' });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const data = await api.sendOtp(trimmedEmail);
      setStep('otp');
      setCountdown(60);
      setNotice({
        type: 'success',
        text: data.message || `A 6-digit verification code was sent to ${trimmedEmail}.`
      });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setNotice(null);
    setLoading(true);
    try {
      const data = await api.sendOtp(form.email.trim());
      setCountdown(60);
      setNotice({
        type: 'success',
        text: data.message || 'A new verification code has been sent to your email.'
      });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (event) => {
    if (event) event.preventDefault();
    setNotice(null);

    if (!isStrongPassword(form.password)) {
      setNotice({ type: 'error', text: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number. Special characters are optional.' });
      setStep('form');
      return;
    }

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setNotice({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = form.email.trim();
      const verifyData = await api.verifyOtp({
        email: trimmedEmail,
        otp: trimmedOtp
      });

      const regData = await api.register({
        name: form.name.trim(),
        email: trimmedEmail,
        password: form.password,
        verificationToken: verifyData.verificationToken
      });

      navigate('/login', {
        replace: true,
        state: {
          notice: {
            type: 'success',
            text: regData.message || 'Account registered successfully! Please sign in.'
          }
        }
      });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col justify-center px-4 py-12">
      <div className="mx-auto max-w-sm w-full bg-white p-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-black">Certificate Verification System</h1>
          <p className="mt-1 text-sm text-black">
            {step === 'form' ? 'Create Administrator Account' : 'Email OTP Verification'}
          </p>
        </div>

        {step === 'form' ? (
          <form className="space-y-4" onSubmit={handleSendOtp}>
            <Field label="Full Name">
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="e.g. John Doe"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="admin@college.edu"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="Create a password"
                aria-invalid={Boolean(form.password) && !isStrongPassword(form.password)}
              />
            </Field>
            <p className="-mt-3 text-xs text-black">
              Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number. Special characters are optional.
            </p>
            {form.password && !isStrongPassword(form.password) && (
              <p className="-mt-3 text-xs font-semibold text-red-700" role="alert">
                This password does not meet the requirements yet.
              </p>
            )}
            <Field label="Confirm Password">
              <input
                required
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="input"
                placeholder="Confirm your password"
              />
            </Field>
            <Notice notice={notice} />
            <button disabled={loading || !isStrongPassword(form.password)} className="button w-full">
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleVerifyAndRegister}>
            <div className="py-2 text-sm text-black">
              <span className="font-bold">Email: </span>
              <span>{form.email.trim()}</span>
            </div>
            <Field label="6-Digit Verification Code">
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="input tracking-widest text-center text-lg font-bold"
                placeholder="123456"
                autoFocus
              />
            </Field>
            <Notice notice={notice} />
            <button disabled={loading || otp.trim().length !== 6} className="button w-full">
              {loading ? 'Verifying…' : 'Verify OTP & Register'}
            </button>
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                disabled={countdown > 0 || loading}
                onClick={handleResendOtp}
                className="underline hover:opacity-80 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed bg-transparent border-0 p-0 text-black cursor-pointer"
              >
                {countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setOtp('');
                  setNotice(null);
                }}
                className="underline hover:opacity-80 bg-transparent border-0 p-0 text-black cursor-pointer"
              >
                Change Email / Details
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center">
          <p className="text-sm text-black">
            Already have an account?{' '}
            <NavLink to="/login" className="font-semibold underline hover:opacity-80">
              Sign In
            </NavLink>
          </p>
        </div>
        <div className="mt-3 text-center">
          <NavLink to="/verify" className="text-sm text-black underline hover:opacity-80">
            Go to Public Certificate Verification →
          </NavLink>
        </div>
      </div>
    </main>
  );
}

function Layout({ session, logout, children }) {
  const links = [
    ['/dashboard', 'Dashboard'],
    ['/students', 'Students'],
    ['/issue', 'Issue Certificate'],
    ['/certificates', 'Certificates'],
    ['/verification-logs', 'Verification Logs'],
    ['/verify', 'Public Verification']
  ];
  const name = session?.user?.name || 'Administrator';

  return (
    <div className="min-h-screen bg-white lg:flex">
      {/* Sidebar */}
      <aside className="bg-white p-4 lg:min-h-screen lg:w-56 shrink-0">
        <div className="mb-6">
          <NavLink to="/dashboard" className="text-base font-bold text-black block">
            Certificate System
          </NavLink>
          <p className="text-xs text-black mt-1">Admin Portal</p>
        </div>
        <nav className="space-y-1">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-12 items-center justify-between bg-white px-6">
          <div className="text-xs font-semibold text-black uppercase tracking-wider">
            College DBMS Project
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-black">
              Logged in as: <strong className="text-black">{name}</strong>
            </span>
            <button
              onClick={logout}
              className="text-xs border border-black bg-white px-2.5 py-1 text-black font-semibold hover:bg-black hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ token }) {
  const [certificates, setCertificates] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getCertificates(token), api.getStudents(token)])
      .then(([certificateData, studentData]) => {
        if (!active) return;
        setCertificates(certificateData.certificates || []);
        setStudentCount((studentData.students || []).length);
      })
      .catch((fetchError) => { if (active) setError(fetchError.message); });
    return () => { active = false; };
  }, [token]);

  const valid = certificates.filter((c) => c.status === 'VALID').length;
  const revoked = certificates.filter((c) => c.status === 'REVOKED').length;
  const stats = [
    ['Students', studentCount],
    ['Certificates', certificates.length],
    ['Valid Certificates', valid],
    ['Revoked Certificates', revoked]
  ];

  return (
    <>
      <PageTitle eyebrow="Overview" title="Dashboard">
        <p className="mt-1 text-sm text-black">
          Issue, verify, and manage certificates from the administration panel.
        </p>
      </PageTitle>
      {error && <Notice notice={{ type: 'error', text: error }} />}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-xs font-bold uppercase tracking-wider text-black">{label}</p>
            <p className="mt-2 text-3xl font-bold text-black">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function StudentPage({ token }) {
  const [form, setForm] = useState({ studentId: '', course: '', department: '', graduationYear: new Date().getFullYear() });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState(null);

  const loadStudents = async () => {
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const data = await api.getStudents(token);
      setStudents(data.students || []);
    } catch (error) {
      setStudentsError(error.message);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.getStudents(token)
      .then((data) => {
        if (active) setStudents(data.students || []);
      })
      .catch((error) => {
        if (active) setStudentsError(error.message);
      })
      .finally(() => {
        if (active) setStudentsLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const data = await api.createStudent({ ...form, graduationYear: Number(form.graduationYear) }, token);
      setNotice({ type: 'success', text: `${data.student.studentId} was added successfully.` });
      setForm({ studentId: '', course: '', department: '', graduationYear: new Date().getFullYear() });
      await loadStudents();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle eyebrow="Management" title="Students" />
      <section className="card max-w-2xl">
        <h2 className="mb-4 text-base font-bold text-black">Add Student</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field label="Student ID">
            <input
              required
              className="input"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              placeholder="STU-001"
            />
          </Field>
          <Field label="Graduation Year">
            <input
              required
              type="number"
              min="2000"
              max="2100"
              className="input"
              value={form.graduationYear}
              onChange={(e) => setForm({ ...form, graduationYear: e.target.value })}
            />
          </Field>
          <Field label="Course">
            <input
              required
              className="input"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              placeholder="BCA"
            />
          </Field>
          <Field label="Department">
            <input
              required
              className="input"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Computer Science"
            />
          </Field>
          <div className="sm:col-span-2">
            <Notice notice={notice} />
          </div>
          <div className="sm:col-span-2">
            <button disabled={loading} className="button">
              {loading ? 'Saving…' : 'Add Student'}
            </button>
          </div>
        </form>
      </section>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="text-base font-bold text-black mb-3">Students List</h2>
        {studentsLoading ? (
          <p className="py-6 text-center text-sm text-black">Loading students…</p>
        ) : studentsError ? (
          <div className="mt-2"><Notice notice={{ type: 'error', text: studentsError }} /></div>
        ) : students.length === 0 ? (
          <p className="py-6 text-center text-sm text-black">No students found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Course</th>
                <th>Department</th>
                <th>Graduation Year</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="font-semibold">{student.studentId}</td>
                  <td>{student.course}</td>
                  <td>{student.department}</td>
                  <td>{student.graduationYear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function IssuePage({ token, issued }) {
  const [form, setForm] = useState({ certificateId: '', studentId: '', title: '', certificateType: '', issueDate: '' });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setNotice({ type: 'error', text: 'Please choose a PDF certificate.' });
    setLoading(true);
    setNotice(null);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('file', file);
    try {
      const data = await api.issueCertificate(body, token);
      setCertificate(data.certificate);
      issued(data.certificate);
      setNotice({ type: 'success', text: data.message });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle eyebrow="Certificates" title="Issue Certificate">
        <p className="mt-1 text-sm text-black">
          Upload PDF certificate, compute SHA-256 hash, and register on blockchain and MySQL.
        </p>
      </PageTitle>
      <section className="card max-w-2xl">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <Field label="Certificate ID">
            <input
              required
              className="input"
              value={form.certificateId}
              onChange={(e) => setForm({ ...form, certificateId: e.target.value })}
              placeholder="CERT-2026-001"
            />
          </Field>
          <Field label="Student ID">
            <input
              required
              className="input"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              placeholder="STU-001"
            />
          </Field>
          <Field label="Certificate Title">
            <input
              required
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Bachelor of Computer Applications"
            />
          </Field>
          <Field label="Certificate Type">
            <input
              required
              className="input"
              value={form.certificateType}
              onChange={(e) => setForm({ ...form, certificateType: e.target.value })}
              placeholder="Degree Certificate"
            />
          </Field>
          <Field label="Issue Date">
            <input
              required
              type="date"
              className="input"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
          </Field>
          <Field label="Certificate PDF File">
            <input
              required
              type="file"
              accept="application/pdf,.pdf"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <div className="md:col-span-2">
            <Notice notice={notice} />
          </div>
          <div className="md:col-span-2">
            <button disabled={loading} className="button">
              {loading ? 'Issuing on blockchain…' : 'Issue Certificate'}
            </button>
          </div>
        </form>
      </section>
      {certificate && (
        <section className="card mt-6 max-w-2xl">
          <h2 className="text-base font-bold text-black mb-3">Certificate Issued</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Certificate ID" value={certificate.certificateId} />
            <Detail label="Status" value={certificate.status} />
            <Detail label="SHA-256 Hash" value={certificate.certificateHash} />
            <Detail label="Blockchain Transaction" value={certificate.blockchainTxHash} />
          </dl>
        </section>
      )}
    </>
  );
}

function LegacyVerifyPage() {
  const [certificateId, setCertificateId] = useState('');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setNotice(null);
    try {
      setResult(await api.verifyCertificate(certificateId.trim()));
    } catch (error) {
      if (error.message === 'Certificate not found in database') {
        setResult({ result: 'NOT_FOUND', message: error.message });
      } else {
        setNotice({ type: 'error', text: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const label = result?.result === 'VALID' ? 'VALID' : result?.result === 'REVOKED' ? 'REVOKED' : result?.result === 'NOT_FOUND' ? 'NOT FOUND' : 'INVALID';

  return (
    <main className="min-h-screen bg-white px-4 py-8 max-w-2xl mx-auto">
      <NavLink to="/login" className="text-sm font-semibold text-black underline">
        ← Administrator Login
      </NavLink>
      <div className="mt-6 mb-4">
        <h1 className="text-2xl font-bold text-black">Verify Certificate</h1>
        <p className="mt-1 text-sm text-black">Check certificate status by ID.</p>
      </div>
      <section className="card mt-6">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <input
            required
            className="input flex-1"
            value={certificateId}
            onChange={(e) => setCertificateId(e.target.value)}
            placeholder="CERT-2026-001"
          />
          <button disabled={loading} className="button whitespace-nowrap">
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <div className="mt-3">
          <Notice notice={notice} />
        </div>
      </section>
      {result && (
        <section className="card mt-6">
          <span className={badge(result.result)}>{label}</span>
          <p className="mt-3 text-sm text-black">{result.reason || result.message || 'Verification complete.'}</p>
          {result.certificate && (
            <dl className="mt-4 grid gap-3 pt-3 text-sm sm:grid-cols-2">
              <Detail label="Certificate ID" value={result.certificate.certificateId} />
              <Detail label="Title" value={result.certificate.title} />
              <Detail label="Type" value={result.certificate.certificateType} />
              <Detail label="Issue Date" value={result.certificate.issueDate ? new Date(result.certificate.issueDate).toLocaleDateString() : '—'} />
              <Detail label="Status" value={result.certificate.status} />
              <Detail label="Hash Match" value={result.hashMatch ? 'Yes' : 'No'} />
            </dl>
          )}
        </section>
      )}
    </main>
  );
}

function CertificatesPage({ token }) {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    let active = true;
    api.getCertificates(token)
      .then((data) => {
        if (active) setCertificates(data.certificates || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const revoke = async (certificateId) => {
    if (!window.confirm(`Revoke certificate ${certificateId}? This cannot be undone.`)) return;
    setRevoking(certificateId);
    setNotice(null);
    try {
      const data = await api.revokeCertificate(certificateId, token);
      const next = certificates.map((c) =>
        c.certificateId === certificateId ? { ...c, status: 'REVOKED', blockchainTxHash: data.blockchainTxHash } : c
      );
      setCertificates(next);
      saveCertificates(next);
      setNotice({ type: 'success', text: data.message });
    } catch (revokeError) {
      setNotice({ type: 'error', text: revokeError.message });
    } finally {
      setRevoking(null);
    }
  };

  return (
    <>
      <PageTitle eyebrow="Certificates" title="Certificate Management">
        <p className="mt-1 text-sm text-black">Certificates stored in MySQL database and blockchain registry.</p>
      </PageTitle>
      <Notice notice={notice} />
      <section className="card mt-4 overflow-x-auto">
        {loading ? (
          <p className="py-6 text-center text-sm text-black">Loading certificates…</p>
        ) : error ? (
          <div className="py-2"><Notice notice={{ type: 'error', text: error }} /></div>
        ) : certificates.length === 0 ? (
          <p className="py-6 text-center text-sm text-black">No certificates found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Certificate ID</th>
                <th>Student ID</th>
                <th>Course</th>
                <th>Department</th>
                <th>Title</th>
                <th>Issue Date</th>
                <th>Status</th>
                <th>Tx Hash</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((c) => (
                <tr key={c.certificateId}>
                  <td className="font-semibold">{c.certificateId}</td>
                  <td>{c.studentId}</td>
                  <td>{c.course || '—'}</td>
                  <td>{c.department || '—'}</td>
                  <td>{c.title}</td>
                  <td>{c.issueDate}</td>
                  <td><span className={badge(c.status)}>{c.status}</span></td>
                  <td title={c.blockchainTxHash} className="max-w-32 truncate font-mono text-xs">
                    {c.blockchainTxHash || '—'}
                  </td>
                  <td>
                    {c.status === 'VALID' && (
                      <button
                        disabled={revoking === c.certificateId}
                        onClick={() => revoke(c.certificateId)}
                        className="border border-black bg-white px-2 py-0.5 text-xs font-semibold text-black hover:bg-black hover:text-white disabled:opacity-50"
                      >
                        {revoking === c.certificateId ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function VerificationLogsPage({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.getVerificationLogs(token)
      .then((data) => {
        if (active) setLogs(data.logs || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  return (
    <>
      <PageTitle eyebrow="Audit" title="Verification Logs">
        <p className="mt-1 text-sm text-black">Historical certificate verification attempts stored in MySQL.</p>
      </PageTitle>
      <section className="card overflow-x-auto">
        {loading ? (
          <p className="py-6 text-center text-sm text-black">Loading verification logs…</p>
        ) : error ? (
          <div className="py-2"><Notice notice={{ type: 'error', text: error }} /></div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-black">No verification attempts found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Certificate ID</th>
                <th>Result</th>
                <th>Verified At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-semibold">{log.certificate_id || '—'}</td>
                  <td><span className={badge(log.result)}>{log.result}</span></td>
                  <td>{log.verified_at ? new Date(log.verified_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function App() {
  const [session, setSession] = useState(() => getStored(SESSION_KEY, null));
  const [certificates, setCertificates] = useState(() => getStored(CERTIFICATES_KEY, []));

  const login = (value) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    setSession(value);
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const issued = (certificate) => {
    const next = [certificate, ...certificates.filter((c) => c.certificateId !== certificate.certificateId)];
    saveCertificates(next);
    setCertificates(next);
  };

  const protectedPage = (child) => (
    <ProtectedRoute session={session}>
      <Layout session={session} logout={logout}>
        {child}
      </Layout>
    </ProtectedRoute>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={login} />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />
        <Route path="/register" element={<Navigate to="/signup" replace />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/dashboard" element={protectedPage(<Dashboard token={session?.token} />)} />
        <Route path="/students" element={protectedPage(<StudentPage token={session?.token} />)} />
        <Route path="/issue" element={protectedPage(<IssuePage token={session?.token} issued={issued} />)} />
        <Route path="/certificates" element={protectedPage(<CertificatesPage token={session?.token} />)} />
        <Route path="/verification-logs" element={protectedPage(<VerificationLogsPage token={session?.token} />)} />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/verify'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { LegacyVerifyPage };
export default App;
