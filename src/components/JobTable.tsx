"use client";

import { JobRecord } from "../lib/types";

type Props = {
  jobs: JobRecord[];
  loading?: boolean;
  onEdit: (job: JobRecord) => void;
};

export function JobTable({ jobs, loading = false, onEdit }: Props) {
  return (
    <div className="w-full overflow-auto rounded-2xl border border-neutral-200 bg-white/80 shadow-lg shadow-black/5">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
          <tr>
            <th className="px-3 py-3">S no</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Customer</th>
            <th className="px-3 py-3">Contact</th>
            <th className="px-3 py-3">Location</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Helper / Salary</th>
            <th className="bg-blue-50 px-3 py-3">Total collected</th>
            <th className="bg-green-50 px-3 py-3">Total incentive</th>
            <th className="bg-rose-50 px-3 py-3">Balance to be paid</th>
            <th className="px-3 py-3">Total balance</th>
            <th className="px-3 py-3">Status</th>
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
          {jobs.map((job, index) => (
            <tr
              key={job.id ?? index}
              className={`border-t border-neutral-200 align-top ${job.status === "completed" ? "" : "bg-amber-50/40"}`}
            >
              <td className="px-3 py-3 text-neutral-600">{index + 1}</td>
              <td className="px-3 py-3 text-neutral-800">{job.date}</td>
              <td className="px-3 py-3">
                <div className="font-semibold text-neutral-900">{job.customerName}</div>
                <div className="text-xs text-neutral-500">{job.acDetails}</div>
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
              <td className="px-3 py-3 text-neutral-900">
                <strong>₹{job.totalBalance.toLocaleString()}</strong>
              </td>
              <td className="px-3 py-3 text-neutral-800">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {job.status === "completed" ? "Completed" : "Pending"}
                </span>
              </td>
              <td className="px-3 py-3">
                <button
                  onClick={() => onEdit(job)}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
