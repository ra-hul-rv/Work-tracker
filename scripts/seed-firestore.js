/*
Seed Firestore with sample AC job data.

Requirements:
- Download a Firebase service account JSON (Project Settings -> Service Accounts -> Generate new key).
- Save it as ./serviceAccountKey.json (or set GOOGLE_APPLICATION_CREDENTIALS to its path).
- Run: npm install
- Then: npm run seed:firestore

This writes to the "jobs" collection. Adjust rules accordingly.
*/

/* eslint-disable @typescript-eslint/no-require-imports */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

const rates = {
  insCharge: 900,
  stand: 500,
  whiteTape: 50,
  plugTop: 150,
  piping: 200,
};

const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const calc = (job) => {
  const c = job.charges;
  const totalCollected =
    toNumber(c.insCharge) +
    toNumber(c.stand) +
    toNumber(c.whiteTape) +
    toNumber(c.plugTop) +
    toNumber(c.piping) +
    toNumber(c.extraWork) +
    toNumber(c.woOutdoorCharge);

  let totalIncentive = 0;
  if (toNumber(c.insCharge) > 0) totalIncentive += rates.insCharge;
  if (toNumber(c.stand) > 0) totalIncentive += rates.stand;
  if (toNumber(c.whiteTape) > 0) totalIncentive += rates.whiteTape;
  if (toNumber(c.plugTop) > 0) totalIncentive += rates.plugTop;
  if (toNumber(c.piping) > 0) totalIncentive += rates.piping;

  const balanceToBePaid = totalCollected - totalIncentive;
  const totalBalance = totalIncentive - toNumber(job.helperSalary);

  return { ...job, totalCollected, balanceToBePaid, totalBalance, totalIncentive };
};

const sampleJobs = [
  {
    date: "2024-12-02",
    type: "Installation",
    customerName: "Sathya Narayana Prasad",
    location: "Aluva SN Puram Vainavelil, Thaikkattukara",
    contact: "7736222759",
    brand: "Voltas SAC 1T 3S INV 123V Vertis Magnum",
    helper: "Anand",
    helperSalary: 1320,
    charges: {
      insCharge: 2000,
      stand: 500,
      whiteTape: 100,
      plugTop: 150,
      piping: 400,
      extraWork: 0,
      woOutdoorCharge: 0,
    },
  },
  {
    date: "2024-12-04",
    type: "Installation",
    customerName: "Excel Example Row",
    location: "Demo Lane",
    contact: "9876543210",
    brand: "Reference to Excel doc example",
    helper: "Helper A",
    helperSalary: 1320,
    charges: {
      insCharge: 900,
      stand: 500,
      whiteTape: 50,
      plugTop: 150,
      piping: 200,
      extraWork: 200,
      woOutdoorCharge: 0,
    },
  },
  {
    date: "2024-12-03",
    type: "Service",
    customerName: "Ayesha Homes",
    location: "Kakkanad Info Park Road",
    contact: "9876501234",
    brand: "LG Split AC service",
    helper: "Ravi",
    helperSalary: 800,
    charges: {
      insCharge: 0,
      stand: 0,
      whiteTape: 0,
      plugTop: 0,
      piping: 0,
      extraWork: 500,
      woOutdoorCharge: 0,
    },
  },
  {
    date: "2024-12-05",
    type: "Installation",
    customerName: "Thomas Villa",
    location: "Edappally",
    contact: "9012309876",
    brand: "Daikin 1.5T inverter",
    helper: "Manu",
    helperSalary: 1000,
    charges: {
      insCharge: 2500,
      stand: 500,
      whiteTape: 50,
      plugTop: 150,
      piping: 600,
      extraWork: 200,
      woOutdoorCharge: 0,
    },
  },
];

async function main() {
  console.log("Seeding sample jobs...");
  for (const job of sampleJobs) {
    const record = calc(job);
    await db.collection("jobs").add({
      ...record,
      createdAt: Date.now(),
      createdAtServer: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Added job for ${job.customerName}`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
