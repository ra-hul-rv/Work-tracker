"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateJob,
  calculateTotalCollected,
  calculateTotalIncentive,
} from "../lib/calculations";
import { CustomIncentive, IncentiveCompany, JobInput } from "../lib/types";
import { parseWorkDetails } from "../lib/parser";

const EMPTY_COMPANY: IncentiveCompany = {
  id: "default",
  name: "Default",
  rates: {
    insCharge: 0,
    stand: 0,
    whiteTape: 0,
    plugTop: 0,
    piping: 0,
  },
  customRates: [],
};

const syncCustomIncentives = (
  existing: CustomIncentive[] = [],
  customRates: Array<{ label: string; value: number }> = [],
): CustomIncentive[] => {
  const next = [...existing];
  customRates.forEach((item) => {
    const found = next.find((n) => n.label === item.label);
    if (!found) {
      next.push({ label: item.label, amount: item.value, applied: false });
    } else {
      found.amount = item.value;
    }
  });
  return next;
};

const makeEmptyJob = (company: IncentiveCompany): JobInput => ({
  date: new Date().toISOString().slice(0, 10),
  type: "Installation",
  status: "pending",
  customerName: "",
  location: "",
  contact: "",
  acDetails: "",
  helper: "",
  helperSalary: 0,
  companyId: company.id,
  companyName: company.name,
  charges: {
    insCharge: company.rates.insCharge,
    stand: company.rates.stand,
    whiteTape: company.rates.whiteTape,
    plugTop: company.rates.plugTop,
    piping: company.rates.piping,
    extraWork: 0,
    woOutdoorCharge: 0,
  },
  customIncentives: syncCustomIncentives([], company.customRates),
});

const numberOrZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Props = {
  onSubmit: (job: JobInput) => Promise<void>;
  companies: IncentiveCompany[];
  selectedCompanyId?: string;
  onSelectCompany?: (companyId: string) => void;
  initialJob?: JobInput;
  submitLabel?: string;
  onCancel?: () => void;
};

export function JobForm({
  onSubmit,
  companies,
  selectedCompanyId,
  onSelectCompany,
  initialJob,
  submitLabel = "Save",
  onCancel,
}: Props) {
  const activeCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0] || EMPTY_COMPANY,
    [companies, selectedCompanyId],
  );

  const [rawMessage, setRawMessage] = useState("");
  const [job, setJob] = useState<JobInput>(() => {
    if (initialJob) {
      const company = companies.find((c) => c.id === (initialJob.companyId || selectedCompanyId)) || activeCompany;
      return {
        ...initialJob,
        status: initialJob.status || "pending",
        companyId: company.id,
        companyName: company.name,
        customIncentives: syncCustomIncentives(initialJob.customIncentives || [], company.customRates),
      };
    }
    return makeEmptyJob(activeCompany);
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [chargesOpen, setChargesOpen] = useState(true);

  // Keep form in sync when editing or switching companies
  useEffect(() => {
    if (initialJob) {
      const company = companies.find((c) => c.id === (initialJob.companyId || selectedCompanyId)) || activeCompany;
      setJob({
        ...initialJob,
        status: initialJob.status || "pending",
        companyId: company.id,
        companyName: company.name,
        customIncentives: syncCustomIncentives(initialJob.customIncentives || [], company.customRates),
      });
      return;
    }
    setJob((current) => {
      const company = companies.find((c) => c.id === (current.companyId || selectedCompanyId)) || activeCompany;
      const nextCustom = syncCustomIncentives(current.customIncentives || [], company.customRates);
      return { ...current, companyId: company.id, companyName: company.name, customIncentives: nextCustom };
    });
  }, [initialJob, companies, selectedCompanyId, activeCompany]);

  useEffect(() => {
    if (!initialJob) {
      setJob(makeEmptyJob(activeCompany));
    }
  }, [activeCompany, initialJob]);

  const companyForJob = useMemo(
    () => companies.find((c) => c.id === job.companyId) || activeCompany,
    [companies, job.companyId, activeCompany],
  );

  const computed = useMemo(() => calculateJob(job, companyForJob.rates), [job, companyForJob.rates]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await onSubmit(job);
      setStatus("Saved");
      if (!initialJob) {
        setJob(makeEmptyJob(companyForJob));
        setRawMessage("");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleParse = () => {
    const parsed = parseWorkDetails(rawMessage);
    setJob((current) => ({
      ...current,
      customerName: parsed.customerName || current.customerName,
      contact: parsed.contact || current.contact,
      location: parsed.location || current.location,
      acDetails: parsed.acDetails || current.acDetails,
    }));
  };

  const updateCharge = (key: keyof JobInput["charges"], value: string) => {
    setJob((current) => ({
      ...current,
      charges: { ...current.charges, [key]: numberOrZero(value) },
    }));
  };

  const updateField = (field: keyof JobInput, value: string) => {
    if (field === "helperSalary") {
      setJob((current) => ({ ...current, helperSalary: numberOrZero(value) }));
      return;
    }
    setJob((current) => ({ ...current, [field]: value }));
  };

  const totalCharges = useMemo(() => calculateTotalCollected(job.charges), [job.charges]);
  const totalIncentive = useMemo(
    () => calculateTotalIncentive(job.charges, companyForJob.rates, job.customIncentives || []),
    [job.charges, companyForJob.rates, job.customIncentives],
  );

  return (
    <form className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white/70 p-6 shadow-lg shadow-black/5 backdrop-blur" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-neutral-700">Paste WhatsApp work details</label>
        <textarea
          value={rawMessage}
          onChange={(event) => setRawMessage(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-900 outline-none transition focus:border-black focus:bg-white"
          placeholder="Name :: Phone\nLocation line 1\nLocation line 2\nAC details"
        />
        <button
          type="button"
          onClick={handleParse}
          className="self-start rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-black hover:bg-black hover:text-white"
        >
          Autofill
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Date</label>
          <input
            type="date"
            value={job.date}
            onChange={(event) => updateField("date", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Type</label>
          <select
            value={job.type}
            onChange={(event) => updateField("type", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
          >
            <option>Installation</option>
            <option>Service</option>
            <option>Dismantle</option>
            <option>Inspection</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Status</label>
          <select
            value={job.status || "pending"}
            onChange={(event) => updateField("status", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Customer name</label>
          <input
            value={job.customerName}
            onChange={(event) => updateField("customerName", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="Customer"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Contact number</label>
          <input
            value={job.contact}
            onChange={(event) => updateField("contact", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="Phone"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Location</label>
          <textarea
            value={job.location}
            onChange={(event) => updateField("location", event.target.value)}
            className="min-h-[96px] w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="Street, area, notes"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">AC / Work details</label>
          <textarea
            value={job.acDetails}
            onChange={(event) => updateField("acDetails", event.target.value)}
            className="min-h-[96px] w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="VOLTAS SAC 1T ..."
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200">
        <button
          type="button"
          onClick={() => setChargesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-neutral-800"
        >
          <span>Charges</span>
          <span className="text-xs text-neutral-500">{chargesOpen ? "Hide" : "Show"}</span>
        </button>
        {chargesOpen && (
          <div className="flex flex-col gap-4 border-t border-neutral-200 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Incentive company</label>
                <select
                  value={job.companyId || activeCompany.id}
                  onChange={(event) => {
                    const id = event.target.value;
                    onSelectCompany?.(id);
                    const company = companies.find((c) => c.id === id) || activeCompany;
                    setJob((current) => ({
                      ...current,
                      companyId: company.id,
                      companyName: company.name,
                      charges: {
                        ...current.charges,
                        insCharge: company.rates.insCharge,
                        stand: company.rates.stand,
                        whiteTape: company.rates.whiteTape,
                        plugTop: company.rates.plugTop,
                        piping: company.rates.piping,
                      },
                      customIncentives: syncCustomIncentives(current.customIncentives || [], company.customRates),
                    }));
                  }}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
            <ChargeInput label="Ins charge" value={job.charges.insCharge} onChange={(value) => updateCharge("insCharge", value)} />
            <ChargeInput label="Stand" value={job.charges.stand} onChange={(value) => updateCharge("stand", value)} />
            <ChargeInput label="White tape" value={job.charges.whiteTape} onChange={(value) => updateCharge("whiteTape", value)} />
            <ChargeInput label="Plug top" value={job.charges.plugTop} onChange={(value) => updateCharge("plugTop", value)} />
            <ChargeInput label="Piping" value={job.charges.piping} onChange={(value) => updateCharge("piping", value)} />
            <ChargeInput label="Extra work" value={job.charges.extraWork} onChange={(value) => updateCharge("extraWork", value)} />
            <ChargeInput label="W/OW charge" value={job.charges.woOutdoorCharge} onChange={(value) => updateCharge("woOutdoorCharge", value)} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Helper name</label>
          <input
            value={job.helper}
            onChange={(event) => updateField("helper", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="Helper"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Helper salary</label>
          <input
            type="number"
            value={job.helperSalary}
            onChange={(event) => updateField("helperSalary", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="0"
            min={0}
          />
        </div>
      </div>

      {companyForJob.customRates.length > 0 && (
        <div className="rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-800">
            <span>Custom incentives</span>
            <span className="text-xs text-neutral-500">Toggle to include</span>
          </div>
          <div className="grid gap-3 border-t border-neutral-200 p-4 md:grid-cols-2">
            {(job.customIncentives || []).map((item, idx) => (
              <label key={`${item.label}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800">
                <span>{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">₹{item.amount.toLocaleString()}</span>
                  <input
                    type="checkbox"
                    checked={item.applied}
                    onChange={(event) => {
                      const applied = event.target.checked;
                      setJob((current) => {
                        const next = (current.customIncentives || []).map((c, i) =>
                          i === idx ? { ...c, applied } : c,
                        );
                        return { ...current, customIncentives: next };
                      });
                    }}
                    className="h-4 w-4"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800 md:grid-cols-4">
        <span className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">Total collected <strong className="text-lg font-bold">₹{totalCharges.toLocaleString()}</strong></span>
        <span className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">Balance to be paid <strong className="text-lg font-bold">₹{computed.balanceToBePaid.toLocaleString()}</strong></span>
        <span className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">Total balance <strong className="text-lg font-bold">₹{computed.totalBalance.toLocaleString()}</strong></span>
        <span className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">Total incentive <strong className="text-lg font-bold">₹{totalIncentive.toLocaleString()}</strong></span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white shadow-md shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-black hover:text-black"
          >
            Cancel
          </button>
        )}
        {status && <span className="text-sm font-medium text-neutral-600">{status}</span>}
      </div>
    </form>
  );
}

type ChargeProps = {
  label: string;
  value: number;
  onChange: (value: string) => void;
};

function ChargeInput({ label, value, onChange }: ChargeProps) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
        placeholder="0"
        min={0}
      />
    </label>
  );
}
