export type IncentiveRate = {
  originalPrice: number;
  incentive: number;
};

export type IncentiveRates = {
  insCharge: IncentiveRate;
  stand: IncentiveRate;
  whiteTape: IncentiveRate;
  plugTop: IncentiveRate;
  piping: IncentiveRate;
};

export type CustomIncentive = {
  label: string;
  amount: number;
  applied: boolean;
};

export type IncentiveCompany = {
  id: string;
  name: string;
  rates: IncentiveRates;
  customRates: Array<{ label: string; incentive: number }>;
};

export type WorkType = {
  id: string;
  name: string;
};

export type Helper = {
  id: string;
  name: string;
};

export type JobStatus = "pending" | "received" | "to_get";

export type Charges = {
  insCharge: number;
  stand: number;
  whiteTape: number;
  plugTop: number;
  piping: number;
  extraWork: number;
  woOutdoorCharge: number;
};

export type JobInput = {
  date: string;
  type: string;
  customerName: string;
  location: string;
  contact: string;
  brand: string;
  acDetails?: string;
  helper: string;
  helperSalary: number;
  status?: JobStatus;
  amountToGet?: number;
  companyId?: string;
  companyName?: string;
  jobRates?: IncentiveRates;
  charges: Charges;
  customIncentives?: CustomIncentive[];
};

export type JobRecord = JobInput & {
  id?: string;
  totalCollected: number;
  balanceToBePaid: number;
  totalBalance: number;
  totalIncentive: number;
  createdAt?: number;
};

export const INCENTIVE_RATES: IncentiveRates = {
  insCharge: { originalPrice: 900, incentive: 900 },
  stand: { originalPrice: 500, incentive: 500 },
  whiteTape: { originalPrice: 50, incentive: 50 },
  plugTop: { originalPrice: 150, incentive: 150 },
  piping: { originalPrice: 200, incentive: 200 },
};

export const CHARGE_KEYS: Array<keyof Charges> = [
  "insCharge",
  "stand",
  "whiteTape",
  "plugTop",
  "piping",
  "extraWork",
  "woOutdoorCharge",
];
