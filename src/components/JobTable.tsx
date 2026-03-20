"use client";

import { useMemo, useRef, useState } from "react";
import { JobRecord } from "../lib/types";

type Props = {
  jobs: JobRecord[];
  loading?: boolean;
  onEdit: (job: JobRecord) => void;
  onDelete: (job: JobRecord) => void;
};

type SortKey =
  | "date"
  | "customerName"
  | "contact"
  | "location"
  | "type"
  | "helperSalary"
  | "totalCollected"
  | "totalIncentive"
  | "balanceToBePaid"
  | "status"
  | "totalBalance";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

const parseDateValue = (raw: string) => {
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(raw);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getSortValue = (job: JobRecord, key: SortKey): number | string => {
  switch (key) {
    case "date":
      return parseDateValue(job.date);
    case "customerName":
      return (job.customerName || "").toLowerCase();
    case "contact":
      return (job.contact || "").toLowerCase();
    case "location":
      return (job.location || "").toLowerCase();
    case "type":
      return (job.type || "").toLowerCase();
    case "helperSalary":
      return job.helperSalary || 0;
    case "totalCollected":
      return job.totalCollected || 0;
    case "totalIncentive":
      return job.totalIncentive || 0;
    case "balanceToBePaid":
      return job.balanceToBePaid || 0;
    case "totalBalance":
      return job.totalBalance || 0;
    case "status": {
      const rank: Record<string, number> = { pending: 0, to_get: 1, received: 2 };
      return rank[job.status || "pending"] ?? 0;
    }
    default:
      return "";
  }
};

const formatDate = (raw: string) => {
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

export function JobTable({ jobs, loading = false, onEdit, onDelete }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const sortedJobs = useMemo(() => {
    const indexed = jobs.map((job, index) => ({ job, index }));
    if (!sortConfig) {
      return indexed.map((entry) => entry.job);
    }

    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;
    indexed.sort((first, second) => {
      const firstValue = getSortValue(first.job, sortConfig.key);
      const secondValue = getSortValue(second.job, sortConfig.key);

      if (firstValue < secondValue) return -1 * directionMultiplier;
      if (firstValue > secondValue) return 1 * directionMultiplier;
      return first.index - second.index;
    });

    return indexed.map((entry) => entry.job);
  }, [jobs, sortConfig]);

  const endDrag = () => {
    setIsDragging(false);
  };

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  const sortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div
      ref={scrollRef}
      className={`w-full overflow-auto rounded-2xl border border-neutral-200 bg-white/80 shadow-lg shadow-black/5 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, select, textarea, label")) return;
        if (!scrollRef.current) return;
        dragStartXRef.current = event.clientX;
        dragStartScrollLeftRef.current = scrollRef.current.scrollLeft;
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (!isDragging || !scrollRef.current) return;
        event.preventDefault();
        const deltaX = event.clientX - dragStartXRef.current;
        scrollRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onDragStart={(event) => event.preventDefault()}
    >
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
          <tr>
            <th className="px-3 py-3">S no</th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("date")} className="flex w-full items-center gap-1 text-left">
                <span>Date</span>
                <span className="text-[10px]">{sortIndicator("date")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("customerName")} className="flex w-full items-center gap-1 text-left">
                <span>Customer</span>
                <span className="text-[10px]">{sortIndicator("customerName")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("contact")} className="flex w-full items-center gap-1 text-left">
                <span>Contact</span>
                <span className="text-[10px]">{sortIndicator("contact")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("location")} className="flex w-full items-center gap-1 text-left">
                <span>Location</span>
                <span className="text-[10px]">{sortIndicator("location")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("type")} className="flex w-full items-center gap-1 text-left">
                <span>Type</span>
                <span className="text-[10px]">{sortIndicator("type")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("helperSalary")} className="flex w-full items-center gap-1 text-left">
                <span>Helper / Salary</span>
                <span className="text-[10px]">{sortIndicator("helperSalary")}</span>
              </button>
            </th>
            <th className="bg-blue-50 px-3 py-3">
              <button type="button" onClick={() => toggleSort("totalCollected")} className="flex w-full items-center gap-1 text-left">
                <span>Total collected</span>
                <span className="text-[10px]">{sortIndicator("totalCollected")}</span>
              </button>
            </th>
            <th className="bg-green-50 px-3 py-3">
              <button type="button" onClick={() => toggleSort("totalIncentive")} className="flex w-full items-center gap-1 text-left">
                <span>Total incentive</span>
                <span className="text-[10px]">{sortIndicator("totalIncentive")}</span>
              </button>
            </th>
            <th className="bg-rose-50 px-3 py-3">
              <button type="button" onClick={() => toggleSort("balanceToBePaid")} className="flex w-full items-center gap-1 text-left">
                <span>Balance to be paid</span>
                <span className="text-[10px]">{sortIndicator("balanceToBePaid")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("status")} className="flex w-full items-center gap-1 text-left">
                <span>Payment status</span>
                <span className="text-[10px]">{sortIndicator("status")}</span>
              </button>
            </th>
            <th className="px-3 py-3">
              <button type="button" onClick={() => toggleSort("totalBalance")} className="flex w-full items-center gap-1 text-left">
                <span>Total balance</span>
                <span className="text-[10px]">{sortIndicator("totalBalance")}</span>
              </button>
            </th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={13} className="px-3 py-4 text-center text-neutral-500">
                Loading jobs...
              </td>
            </tr>
          )}
          {!loading && jobs.length === 0 && (
            <tr>
              <td colSpan={13} className="px-3 py-4 text-center text-neutral-500">
                No jobs yet.
              </td>
            </tr>
          )}
          {sortedJobs.map((job, index) => (
            <tr
              key={job.id ?? index}
              className={`border-t border-neutral-200 align-top ${
                job.status === "received" ? "" : job.status === "to_get" ? "bg-red-100/60" : "bg-amber-50/40"
              }`}
            >
              <td className="px-3 py-3 text-neutral-600">{index + 1}</td>
              <td className="px-3 py-3 text-neutral-800">{formatDate(job.date)}</td>
              <td className="px-3 py-3">
                <div className="font-semibold text-neutral-900">{job.customerName}</div>
                <div className="text-xs text-neutral-500">{job.brand || "—"}</div>
              </td>
              <td className="px-3 py-3 text-neutral-800">{job.contact}</td>
              <td className="px-3 py-3 text-neutral-700">
                {job.location ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                  >
                    {job.location}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </td>
              <td className="px-3 py-3 text-neutral-800">
                <div className="flex flex-col gap-1">
                  <span>{job.type}</span>
                  {job.companyName && (
                    <span className="w-fit rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-700">
                      {job.companyName}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-neutral-800">
                <div className="flex flex-col text-xs text-neutral-700">
                  <span>{job.helper || "—"}</span>
                  <span>₹{job.helperSalary.toLocaleString()}</span>
                </div>
              </td>
              <td className="bg-blue-50/50 px-3 py-3 text-neutral-900">
                <strong>₹{job.totalCollected.toLocaleString()}</strong>
              </td>
              <td className="bg-green-50/50 px-3 py-3 text-neutral-900">
                <strong>₹{job.totalIncentive.toLocaleString()}</strong>
              </td>
              <td className="bg-rose-50/50 px-3 py-3 text-neutral-900">
                <strong>₹{job.balanceToBePaid.toLocaleString()}</strong>
              </td>
              <td className="px-3 py-3 text-neutral-800">
                <div className="flex flex-col gap-1">
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      job.status === "received"
                        ? "bg-green-100 text-green-700"
                        : job.status === "to_get"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {job.status === "received" ? "Received" : job.status === "to_get" ? "To get" : "Pending"}
                  </span>
                  {job.status === "to_get" && (job.amountToGet || 0) > 0 && (
                    <span className="text-xs font-semibold text-red-700">₹{(job.amountToGet || 0).toLocaleString()}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-neutral-900">
                <strong>₹{job.totalBalance.toLocaleString()}</strong>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(job)}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(job)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-500 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
