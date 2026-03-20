"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { JobForm } from "../components/JobForm";
import { JobTable } from "../components/JobTable";
import { calculateJob } from "../lib/calculations";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import { INCENTIVE_RATES, CustomIncentive, Helper, IncentiveCompany, IncentiveRates, JobInput, JobRecord, WorkType } from "../lib/types";

const DEFAULT_COMPANY: IncentiveCompany = {
  id: "default",
  name: "Default",
  rates: INCENTIVE_RATES,
  customRates: [],
};

const DEFAULT_WORK_TYPES: WorkType[] = [
  { id: "installation", name: "Installation" },
  { id: "service", name: "Service" },
  { id: "dismantle", name: "Dismantle" },
  { id: "inspection", name: "Inspection" },
];

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumberInputValue = (value: number) => (value === 0 ? "" : String(value));

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const formatFirestoreError = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return fallback;
  const maybeCode = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  if (maybeCode.includes("permission-denied") || maybeMessage.toLowerCase().includes("insufficient permissions")) {
    return "Firestore permission denied. Update Firestore Rules to allow authenticated access for jobs, incentiveCompanies, workTypes, and helpers.";
  }

  return maybeMessage || fallback;
};

const normalizeRates = (raw: Record<string, unknown> | undefined): IncentiveRates => {
  const fallback = INCENTIVE_RATES;
  const readRate = (key: keyof IncentiveRates) => {
    const value = raw?.[key];
    const valueRecord = asRecord(value);
    if (typeof value === "number") {
      return { originalPrice: value, incentive: value };
    }
    return {
      originalPrice: toNumber(valueRecord.originalPrice ?? fallback[key].originalPrice),
      incentive: toNumber(valueRecord.incentive ?? fallback[key].incentive),
    };
  };

  return {
    insCharge: readRate("insCharge"),
    stand: readRate("stand"),
    whiteTape: readRate("whiteTape"),
    plugTop: readRate("plugTop"),
    piping: readRate("piping"),
  };
};

export default function HomePage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"work" | "incentives" | "types" | "labours">("work");
  const [companies, setCompanies] = useState<IncentiveCompany[]>([DEFAULT_COMPANY]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(DEFAULT_COMPANY.id);
  const [workTypes, setWorkTypes] = useState<WorkType[]>(DEFAULT_WORK_TYPES);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobRecord | null>(null);
  const [deleteJobTarget, setDeleteJobTarget] = useState<JobRecord | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

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
    const firestore = db;
    if (!firestore) {
      return;
    }

    if (requiresAuth && !user) {
      return;
    }

    const q = query(collection(firestore, "incentiveCompanies"));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          await setDoc(doc(firestore, "incentiveCompanies", DEFAULT_COMPANY.id), {
            ...DEFAULT_COMPANY,
            rates: normalizeRates(DEFAULT_COMPANY.rates),
            createdAt: Date.now(),
            createdAtServer: serverTimestamp(),
          });
          return;
        }

        const next = snapshot.docs.map((document) => {
          const data = asRecord(document.data());
          const customRatesRaw = Array.isArray(data.customRates) ? data.customRates : [];
          return {
            id: document.id,
            name: typeof data.name === "string" && data.name.trim() ? data.name : "Unnamed",
            rates: normalizeRates(asRecord(data.rates)),
            customRates: customRatesRaw
              .map((item) => {
                const itemRecord = asRecord(item);
                return {
                  label: typeof itemRecord.label === "string" ? itemRecord.label : "",
                  incentive: toNumber(itemRecord.incentive ?? itemRecord.value),
                };
              })
              .filter((item) => item.label.length > 0),
          } as IncentiveCompany;
        });

        next.sort((a, b) => a.name.localeCompare(b.name));
        setCompanies(next);
        setSelectedCompanyId((current) => (next.some((company) => company.id === current) ? current : next[0]?.id || DEFAULT_COMPANY.id));
      },
      (err) => setError(formatFirestoreError(err, "Could not load incentive companies.")),
    );

    return () => unsubscribe();
  }, [user, requiresAuth]);

  useEffect(() => {
    const firestore = db;
    if (!firestore) {
      return;
    }

    if (requiresAuth && !user) {
      return;
    }

    const q = query(collection(firestore, "workTypes"));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          await Promise.all(
            DEFAULT_WORK_TYPES.map((type) =>
              setDoc(doc(firestore, "workTypes", type.id), {
                ...type,
                createdAt: Date.now(),
                createdAtServer: serverTimestamp(),
              }),
            ),
          );
          return;
        }

        const next = snapshot.docs
          .map((document) => {
            const data = asRecord(document.data());
            return {
              id: document.id,
              name: typeof data.name === "string" ? data.name.trim() : "",
            } as WorkType;
          })
          .filter((item) => item.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        setWorkTypes(next.length > 0 ? next : DEFAULT_WORK_TYPES);
      },
      (err) => setError(formatFirestoreError(err, "Could not load work types.")),
    );

    return () => unsubscribe();
  }, [user, requiresAuth]);

  useEffect(() => {
    const firestore = db;
    if (!firestore) {
      return;
    }

    if (requiresAuth && !user) {
      return;
    }

    const q = query(collection(firestore, "helpers"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs
          .map((document) => {
            const data = asRecord(document.data());
            return {
              id: document.id,
              name: typeof data.name === "string" ? data.name.trim() : "",
            } as Helper;
          })
          .filter((item) => item.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        setHelpers(next);
      },
      (err) => setError(formatFirestoreError(err, "Could not load labours.")),
    );

    return () => unsubscribe();
  }, [user, requiresAuth]);

  useEffect(() => {
    if (!db) {
      return;
    }

    if (requiresAuth && !user) {
      return;
    }

    const q = query(collection(db, "jobs"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nextJobs: JobRecord[] = snapshot.docs.map((document) => {
          const data = asRecord(document.data());
          const chargeData = asRecord(data.charges);
          const charges = {
            insCharge: toNumber(chargeData.insCharge),
            stand: toNumber(chargeData.stand),
            whiteTape: toNumber(chargeData.whiteTape),
            plugTop: toNumber(chargeData.plugTop),
            piping: toNumber(chargeData.piping),
            extraWork: toNumber(chargeData.extraWork),
            woOutdoorCharge: toNumber(chargeData.woOutdoorCharge),
          };

          const customIncentivesRaw = Array.isArray(data.customIncentives) ? data.customIncentives : [];
          const customIncentives: CustomIncentive[] = Array.isArray(data.customIncentives)
            ? customIncentivesRaw.map((item) => {
                const itemRecord = asRecord(item);
                return {
                  label: typeof itemRecord.label === "string" ? itemRecord.label : "",
                  amount: toNumber(itemRecord.amount),
                  applied: Boolean(itemRecord.applied),
                };
              })
            : [];

          const status = data.status;
          const jobRatesRaw = asRecord(data.jobRates);
          const hasJobRates = Object.keys(jobRatesRaw).length > 0;
          const normalizedStatus =
            status === "to_get"
              ? "to_get"
              : status === "completed" || status === "received"
                ? "received"
                : "pending";

          return {
            ...(data as Omit<JobRecord, "id" | "charges" | "customIncentives" | "status" | "brand" | "amountToGet" | "jobRates">),
            id: document.id,
            brand: typeof data.brand === "string" ? data.brand : typeof data.acDetails === "string" ? data.acDetails : "",
            charges,
            customIncentives,
            helperSalary: toNumber(data.helperSalary),
            amountToGet: toNumber(data.amountToGet),
            jobRates: hasJobRates ? normalizeRates(jobRatesRaw) : undefined,
            totalCollected: toNumber(data.totalCollected),
            totalBalance: toNumber(data.totalBalance),
            balanceToBePaid: toNumber(data.balanceToBePaid),
            totalIncentive: toNumber(data.totalIncentive),
            status: normalizedStatus,
            companyId: typeof data.companyId === "string" ? data.companyId : DEFAULT_COMPANY.id,
            companyName: typeof data.companyName === "string" ? data.companyName : DEFAULT_COMPANY.name,
            createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
          };
        });

        nextJobs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setJobs(nextJobs);
        setLoading(false);
      },
      (err) => {
        setError(formatFirestoreError(err, "Missing or insufficient permissions. Check Firestore rules."));
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, requiresAuth]);

  const canWrite = useMemo(() => {
    if (!auth) return true;
    return Boolean(user);
  }, [user]);

  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const requireDb = () => {
    if (!db) {
      throw new Error("Firebase is not configured.");
    }
  };

  const addJob = async (job: JobInput) => {
    requireDb();
    if (auth && !user) throw new Error("Login to add jobs.");

    const company = companies.find((c) => c.id === job.companyId) || activeCompany || DEFAULT_COMPANY;
    const record = calculateJob({ ...job, companyId: company.id, companyName: company.name }, job.jobRates || company.rates);
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
    const record = calculateJob({ ...job, companyId: company.id, companyName: company.name }, job.jobRates || company.rates);
    await updateDoc(doc(db!, "jobs", id), {
      ...record,
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp(),
    });
  };

  const deleteJob = async (jobId: string) => {
    requireDb();
    if (auth && !user) throw new Error("Login to delete jobs.");
    await deleteDoc(doc(db!, "jobs", jobId));
  };

  const updateCompany = async (next: IncentiveCompany) => {
    setCompanies((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    if (!db) return;
    if (auth && !user) throw new Error("Login to edit companies.");
    await setDoc(
      doc(db, "incentiveCompanies", next.id),
      {
        ...next,
        rates: normalizeRates(next.rates),
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const addCompany = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `company-${Date.now()}`;
    const company: IncentiveCompany = {
      id,
      name: trimmed,
      rates: normalizeRates(INCENTIVE_RATES),
      customRates: [],
    };
    setCompanies((prev) => [...prev, company]);
    setSelectedCompanyId(id);
    if (!db) return;
    if (auth && !user) throw new Error("Login to add companies.");
    await setDoc(doc(db, "incentiveCompanies", id), {
      ...company,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  };

  const deleteCompany = async (id: string) => {
    if (id === DEFAULT_COMPANY.id) return;
    setCompanies((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((company) => company.id !== id);
      if (next.length === prev.length) return prev;
      setSelectedCompanyId((current) => (current === id ? next[0].id : current));
      return next;
    });
    if (!db) return;
    if (auth && !user) throw new Error("Login to delete companies.");
    await deleteDoc(doc(db, "incentiveCompanies", id));
  };

  const addWorkType = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `type-${Date.now()}`;
    const nextType: WorkType = { id, name: trimmed };
    setWorkTypes((prev) => [...prev, nextType]);

    if (!db) return;
    if (auth && !user) throw new Error("Login to add work types.");
    await setDoc(doc(db, "workTypes", id), {
      ...nextType,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  };

  const updateWorkType = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setWorkTypes((prev) => prev.map((item) => (item.id === id ? { ...item, name: trimmed } : item)));

    if (!db) return;
    if (auth && !user) throw new Error("Login to edit work types.");
    await setDoc(
      doc(db, "workTypes", id),
      {
        id,
        name: trimmed,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const deleteWorkType = async (id: string) => {
    setWorkTypes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });

    if (!db) return;
    if (auth && !user) throw new Error("Login to delete work types.");
    await deleteDoc(doc(db, "workTypes", id));
  };

  const addHelper = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = `helper-${Date.now()}`;
    const nextHelper: Helper = { id, name: trimmed };
    setHelpers((prev) => [...prev, nextHelper]);

    if (!db) return;
    if (auth && !user) throw new Error("Login to add labours.");
    await setDoc(doc(db, "helpers", id), {
      ...nextHelper,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  };

  const deleteHelper = async (id: string) => {
    setHelpers((prev) => prev.filter((item) => item.id !== id));

    if (!db) return;
    if (auth && !user) throw new Error("Login to delete labours.");
    await deleteDoc(doc(db, "helpers", id));
  };

  const stats = useMemo(() => {
    const pending = jobs.filter((job) => job.status !== "received");
    const completed = jobs.filter((job) => job.status === "received");
    const pendingPaymentAmount = pending.reduce((sum, job) => sum + (job.balanceToBePaid || 0), 0);
    const helperTotalAmount = jobs.reduce((sum, job) => sum + (job.helperSalary || 0), 0);
    return {
      pendingPaymentCount: pending.length,
      pendingPaymentAmount,
      helperTotalAmount,
      completedWorkCount: completed.length,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return jobs;

    return jobs.filter((job) => {
      const fields = [job.customerName, job.location, job.contact, job.type, job.brand, job.companyName]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return fields.some((field) => field.includes(queryText));
    });
  }, [jobs, searchQuery]);

  const header = (
    <header className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-blue-950 via-blue-900 to-cyan-800 px-8 py-6 text-white shadow-xl shadow-blue-950/30 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-white/60 bg-white/95 px-3 py-2 shadow-md shadow-blue-950/20">
          <Image
            src="/freezezone.png"
            alt="FreezeZone"
            width={280}
            height={86}
            priority
            unoptimized
            className="h-14 w-auto object-contain"
          />
        </div>
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
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-200 px-6 py-10 text-neutral-900">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
              onToast={showToast}
            />
          )}
          {activeTab === "types" && (
            <TypeTable
              types={workTypes}
              onAddType={addWorkType}
              onUpdateType={updateWorkType}
              onDeleteType={deleteWorkType}
              onToast={showToast}
            />
          )}
          {activeTab === "labours" && (
            <LabourTable
              helpers={helpers}
              onAddHelper={addHelper}
              onDeleteHelper={deleteHelper}
              onToast={showToast}
            />
          )}
        </main>
        <footer className="mx-auto mt-6 w-full max-w-6xl text-center text-xs font-medium text-neutral-600">
          Created by Rahul RV. All rights reserved.
        </footer>
        <ToastMessage toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-200 px-6 py-10 text-neutral-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
              <h2 className="text-lg font-semibold">Payment overview</h2>
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

            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Work payment details</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, location, phone..."
                    className="w-64 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 outline-none transition focus:border-black"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-black"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-sm text-neutral-600">
                    {filteredJobs.length}
                    {searchQuery ? ` / ${jobs.length}` : ""} jobs
                  </span>
                </div>
              </div>

              {loading || filteredJobs.length > 0 ? (
                <JobTable
                  jobs={filteredJobs}
                  loading={loading}
                  onEdit={(job) => {
                    setEditJob(job);
                    if (job.companyId) setSelectedCompanyId(job.companyId);
                    setCreateModalOpen(false);
                  }}
                  onDelete={(job) => setDeleteJobTarget(job)}
                />
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white/90 px-5 py-10 text-center shadow-sm shadow-black/5">
                  <p className="text-base font-semibold text-neutral-800">
                    {searchQuery ? "No matching work entries" : "No work entries yet"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {searchQuery ? "Try a different search keyword." : "Create your first work entry to get started."}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-black"
                      >
                        Clear search
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCreateModalOpen(true)}
                        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10"
                      >
                        Add work
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {createModalOpen && (
              <Modal title="Add work" onClose={() => setCreateModalOpen(false)}>
                <JobForm
                  onSubmit={async (job) => {
                    await addJob(job);
                    showToast("success", "Work added successfully.");
                    setCreateModalOpen(false);
                  }}
                  onResult={(result) => {
                    if (result.kind === "error") showToast(result.kind, result.message);
                  }}
                  companies={companies}
                  workTypes={workTypes}
                  helpers={helpers}
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
                    showToast("success", "Work updated successfully.");
                    setEditJob(null);
                  }}
                  onResult={(result) => {
                    if (result.kind === "error") showToast(result.kind, result.message);
                  }}
                  companies={companies}
                  workTypes={workTypes}
                  helpers={helpers}
                  selectedCompanyId={editJob.companyId || selectedCompanyId}
                  onSelectCompany={setSelectedCompanyId}
                  submitLabel="Save changes"
                  onCancel={() => setEditJob(null)}
                />
              </Modal>
            )}

            {deleteJobTarget?.id && (
              <DeleteConfirmModal
                job={deleteJobTarget}
                onCancel={() => setDeleteJobTarget(null)}
                onConfirm={async () => {
                  try {
                    await deleteJob(deleteJobTarget.id!);
                    setDeleteJobTarget(null);
                    showToast("success", "Work deleted successfully.");
                  } catch (error) {
                    showToast("error", error instanceof Error ? error.message : "Could not delete work.");
                  }
                }}
              />
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
            onToast={showToast}
          />
        )}

        {activeTab === "types" && (
          <TypeTable
            types={workTypes}
            onAddType={addWorkType}
            onUpdateType={updateWorkType}
            onDeleteType={deleteWorkType}
            onToast={showToast}
          />
        )}

        {activeTab === "labours" && (
          <LabourTable
            helpers={helpers}
            onAddHelper={addHelper}
            onDeleteHelper={deleteHelper}
            onToast={showToast}
          />
        )}
      </main>
      <footer className="mx-auto mt-6 w-full max-w-6xl text-center text-xs font-medium text-neutral-600">
        Created by Rahul RV. All rights reserved.
      </footer>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function ToastMessage({
  toast,
  onClose,
}: {
  toast: { kind: "success" | "error"; message: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div
        className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/10 ${
          toast.kind === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <p className="font-medium">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-current/20 px-2 py-1 text-xs font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Tabs({
  active,
  onChange,
}: {
  active: "work" | "incentives" | "types" | "labours";
  onChange: (tab: "work" | "incentives" | "types" | "labours") => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-neutral-100 p-1 text-sm font-semibold text-neutral-700 sm:rounded-full">
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
      <button
        className={`rounded-full px-4 py-2 transition ${active === "types" ? "bg-white shadow" : "hover:bg-white/70"}`}
        onClick={() => onChange("types")}
      >
        Work types
      </button>
      <button
        className={`rounded-full px-4 py-2 transition ${active === "labours" ? "bg-white shadow" : "hover:bg-white/70"}`}
        onClick={() => onChange("labours")}
      >
        Labours
      </button>
    </div>
  );
}

function DashboardCards({
  stats,
}: {
  stats: {
    pendingPaymentCount: number;
    pendingPaymentAmount: number;
    helperTotalAmount: number;
    completedWorkCount: number;
  };
}) {
  const cards = [
    { label: "No of pending payments", value: stats.pendingPaymentCount, accent: "text-amber-700" },
    { label: "Pending payment amount", value: `₹${stats.pendingPaymentAmount.toLocaleString()}`, accent: "text-rose-700" },
    { label: "Helper total amount", value: `₹${stats.helperTotalAmount.toLocaleString()}`, accent: "text-blue-700" },
    { label: "Total completed works", value: stats.completedWorkCount, accent: "text-emerald-700" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0 rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm shadow-black/5">
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{card.label}</p>
          <div className={`mt-2 text-2xl font-bold leading-none ${card.accent}`}>
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
  onToast,
}: {
  companies: IncentiveCompany[];
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  onUpdateCompany: (company: IncentiveCompany) => Promise<void>;
  onAddCompany: (name: string) => Promise<void>;
  onDeleteCompany: (id: string) => Promise<void>;
  onToast: (kind: "success" | "error", message: string) => void;
}) {
  const active = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0] || DEFAULT_COMPANY,
    [companies, selectedCompanyId],
  );
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const updateRate = (key: keyof IncentiveRates, field: "originalPrice" | "incentive", value: number) => {
    onUpdateCompany({
      ...active,
      rates: { ...active.rates, [key]: { ...active.rates[key], [field]: value } },
    });
  };

  const addCustom = () => {
    if (!newLabel.trim()) return;
    const incentive = Number(newValue) || 0;
    onUpdateCompany({ ...active, customRates: [...active.customRates, { label: newLabel.trim(), incentive }] })
      .then(() => onToast("success", "Custom incentive added."))
      .catch((error) => onToast("error", error instanceof Error ? error.message : "Could not add custom incentive."));
    setNewLabel("");
    setNewValue(0);
  };

  const updateCustomAmount = (index: number, value: number) => {
    const next = active.customRates.map((item, idx) => (idx === index ? { ...item, incentive: value } : item));
    onUpdateCompany({ ...active, customRates: next });
  };

  const saveName = async () => {
    const nextName = (nameDrafts[active.id] ?? active.name).trim();
    if (!nextName) return;
    try {
      await onUpdateCompany({ ...active, name: nextName });
      onToast("success", "Company name updated.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Could not update company name.");
    }
  };

  const baseRows: Array<{ key: keyof IncentiveRates; label: string; value: IncentiveRates[keyof IncentiveRates] }> = [
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
              onClick={async () => {
                try {
                  await onAddCompany(newCompanyName);
                  setNewCompanyName("");
                  onToast("success", "Company added.");
                } catch (error) {
                  onToast("error", error instanceof Error ? error.message : "Could not add company.");
                }
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
              value={nameDrafts[active.id] ?? active.name}
              onChange={(event) => {
                const value = event.target.value;
                setNameDrafts((prev) => ({ ...prev, [active.id]: value }));
              }}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => {
                void saveName();
              }}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-800 hover:border-black hover:text-black"
            >
              Save name
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await onDeleteCompany(active.id);
                  onToast("success", "Company deleted.");
                } catch (error) {
                  onToast("error", error instanceof Error ? error.message : "Could not delete company.");
                }
              }}
              disabled={companies.length <= 1 || active.id === DEFAULT_COMPANY.id}
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
                <th className="px-4 py-3">Original price</th>
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
                        value={toNumberInputValue(row.value.originalPrice)}
                        onChange={(event) => updateRate(row.key, "originalPrice", Number(event.target.value) || 0)}
                        className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                      />
                    ) : (
                      <span>₹{row.value.originalPrice.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">
                    {editing ? (
                      <input
                        type="number"
                        value={toNumberInputValue(row.value.incentive)}
                        onChange={(event) => updateRate(row.key, "incentive", Number(event.target.value) || 0)}
                        className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                      />
                    ) : (
                      <span>₹{row.value.incentive.toLocaleString()}</span>
                    )}
                  </td>
                </tr>
              ))}
              {active.customRates.map((row, idx) => (
                <tr key={`${row.label}-${idx}`} className="border-t border-neutral-200">
                  <td className="px-4 py-3 font-medium text-neutral-800">{row.label}</td>
                  <td className="px-4 py-3 text-neutral-500">—</td>
                  <td className="px-4 py-3 text-neutral-800">
                    {editing ? (
                      <input
                        type="number"
                        value={toNumberInputValue(row.incentive)}
                        onChange={(event) => updateCustomAmount(idx, Number(event.target.value) || 0)}
                        className="w-32 rounded-md border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                      />
                    ) : (
                      <span>₹{row.incentive.toLocaleString()}</span>
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
              value={toNumberInputValue(newValue)}
              onChange={(event) => setNewValue(Number(event.target.value) || 0)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
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

function TypeTable({
  types,
  onAddType,
  onUpdateType,
  onDeleteType,
  onToast,
}: {
  types: WorkType[];
  onAddType: (name: string) => Promise<void>;
  onUpdateType: (id: string, name: string) => Promise<void>;
  onDeleteType: (id: string) => Promise<void>;
  onToast: (kind: "success" | "error", message: string) => void;
}) {
  const [newType, setNewType] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Work types</h2>
        <p className="text-sm text-neutral-600">Add, edit, or remove work types used in the form.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-lg shadow-black/5">
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-neutral-300 bg-white/80 p-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">New type</label>
            <input
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
              placeholder="e.g. Gas Fill"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await onAddType(newType);
                setNewType("");
                onToast("success", "Work type added.");
              } catch (error) {
                onToast("error", error instanceof Error ? error.message : "Could not add work type.");
              }
            }}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10"
          >
            Add type
          </button>
        </div>

        {types.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-neutral-800">No work types yet</p>
            <p className="mt-1 text-sm text-neutral-600">Add a type above to start using it in forms.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const isEditing = editingId === type.id;
                  return (
                    <tr key={type.id} className="border-t border-neutral-200">
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        {isEditing ? (
                          <input
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none focus:border-black"
                          />
                        ) : (
                          type.name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onUpdateType(type.id, editingName);
                                  setEditingId(null);
                                  setEditingName("");
                                  onToast("success", "Work type updated.");
                                } catch (error) {
                                  onToast("error", error instanceof Error ? error.message : "Could not update work type.");
                                }
                              }}
                              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(type.id);
                                setEditingName(type.name);
                              }}
                              className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={types.length <= 1}
                            onClick={async () => {
                              try {
                                await onDeleteType(type.id);
                                onToast("success", "Work type deleted.");
                              } catch (error) {
                                onToast("error", error instanceof Error ? error.message : "Could not delete work type.");
                              }
                            }}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-500 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function LabourTable({
  helpers,
  onAddHelper,
  onDeleteHelper,
  onToast,
}: {
  helpers: Helper[];
  onAddHelper: (name: string) => Promise<void>;
  onDeleteHelper: (id: string) => Promise<void>;
  onToast: (kind: "success" | "error", message: string) => void;
}) {
  const [newHelper, setNewHelper] = useState("");

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Labours</h2>
        <p className="text-sm text-neutral-600">Add or remove labours used in the helper dropdown.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-lg shadow-black/5">
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-neutral-300 bg-white/80 p-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">New labour</label>
            <input
              value={newHelper}
              onChange={(event) => setNewHelper(event.target.value)}
              placeholder="e.g. Arun"
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await onAddHelper(newHelper);
                setNewHelper("");
                onToast("success", "Labour added.");
              } catch (error) {
                onToast("error", error instanceof Error ? error.message : "Could not add labour.");
              }
            }}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/10"
          >
            Add labour
          </button>
        </div>

        {helpers.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-neutral-800">No labours yet</p>
            <p className="mt-1 text-sm text-neutral-600">Add a labour above to include it in helper dropdown.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Labour name</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {helpers.map((helper) => (
                  <tr key={helper.id} className="border-t border-neutral-200">
                    <td className="px-4 py-3 font-medium text-neutral-800">{helper.name}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onDeleteHelper(helper.id);
                            onToast("success", "Labour removed.");
                          } catch (error) {
                            onToast("error", error instanceof Error ? error.message : "Could not remove labour.");
                          }
                        }}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-500 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function DeleteConfirmModal({
  job,
  onConfirm,
  onCancel,
}: {
  job: JobRecord;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <Modal title="Confirm delete" onClose={onCancel} maxWidthClass="max-w-lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-700">Delete this work entry permanently?</p>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          <p>
            <strong>User:</strong> {job.customerName || "—"}
          </p>
          <p>
            <strong>Location:</strong> {job.location || "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setDeleting(true);
              try {
                await onConfirm();
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-black"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
  maxWidthClass = "max-w-3xl",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className={`w-full ${maxWidthClass} rounded-2xl bg-white shadow-2xl shadow-black/30`}>
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
