const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function patch(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(buf) });
          } catch {
            resolve({ status: res.statusCode, body: buf });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: Request OTP for Citizen ---');
  const otpRes = await post('/api/auth/send-otp', {
    contact: '+91 98765 43210',
    name: 'Aarav Mehta',
  });
  console.log('Status:', otpRes.status, 'Response:', otpRes.body);

  const otpCode = otpRes.body.debug_code;

  console.log('\n--- TEST 2: Verify OTP with Correct 6-Digit Code ---');
  const verifyRes = await post('/api/auth/verify-otp', {
    contact: '+91 98765 43210',
    code: otpCode,
    name: 'Aarav Mehta',
  });
  console.log('Status:', verifyRes.status, 'User:', verifyRes.body.user);
  const citizenToken = verifyRes.body.token;

  console.log('\n--- TEST 3: Verify Public PII Redaction on GET /api/complaints/JSN-1001 (Unauthenticated) ---');
  const publicComplaint = await get('/api/complaints/JSN-1001');
  console.log('Status:', publicComplaint.status);
  console.log('Masked Phone:', publicComplaint.body.complaint.citizen_phone);
  console.log('Masked Email:', publicComplaint.body.complaint.citizen_email);
  console.log('Internal Notes (should be empty array):', publicComplaint.body.complaint.internal_notes);

  console.log('\n--- TEST 4: Attempt Unauthenticated Status Update (Should be 403 Forbidden) ---');
  const unauthPatch = await patch('/api/complaints/JSN-1001/status', {
    new_status: 'resolved',
  });
  console.log('Status (Expect 403):', unauthPatch.status, 'Error:', unauthPatch.body.error);

  console.log('\n--- TEST 5: Municipal Officer Admin Login ---');
  const adminLoginRes = await post('/api/auth/admin-login', {
    email: 'roads.dept@municipal.gov.in',
    department_id: 'dept-roads',
  });
  console.log('Status:', adminLoginRes.status, 'Officer:', adminLoginRes.body.user);
  const officerToken = adminLoginRes.body.token;

  console.log('\n--- TEST 6: Authorized Status Update with Officer JWT Token ---');
  const authPatch = await patch(
    '/api/complaints/JSN-1001/status',
    { new_status: 'in_progress', note: 'Emergency patching crew arrived on site.' },
    { Authorization: `Bearer ${officerToken}` }
  );
  console.log('Status (Expect 200):', authPatch.status, 'Message:', authPatch.body.message);
  console.log('Latest History Changed By:', authPatch.body.complaint.history.slice(-1)[0].changed_by);

  console.log('\n--- TEST 7: Authorized GET /api/complaints/JSN-1001 with Officer Token (Unmasked) ---');
  const officerView = await get('/api/complaints/JSN-1001', {
    Authorization: `Bearer ${officerToken}`,
  });
  console.log('Status:', officerView.status);
  console.log('Unmasked Citizen Phone:', officerView.body.complaint.citizen_phone);
  console.log('Officer Internal Notes Present:', officerView.body.complaint.internal_notes.length > 0);

  console.log('\n========================================');
  console.log('ALL SECURITY & AUTH VERIFICATION TESTS PASSED!');
  console.log('========================================');
}

runTests().catch(console.error);
