import { Charges, CustomIncentive, IncentiveRates, JobInput, JobRecord } from "./types";

const toNumber = (value: number | string): number => {
  const parsed = typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateTotalCollected = (charges: Charges): number => {
  return (
    toNumber(charges.insCharge) +
    toNumber(charges.stand) +
    toNumber(charges.whiteTape) +
    toNumber(charges.plugTop) +
    toNumber(charges.piping) +
    toNumber(charges.extraWork) +
    toNumber(charges.woOutdoorCharge)
  );
};

export const calculateBalanceToBePaid = (totalCollected: number): number => {
  return totalCollected;
};

export const calculateTotalBalance = (totalCollected: number, helperSalary: number): number => {
  return totalCollected - toNumber(helperSalary);
};

export const calculateTotalIncentive = (charges: Charges, rates: IncentiveRates, customIncentives: CustomIncentive[] = []): number => {
  let total = 0;

  if (toNumber(charges.insCharge) > 0) total += rates.insCharge;
  if (toNumber(charges.stand) > 0) total += rates.stand;
  if (toNumber(charges.whiteTape) > 0) total += rates.whiteTape;
  if (toNumber(charges.plugTop) > 0) total += rates.plugTop;
  if (toNumber(charges.piping) > 0) total += rates.piping;

  customIncentives.forEach((item) => {
    if (item.applied && toNumber(item.amount) > 0) {
      total += toNumber(item.amount);
    }
  });

  return total;
};

export const calculateJob = (job: JobInput, rates: IncentiveRates): JobRecord => {
  const totalCollected = calculateTotalCollected(job.charges);
  const balanceToBePaid = calculateBalanceToBePaid(totalCollected);
  const totalBalance = calculateTotalBalance(totalCollected, job.helperSalary);
  const totalIncentive = calculateTotalIncentive(job.charges, rates, job.customIncentives || []);

  return {
    ...job,
    totalCollected,
    balanceToBePaid,
    totalBalance,
    totalIncentive,
  };
};
