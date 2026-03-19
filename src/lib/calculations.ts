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

export const calculateBalanceToBePaid = (totalCollected: number, totalIncentive: number): number => {
  return totalCollected - totalIncentive;
};

export const calculateTotalBalance = (totalIncentive: number, helperSalary: number): number => {
  return totalIncentive - toNumber(helperSalary);
};

export const calculateTotalIncentive = (charges: Charges, rates: IncentiveRates, customIncentives: CustomIncentive[] = []): number => {
  let total = 0;

  if (toNumber(charges.insCharge) > 0) total += toNumber(rates.insCharge.incentive);
  if (toNumber(charges.stand) > 0) total += toNumber(rates.stand.incentive);
  if (toNumber(charges.whiteTape) > 0) total += toNumber(rates.whiteTape.incentive);
  if (toNumber(charges.plugTop) > 0) total += toNumber(rates.plugTop.incentive);
  if (toNumber(charges.piping) > 0) total += toNumber(rates.piping.incentive);

  customIncentives.forEach((item) => {
    if (item.applied && toNumber(item.amount) > 0) {
      total += toNumber(item.amount);
    }
  });

  return total;
};

export const calculateJob = (job: JobInput, rates: IncentiveRates): JobRecord => {
  const totalCollected = calculateTotalCollected(job.charges);
  const totalIncentive = calculateTotalIncentive(job.charges, rates, job.customIncentives || []);
  const balanceToBePaid = calculateBalanceToBePaid(totalCollected, totalIncentive);
  const totalBalance = calculateTotalBalance(totalIncentive, job.helperSalary);

  return {
    ...job,
    totalCollected,
    balanceToBePaid,
    totalBalance,
    totalIncentive,
  };
};
