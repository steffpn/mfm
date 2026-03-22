"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/cn";

interface Invitation {
  id: number;
  code: string;
  role: string;
  status: "pending" | "redeemed" | "expired" | "revoked";
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

const ROLES = ["ARTIST", "LABEL", "STATION", "ADMIN"] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  redeemed: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  expired: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20",
  revoked: "bg-red-400/10 text-red-400 border-red-400/20",
};

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form state
  const [formRole, setFormRole] = useState<string>("ARTIST");
  const [formScopeId, setFormScopeId] = useState("");
  const [formMaxUses, setFormMaxUses] = useState("1");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchInvitations = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated. Please log in.");
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<Invitation[]>("/admin/invitations", { token });
      setInvitations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setFormSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        role: formRole,
        maxUses: parseInt(formMaxUses, 10) || 1,
      };
      if (formScopeId) body.scopeId = parseInt(formScopeId, 10);
      if (formExpiresAt) body.expiresAt = new Date(formExpiresAt).toISOString();

      await apiFetch("/admin/invitations", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setFormRole("ARTIST");
      setFormScopeId("");
      setFormMaxUses("1");
      setFormExpiresAt("");
      fetchInvitations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleRevoke(id: number) {
    const token = getToken();
    if (!token) return;
    setActionLoading(id);
    try {
      await apiFetch(`/admin/invitations/${id}/revoke`, {
        method: "PATCH",
        token,
      });
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, status: "revoked" as const } : inv
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke invitation");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading invitations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchInvitations(); }}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invitation Codes</h1>
          <p className="text-sm text-zinc-400 mt-1">{invitations.length} invitations</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Invitation
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Invitation</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Role</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Scope ID</label>
              <input
                type="number"
                value={formScopeId}
                onChange={(e) => setFormScopeId(e.target.value)}
                placeholder="Optional"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Max Uses</label>
              <input
                type="number"
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
                min="1"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Expires At</label>
              <input
                type="datetime-local"
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-4 flex gap-3">
              <button
                type="submit"
                disabled={formSubmitting}
                className={cn(
                  "px-4 py-2 bg-white text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors",
                  formSubmitting && "opacity-50 cursor-not-allowed"
                )}
              >
                {formSubmitting ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Code</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Role</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Uses</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Expires</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Created</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-white bg-zinc-800 px-2 py-1 rounded">
                      {inv.code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{inv.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block text-xs font-medium px-2 py-1 rounded-full border",
                        STATUS_COLORS[inv.status] || "text-zinc-400 border-zinc-700"
                      )}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {inv.usedCount} / {inv.maxUses}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {inv.expiresAt
                      ? new Date(inv.expiresAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === "pending" && (
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        disabled={actionLoading === inv.id}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors",
                          actionLoading === inv.id && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invitations.length === 0 && (
          <div className="py-16 text-center text-zinc-500">No invitations yet.</div>
        )}
      </div>
    </div>
  );
}
