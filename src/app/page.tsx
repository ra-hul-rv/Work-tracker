"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { JobForm } from "../components/JobForm";
import { JobTable } from "../components/JobTable";
import { calculateJob } from "../lib/calculations";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import { INCENTIVE_RATES, CustomIncentive, IncentiveCompany, IncentiveRates, JobInput, JobRecord } from "../lib/types";

const DEFAULT_COMPANY: IncentiveCompany = {
  id: "default",
  name: "Default",
  rates: INCENTIVE_RATES,
  customRates: [],
};

export default function HomePage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"work" | "incentives">("work");
  const [companies, setCompanies] = useState<IncentiveCompany[]>([DEFAULT_COMPANY]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(DEFAULT_COMPANY.id);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobRecord | null>(null);

  const requiresAuth = Boolean(auth);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0] || DEFAULT_COMPANY,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    setError(null);

    if (!db) {
      setLoading(false);
      if (!isFirebaseConfigured) {
        setError("Add Firebase environment variables to enable saving and loading data.");
      }
      return;
    }

    if (requiresAuth && !user) {
      setJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "jobs"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextJobs: JobRecord[] = snapshot.docs.map((document) => {
          const data = document.data() as JobRecord;
          const charges = {
            insCharge: Number(data.charges?.insCharge) || 0,
            stand: Number(data.charges?.stand) || 0,
            whiteTape: Number(data.charges?.whiteTape) || 0,
            plugTop: Number(data.charges?.plugTop) || 0,
            piping: Number(data.charges?.piping) || 0,
            extraWork: Number(data.charges?.extraWork) || 0,
            woOutdoorCharge: Number(data.charges?.woOutdoorCharge) || 0,
          };

          const customIncentives: CustomIncentive[] = Array.isArray(data.customIncentives)
            ? data.customIncentives.map((item) => ({
                label: item.label,
                amount: Number((item as any).amount) || 0,
                applied: Boolean(item.applied),
              }))
            : [];

          return {
            ...data,
            id: document.id,
            charges,
            customIncentives,
            helperSalary: Number(data.helperSalary) || 0,
            totalCollected: Number(data.totalCollected) || 0,
            totalBalance: Number(data.totalBalance) || 0,
            balanceToBePaid: Number(data.balanceToBePaid) || 0,
            totalIncentive: Number(data.totalIncentive) || 0,
            status: data.status || "pending",
            companyId: data.companyId || DEFAULT_COMPANY.id,
            companyName: data.companyName || DEFAULT_COMPANY.name,
            createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
          };
        });

        nextJobs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setJobs(nextJobs);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Missing or insufficient permissions. Check Firestore rules.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, requiresAuth]);

  const canWrite = useMemo(() => {
    if (!auth) return true;
    return Boolean(user);
  }, [user]);

  const requireDb = () => {
    if (!db) {
      throw new Error("Firebase is not configured.");
    }
  };

  const addJob = async (job: JobInput) => {
    requireDb();
    if (auth && !user) throw new Error("Login to add jobs.");

    const company = companies.find((c) => c.id === job.companyId) || activeCompany || DEFAULT_COMPANY;
    const record = calculateJob({ ...job, companyId: company.id, companyName: company.name }, company.rates);
    await addDoc(collection(db!, "jobs"), {
      ...record,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  };

  const saveJob = async (id: string, job: JobInput) => {
    requireDb();
    if (auth && !user) throw new Error("Login to edit jobs.");

    const company = companies.find((c) => c.id === job.companyId) || activeCompany || DEFAULT_COMPANY;
    const record = calculateJob({ ...job, companyId: company.id, companyName: company.name }, company.rates);
    await updateDoc(doc(db!, "jobs", id), {
      ...record,
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp(),
    });
  };

  const updateCompany = (next: IncentiveCompany) => {
    setCompanies((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  const addCompany = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `company-${Date.now()}`;
    const company: IncentiveCompany = {
      id,
      name: trimmed,
      rates: { ...INCENTIVE_RATES },
      customRates: [],
    };
    setCompanies((prev) => [...prev, company]);
    setSelectedCompanyId(id);
  };

  const deleteCompany = (id: string) => {
    setCompanies((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((company) => company.id !== id);
      if (next.length === prev.length) return prev;
      setSelectedCompanyId((current) => (current === id ? next[0].id : current));
      return next;
    });
  };

  const stats = useMemo(() => {
    const pending = jobs.filter((job) => job.status !== "completed");
    const completed = jobs.filter((job) => job.status === "completed");
    const totalIncentiveCompleted = completed.reduce((sum, job) => sum + (job.totalIncentive || 0), 0);
    const totalCollected = jobs.reduce((sum, job) => sum + (job.totalCollected || 0), 0);
    return {
      pendingCount: pending.length,
      completedCount: completed.length,
      totalIncentiveCompleted,
      totalCollected,
    };
  }, [jobs]);

  const header = (
    <header className="flex flex-col gap-3 rounded-2xl bg-black px-8 py-6 text-white shadow-xl shadow-black/20 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">AC Work Tracker</p>
        <h1 className="text-2xl font-semibold leading-8">AC Installation Work & Incentive Tracking</h1>
        <p className="text-sm text-white/70">Paste WhatsApp details, verify fields, and save to Firebase. Incentives and balances auto-calculate.</p>
      </div>
      <div className="flex flex-col items-start gap-2 text-sm font-semibold text-white">
        <span className="rounded-full bg-white/10 px-4 py-2">{user?.email ?? "Guest"}</span>
        {auth ? (
          user ? null : (
            <Link href="/login" className="rounded-full bg-white px-4 py-2 text-black hover:-translate-y-0.5 hover:shadow-md">
              Login to continue
            </Link>
          )
        ) : (
          <span className="text-white/80">Auth not configured</span>
        )}
      </div>
    </header>
  );

  if (requiresAuth && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-slate-100 px-6 py-10 text-neutral-900">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          {header}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sign in to view and edit jobs.
          </div>
          <Tabs active={activeTab} onChange={setActiveTab} />
          {activeTab === "incentives" && (
            <IncentiveTable
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectCompany={setSelectedCompanyId}
              onUpdateCompany={updateCompany}
              onAddCompany={addCompany}
              onDeleteCompany={deleteCompany}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-slate-100 px-6 py-10 text-neutral-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {header}

        {!isFirebaseConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add Firebase config in .env.local (NEXT_PUBLIC_FIREBASE_*) to enable saving and login.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Tabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "work" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Work overview</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Add work
              </button>
            </div>

            {!canWrite && auth && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Login to add or edit rows.
              </div>
            )}

            <DashboardCards stats={stats} />

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Work amount details</h2>
                <span className="text-sm text-neutral-600">{jobs.length} jobs</span>
              </div>
              <JobTable
                jobs={jobs}
                loading={loading}
                onEdit={(job) => {
                  setEditJob(job);
                  if (job.companyId) setSelectedCompanyId(job.companyId);
                  setCreateModalOpen(false);
                }}
              />
            </section>

            {createModalOpen && (
              <Modal title="Add work" onClose={() => setCreateModalOpen(false)}>
                <JobForm
                  onSubmit={async (job) => {
                    await addJob(job);
                    setCreateModalOpen(false);
                  }}
                  companies={companies}
                  selectedCompanyId={selectedCompanyId}
                  onSelectCompany={setSelectedCompanyId}
                  submitLabel="Add to table"
                  onCancel={() => setCreateModalOpen(false)}
                />
              </Modal>
            )}

            {editJob && (
              <Modal title="Edit work" onClose={() => setEditJob(null)}>
                <JobForm
                  initialJob={editJob}
                  onSubmit={async (job) => {
                    if (!editJob?.id) return;
                    await saveJob(editJob.id, job);
                    setEditJob(null);
                  }}
                  companies={companies}
                  selectedCompanyId={editJob.companyId || selectedCompanyId}
                  onSelectCompany={setSelectedCompanyId}
                  submitLabel="Save changes"
                  onCancel={() => setEditJob(null)}
                />
              </Modal>
            )}
          </>
        )}

        {activeTab === "incentives" && (
          <IncentiveTable
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={setSelectedCompanyId}
            onUpdateCompany={updateCompany}
            onAddCompany={addCompany}
            onDeleteCompany={deleteCompany}
          />
        )}
      </main>
    </div>
  );
}

function Tabs({ active, onChange }: { active: "work" | "incentives"; onChange: (tab: "work" | "incentives") => void }) {
  return (
    <div className="flex gap-2 rounded-full bg-neutral-100 p-1 text-sm font-semibold text-neutral-700">
      <button
        className={`rounded-full px-4 py-2 transition ${active === "work" ? "bg-white shadow" : "hover:bg-white/70"}`}
        onClick={() => onChange("work")}
      >
        Work amount details
      </button>
      <button
        className={`rounded-full px-4 py-2 transition ${active === "incentives" ? "bg-white shadow" : "hover:bg-white/70"}`}
        onClick={() => onChange("incentives")}
      >
        Incentive rates
      </button>
    </div>
  );
}

function DashboardCards({
  stats,
}: {
  stats: {
    pendingCount: number;
    completedCount: number;
    totalIncentiveCompleted: number;
    totalCollected: number;
  };
}) {
  const cards = [
    { label: "Pending jobs", value: stats.pendingCount, accent: "bg-amber-100 text-amber-800" },
    { label: "Completed jobs", value: stats.completedCount, accent: "bg-emerald-100 text-emerald-800" },
    { label: "Incentive (completed)", value: `₹${stats.totalIncentiveCompleted.toLocaleString()}`, accent: "bg-blue-100 text-blue-800" },
    { label: "Total collected", value: `₹${stats.totalCollected.toLocaleString()}`, accent: "bg-neutral-100 text-neutral-800" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm shadow-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{card.label}</p>
          <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${card.accent}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncentiveTable({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onUpdateCompany,
  onAddCompany,
  onDeleteCompany,
}: {
  companies: IncentiveCompany[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  onUpdateCompany: (company: IncentiveCompany) => void;
  onAddCompany: (name: string) => void;
  onDeleteCompany: (id: string) => void;
}) {
  const active = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0] || DEFAULT_COMPANY,
    [companies, selectedCompanyId],
  );
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(active.name);

  useEffect(() => {
    setName(active.name);
  }, [active.name]);

  const updateRate = (key: keyof IncentiveRates, value: number) => {
    onUpdateCompany({ ...active, rates: { ...active.rates, [key]: value } });
  };

  const addCustom = () => {
    if (!newLabel.trim()) return;
    const value = Number(newValue) || 0;
    onUpdateCompany({ ...active, customRates: [...active.customRates, { label: newLabel.trim(), value }] });
    setNewLabel("");
    setNewValue(0);
  };

  const updateCustomAmount = (index: number, value: number) => {
    const next = active.customRates.map((item, idx) => (idx === index ? { ...item, value } : item));
    onUpdateCompany({ ...active, customRates: next });
  };

  const saveName = () => {
    if (!name.trim()) return;
    onUpdateCompany({ ...active, name: name.trim() });
  };

  const baseRows: Array<{ key: keyof IncentiveRates; label: string; value: number }> = [
    { key: "insCharge", label: "Ins charge", value: active.rates.insCharge },
    { key: "stand", label: "Stand", value: active.rates.stand },
    { key: "whiteTape", label: "White tape", value: active.rates.whiteTape },
    { key: "plugTop", label: "Plug top", value: active.rates.plugTop },
    { key: "piping", label: "Piping", value: active.rates.piping },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Incentive companies</h2>
          <p className="text-sm text-neutral-600">Switch between companies to manage their rates and custom incentives.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={active.id}
            onChange={(event) => onSelectCompany(event.target.value)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-full border border-dashed border-neutral-300 bg-white/80 px-3 py-2">
            <input
              value={newCompanyName}
              onChange={(event) => setNewCompanyName(event.target.value)}
              placeholder="New company"
              className="w-36 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => {
                onAddCompany(newCompanyName);
                setNewCompanyName("");
              }}
              className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white shadow-md shadow-black/10"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-lg shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={saveName}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-800 hover:border-black hover:text-black"
            >
              Save name
            </button>
            <button
              type="button"
              onClick={() => onDeleteCompany(active.id)}
              disabled={companies.length <= 1}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete company
            </button>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white shadow-md shadow-black/10"
          >
            {editing ? "Lock rates" : "Edit rates"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <tr>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Incentive</th>
              </tr>
            </thead>
            <tbody>
              {baseRows.map((row) => (
                <tr key={row.key} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-medium text-neutral-800">{row.label}</td>
                  <td className="px-4 py-3 text-neutral-800">
                    {editing ? (
                      <input
                        type="number"
                        value={row.value}
                        onChange={(event) => updateRate(row.key, Number(event.target.value) || 0)}
                        className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                      />
                    ) : (
                      <span>₹{row.value.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              ))}
              {active.customRates.map((row, idx) => (
                <tr key={`${row.label}-${idx}`} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-medium text-neutral-800">{row.label}</td>
                  <td className="px-4 py-3 text-neutral-800">
                    {editing ? (
                      <input
                        type="number"
                        value={row.value}
                        onChange={(event) => updateCustomAmount(idx, Number(event.target.value) || 0)}
                        className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                      />
                    ) : (
                      <span>₹{row.value.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-neutral-300 bg-white/70 p-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">New incentive label</label>
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
              placeholder="e.g. Brackets"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Amount</label>
            <input
              type="number"
              value={newValue}
              onChange={(event) => setNewValue(Number(event.target.value) || 0)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
              placeholder="0"
              min={0}
            />
          </div>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Add incentive
          </button>
          <p className="text-sm text-neutral-600">Base rates above feed calculations for this company. Custom incentives are company-specific.</p>
        </div>
      </div>
    </section>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
          >
            Close
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
