"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateTotalCollected, calculateTotalIncentive } from "../lib/calculations";
import { CustomIncentive, Helper, INCENTIVE_RATES, IncentiveCompany, IncentiveRates, JobInput, JobStatus, WorkType } from "../lib/types";
import { parseWorkDetails } from "../lib/parser";

const EMPTY_COMPANY: IncentiveCompany = {
  id: "default",
  name: "Default",
  rates: {
    insCharge: { originalPrice: 0, incentive: 0 },
    stand: { originalPrice: 0, incentive: 0 },
    whiteTape: { originalPrice: 0, incentive: 0 },
    plugTop: { originalPrice: 0, incentive: 0 },
    piping: { originalPrice: 0, incentive: 0 },
  },
  customRates: [],
};

const DEFAULT_WORK_TYPES: WorkType[] = [
  { id: "installation", name: "Installation" },
  { id: "service", name: "Service" },
  { id: "dismantle", name: "Dismantle" },
  { id: "inspection", name: "Inspection" },
];

const BASE_RATE_ROWS: Array<{ key: keyof JobInput["charges"]; label: string; incentiveKey?: keyof IncentiveCompany["rates"] }> = [
  { key: "insCharge", label: "Ins charge", incentiveKey: "insCharge" },
  { key: "stand", label: "Stand", incentiveKey: "stand" },
  { key: "whiteTape", label: "White tape", incentiveKey: "whiteTape" },
  { key: "plugTop", label: "Plug top", incentiveKey: "plugTop" },
  { key: "piping", label: "Piping", incentiveKey: "piping" },
  { key: "extraWork", label: "Extra work" },
  { key: "woOutdoorCharge", label: "W/OW charge" },
];

const syncCustomIncentives = (
  existing: CustomIncentive[] = [],
  customRates: Array<{ label: string; originalPrice: number; incentive: number }> = [],
): CustomIncentive[] => {
  const next = [...existing];
  customRates.forEach((item) => {
    const found = next.find((n) => n.label === item.label);
    if (!found) {
      next.push({ label: item.label, amount: item.incentive, applied: false });
    } else {
      found.amount = item.incentive;
    }
  });
  return next;
};

const cloneRates = (rates: IncentiveRates): IncentiveRates => ({
  insCharge: { ...rates.insCharge },
  stand: { ...rates.stand },
  whiteTape: { ...rates.whiteTape },
  plugTop: { ...rates.plugTop },
  piping: { ...rates.piping },
});

const getRateKey = (typeName: string) => typeName.trim().toLowerCase();

const resolveCompanyRatesForType = (company: IncentiveCompany, typeName: string): IncentiveRates => {
  const key = getRateKey(typeName);
  return company.typeRates?.[key] || INCENTIVE_RATES;
};

const getDefaultTypeName = (workTypes: WorkType[]) => {
  const found = workTypes.find((item) => item.name.trim().toLowerCase() === "installation");
  return found?.name || workTypes[0]?.name || "Installation";
};

const normalizeStatus = (status: JobInput["status"]): JobStatus => {
  if (status === "received" || status === "to_get") return status;
  return "pending";
};

const makeEmptyJob = (company: IncentiveCompany, workTypes: WorkType[]): JobInput => {
  const type = getDefaultTypeName(workTypes);
  const rates = resolveCompanyRatesForType(company, type);
  return {
    date: new Date().toISOString().slice(0, 10),
    type,
    status: "pending",
    amountToGet: 0,
    customerName: "",
    location: "",
    contact: "",
    brand: "",
    helper: "",
    helperSalary: 0,
    companyId: company.id,
    companyName: company.name,
    jobRates: cloneRates(rates),
    charges: {
      insCharge: rates.insCharge.originalPrice,
      stand: rates.stand.originalPrice,
      whiteTape: rates.whiteTape.originalPrice,
      plugTop: rates.plugTop.originalPrice,
      piping: rates.piping.originalPrice,
      extraWork: 0,
      woOutdoorCharge: 0,
    },
    customIncentives: syncCustomIncentives([], company.customRates),
  };
};

const numberOrZero = (value: string) => {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInputNumberValue = (value: number | undefined) => {
  if (!value) return "";
  return String(value);
};

type Props = {
  onSubmit: (job: JobInput) => Promise<void>;
  companies: IncentiveCompany[];
  workTypes: WorkType[];
  helpers: Helper[];
  selectedCompanyId?: string;
  onSelectCompany?: (companyId: string) => void;
  initialJob?: JobInput;
  submitLabel?: string;
  onCancel?: () => void;
  onResult?: (result: { kind: "success" | "error"; message: string }) => void;
};

export function JobForm({
  onSubmit,
  companies,
  workTypes,
  helpers,
  selectedCompanyId,
  onSelectCompany,
  initialJob,
  submitLabel = "Save",
  onCancel,
  onResult,
}: Props) {
  const activeCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || companies[0] || EMPTY_COMPANY,
    [companies, selectedCompanyId],
  );

  const [rawMessage, setRawMessage] = useState("");
  const [job, setJob] = useState<JobInput>(() => {
    if (initialJob) {
      const company = companies.find((c) => c.id === (initialJob.companyId || selectedCompanyId)) || activeCompany;
      const selectedType = initialJob.type || getDefaultTypeName(workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES);
      return {
        ...initialJob,
        status: normalizeStatus(initialJob.status),
        amountToGet: initialJob.amountToGet || 0,
        brand: initialJob.brand || "",
        companyId: company.id,
        companyName: company.name,
        jobRates: cloneRates(initialJob.jobRates || resolveCompanyRatesForType(company, selectedType)),
        customIncentives: syncCustomIncentives(initialJob.customIncentives || [], company.customRates),
      };
    }
    return makeEmptyJob(activeCompany, workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES);
  });
  const [submitting, setSubmitting] = useState(false);
  const [chargesOpen, setChargesOpen] = useState(true);

  // Keep form in sync when editing or switching companies
  useEffect(() => {
    if (initialJob) {
      const company = companies.find((c) => c.id === (initialJob.companyId || selectedCompanyId)) || activeCompany;
      const selectedType = initialJob.type || getDefaultTypeName(workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES);
      setJob({
        ...initialJob,
        status: normalizeStatus(initialJob.status),
        amountToGet: initialJob.amountToGet || 0,
        brand: initialJob.brand || "",
        companyId: company.id,
        companyName: company.name,
        jobRates: cloneRates(initialJob.jobRates || resolveCompanyRatesForType(company, selectedType)),
        customIncentives: syncCustomIncentives(initialJob.customIncentives || [], company.customRates),
      });
      return;
    }
    setJob((current) => {
      const company = companies.find((c) => c.id === (current.companyId || selectedCompanyId)) || activeCompany;
      const nextCustom = syncCustomIncentives(current.customIncentives || [], company.customRates);
      const resolvedRates = resolveCompanyRatesForType(company, current.type || getDefaultTypeName(workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES));
      return {
        ...current,
        companyId: company.id,
        companyName: company.name,
        jobRates: current.jobRates || cloneRates(resolvedRates),
        customIncentives: nextCustom,
      };
    });
  }, [initialJob, companies, selectedCompanyId, activeCompany, workTypes]);

  useEffect(() => {
    if (!initialJob) {
      setJob(makeEmptyJob(activeCompany, workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES));
    }
  }, [activeCompany, initialJob, workTypes]);

  useEffect(() => {
    if (initialJob || workTypes.length === 0) return;
    setJob((current) => {
      const exists = workTypes.some((item) => item.name === current.type);
      if (exists) return current;
      const company = companies.find((c) => c.id === (current.companyId || selectedCompanyId)) || activeCompany;
      const nextType = getDefaultTypeName(workTypes);
      const rates = resolveCompanyRatesForType(company, nextType);
      return {
        ...current,
        type: nextType,
        jobRates: cloneRates(rates),
        charges: {
          ...current.charges,
          insCharge: rates.insCharge.originalPrice,
          stand: rates.stand.originalPrice,
          whiteTape: rates.whiteTape.originalPrice,
          plugTop: rates.plugTop.originalPrice,
          piping: rates.piping.originalPrice,
        },
      };
    });
  }, [initialJob, workTypes, companies, selectedCompanyId, activeCompany]);

  const companyForJob = useMemo(
    () => companies.find((c) => c.id === job.companyId) || activeCompany,
    [companies, job.companyId, activeCompany],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(job);
      onResult?.({
        kind: "success",
        message: initialJob ? "Work updated successfully." : "Work added successfully.",
      });
      if (!initialJob) {
        setJob(makeEmptyJob(companyForJob, workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES));
        setRawMessage("");
      }
    } catch (error) {
      onResult?.({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not save work.",
      });
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
      brand: parsed.brand || current.brand,
    }));
  };

  const updateCharge = (key: keyof JobInput["charges"], value: string) => {
    setJob((current) => ({
      ...current,
      charges: { ...current.charges, [key]: numberOrZero(value) },
    }));
  };

  const updateField = (field: keyof JobInput, value: string) => {
    if (field === "helperSalary" || field === "amountToGet") {
      setJob((current) => ({ ...current, [field]: numberOrZero(value) }));
      return;
    }

    if (field === "type") {
      setJob((current) => {
        const company = companies.find((c) => c.id === (current.companyId || selectedCompanyId)) || activeCompany;
        const rates = resolveCompanyRatesForType(company, value);
        return {
          ...current,
          type: value,
          jobRates: cloneRates(rates),
          charges: {
            ...current.charges,
            insCharge: rates.insCharge.originalPrice,
            stand: rates.stand.originalPrice,
            whiteTape: rates.whiteTape.originalPrice,
            plugTop: rates.plugTop.originalPrice,
            piping: rates.piping.originalPrice,
          },
        };
      });
      return;
    }

    if (field === "status") {
      const nextStatus = normalizeStatus(value as JobStatus);
      setJob((current) => ({
        ...current,
        status: nextStatus,
        amountToGet: nextStatus === "to_get" ? current.amountToGet || 0 : 0,
      }));
      return;
    }

    setJob((current) => ({ ...current, [field]: value }));
  };

  const updateIncentive = (key: keyof IncentiveRates, value: string) => {
    setJob((current) => {
      const baseRates = current.jobRates || cloneRates(resolveCompanyRatesForType(companyForJob, current.type));
      return {
        ...current,
        jobRates: {
          ...baseRates,
          [key]: {
            ...baseRates[key],
            incentive: numberOrZero(value),
          },
        },
      };
    });
  };

  const totalCharges = useMemo(() => calculateTotalCollected(job.charges), [job.charges]);
  const totalIncentive = useMemo(
    () => calculateTotalIncentive(job.charges, job.jobRates || resolveCompanyRatesForType(companyForJob, job.type), job.customIncentives || []),
    [job.charges, job.jobRates, companyForJob, job.type, job.customIncentives],
  );

  const helperOptions = useMemo(() => {
    const names = helpers
      .map((item) => item.name.trim())
      .filter((value) => value.length > 0);
    if (job.helper && !names.includes(job.helper)) {
      return [job.helper, ...names];
    }
    return names;
  }, [helpers, job.helper]);

  const typeOptions = useMemo(() => {
    const names = (workTypes.length > 0 ? workTypes : DEFAULT_WORK_TYPES).map((item) => item.name);
    if (job.type && !names.includes(job.type)) {
      return [job.type, ...names];
    }
    return names;
  }, [workTypes, job.type]);

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
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
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
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Brand</label>
          <textarea
            value={job.brand}
            onChange={(event) => updateField("brand", event.target.value)}
            className="min-h-[96px] w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            placeholder="VOLTAS / LG / Daikin ..."
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
                    setJob((current) => {
                      const rates = resolveCompanyRatesForType(company, current.type);
                      return {
                        ...current,
                        companyId: company.id,
                        companyName: company.name,
                        jobRates: cloneRates(rates),
                        charges: {
                          ...current.charges,
                          insCharge: rates.insCharge.originalPrice,
                          stand: rates.stand.originalPrice,
                          whiteTape: rates.whiteTape.originalPrice,
                          plugTop: rates.plugTop.originalPrice,
                          piping: rates.piping.originalPrice,
                        },
                        customIncentives: syncCustomIncentives(current.customIncentives || [], company.customRates),
                      };
                    });
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

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Original price</th>
                    <th className="px-4 py-3">Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {BASE_RATE_ROWS.map((row) => {
                    const incentive = row.incentiveKey
                      ? (job.jobRates?.[row.incentiveKey]?.incentive ?? resolveCompanyRatesForType(companyForJob, job.type)[row.incentiveKey].incentive)
                      : 0;
                    const chargeValue = job.charges[row.key];
                    const showIncentiveInput = row.incentiveKey
                      ? row.incentiveKey === "insCharge" || numberOrZero(String(chargeValue)) > 0
                      : false;
                    return (
                      <tr key={row.key} className="border-t border-neutral-200">
                        <td className="px-4 py-3 font-medium text-neutral-800">{row.label}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={toInputNumberValue(chargeValue)}
                            onChange={(event) => updateCharge(row.key, event.target.value)}
                            className="w-36 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
                            min={0}
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-neutral-800">
                          {row.incentiveKey && showIncentiveInput ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              value={toInputNumberValue(incentive)}
                              onChange={(event) => updateIncentive(row.incentiveKey!, event.target.value)}
                              className="w-36 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
                              min={0}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Helper name</label>
          <select
            value={job.helper}
            onChange={(event) => updateField("helper", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
          >
            <option value="">Select helper</option>
            {helperOptions.map((helperName) => (
              <option key={helperName} value={helperName}>
                {helperName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Helper salary</label>
          <input
            type="number"
            value={toInputNumberValue(job.helperSalary)}
            onChange={(event) => updateField("helperSalary", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
            min={0}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Payment status</label>
          <select
            value={job.status || "pending"}
            onChange={(event) => updateField("status", event.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
          >
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="to_get">To get</option>
          </select>
        </div>
        {(job.status || "pending") === "to_get" && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Amount to get</label>
            <input
              type="number"
              value={toInputNumberValue(job.amountToGet || 0)}
              onChange={(event) => {
                setJob((current) => ({ ...current, amountToGet: numberOrZero(event.target.value) }));
              }}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-black"
              min={0}
            />
          </div>
        )}
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

      <div className="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800 sm:grid-cols-2">
        <span className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">Collected from customer <strong className="text-lg font-bold">₹{totalCharges.toLocaleString()}</strong></span>
        <span className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">Total incentive <strong className="text-lg font-bold">₹{totalIncentive.toLocaleString()}</strong></span>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-6 py-4 backdrop-blur">
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
      </div>
    </form>
  );
}
