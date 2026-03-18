"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { JobForm } from "../components/JobForm";
import { JobTable } from "../components/JobTable";
import { calculateJob } from "../lib/calculations";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import { INCENTIVE_RATES, IncentiveRates, JobInput, JobRecord, CustomIncentive } from "../lib/types";

export default function HomePage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"work" | "incentives">("work");
  const [rates, setRates] = useState<IncentiveRates>(INCENTIVE_RATES);
  const [customRates, setCustomRates] = useState<Array<{ label: string; value: number }>>([]);
  const [formOpen, setFormOpen] = useState(true);

  const requiresAuth = Boolean(auth);

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
            amountPaid: Number(data.charges?.amountPaid) || 0,
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
            totalCollected: Number(data.totalCollected) || 0,
            totalBalance: Number(data.totalBalance) || 0,
            balanceToBePaid: Number(data.balanceToBePaid) || 0,
            totalIncentive: Number(data.totalIncentive) || 0,
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

    const record = calculateJob(job, rates);
    await addDoc(collection(db!, "jobs"), {
      ...record,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  };

  const saveJob = async (id: string, job: JobInput) => {
    requireDb();
    if (auth && !user) throw new Error("Login to edit jobs.");

    const record = calculateJob(job, rates);
    await updateDoc(doc(db!, "jobs", id), {
      ...record,
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp(),
    });
  };

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
              rates={rates}
              onChangeRate={(key, value) => setRates((prev) => ({ ...prev, [key]: value }))}
              customRates={customRates}
              onAddCustom={(label, value) => setCustomRates((prev) => [...prev, { label, value }])}
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
            <div className="rounded-2xl border border-neutral-200 bg-white/80 shadow-lg shadow-black/5">
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-neutral-800"
              >
                <span>Work details form</span>
                <span className="text-xs text-neutral-500">{formOpen ? "Hide" : "Show"}</span>
              </button>
              {formOpen && (
                <div className="border-t border-neutral-200 p-5">
                  <JobForm onSubmit={addJob} rates={rates} customRates={customRates} />
                </div>
              )}
            </div>

            {!canWrite && auth && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Login to add or edit rows.
              </div>
            )}

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Work amount details</h2>
                <span className="text-sm text-neutral-600">{jobs.length} jobs</span>
              </div>
              <JobTable jobs={jobs} loading={loading} onSave={saveJob} />
            </section>
          </>
        )}

        {activeTab === "incentives" && (
          <IncentiveTable
            rates={rates}
            onChangeRate={(key, value) => setRates((prev) => ({ ...prev, [key]: value }))}
            customRates={customRates}
            onAddCustom={(label, value) => setCustomRates((prev) => [...prev, { label, value }])}
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

function IncentiveTable({
  rates,
  onChangeRate,
  customRates,
  onAddCustom,
}: {
  rates: IncentiveRates;
  onChangeRate: (key: keyof IncentiveRates, value: number) => void;
  customRates: Array<{ label: string; value: number }>;
  onAddCustom: (label: string, value: number) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState(0);
  const [editing, setEditing] = useState(false);

  const baseRows: Array<{ key: keyof IncentiveRates; label: string; value: number }> = [
    { key: "insCharge", label: "Ins charge", value: rates.insCharge },
    { key: "stand", label: "Stand", value: rates.stand },
    { key: "whiteTape", label: "White tape", value: rates.whiteTape },
    { key: "plugTop", label: "Plug top", value: rates.plugTop },
    { key: "piping", label: "Piping", value: rates.piping },
  ];

  const addCustom = () => {
    if (!newLabel || Number.isNaN(newValue)) return;
    onAddCustom(newLabel, Number(newValue));
    setNewLabel("");
    setNewValue(0);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Incentive rates</h2>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 shadow-lg shadow-black/5">
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
                      onChange={(event) => onChangeRate(row.key, Number(event.target.value) || 0)}
                      className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                    />
                  ) : (
                    <span>₹{row.value.toLocaleString()}</span>
                  )}
                </td>
              </tr>
            ))}
            {customRates.map((row, idx) => (
              <tr key={`${row.label}-${idx}`} className="border-t border-neutral-200">
                <td className="px-4 py-3 font-medium text-neutral-800">{row.label}</td>
                <td className="px-4 py-3 text-neutral-800">₹{row.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-700">Toggle edit to adjust base rates. You can always add a new incentive row.</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-black hover:text-black"
          >
            Edit rates
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Save
          </button>
        </div>
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
        <p className="text-sm text-neutral-600">
          Base rates above feed calculations. Custom incentives are tracked here for reference.
        </p>
      </div>
    </section>
  );
}
