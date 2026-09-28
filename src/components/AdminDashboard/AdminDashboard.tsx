import React, { useState, useEffect } from 'react';
import {
  Building2,
  Filter,
  Search,
  LayoutGrid,
  List,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Flame,
  MessageSquare,
  FileText,
  Mail,
  Send,
  RefreshCw,
  MapPin,
  ChevronRight,
  TrendingUp,
  PieChart,
  Shield,
  Layers,
  ArrowRight,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  fetchComplaints,
  fetchDepartments,
  updateComplaintStatus,
  reassignComplaint,
  addInternalNote,
  simulateInboundEmailReply,
  fetchAnalytics,
} from '../../services/api';
import { CitizenComplaint, Department, AnalyticsData, SupportedLanguage } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';
import { InteractiveMap } from '../Common/InteractiveMap';
import { useAuth } from '../../context/AuthContext';

interface AdminDashboardProps {
  language: SupportedLanguage;
  selectedDeptId: string;
  onSelectDeptId: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  language,
  selectedDeptId,
  onSelectDeptId,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const { user, openAuthModal } = useAuth();


  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'analytics'>('queue');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Queue state
  const [complaints, setComplaints] = useState<CitizenComplaint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Detail Modal / Drawer state
  const [selectedComplaint, setSelectedComplaint] = useState<CitizenComplaint | null>(null);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Actions state
  const [statusActionNote, setStatusActionNote] = useState('');
  const [reassignDeptId, setReassignDeptId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [resolutionProofPhoto, setResolutionProofPhoto] = useState(
    'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80'
  );
  const [rejectionReason, setRejectionReason] = useState('Duplicate of existing ongoing civil works contract');

  // Inbound Email Simulation state (Section 13)
  const [officerReplyText, setOfficerReplyText] = useState('Inspected location. Team has patched the surface.');
  const [officerName, setOfficerName] = useState('Er. Rakesh Saxena (JE)');
  const [isSimulatingReply, setIsSimulatingReply] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Load departments on mount
  useEffect(() => {
    fetchDepartments()
      .then((data) => {
        setDepartments(data);
        if (!selectedDeptId && data.length > 0) {
          onSelectDeptId(data[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Load complaints whenever department or filters change
  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const data = await fetchComplaints({
        department_id: selectedDeptId,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        query: searchQuery || undefined,
      });
      setComplaints(data.complaints);

      // Keep selected complaint synced if drawer is open
      if (selectedComplaint) {
        const updated = data.complaints.find((c) => c.id === selectedComplaint.id);
        if (updated) setSelectedComplaint(updated);
      }
    } catch (err) {
      console.error('Failed to load department complaints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      const data = await fetchAnalytics(selectedDeptId);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  useEffect(() => {
    loadComplaints();
    loadAnalyticsData();
  }, [selectedDeptId, severityFilter, statusFilter]);

  const currentDept = departments.find((d) => d.id === selectedDeptId) || departments[0];

  // Update Status handler
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedComplaint) return;
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      openAuthModal('admin');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const updated = await updateComplaintStatus(selectedComplaint.id, {
        new_status: newStatus,
        admin_name: user.name || currentDept?.head_officer || 'Department Officer',
        note: statusActionNote || `Status shifted to ${newStatus} by ${user.name}.`,
        resolution_proof_photo: newStatus === 'resolved' ? resolutionProofPhoto : undefined,
        rejection_reason: newStatus === 'rejected' ? rejectionReason : undefined,
      });
      setSelectedComplaint(updated);
      setStatusActionNote('');
      loadComplaints();
      loadAnalyticsData();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Reassign Department handler
  const handleReassign = async () => {
    if (!selectedComplaint || !reassignDeptId) return;
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      openAuthModal('admin');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const updated = await reassignComplaint(selectedComplaint.id, {
        new_department_id: reassignDeptId,
        admin_name: user.name || currentDept?.head_officer || 'Department Officer',
        reason: reassignReason || 'Jurisdiction realignment based on defect assessment.',
      });
      setSelectedComplaint(null);
      loadComplaints();
      loadAnalyticsData();
      alert(`Complaint #${updated.id} successfully reassigned to ${updated.department_name}.`);
    } catch (err: any) {
      alert(`Error reassigning: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Add Internal Note
  const handleAddNote = async () => {
    if (!selectedComplaint || !newInternalNote.trim()) return;
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      openAuthModal('admin');
      return;
    }
    setIsSavingNote(true);
    try {
      const updatedNotes = await addInternalNote(
        selectedComplaint.id,
        newInternalNote.trim(),
        user.name || currentDept?.head_officer || 'Admin'
      );
      setSelectedComplaint({
        ...selectedComplaint,
        internal_notes: updatedNotes,
      });
      setNewInternalNote('');
      loadComplaints();
    } catch (err: any) {
      alert(`Error adding note: ${err.message}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Simulate Inbound Email Reply (Section 13)
  const handleSimulateEmailReply = async () => {
    if (!selectedComplaint) return;
    setIsSimulatingReply(true);
    try {
      const updated = await simulateInboundEmailReply(selectedComplaint.id, {
        officer_name: officerName,
        from_email: currentDept?.contact_email || 'officer@municipal.gov.in',
        reply_text: officerReplyText,
        update_status_to: selectedComplaint.status === 'new' ? 'in_progress' : undefined,
      });
      setSelectedComplaint(updated);
      loadComplaints();
      loadAnalyticsData();
    } catch (err: any) {
      alert(`Error simulating reply: ${err.message}`);
    } finally {
      setIsSimulatingReply(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans-civic space-y-6">
      {/* Scope Banner: Shows current department details */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-xs"
            style={{ backgroundColor: currentDept?.color || '#1F4D3A' }}
          >
            {currentDept?.short_code || 'DEPT'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-civic text-[var(--ink)]">
                {currentDept?.name || 'Department Admin'}
              </h2>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-[var(--bg2)] text-[var(--ink-soft)] border border-[var(--line)]">
                {currentDept?.municipal_zone}
              </span>
            </div>

            <p className="text-xs text-[var(--ink-soft)] mt-0.5">
              Head: <strong className="text-[var(--ink)]">{currentDept?.head_officer}</strong> · Inbox:{' '}
              <span className="font-mono text-[var(--green)]">{currentDept?.contact_email}</span>
            </p>
          </div>
        </div>

        {/* Department Switcher Dropdown (for testing and demo inspection) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--ink-soft)] block">
              Department Queue Scope:
            </span>
          </div>

          <select
            value={selectedDeptId}
            onChange={(e) => onSelectDeptId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)] cursor-pointer"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.short_code})
              </option>
            ))}
          </select>

          {/* Navigation Tabs (Queue vs Analytics) */}
          <div className="flex items-center p-1 bg-[var(--bg2)] border border-[var(--line)] rounded-xl">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                activeTab === 'queue'
                  ? 'bg-[var(--card)] text-[var(--ink)] font-bold shadow-2xs'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-[var(--card)] text-[var(--ink)] font-bold shadow-2xs'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: QUEUE VIEW (TABLE / KANBAN)                   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls: Search, Filters & View Toggle */}
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[var(--ink-soft)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadComplaints()}
                placeholder="Search ticket, ward, keyword..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
              />
            </div>

            {/* Severity Filter */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--ink-soft)]">Severity:</span>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--ink-soft)]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* View Toggle (Table / Kanban) */}
              <div className="flex items-center border border-[var(--line)] rounded-lg p-0.5 bg-[var(--bg)] ml-auto">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded cursor-pointer ${
                    viewMode === 'table' ? 'bg-[var(--card)] text-[var(--ink)] shadow-2xs' : 'text-[var(--ink-soft)]'
                  }`}
                  title="Table view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded cursor-pointer ${
                    viewMode === 'kanban' ? 'bg-[var(--card)] text-[var(--ink)] shadow-2xs' : 'text-[var(--ink-soft)]'
                  }`}
                  title="Kanban view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-3.5 space-y-1">
              <span className="text-[var(--ink-soft)] block">Total in Queue</span>
              <span className="text-xl font-bold font-serif-civic text-[var(--ink)]">
                {complaints.length}
              </span>
            </div>
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-3.5 space-y-1">
              <span className="text-[var(--brick)] block font-semibold">Critical / High Severity</span>
              <span className="text-xl font-bold font-serif-civic text-[var(--brick)]">
                {complaints.filter((c) => c.severity === 'critical' || c.severity === 'high').length}
              </span>
            </div>
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-3.5 space-y-1">
              <span className="text-emerald-800 block font-semibold">Duplicate Clusters Clustered</span>
              <span className="text-xl font-bold font-serif-civic text-emerald-800">
                {complaints.filter((c) => c.report_count > 1).length}
              </span>
            </div>
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-3.5 space-y-1">
              <span className="text-[var(--ink-soft)] block">Avg Response Target</span>
              <span className="text-xl font-bold font-serif-civic text-[var(--ink)]">
                &lt; 4 Hours
              </span>
            </div>
          </div>

          {/* VIEW MODE 1: LEDGER TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg2)] text-[var(--ink)] font-semibold border-b border-[var(--line)] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Category & Location</th>
                      <th className="py-3 px-4">Executive AI Summary</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Citizens</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[var(--ink-soft)]">
                          Loading complaints queue...
                        </td>
                      </tr>
                    ) : complaints.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-[var(--ink-soft)]">
                          No complaints match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      complaints.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-[var(--bg)] cursor-pointer transition-colors"
                          onClick={() => setSelectedComplaint(item)}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[var(--ochre)] whitespace-nowrap">
                            #{item.id}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-[var(--ink)] block">{item.category}</span>
                            <span className="text-[11px] text-[var(--ink-soft)]">{item.ward}</span>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-[var(--ink)] font-serif-civic">
                            {item.ai_summary}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 ${
                                item.severity === 'critical'
                                  ? 'bg-red-100 text-[var(--brick)] border border-red-300'
                                  : item.severity === 'high'
                                  ? 'bg-orange-100 text-orange-900'
                                  : item.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {item.severity === 'critical' && <Flame className="w-3 h-3 text-[var(--brick)]" />}
                              {item.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.report_count > 1 ? (
                              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {item.report_count} reporters
                              </span>
                            ) : (
                              <span className="text-[var(--ink-soft)]">1 citizen</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                item.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : item.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-900'
                                  : item.status === 'acknowledged'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-neutral-100 text-neutral-800'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComplaint(item);
                              }}
                              className="text-xs font-semibold text-[var(--green)] hover:underline flex items-center justify-end gap-1"
                            >
                              <span>Manage</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: KANBAN BOARD */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { status: 'new', label: 'New Reports', color: 'border-neutral-300' },
                { status: 'acknowledged', label: 'Acknowledged', color: 'border-amber-300' },
                { status: 'in_progress', label: 'In Progress', color: 'border-blue-300' },
                { status: 'resolved', label: 'Resolved', color: 'border-emerald-300' },
              ].map((col) => {
                const colItems = complaints.filter((c) => c.status === col.status);
                return (
                  <div key={col.status} className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                      <span className="text-xs font-bold text-[var(--ink)]">{col.label}</span>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg2)]">
                        {colItems.length}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {colItems.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[var(--ink-soft)] italic">
                          No items
                        </div>
                      ) : (
                        colItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedComplaint(item)}
                            className="bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--green)] p-3 rounded-lg cursor-pointer transition-all shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-[var(--ochre)]">
                                #{item.id}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  item.severity === 'critical'
                                    ? 'bg-red-100 text-[var(--brick)]'
                                    : item.severity === 'high'
                                    ? 'bg-orange-100 text-orange-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {item.severity}
                              </span>
                            </div>

                            <p className="text-xs font-serif-civic font-semibold text-[var(--ink)] line-clamp-2 leading-snug">
                              {item.ai_summary}
                            </p>

                            <div className="flex items-center justify-between text-[11px] text-[var(--ink-soft)] pt-1 border-t border-[var(--line)]">
                              <span>{item.ward}</span>
                              {item.report_count > 1 && (
                                <span className="font-semibold text-emerald-800">
                                  {item.report_count} reporters
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: ANALYTICS DASHBOARD                           */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-1">
              <span className="text-xs font-semibold text-[var(--ink-soft)] uppercase tracking-wider block">
                Total Complaints
              </span>
              <div className="text-3xl font-bold font-serif-civic text-[var(--ink)]">
                {analytics.metrics.total}
              </div>
              <span className="text-[11px] text-[var(--ink-soft)] block">
                Across active ward jurisdiction
              </span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Resolved Ratio
              </span>
              <div className="text-3xl font-bold font-serif-civic text-emerald-800">
                {analytics.metrics.total > 0
                  ? ((analytics.metrics.resolved / analytics.metrics.total) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <span className="text-[11px] text-[var(--ink-soft)] block">
                {analytics.metrics.resolved} cases verified closed
              </span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-1">
              <span className="text-xs font-semibold text-[var(--green)] uppercase tracking-wider block">
                Avg Resolution Time
              </span>
              <div className="text-3xl font-bold font-serif-civic text-[var(--green)]">
                {analytics.metrics.avg_resolution_hours} hrs
              </div>
              <span className="text-[11px] text-[var(--ink-soft)] block">
                SLA Compliance: {analytics.metrics.sla_compliance_rate}%
              </span>
            </div>

            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-1">
              <span className="text-xs font-semibold text-[var(--ochre)] uppercase tracking-wider block">
                Citizens Consolidated
              </span>
              <div className="text-3xl font-bold font-serif-civic text-[var(--ochre)]">
                {analytics.metrics.total_citizens_reached}
              </div>
              <span className="text-[11px] text-[var(--ink-soft)] block">
                {analytics.metrics.deduplicated_reports} near-duplicate calls saved
              </span>
            </div>
          </div>

          {/* Breakdown Charts (Severity & Ward Density) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Severity Distribution */}
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold font-serif-civic text-[var(--ink)] flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[var(--green)]" />
                Severity Breakdown & Risk Profile
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Critical Risk', count: analytics.by_severity.critical || 0, color: 'bg-[var(--brick)]' },
                  { label: 'High Priority', count: analytics.by_severity.high || 0, color: 'bg-orange-500' },
                  { label: 'Medium', count: analytics.by_severity.medium || 0, color: 'bg-[var(--ochre)]' },
                  { label: 'Low Routine', count: analytics.by_severity.low || 0, color: 'bg-[var(--green)]' },
                ].map((sev) => {
                  const pct = analytics.metrics.total > 0 ? (sev.count / analytics.metrics.total) * 100 : 0;
                  return (
                    <div key={sev.label} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--ink)]">{sev.label}</span>
                        <span className="text-[var(--ink-soft)]">
                          {sev.count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sev.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ward Hotspot Map Visualizer */}
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold font-serif-civic text-[var(--ink)] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--green)]" />
                Ward Hotspot Density & Concentration
              </h3>
              <div className="space-y-2.5">
                {Object.entries(analytics.by_ward).map(([wardName, count]) => {
                  const maxCount = Math.max(...Object.values(analytics.by_ward), 1);
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={wardName} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-semibold text-[var(--ink)]">{wardName}</span>
                        <span className="font-mono text-[var(--ink-soft)]">{count} complaints</span>
                      </div>
                      <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--green)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* COMPLAINT DETAIL MODAL / DRAWER (Section 6)          */}
      {/* ---------------------------------------------------- */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-[var(--ochre)] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    #{selectedComplaint.id}
                  </span>
                  <span className="text-xs uppercase tracking-wider font-semibold text-[var(--ink-soft)]">
                    {selectedComplaint.department_name}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-serif-civic text-[var(--ink)] mt-1">
                  {selectedComplaint.category}
                </h3>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg2)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Summary Banner */}
            <div className="bg-[var(--bg2)] border border-[var(--line)] rounded-xl p-4 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--green)] block">
                Executive AI Triage Summary:
              </span>
              <p className="text-sm font-serif-civic text-[var(--ink)] leading-relaxed">
                {selectedComplaint.ai_summary}
              </p>
              <p className="text-xs text-[var(--ink-soft)] italic pt-1">
                Original raw voice/text: "{selectedComplaint.raw_input_text}"
              </p>
            </div>

            {/* Grid: Photo & Map Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <span className="font-semibold text-[var(--ink)] block">Location & GIS Pin:</span>
                <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 space-y-2">
                  <p className="font-medium text-[var(--ink)]">{selectedComplaint.address_text}</p>
                  <p className="text-[var(--ink-soft)]">Ward: {selectedComplaint.ward}</p>
                  <div className="rounded-lg overflow-hidden border border-[var(--line)] mt-1">
                    <InteractiveMap
                      latitude={selectedComplaint.latitude}
                      longitude={selectedComplaint.longitude}
                      interactive={false}
                      height="150px"
                      zoom={16}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-[var(--ink)] block">Citizen Attached Photo:</span>
                {selectedComplaint.photo_url ? (
                  <img
                    src={selectedComplaint.photo_url}
                    alt="Citizen defect"
                    className="w-full h-32 object-cover rounded-xl border border-[var(--line)]"
                  />
                ) : (
                  <div className="h-32 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center justify-center text-[var(--ink-soft)]">
                    No photo uploaded
                  </div>
                )}
              </div>
            </div>

            {/* Duplicate Cluster List */}
            {selectedComplaint.report_count > 1 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>Deduplication Cluster ({selectedComplaint.report_count} Citizens)</span>
                </div>
                <p className="text-emerald-950 text-[11px]">
                  Citizens who reported this defect:{' '}
                  <strong>{selectedComplaint.reporter_names.join(', ')}</strong>
                </p>
              </div>
            )}

            {/* SECTION 13: CORRESPONDENCE THREAD & SIMULATED INBOUND OFFICER EMAIL */}
            <div className="border border-[var(--line)] rounded-xl p-4 bg-[var(--bg)] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[var(--green)]" />
                  Automated Municipal Email Correspondence:
                </span>
                <span className="text-[11px] text-[var(--ink-soft)]">
                  Unique reply address: complaint-{selectedComplaint.id}@municipal.gov.in
                </span>
              </div>

              {/* Thread list */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedComplaint.correspondence.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-lg border ${
                      c.direction === 'inbound_reply'
                        ? 'bg-emerald-50 border-emerald-300 ml-4'
                        : 'bg-[var(--card)] border-[var(--line)] mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink)] mb-1">
                      <span>{c.direction === 'inbound_reply' ? `📥 Reply from ${c.officer_name}` : `📤 Automated Dispatch to ${c.to_email}`}</span>
                      <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                        {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>

              {/* Interactive Inbound Email Simulation Control */}
              <div className="bg-[var(--card)] border border-[var(--line)] p-3 rounded-lg space-y-2 pt-2">
                <span className="text-[11px] font-semibold text-[var(--ochre)] block">
                  Simulate Department Officer Email Reply (Interactive Demo):
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={officerReplyText}
                    onChange={(e) => setOfficerReplyText(e.target.value)}
                    placeholder="Type officer reply text..."
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--line)] bg-[var(--bg)]"
                  />
                  <button
                    onClick={handleSimulateEmailReply}
                    disabled={isSimulatingReply}
                    className="px-4 py-1.5 text-xs font-semibold bg-[var(--green)] text-white rounded cursor-pointer hover:bg-[var(--green-deep)] flex items-center justify-center gap-1.5"
                  >
                    {isSimulatingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Reply Webhook</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Internal Notes (Admin-only) */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-[var(--ink)] block">Internal Department Notes (Admin Only):</span>
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {selectedComplaint.internal_notes.length === 0 ? (
                  <p className="text-[var(--ink-soft)] italic">No internal notes yet.</p>
                ) : (
                  selectedComplaint.internal_notes.map((note, idx) => (
                    <div key={idx} className="bg-[var(--bg)] p-2 rounded border border-[var(--line)] text-[var(--ink)]">
                      {note}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newInternalNote}
                  onChange={(e) => setNewInternalNote(e.target.value)}
                  placeholder="Add note for field crew..."
                  className="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--line)] bg-[var(--bg)]"
                />
                <button
                  onClick={handleAddNote}
                  disabled={isSavingNote}
                  className="px-3 py-1.5 text-xs font-semibold bg-[var(--ink)] text-white rounded cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>

            {/* Department Actions Toolbar */}
            <div className="border-t border-[var(--line)] pt-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] block">
                Official Department Actions:
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {/* Acknowledge */}
                <button
                  onClick={() => handleStatusChange('acknowledged')}
                  disabled={isUpdatingStatus || selectedComplaint.status === 'acknowledged'}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition-colors"
                >
                  Acknowledge Ticket
                </button>

                {/* Mark In Progress */}
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isUpdatingStatus || selectedComplaint.status === 'in_progress'}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                >
                  Dispatch Crew (In Progress)
                </button>

                {/* Resolve */}
                <button
                  onClick={() => handleStatusChange('resolved')}
                  disabled={isUpdatingStatus || selectedComplaint.status === 'resolved'}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>

                {/* Reject */}
                <button
                  onClick={() => handleStatusChange('rejected')}
                  disabled={isUpdatingStatus || selectedComplaint.status === 'rejected'}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--brick)] hover:bg-red-800 text-white cursor-pointer transition-colors"
                >
                  Reject Ticket
                </button>
              </div>

              {/* Reassign Department Accordion */}
              <div className="pt-2 border-t border-[var(--line)] flex flex-col sm:flex-row items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--ink)] flex-shrink-0">Reassign Jurisdiction:</span>
                <select
                  value={reassignDeptId}
                  onChange={(e) => setReassignDeptId(e.target.value)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] bg-[var(--bg)] cursor-pointer"
                >
                  <option value="">Select target department...</option>
                  {departments
                    .filter((d) => d.id !== selectedComplaint.department_id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleReassign}
                  disabled={!reassignDeptId || isUpdatingStatus}
                  className="px-3 py-1.5 font-semibold bg-[var(--green)] hover:bg-[var(--green-deep)] text-white rounded cursor-pointer disabled:opacity-50"
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
