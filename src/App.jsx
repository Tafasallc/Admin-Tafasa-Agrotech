import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import {
  LayoutGrid, Wheat, Users, Handshake, Tractor, AlertTriangle, Check, X,
  Search, Pencil, ShieldCheck, ShieldAlert, Star, ChevronDown, TrendingUp,
  TrendingDown, Clock, MapPin, Phone, MoreHorizontal, ArrowRight, Settings
} from "lucide-react";

// ---------- Tokens (shared brand, dashboard layout) ----------
// Indigo #23305A · Millet gold #D9A62E · Sorghum #B4482A · Baobab green #4C7A52 · Husk #FBF7EA

const CROPS = {
  MAI: "Maize", SOR: "Sorghum", MIL: "Millet", RIC: "Rice", GNT: "Groundnut", COW: "Cowpea",
};

const MARKET_NAMES = { AUY: "Auyo", KAZ: "Kazaure", HAD: "Hadejia" };

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

// ---------- Data loading + writes (Supabase) ----------

async function fetchPrices() {
  const { data, error } = await supabase
    .from("price_aggregates")
    .select("*")
    .order("crop_code");
  if (error) { console.error(error); return []; }
  return data.map((r) => ({
    id: r.id, crop: r.crop_code, market: MARKET_NAMES[r.market_code] || r.market_code,
    min: r.min_price, avg: r.avg_price, max: r.max_price,
    reports: r.report_count, trend: r.trend_pct,
  }));
}

async function fetchFlaggedReports() {
  const { data, error } = await supabase
    .from("price_reports")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((r) => ({
    id: r.id, crop: r.crop_code, market: MARKET_NAMES[r.market_code] || r.market_code,
    reporter: r.reporter_name, qty: `${r.quantity} ${r.unit}`, price: r.price,
    benchmark: r.benchmark, deviation: r.deviation_pct, submitted: timeAgo(r.submitted_at),
  }));
}

async function fetchVerifications() {
  const { data, error } = await supabase
    .from("user_verifications")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((r) => ({
    id: r.id, name: r.name, role: r.role, phone: r.phone,
    market: MARKET_NAMES[r.market_code] || r.market_code, channel: r.channel,
    submitted: timeAgo(r.submitted_at),
  }));
}

async function fetchTrustUsers() {
  const { data, error } = await supabase
    .from("user_trust")
    .select("*")
    .order("trust_score", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((r) => ({
    id: r.id, name: r.name, role: r.role,
    market: MARKET_NAMES[r.market_code] || r.market_code,
    trust: r.trust_score, deals: r.deals_count, flag: r.flag,
  }));
}

async function fetchServiceRequests() {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*, service_providers(name)")
    .order("requested_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map((r) => ({
    id: r.id, farmer: r.farmer_name, service: r.service_type,
    market: MARKET_NAMES[r.market_code] || r.market_code,
    requested: timeAgo(r.requested_at), status: r.status,
    provider: r.service_providers?.name || null,
  }));
}

// ---------- Admin management (super admin only) ----------

async function fetchCurrentAdmin() {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("admins").select("*").eq("id", uid).maybeSingle();
  if (error) { console.error(error); return null; }
  return data; // { id, email, is_super_admin } or null if somehow not in admins
}

async function fetchAllAdmins() {
  const { data, error } = await supabase.from("admins").select("*").order("email");
  if (error) { console.error(error); return []; }
  return data;
}

async function addAdmin(uuid, email) {
  const { error } = await supabase.from("admins").insert({ id: uuid, email });
  if (error) { console.error(error); return error.message; }
  return null;
}

async function removeAdmin(id) {
  const { error } = await supabase.from("admins").delete().eq("id", id);
  if (error) { console.error(error); return error.message; }
  return null;
}

async function setSuperAdminStatus(id, isSuper) {
  const { error } = await supabase.from("admins").update({ is_super_admin: isSuper }).eq("id", id);
  if (error) { console.error(error); return error.message; }
  return null;
}

async function changeMyPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return error.message;
  return null;
}


// Providers are now fetched from Supabase per-request (see ServicesPanel),
// since service_providers is a real table rather than a static map.

function naira(n) {
  return "₦" + n.toLocaleString("en-NG");
}

// ---------- Small shared UI ----------

function StatCard({ label, value, sub, tone = "indigo" }) {
  const tones = {
    indigo: "text-[#23305A]",
    gold: "text-[#B0791C]",
    red: "text-[#B4482A]",
    green: "text-[#4C7A52]",
  };
  return (
    <div className="bg-white rounded-xl border border-[#E9DFC2] px-5 py-4">
      <p className="text-[11.5px] text-[#8A8064] font-medium">{label}</p>
      <p className={`font-display text-[26px] mt-1 ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#8A8064] mt-0.5">{sub}</p>}
    </div>
  );
}

function TrustPill({ score }) {
  const tone = score >= 70 ? "green" : score >= 45 ? "gold" : "red";
  const styles = {
    green: "bg-[#E4EEE3] text-[#4C7A52]",
    gold: "bg-[#F3E9CE] text-[#8A6A1A]",
    red: "bg-[#F3E1DA] text-[#B4482A]",
  };
  return (
    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full ${styles[tone]}`}>
      {score}
    </span>
  );
}

function SectionHeader({ title, desc, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h1 className="font-display text-[21px] text-[#23305A]">{title}</h1>
        {desc && <p className="text-[12.5px] text-[#8A8064] mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Overview ----------

function OverviewPanel({ prices, flagged, verifications, requests }) {
  const openRequests = requests.filter((r) => r.status === "requested").length;
  return (
    <div>
      <SectionHeader title="Overview" desc="Auyo LGA pilot · today" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Flagged price reports" value={flagged.length} sub="awaiting review" tone="red" />
        <StatCard label="Pending verifications" value={verifications.length} sub="new signups" tone="gold" />
        <StatCard label="Open service requests" value={openRequests} sub="unassigned" tone="indigo" />
        <StatCard label="Crops tracked" value={prices.length} sub="across 3 markets" tone="green" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E9DFC2] p-4">
          <p className="text-[13px] font-semibold text-[#23305A] mb-3">Needs attention</p>
          <div className="space-y-2.5">
            {flagged.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 text-[12.5px]">
                <AlertTriangle size={14} className="text-[#B4482A] shrink-0" />
                <span className="text-[#5C5540]">
                  {CROPS[f.crop]} at {f.market} — {f.deviation > 0 ? "+" : ""}{f.deviation}% off benchmark
                </span>
              </div>
            ))}
            {openRequests > 0 && (
              <div className="flex items-center gap-2.5 text-[12.5px]">
                <Tractor size={14} className="text-[#23305A] shrink-0" />
                <span className="text-[#5C5540]">{openRequests} farm service requests unassigned</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9DFC2] p-4">
          <p className="text-[13px] font-semibold text-[#23305A] mb-3">Today's price movement</p>
          <div className="space-y-2">
            {prices.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#5C5540]">{CROPS[p.crop]} · {p.market}</span>
                <span className={`font-mono flex items-center gap-1 ${p.trend >= 0 ? "text-[#4C7A52]" : "text-[#B4482A]"}`}>
                  {p.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(p.trend)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Prices ----------

function PricesPanel({ prices, setPrices, flagged, setFlagged }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({ min: row.min, avg: row.avg, max: row.max });
  };

  const saveEdit = async (id) => {
    const updated = { min: +draft.min, avg: +draft.avg, max: +draft.max };
    // optimistic UI update
    setPrices((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    setEditingId(null);
    const { error } = await supabase
      .from("price_aggregates")
      .update({ min_price: updated.min, avg_price: updated.avg, max_price: updated.max, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error("Failed to save price:", error);
  };

  const resolveFlag = async (id, action) => {
    setFlagged((prev) => prev.filter((f) => f.id !== id));
    const { error } = await supabase
      .from("price_reports")
      .update({ status: action === "approve" ? "approved" : "rejected" })
      .eq("id", id);
    if (error) console.error("Failed to resolve report:", error);
    // Note: approving a report here just marks it reviewed. Recomputing the
    // price_aggregates min/avg/max from approved reports is a good next step
    // (e.g. a Supabase Edge Function or scheduled job) rather than doing it
    // client-side.
  };

  return (
    <div>
      <SectionHeader title="Price management" desc="Override aggregates and review flagged community reports" />

      {flagged.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E9DFC2] mb-5">
          <div className="px-4 py-3 border-b border-[#EFE7CE] flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#B4482A]" />
            <p className="text-[13px] font-semibold text-[#23305A]">Flagged reports ({flagged.length})</p>
          </div>
          <div className="divide-y divide-[#EFE7CE]">
            {flagged.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#23305A]">
                    <span className="font-semibold">{CROPS[f.crop]}</span> · {f.market} · {f.reporter}
                  </p>
                  <p className="text-[11.5px] text-[#8A8064] mt-0.5">
                    Reported {naira(f.price)} for {f.qty} · benchmark {naira(f.benchmark)} ·{" "}
                    <span className={f.deviation > 0 ? "text-[#B4482A]" : "text-[#B4482A]"}>
                      {f.deviation > 0 ? "+" : ""}{f.deviation}% deviation
                    </span>{" "}
                    · {f.submitted}
                  </p>
                </div>
                <button
                  onClick={() => resolveFlag(f.id, "reject")}
                  className="w-8 h-8 rounded-lg border border-[#E9DFC2] flex items-center justify-center text-[#B4482A]"
                  title="Reject report"
                >
                  <X size={15} />
                </button>
                <button
                  onClick={() => resolveFlag(f.id, "approve")}
                  className="w-8 h-8 rounded-lg bg-[#4C7A52] flex items-center justify-center text-white"
                  title="Approve into aggregate"
                >
                  <Check size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E9DFC2] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#F8F2E1] text-[#8A8064] text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-2.5">Crop</th>
              <th className="text-left font-medium px-4 py-2.5">Market</th>
              <th className="text-right font-medium px-4 py-2.5">Min</th>
              <th className="text-right font-medium px-4 py-2.5">Avg</th>
              <th className="text-right font-medium px-4 py-2.5">Max</th>
              <th className="text-right font-medium px-4 py-2.5">Reports</th>
              <th className="text-right font-medium px-4 py-2.5">Trend</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE7CE]">
            {prices.map((row) => {
              const editing = editingId === row.id;
              return (
                <tr key={row.id} className="text-[#3A3626]">
                  <td className="px-4 py-2.5 font-semibold text-[#23305A]">{CROPS[row.crop]}</td>
                  <td className="px-4 py-2.5 text-[#8A8064]">{row.market}</td>
                  {["min", "avg", "max"].map((k) => (
                    <td key={k} className="px-4 py-2.5 text-right font-mono">
                      {editing ? (
                        <input
                          value={draft[k]}
                          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                          className="w-24 text-right border border-[#D9A62E] rounded px-1.5 py-0.5 outline-none font-mono"
                        />
                      ) : (
                        naira(row[k])
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-[#8A8064] font-mono">{row.reports}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-mono inline-flex items-center gap-0.5 ${row.trend >= 0 ? "text-[#4C7A52]" : "text-[#B4482A]"}`}>
                      {row.trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {Math.abs(row.trend)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editing ? (
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditingId(null)} className="text-[11.5px] text-[#8A8064] px-2 py-1">
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(row.id)}
                          className="text-[11.5px] font-semibold text-white bg-[#23305A] rounded-md px-2.5 py-1"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(row)}
                        className="text-[#8A8064] hover:text-[#23305A] inline-flex items-center gap-1 text-[11.5px]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Users: verification + trust ----------

function UsersPanel({ verifications, setVerifications, users, setUsers }) {
  const [tab, setTab] = useState("verify");

  const decide = async (id, approve) => {
    setVerifications((prev) => prev.filter((v) => v.id !== id));
    const { error } = await supabase
      .from("user_verifications")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", id);
    if (error) console.error("Failed to update verification:", error);
    // Note: on approval you'd typically also create/activate the user's
    // real account record here (or via a database trigger).
  };

  const adjustTrust = async (id, delta) => {
    let newScore = 50;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        newScore = Math.max(0, Math.min(100, u.trust + delta));
        return { ...u, trust: newScore };
      })
    );
    const { error } = await supabase
      .from("user_trust")
      .update({ trust_score: newScore, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error("Failed to update trust score:", error);
  };

  return (
    <div>
      <SectionHeader title="Users" desc="Verification queue and trust score oversight" />

      <div className="flex gap-1.5 mb-4">
        {[
          { id: "verify", label: `Verification queue (${verifications.length})` },
          { id: "trust", label: "Trust & ratings" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[12.5px] font-medium px-3.5 py-1.5 rounded-full border ${
              tab === t.id ? "bg-[#23305A] border-[#23305A] text-white" : "bg-white border-[#E9DFC2] text-[#5C5540]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "verify" ? (
        <div className="bg-white rounded-xl border border-[#E9DFC2] divide-y divide-[#EFE7CE]">
          {verifications.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px] text-[#8A8064]">Queue is empty. Nice work.</p>
          )}
          {verifications.map((v) => (
            <div key={v.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#F1EAD6] flex items-center justify-center text-[#23305A] text-[12px] font-display shrink-0">
                {v.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#23305A]">{v.name}</p>
                <p className="text-[11.5px] text-[#8A8064] flex items-center gap-1.5 flex-wrap">
                  <span className="capitalize">{v.role}</span>
                  <span>·</span>
                  <Phone size={10} /> {v.phone}
                  <span>·</span>
                  <MapPin size={10} /> {v.market}
                  <span>·</span> {v.channel}
                </p>
              </div>
              <span className="text-[10.5px] text-[#B0A883] whitespace-nowrap">{v.submitted}</span>
              <button
                onClick={() => decide(v.id, false)}
                className="w-8 h-8 rounded-lg border border-[#E9DFC2] flex items-center justify-center text-[#B4482A]"
              >
                <X size={15} />
              </button>
              <button
                onClick={() => decide(v.id, true)}
                className="w-8 h-8 rounded-lg bg-[#4C7A52] flex items-center justify-center text-white"
              >
                <Check size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E9DFC2] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8F2E1] text-[#8A8064] text-[11px] uppercase tracking-wide">
                <th className="text-left font-medium px-4 py-2.5">User</th>
                <th className="text-left font-medium px-4 py-2.5">Role</th>
                <th className="text-left font-medium px-4 py-2.5">Market</th>
                <th className="text-right font-medium px-4 py-2.5">Deals</th>
                <th className="text-right font-medium px-4 py-2.5">Trust</th>
                <th className="text-left font-medium px-4 py-2.5">Flag</th>
                <th className="text-right font-medium px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7CE]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-semibold text-[#23305A]">{u.name}</td>
                  <td className="px-4 py-2.5 text-[#8A8064] capitalize">{u.role}</td>
                  <td className="px-4 py-2.5 text-[#8A8064]">{u.market}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#8A8064]">{u.deals}</td>
                  <td className="px-4 py-2.5 text-right"><TrustPill score={u.trust} /></td>
                  <td className="px-4 py-2.5">
                    {u.flag ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#B4482A]">
                        <ShieldAlert size={12} /> {u.flag}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#4C7A52]">
                        <ShieldCheck size={12} /> Clear
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => adjustTrust(u.id, -5)}
                        className="text-[11px] px-2 py-1 rounded border border-[#E9DFC2] text-[#5C5540]"
                      >
                        −5
                      </button>
                      <button
                        onClick={() => adjustTrust(u.id, 5)}
                        className="text-[11px] px-2 py-1 rounded border border-[#E9DFC2] text-[#5C5540]"
                      >
                        +5
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Services ----------

function ServicesPanel({ requests, setRequests }) {
  const [assigningId, setAssigningId] = useState(null);
  const [providers, setProviders] = useState([]); // {id, name, service_type}

  useEffect(() => {
    supabase
      .from("service_providers")
      .select("*")
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setProviders(data || []);
      });
  }, []);

  const statusStyle = {
    requested: "bg-[#F3E9CE] text-[#8A6A1A]",
    assigned: "bg-[#DCE3F0] text-[#23305A]",
    completed: "bg-[#E4EEE3] text-[#4C7A52]",
  };

  const assign = async (id, provider) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "assigned", provider: provider.name } : r))
    );
    setAssigningId(null);
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "assigned", provider_id: provider.id })
      .eq("id", id);
    if (error) console.error("Failed to assign provider:", error);
  };

  const complete = async (id) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "completed" } : r)));
    const { error } = await supabase
      .from("service_requests")
      .update({ status: "completed" })
      .eq("id", id);
    if (error) console.error("Failed to mark complete:", error);
  };

  return (
    <div>
      <SectionHeader title="Farm service requests" desc="Match incoming requests to a provider" />
      <div className="bg-white rounded-xl border border-[#E9DFC2] divide-y divide-[#EFE7CE]">
        {requests.map((r) => (
          <div key={r.id} className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F1EAD6] flex items-center justify-center shrink-0">
              <Tractor size={16} className="text-[#23305A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#23305A]">{r.service}</p>
              <p className="text-[11.5px] text-[#8A8064]">
                {r.farmer} · {r.market} · requested {r.requested}
                {r.provider && <> · assigned to <span className="text-[#23305A] font-medium">{r.provider}</span></>}
              </p>
            </div>
            <span className={`text-[10.5px] font-medium px-2 py-1 rounded-full whitespace-nowrap capitalize ${statusStyle[r.status]}`}>
              {r.status}
            </span>

            {r.status === "requested" && (
              <div className="relative">
                <button
                  onClick={() => setAssigningId(assigningId === r.id ? null : r.id)}
                  className="text-[11.5px] font-semibold text-white bg-[#23305A] rounded-md px-2.5 py-1.5 flex items-center gap-1"
                >
                  Assign <ChevronDown size={12} />
                </button>
                {assigningId === r.id && (
                  <div className="absolute right-0 top-8 bg-white border border-[#E9DFC2] rounded-lg shadow-lg z-10 w-48 py-1">
                    {providers
                      .filter((p) => p.service_type === r.service)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => assign(r.id, p)}
                          className="w-full text-left px-3 py-2 text-[12px] text-[#3A3626] hover:bg-[#FAF5E8]"
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            {r.status === "assigned" && (
              <button
                onClick={() => complete(r.id)}
                className="text-[11.5px] font-semibold text-[#4C7A52] border border-[#4C7A52] rounded-md px-2.5 py-1.5"
              >
                Mark complete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Manage admins (super admin only) ----------

function AdminsPanel({ currentAdmin }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUuid, setNewUuid] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    setLoading(true);
    setAdmins(await fetchAllAdmins());
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!newUuid.trim() || !newEmail.trim()) {
      setError("Both the User UID and email are required.");
      return;
    }
    setAdding(true);
    const err = await addAdmin(newUuid.trim(), newEmail.trim());
    setAdding(false);
    if (err) {
      setError(err);
      return;
    }
    setNewUuid("");
    setNewEmail("");
    reload();
  };

  const handleRemove = async (id) => {
    if (id === currentAdmin?.id) return; // don't let someone remove themselves by accident
    await removeAdmin(id);
    reload();
  };

  const [togglingId, setTogglingId] = useState(null);
  const handleToggleSuper = async (a) => {
    if (a.id === currentAdmin?.id) return; // don't let someone change their own super status
    setTogglingId(a.id);
    await setSuperAdminStatus(a.id, !a.is_super_admin);
    setTogglingId(null);
    reload();
  };

  return (
    <div>
      <SectionHeader
        title="Manage admins"
        desc="Only you can add or remove admins. Everyone listed can edit prices, verifications, and services."
      />

      <div className="bg-white rounded-xl border border-[#E9DFC2] p-4 mb-5">
        <p className="text-[13px] font-semibold text-[#23305A] mb-3">Add an admin</p>
        <p className="text-[11.5px] text-[#8A8064] mb-3 leading-snug">
          First create their login in Supabase (Authentication → Users → Add
          user), then paste their User UID and email here.
        </p>
        <form onSubmit={handleAdd} className="flex flex-col gap-2.5">
          <input
            value={newUuid}
            onChange={(e) => setNewUuid(e.target.value)}
            placeholder="User UID (from Supabase Authentication → Users)"
            className="border border-[#E9DFC2] rounded-lg px-3 py-2 text-[12.5px] font-mono outline-none focus:ring-2 focus:ring-[#D9A62E]"
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="border border-[#E9DFC2] rounded-lg px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-[#D9A62E]"
          />
          {error && <p className="text-[11.5px] text-[#B4482A]">{error}</p>}
          <button
            type="submit"
            disabled={adding}
            className="self-start text-[12px] font-semibold text-white bg-[#23305A] rounded-md px-3.5 py-2 disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add admin"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-[#E9DFC2] divide-y divide-[#EFE7CE]">
        {loading && <p className="px-4 py-4 text-[12.5px] text-[#8A8064]">Loading…</p>}
        {!loading && admins.length === 0 && (
          <p className="px-4 py-4 text-[12.5px] text-[#8A8064]">No admins found.</p>
        )}
        {admins.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#F1EAD6] flex items-center justify-center text-[#23305A] text-[12px] font-display shrink-0">
              {a.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#23305A]">{a.email}</p>
              <p className="text-[11px] text-[#8A8064] font-mono">{a.id}</p>
            </div>
            {a.id === currentAdmin?.id ? (
              <span
                className={`text-[10.5px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                  a.is_super_admin ? "bg-[#DCE3F0] text-[#23305A]" : "bg-[#F1EAD6] text-[#5C5540]"
                }`}
              >
                {a.is_super_admin ? "Super admin" : "Admin"} (you)
              </span>
            ) : (
              <button
                onClick={() => handleToggleSuper(a)}
                disabled={togglingId === a.id}
                title={a.is_super_admin ? "Demote to regular admin" : "Promote to super admin"}
                className={`text-[10.5px] font-medium px-2 py-1 rounded-full whitespace-nowrap disabled:opacity-60 ${
                  a.is_super_admin ? "bg-[#DCE3F0] text-[#23305A]" : "bg-[#F1EAD6] text-[#5C5540]"
                }`}
              >
                {togglingId === a.id ? "…" : a.is_super_admin ? "Super admin" : "Admin"}
              </button>
            )}
            {a.id !== currentAdmin?.id && (
              <button
                onClick={() => handleRemove(a.id)}
                className="w-8 h-8 rounded-lg border border-[#E9DFC2] flex items-center justify-center text-[#B4482A]"
                title="Remove admin"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#B0A883] mt-2.5">
        Click an admin's badge to promote or demote them. You can't change
        your own super-admin status — ask another super admin if needed.
      </p>
    </div>
  );
}

// ---------- My account (all admins) ----------

function AccountPanel({ currentAdmin }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const err = await changeMyPassword(newPassword);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div>
      <SectionHeader title="My account" desc="Update your login details" />

      <div className="bg-white rounded-xl border border-[#E9DFC2] p-4 mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F1EAD6] flex items-center justify-center text-[#23305A] text-[13px] font-display shrink-0">
          {currentAdmin?.email?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-[13.5px] font-semibold text-[#23305A]">{currentAdmin?.email}</p>
          <p className="text-[11px] text-[#8A8064]">
            {currentAdmin?.is_super_admin ? "Super admin" : "Admin"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E9DFC2] p-4 max-w-sm">
        <p className="text-[13px] font-semibold text-[#23305A] mb-3">Change password</p>
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div>
            <label className="text-[11.5px] text-[#5C5540] mb-1 block">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-[#E9DFC2] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#D9A62E]"
            />
          </div>
          <div>
            <label className="text-[11.5px] text-[#5C5540] mb-1 block">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-[#E9DFC2] rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#D9A62E]"
            />
          </div>
          {error && <p className="text-[11.5px] text-[#B4482A]">{error}</p>}
          {success && (
            <p className="text-[11.5px] text-[#4C7A52]">Password updated.</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="self-start text-[12px] font-semibold text-white bg-[#23305A] rounded-md px-3.5 py-2 mt-1 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Shell ----------

export default function AdminDashboard() {
  const [nav, setNav] = useState("overview");
  const [prices, setPrices] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  useEffect(() => {
    async function loadAll() {
      const [p, f, v, u, r, me] = await Promise.all([
        fetchPrices(), fetchFlaggedReports(), fetchVerifications(),
        fetchTrustUsers(), fetchServiceRequests(), fetchCurrentAdmin(),
      ]);
      setPrices(p); setFlagged(f); setVerifications(v); setUsers(u); setRequests(r);
      setCurrentAdmin(me);
      setLoading(false);
    }
    loadAll();
  }, []);

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "prices", label: "Prices", icon: Wheat, badge: flagged.length },
    { id: "users", label: "Users", icon: Users, badge: verifications.length },
    { id: "services", label: "Services", icon: Tractor, badge: requests.filter((r) => r.status === "requested").length },
    { id: "account", label: "My account", icon: Settings },
    ...(currentAdmin?.is_super_admin
      ? [{ id: "admins", label: "Admins", icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#FBF7EA] font-sans flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {/* Sidebar */}
      <div className="w-56 bg-[#23305A] min-h-screen shrink-0 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <div className="w-7 h-7 rounded-md bg-[#D9A62E] flex items-center justify-center">
            <Wheat size={15} className="text-[#23305A]" />
          </div>
          <div>
            <p className="font-display text-[14px] text-white leading-none">Tafasa</p>
            <p className="text-[10px] text-[#9AA5C4] mt-0.5">Admin console</p>
          </div>
        </div>

        <div className="flex-1 py-3 px-2.5">
          {navItems.map((item) => {
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setNav(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] mb-1 ${
                  active ? "bg-white/10 text-white font-medium" : "text-[#B7BFDB] hover:bg-white/5"
                }`}
              >
                <item.icon size={16} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge > 0 && (
                  <span className="text-[10px] font-mono bg-[#D9A62E] text-[#23305A] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#D9A62E] flex items-center justify-center text-[#23305A] text-[11px] font-display">
            AZ
          </div>
          <div>
            <p className="text-[12px] text-white font-medium leading-none">Admin</p>
            <p className="text-[10.5px] text-[#9AA5C4] mt-0.5">Auyo pilot</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-7 max-w-[1100px]">
        {loading && (
          <p className="text-[12.5px] text-[#8A8064] mb-4">Loading live data…</p>
        )}
        {nav === "overview" && (
          <OverviewPanel prices={prices} flagged={flagged} verifications={verifications} requests={requests} />
        )}
        {nav === "prices" && (
          <PricesPanel prices={prices} setPrices={setPrices} flagged={flagged} setFlagged={setFlagged} />
        )}
        {nav === "users" && (
          <UsersPanel verifications={verifications} setVerifications={setVerifications} users={users} setUsers={setUsers} />
        )}
        {nav === "services" && <ServicesPanel requests={requests} setRequests={setRequests} />}
        {nav === "account" && <AccountPanel currentAdmin={currentAdmin} />}
        {nav === "admins" && currentAdmin?.is_super_admin && (
          <AdminsPanel currentAdmin={currentAdmin} />
        )}
      </div>
    </div>
  );
}
