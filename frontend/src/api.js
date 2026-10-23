const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function request(path, { method = 'GET', token, body, debug = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const url = `${API_BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (debug) console.error('[getStudents] request error:', error);
    throw new Error('Cannot reach the backend. Check that it is running.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (debug) console.log(`[getStudents] ${response.ok ? 'success' : 'failure'}:`, { url, status: response.status, response: data });
  if (!response.ok) {
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const message = typeof data?.message === 'string' && data.message.trim()
      ? data.message
      : data
        ? `Request failed with HTTP ${status}.`
        : `The backend returned a non-JSON error (HTTP ${status}). Check the backend logs.`;
    throw new Error(message);
  }
  if (!data) {
    throw new Error(`The backend returned an invalid response (HTTP ${response.status}).`);
  }
  return data;
}

export const api = {
  sendOtp: (email) => request('/auth/send-otp', { method: 'POST', body: { email } }),
  verifyOtp: (body) => request('/auth/verify-otp', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  getStudents: (token) => request('/students', { token, debug: true }),
  getCertificates: (token) => request('/certificates', { token }),
  getVerificationLogs: (token) => request('/verification-logs', { token }),
  createStudent: (body, token) => request('/students', { method: 'POST', token, body }),
  issueCertificate: (body, token) => request('/certificates', { method: 'POST', token, body }),
  verifyCertificate: (certificateId) => request(`/verify/${encodeURIComponent(certificateId)}`),
  verifyCertificateWithPdf: (certificateId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(`/verify/${encodeURIComponent(certificateId)}`, { method: 'POST', body });
  },
  revokeCertificate: (certificateId, token) => request(`/certificates/${encodeURIComponent(certificateId)}/revoke`, { method: 'POST', token }),
};

export { API_BASE_URL };
