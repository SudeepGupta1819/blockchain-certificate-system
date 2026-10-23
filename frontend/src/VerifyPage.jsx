import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from './api';

function Notice({ notice }) {
  if (!notice) return null;
  return (
    <div className="py-2 text-sm text-black">
      <span className="font-bold">{notice.type === 'error' ? 'Error: ' : 'Notice: '}</span>
      {notice.text}
    </div>
  );
}

function VerifyPage() {
  const [certificateId, setCertificateId] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const trimmedCertificateId = certificateId.trim();

    if (!trimmedCertificateId) {
      setNotice({ type: 'error', text: 'Please enter a certificate ID.' });
      return;
    }
    if (!file) {
      setNotice({ type: 'error', text: 'Please choose a PDF certificate.' });
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setNotice({ type: 'error', text: 'Invalid file type. Only PDF uploads are allowed.' });
      return;
    }

    setLoading(true);
    setResult(null);
    setNotice(null);
    try {
      setResult(await api.verifyCertificateWithPdf(trimmedCertificateId, file));
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

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="flex items-center justify-between bg-white px-6 py-3">
        <span className="font-bold text-black text-base">Certificate Verification System</span>
        <NavLink to="/login" className="text-sm font-semibold text-black underline hover:opacity-80">
          Admin Sign In →
        </NavLink>
      </nav>

      <main className="mx-auto max-w-xl px-4 py-10">
        {/* Page Title */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-black">Public Certificate Verification</h1>
          <p className="mt-1 text-sm text-black">
            Verify the authenticity of an issued certificate using its Certificate ID and original PDF.
          </p>
        </div>

        {/* Verification Form */}
        <section className="card bg-white p-5">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-1">
                Certificate ID
              </label>
              <input
                required
                className="input"
                value={certificateId}
                onChange={(event) => setCertificateId(event.target.value)}
                placeholder="e.g. CERT-2026-001"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-black mb-1">
                Certificate PDF File
              </label>
              <input
                required
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="input"
              />
              <p className="mt-1 text-xs text-black">Select the original issued PDF document.</p>
            </div>

            <button disabled={loading} className="button w-full mt-2">
              {loading ? 'Verifying on blockchain…' : 'Verify Certificate'}
            </button>
          </form>

          {notice && (
            <div className="mt-4">
              <Notice notice={notice} />
            </div>
          )}
        </section>

        {/* Verification Result */}
        {result && (
          <section className="mt-6">
            {/* VALID STATE */}
            {result.result === 'VALID' && (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-black">Verification Result</h2>
                  <span className="bg-black text-white px-2 py-0.5 text-xs font-bold">
                    VALID
                  </span>
                </div>
                <p className="text-sm text-black mb-4">
                  The certificate is verified. The document hash matches both the MySQL database and the blockchain registry.
                </p>
                <table>
                  <tbody>
                    <tr>
                      <td className="font-semibold w-1/3">Certificate ID</td>
                      <td className="font-mono">{result.certificate?.certificateId}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Status</td>
                      <td className="font-bold">VALID</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Student ID</td>
                      <td>{result.certificate?.studentId || result.certificate?.studentName || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Title</td>
                      <td>{result.certificate?.title || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Certificate Type</td>
                      <td>{result.certificate?.certificateType || '—'}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Issue Date</td>
                      <td>{result.certificate?.issueDate || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* INVALID STATE */}
            {result.result === 'INVALID' && (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-black">Verification Result</h2>
                  <span className="text-black text-xs font-bold">
                    INVALID
                  </span>
                </div>
                <p className="text-sm text-black">
                  {result.reason || 'The uploaded certificate PDF hash does not match the blockchain record or database.'}
                </p>
              </div>
            )}

            {/* REVOKED STATE */}
            {result.result === 'REVOKED' && (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-black">Verification Result</h2>
                  <span className="text-black text-xs font-bold line-through">
                    REVOKED
                  </span>
                </div>
                <p className="text-sm text-black">
                  {result.reason || 'This certificate has been officially revoked by the institution.'}
                </p>
              </div>
            )}

            {/* NOT FOUND STATE */}
            {result.result === 'NOT_FOUND' && (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-black">Verification Result</h2>
                  <span className="text-black text-xs font-bold">
                    NOT FOUND
                  </span>
                </div>
                <p className="text-sm text-black">
                  No certificate record was found matching Certificate ID &quot;{certificateId}&quot;.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default VerifyPage;
