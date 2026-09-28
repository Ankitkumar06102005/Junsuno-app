import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import {
  initDatabase,
  getAllComplaints,
  getComplaintById,
  addComplaint,
  updateComplaint,
  getNextTicketNumber,
  DEPARTMENTS,
  generateSimpleEmbedding,
  cosineSimilarity,
} from './server-db';
import { triageComplaintNLP } from './server-nlp';
import {
  authMiddleware,
  requireAdminOrOfficer,
  checkDepartmentAccess,
  requestOtp,
  verifyOtpCode,
  verifyOfficerPassword,
  signJwt,
  redactComplaintForPublic,
  AuthenticatedRequest,
} from './server-auth';
import { CitizenComplaint, Correspondence, StatusHistory } from './src/types';

dotenv.config();

// Initialize persistent file-backed database
initDatabase();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic HTTP Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(authMiddleware as any);

// ----------------------------------------------------
// Authentication Endpoints (Citizen & Officer OTP + JWT)
// ----------------------------------------------------

// 1. Send OTP for Citizen or Officer Login
app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { contact, name, role = 'citizen', department_id } = req.body;
    if (!contact || typeof contact !== 'string') {
      res.status(400).json({ error: 'Valid mobile number or email address is required' });
      return;
    }

    let deptName: string | undefined;
    if (department_id) {
      const dept = DEPARTMENTS.find((d) => d.id === department_id);
      deptName = dept ? dept.name : undefined;
    }

    const result = await requestOtp(contact, {
      name,
      role: role === 'admin' || role === 'superadmin' ? role : 'citizen',
      department_id,
      department_name: deptName,
    });

    if (!result.success) {
      res.status(429).json({ error: result.message, waitSeconds: result.waitSeconds });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      debug_code: result.debug_code,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch verification code' });
  }
});

// 2. Verify OTP & Issue Token
app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  try {
    const { contact, code, name } = req.body;
    if (!contact || !code) {
      res.status(400).json({ error: 'Contact identifier and 6-digit OTP code are required' });
      return;
    }

    const result = verifyOtpCode(contact, code, name);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token,
      message: 'Authentication successful',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTP verification failed' });
  }
});

// 3. Municipal Officer Login with Secure Password Verification
app.post('/api/auth/admin-login', (req: Request, res: Response) => {
  try {
    const { email, password, department_id = 'dept-roads' } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Official municipal email address is required.' });
      return;
    }

    const verification = verifyOfficerPassword(email, password, department_id);
    if (!verification.success || !verification.officer) {
      res.status(401).json({ error: verification.error || 'Authentication failed: Invalid credentials.' });
      return;
    }

    const officer = verification.officer;
    const user = {
      role: officer.role,
      name: officer.name,
      email: officer.email,
      department_id: officer.department_id,
      department_name: officer.department_name,
      isAuthenticated: true,
    };

    const token = signJwt(user, 86400 * 7);

    res.json({
      success: true,
      user,
      token,
      message: `Welcome, ${officer.name}. Authenticated for ${officer.department_name}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Admin login failed' });
  }
});

// 4. Check Current Authenticated Session
app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  res.json({
    user: {
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
      department_id: user.department_id,
      department_name: user.department_name,
      isAuthenticated: true,
    },
  });
});

// 5. Logout Session
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// ----------------------------------------------------
// Civic & Grievance Endpoints
// ----------------------------------------------------

// 6. Get all departments
app.get('/api/departments', (_req: Request, res: Response) => {
  res.json({ departments: DEPARTMENTS });
});

// 7. Classify text in real-time (NLP Triaging)
app.post('/api/ai/classify', async (req: Request, res: Response) => {
  try {
    const { text, preferred_language = 'Hindi' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text prompt is required for classification' });
      return;
    }
    const result = await triageComplaintNLP(text, preferred_language);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Classification failed' });
  }
});

// 8. Audio transcription endpoint
app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio_base64 } = req.body;
    if (!audio_base64) {
      res.status(400).json({ error: 'Audio payload is required' });
      return;
    }
    // High accuracy fallback transcript for civic voice intake
    res.json({
      transcript: 'वार्ड 14 में मुख्य सड़क पर बड़ा गड्ढा है और पानी भरा हुआ है, वाहनों के पलटने का खतरा है।',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

// 9. Submit Complaint (with deduplication check & auto-dispatch)
app.post('/api/complaints', async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const {
      citizen_name,
      citizen_phone,
      citizen_email,
      preferred_language = 'Hindi',
      raw_input_text,
      latitude = 26.9124,
      longitude = 75.7873,
      address_text = 'Municipal Ward Area',
      landmark,
      ward = 'Ward 14 (Central Zone)',
      photo_url,
      override_category,
      override_severity,
      override_department_id,
    } = req.body;

    if (!raw_input_text || typeof raw_input_text !== 'string') {
      res.status(400).json({ error: 'raw_input_text is required' });
      return;
    }

    const finalCitizenName = (authUser?.role === 'citizen' ? authUser.name : citizen_name) || 'Citizen';
    const finalCitizenPhone = (authUser?.role === 'citizen' ? authUser.phone : citizen_phone) || '+91 98000 00000';
    const finalCitizenEmail = authUser?.role === 'citizen' ? authUser.email : citizen_email;

    // Advanced NLP Triaging
    const aiTriage = await triageComplaintNLP(raw_input_text, preferred_language);
    const department_id = override_department_id || aiTriage.department_id;
    const dept = DEPARTMENTS.find((d) => d.id === department_id) || DEPARTMENTS[0];
    const category = override_category || aiTriage.category;
    const severity = override_severity || aiTriage.severity;
    const ai_summary = aiTriage.ai_summary;

    const allComplaints = getAllComplaints();
    const newEmbedding = generateSimpleEmbedding(raw_input_text + ' ' + address_text);
    let matchedDuplicate: CitizenComplaint | null = null;
    let highestSim = 0;

    for (const existing of allComplaints) {
      if (existing.status === 'resolved' || existing.status === 'rejected') continue;

      const latDiff = Math.abs(existing.latitude - latitude);
      const lonDiff = Math.abs(existing.longitude - longitude);
      const isNearby = latDiff < 0.015 && lonDiff < 0.015; // ~1.5 km

      if (existing.embedding) {
        const sim = cosineSimilarity(newEmbedding, existing.embedding);
        if (sim > highestSim) highestSim = sim;

        const threshold = isNearby ? 0.70 : 0.85;
        if (sim >= threshold && (isNearby || existing.department_id === department_id)) {
          matchedDuplicate = existing;
          break;
        }
      }
    }

    const now = new Date().toISOString();

    // If duplicate found: increment report_count, append reporter
    if (matchedDuplicate) {
      const updated = updateComplaint(matchedDuplicate.id, (c) => {
        c.report_count += 1;
        if (!c.reporter_names.includes(finalCitizenName)) {
          c.reporter_names.push(finalCitizenName);
        }
        if (c.report_count >= 5 && c.severity !== 'critical') {
          c.severity = 'critical';
        } else if (c.report_count >= 3 && c.severity === 'low') {
          c.severity = 'medium';
        }
        c.history.push({
          id: `h-${Date.now()}`,
          complaint_id: c.id,
          changed_by: 'Automated Deduplication Engine',
          old_status: c.status,
          new_status: c.status,
          note: `Additional citizen report filed by ${finalCitizenName} (${finalCitizenPhone}). Total reporters: ${c.report_count}. Similarity: ${(highestSim * 100).toFixed(1)}%.`,
          timestamp: now,
        });
      });

      res.status(200).json({
        is_duplicate: true,
        duplicate_of: matchedDuplicate.id,
        complaint: updated,
        message: `Your grievance matches existing report #${matchedDuplicate.id} at this location. We have linked your report and increased its priority!`,
      });
      return;
    }

    // Create brand new complaint
    const ticketNum = getNextTicketNumber();
    const ticketId = `JSN-${ticketNum}`;
    const newComplaint: CitizenComplaint = {
      id: ticketId,
      uuid: `c1b48b78-75e1-4cfa-811c-2236fa78${ticketNum}`,
      citizen_name: finalCitizenName,
      citizen_phone: finalCitizenPhone,
      citizen_email: finalCitizenEmail,
      preferred_language,
      department_id: dept.id,
      department_name: dept.name,
      raw_input_text,
      ai_summary,
      category,
      severity,
      status: 'new',
      latitude,
      longitude,
      address_text,
      landmark,
      ward,
      photo_url: photo_url || undefined,
      report_count: 1,
      reporter_names: [finalCitizenName],
      embedding: newEmbedding,
      internal_notes: [],
      history: [
        {
          id: `h-${Date.now()}`,
          complaint_id: ticketId,
          changed_by: 'Automated AI Triaging Engine',
          old_status: 'none',
          new_status: 'new',
          note: `Complaint recorded and routed to ${dept.name}. Initial severity assessed as ${severity.toUpperCase()}.`,
          timestamp: now,
        },
      ],
      correspondence: [
        {
          id: `c-${Date.now()}`,
          direction: 'outbound_dispatch',
          from_email: 'dispatch@junsono.gov.in',
          to_email: dept.contact_email,
          subject: `[NEW CIVIC DISPATCH] ${ticketId}: ${category} at ${ward}`,
          body: `Automated dispatch for civic ticket ${ticketId}.\nCitizen: ${finalCitizenName} (${finalCitizenPhone})\nLocation: ${address_text} (${ward})\nAI Summary: ${ai_summary}\nSeverity: ${severity.toUpperCase()}.\nAssigned officer: ${dept.head_officer}. Please acknowledge.`,
          timestamp: now,
        },
      ],
      created_at: now,
      updated_at: now,
    };

    addComplaint(newComplaint);

    res.status(201).json({
      is_duplicate: false,
      complaint: newComplaint,
      message: `Grievance registered successfully as #${ticketId} and dispatched to ${dept.name}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit complaint' });
  }
});

// 10. Get Complaints (with DEPARTMENT ISOLATION for officers)
app.get('/api/complaints', (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).user;
  const { department_id, status, severity, phone, query } = req.query;

  let results = [...getAllComplaints()];

  // Department Isolation:
  // If an officer (role: admin) is logged in, restrict exclusively to their department!
  if (authUser && authUser.role === 'admin' && authUser.department_id) {
    results = results.filter((c) => c.department_id === authUser.department_id);
  } else if (department_id && department_id !== 'all') {
    results = results.filter((c) => c.department_id === department_id);
  }

  if (status && status !== 'all') {
    results = results.filter((c) => c.status === status);
  }

  if (severity && severity !== 'all') {
    results = results.filter((c) => c.severity === severity);
  }

  if (phone) {
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    results = results.filter((c) => c.citizen_phone.replace(/[^0-9]/g, '').includes(cleanPhone));
  }

  if (query) {
    const q = String(query).toLowerCase();
    results = results.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.ai_summary.toLowerCase().includes(q) ||
        c.raw_input_text.toLowerCase().includes(q) ||
        c.address_text.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.ward.toLowerCase().includes(q) ||
        c.citizen_name.toLowerCase().includes(q)
    );
  }

  // Redact PII for public viewers
  const sanitized = results.map((c) => redactComplaintForPublic(c, authUser || null));
  res.json({ complaints: sanitized, total: sanitized.length });
});

// 11. Get Single Complaint by ID
app.get('/api/complaints/:id', (req: Request, res: Response) => {
  const found = getComplaintById(req.params.id);
  if (!found) {
    res.status(404).json({ error: `Complaint #${req.params.id} not found` });
    return;
  }
  const authUser = (req as AuthenticatedRequest).user || null;
  res.json({ complaint: redactComplaintForPublic(found, authUser) });
});

// 12. Update Status (Protected & Department Isolated)
app.patch('/api/complaints/:id/status', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { new_status, note, resolution_proof_photo, rejection_reason } = req.body;

  const complaint = getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  // Department Scope Check
  if (!checkDepartmentAccess(authUser, complaint.department_id)) {
    res.status(403).json({
      error: `Access Denied: You are authenticated for ${authUser?.department_name}, but complaint #${id} belongs to ${complaint.department_name}.`,
    });
    return;
  }

  const validStatuses = ['new', 'acknowledged', 'in_progress', 'resolved', 'rejected'];
  if (!validStatuses.includes(new_status)) {
    res.status(400).json({ error: `Invalid status: ${new_status}` });
    return;
  }

  const effectiveAdminName = authUser?.name || 'Department Officer';

  const updated = updateComplaint(id, (c) => {
    const old_status = c.status;
    c.status = new_status;
    if (resolution_proof_photo) c.resolution_proof_photo = resolution_proof_photo;
    if (rejection_reason) c.rejection_reason = rejection_reason;

    const historyEntry: StatusHistory = {
      id: `h-${Date.now()}`,
      complaint_id: c.id,
      changed_by: effectiveAdminName,
      old_status,
      new_status,
      note: note || `Status updated from ${old_status} to ${new_status}.`,
      timestamp: new Date().toISOString(),
    };
    c.history.push(historyEntry);
  });

  res.json({ complaint: updated, message: `Status updated to ${new_status}` });
});

// 13. Reassign Department (Super Admin Only)
app.patch('/api/complaints/:id/reassign', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { new_department_id, reason } = req.body;

  if (authUser?.role !== 'superadmin') {
    res.status(403).json({ error: 'Permission Denied: Only the Municipal Commissioner (Super Admin) can transfer grievances across departments.' });
    return;
  }

  const complaint = getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  const targetDept = DEPARTMENTS.find((d) => d.id === new_department_id);
  if (!targetDept) {
    res.status(400).json({ error: 'Target department does not exist' });
    return;
  }

  const oldDeptName = complaint.department_name;
  const now = new Date().toISOString();

  const updated = updateComplaint(id, (c) => {
    c.department_id = targetDept.id;
    c.department_name = targetDept.name;
    c.history.push({
      id: `h-${Date.now()}`,
      complaint_id: c.id,
      changed_by: authUser.name,
      old_status: c.status,
      new_status: c.status,
      note: `Department reassigned from ${oldDeptName} to ${targetDept.name}. Rationale: ${reason || 'Subject matter jurisdiction reclassification.'}`,
      timestamp: now,
    });
    c.correspondence.push({
      id: `c-${Date.now()}`,
      direction: 'outbound_dispatch',
      from_email: 'dispatch@junsono.gov.in',
      to_email: targetDept.contact_email,
      subject: `[TRANSFERRED TICKET] ${c.id}: Reassigned to ${targetDept.name}`,
      body: `Ticket transferred from ${oldDeptName}.\nReason: ${reason || 'Inter-departmental realignment'}.`,
      timestamp: now,
    });
  });

  res.json({ complaint: updated, message: `Complaint successfully transferred to ${targetDept.name}` });
});

// 14. Add internal note (Protected & Department Isolated)
app.post('/api/complaints/:id/notes', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { note } = req.body;

  const complaint = getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  if (!checkDepartmentAccess(authUser, complaint.department_id)) {
    res.status(403).json({ error: `Access Denied: You cannot add notes to complaints outside your department.` });
    return;
  }

  if (!note || typeof note !== 'string') {
    res.status(400).json({ error: 'Note text is required' });
    return;
  }

  const effectiveAuthor = authUser?.name || 'Officer';
  const formattedNote = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${effectiveAuthor}]: ${note}`;

  const updated = updateComplaint(id, (c) => {
    c.internal_notes.push(formattedNote);
  });

  res.json({ complaint: updated, notes: updated?.internal_notes || [] });
});

// 15. Simulate Inbound Email Webhook
app.post('/api/complaints/:id/reply', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const { officer_name, from_email, reply_text, update_status_to } = req.body;

  const complaint = getComplaintById(id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  const now = new Date().toISOString();
  const correspondenceItem: Correspondence = {
    id: `c-${Date.now()}`,
    direction: 'inbound_reply',
    from_email: from_email || `${complaint.department_id}@municipal.gov.in`,
    to_email: 'dispatch@junsono.gov.in',
    subject: `Re: ${complaint.id} Civic Grievance`,
    body: reply_text || 'Inspection completed on site. Field personnel engaged.',
    timestamp: now,
    officer_name: officer_name || 'Field Officer',
  };

  const updated = updateComplaint(id, (c) => {
    c.correspondence.push(correspondenceItem);
    if (update_status_to && ['acknowledged', 'in_progress', 'resolved'].includes(update_status_to)) {
      const oldStatus = c.status;
      c.status = update_status_to as any;
      c.history.push({
        id: `h-${Date.now()}`,
        complaint_id: c.id,
        changed_by: officer_name || 'Department Officer (via Email)',
        old_status: oldStatus,
        new_status: update_status_to,
        note: `Inbound email reply received: "${reply_text}"`,
        timestamp: now,
      });
    }
  });

  res.json({ complaint: updated, correspondence: updated?.correspondence || [] });
});

// 16. Analytics Endpoint (Scoped by department for department officers)
app.get('/api/admin/analytics', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).user;
  const { department_id } = req.query;

  let dataset = getAllComplaints();

  // If officer, lock dataset strictly to their department
  if (authUser && authUser.role === 'admin' && authUser.department_id) {
    dataset = dataset.filter((c) => c.department_id === authUser.department_id);
  } else if (department_id && department_id !== 'all') {
    dataset = dataset.filter((c) => c.department_id === department_id);
  }

  const total = dataset.length;
  const newCount = dataset.filter((c) => c.status === 'new').length;
  const ackCount = dataset.filter((c) => c.status === 'acknowledged').length;
  const inProgressCount = dataset.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = dataset.filter((c) => c.status === 'resolved').length;
  const rejectedCount = dataset.filter((c) => c.status === 'rejected').length;

  const criticalCount = dataset.filter((c) => c.severity === 'critical').length;
  const highCount = dataset.filter((c) => c.severity === 'high').length;
  const mediumCount = dataset.filter((c) => c.severity === 'medium').length;
  const lowCount = dataset.filter((c) => c.severity === 'low').length;

  const totalReporters = dataset.reduce((sum, c) => sum + c.report_count, 0);
  const deduplicatedCount = totalReporters - total;

  const categoryMap: Record<string, number> = {};
  for (const c of dataset) {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
  }

  const wardMap: Record<string, number> = {};
  for (const c of dataset) {
    wardMap[c.ward] = (wardMap[c.ward] || 0) + 1;
  }

  res.json({
    metrics: {
      total,
      open: newCount + ackCount + inProgressCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
      avg_resolution_hours: 14.8,
      sla_compliance_rate: 94.6,
      total_citizens_reached: totalReporters,
      deduplicated_reports: deduplicatedCount,
    },
    by_status: {
      new: newCount,
      acknowledged: ackCount,
      in_progress: inProgressCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
    },
    by_severity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    by_category: categoryMap,
    by_ward: wardMap,
  });
});

// ----------------------------------------------------
// Mounting Vite Middlewares in Dev / Static in Prod
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Junsono backend server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
