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

export const calculateTotalIncentive = (rates: IncentiveRates, customIncentives: CustomIncentive[] = []): number => {
  let total = 0;

  total += toNumber(rates.insCharge.incentive);
  total += toNumber(rates.stand.incentive);
  total += toNumber(rates.whiteTape.incentive);
  total += toNumber(rates.plugTop.incentive);
  total += toNumber(rates.piping.incentive);

  customIncentives.forEach((item) => {
    if (item.applied && toNumber(item.amount) > 0) {
      total += toNumber(item.amount);
    }
  });

  return total;
};

export const calculateJob = (job: JobInput, rates: IncentiveRates): JobRecord => {
  const totalCollected = calculateTotalCollected(job.charges);
  const totalIncentive = calculateTotalIncentive(rates, job.customIncentives || []);
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
