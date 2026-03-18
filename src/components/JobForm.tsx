"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateJob,
  calculateTotalCollected,
  calculateTotalIncentive,
} from "../lib/calculations";
import { CustomIncentive, IncentiveRates, JobInput } from "../lib/types";
import { parseWorkDetails } from "../lib/parser";

const makeEmptyJob = (rates: IncentiveRates, customRates: Array<{ label: string; value: number }>): JobInput => ({
  date: new Date().toISOString().slice(0, 10),
  type: "Installation",
  customerName: "",
  location: "",
  contact: "",
  acDetails: "",
  helper: "",
  helperSalary: 0,
  charges: {
    insCharge: rates.insCharge,
    stand: rates.stand,
    whiteTape: rates.whiteTape,
    plugTop: rates.plugTop,
    piping: rates.piping,
    extraWork: 0,
    woOutdoorCharge: 0,
    amountPaid: 0,
  },
  customIncentives: customRates.map((item) => ({ label: item.label, amount: item.value, applied: false })),
});

const numberOrZero = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Props = {
  onSubmit: (job: JobInput) => Promise<void>;
  rates: IncentiveRates;
  customRates: Array<{ label: string; value: number }>;
};

export function JobForm({ onSubmit, rates, customRates }: Props) {
  const [rawMessage, setRawMessage] = useState("");
  const [job, setJob] = useState<JobInput>(makeEmptyJob(rates, customRates));
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [chargesOpen, setChargesOpen] = useState(true);

  // Sync new custom incentives into the form when added
  useEffect(() => {
    setJob((current) => {
      const existing = current.customIncentives || [];
      const next: CustomIncentive[] = [...existing];
      customRates.forEach((item) => {
        const found = next.find((n) => n.label === item.label);
        if (!found) {
          next.push({ label: item.label, amount: item.value, applied: false });
        }
      });
      return { ...current, customIncentives: next };
    });
  }, [customRates]);

  const computed = useMemo(() => calculateJob(job, rates), [job, rates]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await onSubmit(job);
      setStatus("Saved");
      setJob(makeEmptyJob(rates, customRates));
      setRawMessage("");
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
    () => calculateTotalIncentive(job.charges, rates, job.customIncentives || []),
    [job.charges, rates, job.customIncentives],
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
          Parse message
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          <div className="grid gap-4 border-t border-neutral-200 p-4 md:grid-cols-4">
            <ChargeInput label="Ins charge" value={job.charges.insCharge} onChange={(value) => updateCharge("insCharge", value)} />
            <ChargeInput label="Stand" value={job.charges.stand} onChange={(value) => updateCharge("stand", value)} />
            <ChargeInput label="White tape" value={job.charges.whiteTape} onChange={(value) => updateCharge("whiteTape", value)} />
            <ChargeInput label="Plug top" value={job.charges.plugTop} onChange={(value) => updateCharge("plugTop", value)} />
            <ChargeInput label="Piping" value={job.charges.piping} onChange={(value) => updateCharge("piping", value)} />
            <ChargeInput label="Extra work" value={job.charges.extraWork} onChange={(value) => updateCharge("extraWork", value)} />
            <ChargeInput label="W/OW charge" value={job.charges.woOutdoorCharge} onChange={(value) => updateCharge("woOutdoorCharge", value)} />
            <ChargeInput label="Amount paid" value={job.charges.amountPaid} onChange={(value) => updateCharge("amountPaid", value)} />
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

      {customRates.length > 0 && (
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
          {submitting ? "Saving..." : "Add to table"}
        </button>
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
