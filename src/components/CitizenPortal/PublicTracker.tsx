import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Clock,
  Building,
  CheckCircle,
  AlertCircle,
  Users,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Flame,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { fetchComplaints } from '../../services/api';
import { CitizenComplaint, SupportedLanguage } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';
import { InteractiveMap } from '../Common/InteractiveMap';

interface PublicTrackerProps {
  language: SupportedLanguage;
  initialQuery?: string;
  onSelectComplaint?: (id: string) => void;
  onNewComplaintClick: () => void;
}

export const PublicTracker: React.FC<PublicTrackerProps> = ({
  language,
  initialQuery = '',
  onSelectComplaint,
  onNewComplaintClick,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [complaints, setComplaints] = useState<CitizenComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchComplaints({
        query: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setComplaints(data.complaints);
      if (initialQuery && data.complaints.length > 0) {
        setExpandedId(data.complaints[0].id);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getStepStatus = (currentStatus: string, stepIndex: number) => {
    // 0: Reported, 1: Acknowledged, 2: In Progress, 3: Resolved
    const statusOrder: Record<string, number> = {
      new: 0,
      acknowledged: 1,
      in_progress: 2,
      resolved: 3,
      rejected: -1,
    };
    const currentIdx = statusOrder[currentStatus] ?? 0;
    if (currentStatus === 'rejected') return 'rejected';
    if (currentIdx > stepIndex) return 'completed';
    if (currentIdx === stepIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 font-sans-civic space-y-6">
      {/* Header & Search Hero */}
      <div className="border-b border-[var(--line)] pb-5">
        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--green)]">
          Public Civic Register & Transparency Ledger
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold font-serif-civic text-[var(--ink)] mt-1">
          {t.trackGrievance}
        </h2>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          Enter any complaint ID (e.g. <code className="font-mono bg-[var(--bg2)] px-1 py-0.5 rounded text-xs">JSN-1001</code>)
          or citizen phone number to inspect real-time municipal response.
        </p>

        {/* Universal Search Form */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--ink-soft)] absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--green)] shadow-2xs font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            Search
          </button>
        </form>

        {/* Status Filter Segmented Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-[var(--line)]">
          {[
            { id: 'all', label: t.allStatus },
            { id: 'new', label: t.statusNew },
            { id: 'acknowledged', label: t.statusAcknowledged },
            { id: 'in_progress', label: t.statusInProgress },
            { id: 'resolved', label: t.statusResolved },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                statusFilter === item.id
                  ? 'bg-[var(--ink)] text-white font-semibold shadow-2xs'
                  : 'bg-[var(--card)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results List (Ledger Concept) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-[var(--ink-soft)]">
            Loading civic ledger records...
          </div>
        ) : complaints.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-[var(--ink-soft)] opacity-40" />
            <h3 className="text-base font-semibold text-[var(--ink)]">No Grievances Found</h3>
            <p className="text-xs text-[var(--ink-soft)] max-w-md mx-auto">
              {t.emptyTrack}
            </p>
            <button
              onClick={onNewComplaintClick}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--green)] text-white text-xs font-semibold cursor-pointer"
            >
              <span>File a new grievance now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          complaints.map((item) => {
            const isExpanded = expandedId === item.id;
            const latestReply = item.correspondence.find((c) => c.direction === 'inbound_reply');

            return (
              <div
                key={item.id}
                className="bg-[var(--card)] border border-[var(--line)] hover:border-[var(--green)] rounded-xl transition-all shadow-xs overflow-hidden"
              >
                {/* Main Card Summary Row */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Ticket ID, Category, Location */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[var(--ochre)] bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200">
                          #{item.id}
                        </span>

                        <span className="text-xs font-semibold text-[var(--ink)]">
                          {item.category}
                        </span>

                        <span className="text-xs text-[var(--ink-soft)] font-medium">
                          · {item.ward}
                        </span>

                        {/* Duplicate Cluster Badge (Section 1) */}
                        {item.report_count > 1 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Users className="w-3 h-3 text-emerald-700" />
                            <span>{item.report_count} citizens reported this</span>
                          </span>
                        )}
                      </div>

                      {/* AI Clean Summary */}
                      <p className="text-sm font-serif-civic font-semibold text-[var(--ink)] leading-snug">
                        {item.ai_summary}
                      </p>

                      {/* Raw text snippet */}
                      <p className="text-xs text-[var(--ink-soft)] line-clamp-1 italic">
                        "{item.raw_input_text}"
                      </p>

                      {/* Metadata inline */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-soft)] pt-1">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-[var(--green)]" />
                          {item.department_name}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Right: Severity Badge & Toggle */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 flex-shrink-0">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded inline-flex items-center gap-1 uppercase tracking-wider ${
                          item.severity === 'critical'
                            ? 'bg-red-100 text-[var(--brick)] border border-red-300'
                            : item.severity === 'high'
                            ? 'bg-orange-100 text-orange-900 border border-orange-200'
                            : item.severity === 'medium'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {item.severity === 'critical' && <Flame className="w-3.5 h-3.5 text-[var(--brick)]" />}
                        {item.severity}
                      </span>

                      <div className="flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                        <span>{isExpanded ? 'Less' : 'Details'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* 4-Step Progress Bar (Reported ● Acknowledged ● In Progress ● Resolved) */}
                  <div className="mt-4 pt-4 border-t border-[var(--line)]">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: t.statusNew, idx: 0 },
                        { label: t.statusAcknowledged, idx: 1 },
                        { label: t.statusInProgress, idx: 2 },
                        { label: t.statusResolved, idx: 3 },
                      ].map((st) => {
                        const state = getStepStatus(item.status, st.idx);
                        return (
                          <div key={st.idx} className="space-y-1">
                            <div className="relative flex items-center justify-center">
                              {/* Connector line */}
                              {st.idx > 0 && (
                                <div
                                  className={`absolute left-0 right-1/2 top-1.5 h-0.5 -z-0 ${
                                    state === 'completed' || state === 'current'
                                      ? 'bg-[var(--green)]'
                                      : 'bg-[var(--line)]'
                                  }`}
                                />
                              )}
                              {st.idx < 3 && (
                                <div
                                  className={`absolute left-1/2 right-0 top-1.5 h-0.5 -z-0 ${
                                    state === 'completed'
                                      ? 'bg-[var(--green)]'
                                      : 'bg-[var(--line)]'
                                  }`}
                                />
                              )}
                              {/* Step circle */}
                              <div
                                className={`w-3.5 h-3.5 rounded-full z-10 transition-colors ${
                                  state === 'completed'
                                    ? 'bg-[var(--green)]'
                                    : state === 'current'
                                    ? 'bg-[var(--green)] ring-4 ring-emerald-200'
                                    : 'bg-[var(--line)]'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-[11px] block leading-tight font-medium ${
                                state === 'completed' || state === 'current'
                                  ? 'text-[var(--ink)] font-semibold'
                                  : 'text-[var(--ink-soft)]'
                              }`}
                            >
                              {st.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="bg-[var(--bg)] border-t border-[var(--line)] p-5 space-y-4">
                    {/* Official Department Inbound Reply Quote (Section 13) */}
                    {latestReply && (
                      <div className="bg-emerald-50 border-l-4 border-[var(--green)] p-3 rounded-r-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-950">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[var(--green)]" />
                            Official Response from {latestReply.officer_name || item.department_name}:
                          </span>
                          <span className="text-[11px] text-emerald-800 font-normal">
                            {new Date(latestReply.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-900 leading-relaxed font-serif-civic">
                          "{latestReply.body}"
                        </p>
                      </div>
                    )}

                    {/* Location & Attached Photo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-[var(--card)] p-3 rounded-lg border border-[var(--line)] space-y-2">
                        <span className="font-semibold text-[var(--ink)] block flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[var(--green)]" />
                          Location & Geotag:
                        </span>
                        <p className="text-[var(--ink-soft)]">{item.address_text}</p>
                        <div className="rounded-lg overflow-hidden border border-[var(--line)] mt-1">
                          <InteractiveMap
                            latitude={item.latitude}
                            longitude={item.longitude}
                            interactive={false}
                            height="160px"
                            zoom={16}
                          />
                        </div>
                      </div>

                      {item.photo_url ? (
                        <div className="bg-[var(--card)] p-3 rounded-lg border border-[var(--line)]">
                          <span className="font-semibold text-[var(--ink)] block mb-1 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-[var(--green)]" />
                            Attached On-site Photo:
                          </span>
                          <img
                            src={item.photo_url}
                            alt="Civic defect photo"
                            className="w-full h-28 object-cover rounded border border-[var(--line)]"
                          />
                        </div>
                      ) : (
                        <div className="bg-[var(--card)] p-3 rounded-lg border border-[var(--line)] flex items-center justify-center text-[var(--ink-soft)]">
                          No photo attached
                        </div>
                      )}
                    </div>

                    {/* Status Audit History Timeline */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider block">
                        Official Action Log & Timeline:
                      </span>
                      <div className="space-y-1.5">
                        {item.history.map((hist) => (
                          <div
                            key={hist.id}
                            className="text-xs bg-[var(--card)] p-2.5 rounded-lg border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                          >
                            <div>
                              <span className="font-semibold text-[var(--ink)]">{hist.changed_by}:</span>{' '}
                              <span className="text-[var(--ink-soft)]">{hist.note}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--ink-soft)] flex-shrink-0">
                              {new Date(hist.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
