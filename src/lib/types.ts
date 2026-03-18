export type IncentiveRates = {
  insCharge: number;
  stand: number;
  whiteTape: number;
  plugTop: number;
  piping: number;
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
  customRates: Array<{ label: string; value: number }>;
};

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
  acDetails: string;
  helper: string;
  helperSalary: number;
  status?: "pending" | "completed";
  companyId?: string;
  companyName?: string;
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
  insCharge: 900,
  stand: 500,
  whiteTape: 50,
  plugTop: 150,
  piping: 200,
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
