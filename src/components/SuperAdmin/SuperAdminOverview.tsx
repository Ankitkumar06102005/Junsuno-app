import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  Flame,
  Search,
  Activity,
  Layers,
} from 'lucide-react';
import { fetchDepartments, fetchComplaints, fetchAnalytics } from '../../services/api';
import { Department, CitizenComplaint, AnalyticsData } from '../../types';

interface SuperAdminOverviewProps {
  onSelectDepartment: (deptId: string) => void;
}

export const SuperAdminOverview: React.FC<SuperAdminOverviewProps> = ({
  onSelectDepartment,
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allComplaints, setAllComplaints] = useState<CitizenComplaint[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Promise.all([fetchDepartments(), fetchComplaints(), fetchAnalytics()]).then(
      ([depts, complaintsRes, analyticsData]) => {
        setDepartments(depts);
        setAllComplaints(complaintsRes.complaints);
        setAnalytics(analyticsData);
      }
    );
  }, []);

  const filtered = allComplaints.filter(
    (c) =>
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ai_summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.department_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ward.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans-civic space-y-6">
      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[var(--green-deep)] text-white">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold font-serif-civic text-[var(--ink)]">
              City-wide Municipal Command & Audit Center
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Real-time cross-departmental surveillance, jurisdictional load balancing, and municipal SLA monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono bg-[var(--bg2)] px-2.5 py-1.5 rounded-lg border border-[var(--line)] font-semibold text-[var(--ink)]">
            Active Wards: 42
          </span>
          <span className="font-mono bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 font-semibold text-emerald-800">
            SLA Rating: 94.6%
          </span>
        </div>
      </div>

      {/* Department Load Grid */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-3">
          Departmental Caseload & SLA Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {departments.map((dept) => {
            const deptComplaints = allComplaints.filter((c) => c.department_id === dept.id);
            const openCount = deptComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'rejected').length;
            const criticalCount = deptComplaints.filter((c) => c.severity === 'critical').length;

            return (
              <div
                key={dept.id}
                onClick={() => onSelectDepartment(dept.id)}
                className="bg-[var(--card)] border border-[var(--line)] hover:border-[var(--green)] p-4 rounded-xl cursor-pointer transition-all shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: dept.color }}
                  >
                    {dept.short_code}
                  </div>
                  {criticalCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--brick)] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      <Flame className="w-3 h-3 text-[var(--brick)]" />
                      {criticalCount} Critical
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[var(--ink)] line-clamp-1">{dept.name}</h4>
                  <span className="text-[11px] text-[var(--ink-soft)] block line-clamp-1 mt-0.5">
                    {dept.municipal_zone}
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                  <span className="text-[var(--ink-soft)]">Active Load:</span>
                  <span className="font-bold text-[var(--ink)]">{openCount} tickets</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* City-wide Ledger Audit Stream */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold font-serif-civic text-[var(--ink)] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--green)]" />
            Live City-wide Grievance Feed & Cross-Department Ledger
          </h3>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all departments..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg2)] text-[var(--ink)] font-semibold border-b border-[var(--line)] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Ticket</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Executive AI Summary</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Reported By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--bg)] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-[var(--ochre)] whitespace-nowrap">
                    #{item.id}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[var(--ink)]">
                    {item.department_name}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-[var(--ink-soft)]">
                    {item.category}
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate text-[var(--ink)] font-serif-civic">
                    {item.ai_summary}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
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
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-mono text-[11px] text-[var(--ink-soft)] uppercase">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-[var(--ink-soft)]">
                    {item.citizen_name} ({item.report_count} calls)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
