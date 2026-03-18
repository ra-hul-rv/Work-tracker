"use client";

import { useState } from "react";
import { JobInput, JobRecord } from "../lib/types";

const toJobInput = (job: JobRecord): JobInput => ({
  date: job.date,
  type: job.type,
  customerName: job.customerName,
  location: job.location,
  contact: job.contact,
  acDetails: job.acDetails,
  helper: job.helper,
  helperSalary: job.helperSalary,
  charges: { ...job.charges },
  customIncentives: job.customIncentives || [],
});

type Props = {
  jobs: JobRecord[];
  loading?: boolean;
  onSave: (id: string, job: JobInput) => Promise<void>;
};

export function JobTable({ jobs, loading = false, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JobInput | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (job: JobRecord) => {
    if (!job.id) return;
    setEditingId(job.id);
    setDraft(toJobInput(job));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateField = (field: keyof JobInput, value: string) => {
    if (!draft) return;
    if (field === "helperSalary") {
      setDraft({ ...draft, helperSalary: Number(value) || 0 });
      return;
    }
    setDraft({ ...draft, [field]: value });
  };

  const updateCharge = (key: keyof JobInput["charges"], value: string) => {
    if (!draft) return;
    setDraft({ ...draft, charges: { ...draft.charges, [key]: Number(value) || 0 } });
  };

  const toggleCustom = (index: number, applied: boolean) => {
    if (!draft) return;
    const next = (draft.customIncentives || []).map((item, idx) =>
      idx === index ? { ...item, applied } : item,
    );
    setDraft({ ...draft, customIncentives: next });
  };

  const save = async () => {
    if (!draft || !editingId) return;
    setSaving(true);
    try {
      await onSave(editingId, draft);
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

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
            <th className="px-3 py-3">Charges</th>
            <th className="px-3 py-3">Helper</th>
            <th className="px-3 py-3">Totals</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={10} className="px-3 py-4 text-center text-neutral-500">
                Loading jobs...
              </td>
            </tr>
          )}
          {!loading && jobs.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-4 text-center text-neutral-500">
                No jobs yet.
              </td>
            </tr>
          )}
          {jobs.map((job, index) => {
            const isEditing = editingId === job.id;
            return (
              <tr key={job.id ?? index} className="border-t border-neutral-200 align-top">
                <td className="px-3 py-3 text-neutral-600">{index + 1}</td>
                <td className="px-3 py-3 text-neutral-800">{job.date}</td>
                <td className="px-3 py-3">
                  {isEditing ? (
                    <input
                      value={draft?.customerName ?? ""}
                      onChange={(event) => updateField("customerName", event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                    />
                  ) : (
                    <div className="font-semibold text-neutral-900">{job.customerName}</div>
                  )}
                  <div className="text-xs text-neutral-500">{job.acDetails}</div>
                </td>
                <td className="px-3 py-3">
                  {isEditing ? (
                    <input
                      value={draft?.contact ?? ""}
                      onChange={(event) => updateField("contact", event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="text-neutral-800">{job.contact}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-neutral-700">
                  {isEditing ? (
                    <textarea
                      value={draft?.location ?? ""}
                      onChange={(event) => updateField("location", event.target.value)}
                      className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                      rows={2}
                    />
                  ) : (
                    job.location ? (
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
                    )
                  )}
                </td>
                <td className="px-3 py-3 text-neutral-800">
                  {isEditing ? (
                    <select
                      value={draft?.type ?? ""}
                      onChange={(event) => updateField("type", event.target.value)}
                      className="rounded-md border border-neutral-200 px-2 py-1 text-sm"
                    >
                      <option>Installation</option>
                      <option>Service</option>
                      <option>Dismantle</option>
                      <option>Inspection</option>
                    </select>
                  ) : (
                    <span>{job.type}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-neutral-700">
                  <div className="grid grid-cols-2 gap-1 text-xs text-neutral-700">
                    {renderCharge(isEditing, "Ins", job.charges.insCharge, (value) => updateCharge("insCharge", value))}
                    {renderCharge(isEditing, "Stand", job.charges.stand, (value) => updateCharge("stand", value))}
                    {renderCharge(isEditing, "Tape", job.charges.whiteTape, (value) => updateCharge("whiteTape", value))}
                    {renderCharge(isEditing, "Plug", job.charges.plugTop, (value) => updateCharge("plugTop", value))}
                    {renderCharge(isEditing, "Piping", job.charges.piping, (value) => updateCharge("piping", value))}
                    {renderCharge(isEditing, "Extra", job.charges.extraWork, (value) => updateCharge("extraWork", value))}
                    {renderCharge(isEditing, "W/OW", job.charges.woOutdoorCharge, (value) => updateCharge("woOutdoorCharge", value))}
                    {renderCharge(isEditing, "Paid", job.charges.amountPaid, (value) => updateCharge("amountPaid", value))}
                  </div>
                </td>
                <td className="px-3 py-3 text-neutral-800">
                  <div className="flex flex-col gap-1 text-xs text-neutral-700">
                    <span>Helper: {isEditing ? (
                      <input
                        value={draft?.helper ?? ""}
                        onChange={(event) => updateField("helper", event.target.value)}
                        className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      job.helper || "—"
                    )}</span>
                    <span>Salary: {isEditing ? (
                      <input
                        type="number"
                        value={draft?.helperSalary ?? 0}
                        onChange={(event) => updateField("helperSalary", event.target.value)}
                        className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      `₹${job.helperSalary.toLocaleString()}`
                    )}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-neutral-900">
                  <div className="flex flex-col gap-1 text-xs">
                    <span>Total collected: <strong>₹{job.totalCollected.toLocaleString()}</strong></span>
                    <span>Balance to be paid: <strong>₹{job.balanceToBePaid.toLocaleString()}</strong></span>
                    <span>Total balance: <strong>₹{job.totalBalance.toLocaleString()}</strong></span>
                    <span>Incentive: <strong>₹{job.totalIncentive.toLocaleString()}</strong></span>
                    {(job.customIncentives || []).length > 0 && (
                      <div className="flex flex-col gap-1 text-neutral-700">
                        <span className="font-semibold text-neutral-800">Custom incentives</span>
                        {(isEditing ? draft?.customIncentives : job.customIncentives)?.map((c, cIdx) => (
                          <label key={`${c.label}-${cIdx}`} className="flex items-center gap-2">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={c.applied}
                                onChange={(event) => toggleCustom(cIdx, event.target.checked)}
                                className="h-4 w-4"
                              />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-neutral-400" />
                            )}
                            <span>
                              {c.label} ({`₹${c.amount}`}) {(!isEditing && !c.applied) ? "(off)" : ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        type="button"
                        className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(job)}
                      className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-black hover:text-black"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const renderCharge = (
  editable: boolean,
  label: string,
  value: number,
  onChange: (value: string) => void,
) => {
  if (editable) {
    return (
      <label className="flex flex-col rounded-md border border-neutral-200 bg-white px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full text-sm font-medium text-neutral-900 outline-none"
          min={0}
        />
      </label>
    );
  }

  return (
    <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-800">
      {label}: ₹{value.toLocaleString()}
    </span>
  );
};
