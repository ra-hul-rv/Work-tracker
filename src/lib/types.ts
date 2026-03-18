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

export type Charges = {
  insCharge: number;
  stand: number;
  whiteTape: number;
  plugTop: number;
  piping: number;
  extraWork: number;
  woOutdoorCharge: number;
  amountPaid: number;
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
  "amountPaid",
];
