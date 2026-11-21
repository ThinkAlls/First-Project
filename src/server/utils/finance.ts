import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  expenseTransactions,
  incomeTransactions,
  mosqueAssets,
  mosqueSettings,
  zakatDistributions,
} from '../../db/schema.ts';

export type FundType = 'mosque_cash' | 'zakat_fitrah' | 'zakat_mal';

export interface FundBalances {
  mosqueCash: {
    opening: number;
    income: number;
    expense: number;
    balance: number;
  };
  zakatFitrah: {
    opening: number;
    income: number;
    distributed: number;
    balance: number;
  };
  zakatMal: {
    opening: number;
    income: number;
    distributed: number;
    balance: number;
  };
  totalZakatCollected: number;
  totalZakatDistributed: number;
  totalZakatRemaining: number;
  mosqueAssets: {
    totalItems: number;
    totalQuantity: number;
    totalNominalValue: number;
  };
}

export function generateTxNumber(prefix: 'INC' | 'EXP' | 'ZKT' | 'DST' | 'AST'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ts = String(now.getTime()).slice(-4);
  return `${prefix}-${y}${m}${d}-${ts}${rand}`;
}

export function resolveFundTypeForCategory(categoryName: string, requestedFundType?: string): FundType {
  const normalized = categoryName.trim().toLowerCase();
  if (normalized === 'zakat fitrah' || normalized === 'zakat_fitrah') {
    return 'zakat_fitrah';
  }
  if (normalized === 'zakat mal' || normalized === 'zakat_mal') {
    return 'zakat_mal';
  }
  if (
    normalized === 'infak' ||
    normalized === 'sedekah' ||
    normalized === 'donasi umum' ||
    normalized === 'kotak amal' ||
    normalized === 'sumbangan operasional'
  ) {
    return 'mosque_cash';
  }
  if (requestedFundType === 'zakat_fitrah' || requestedFundType === 'zakat_mal' || requestedFundType === 'mosque_cash') {
    return requestedFundType;
  }
  return 'mosque_cash';
}

export async function getFundBalances(executor: typeof db | any = db): Promise<FundBalances> {
  const settingsRows = await executor.select().from(mosqueSettings).limit(1);
  const settings = settingsRows[0];

  const openCash = Number(settings?.initialCashBalance ?? 0);
  const openFitrah = Number(settings?.initialZakatFitrahBalance ?? 0);
  const openMal = Number(settings?.initialZakatMalBalance ?? 0);

  const incomeTotals = await executor
    .select({
      fundType: incomeTransactions.fundType,
      total: sql<string>`COALESCE(SUM(${incomeTransactions.amount}), 0)`,
    })
    .from(incomeTransactions)
    .where(eq(incomeTransactions.transactionStatus, 'verified'))
    .groupBy(incomeTransactions.fundType);

  const expenseTotals = await executor
    .select({
      total: sql<string>`COALESCE(SUM(${expenseTransactions.amount}), 0)`,
    })
    .from(expenseTransactions)
    .where(eq(expenseTransactions.transactionStatus, 'approved'));

  const distTotals = await executor
    .select({
      zakatType: zakatDistributions.zakatType,
      total: sql<string>`COALESCE(SUM(${zakatDistributions.amount}), 0)`,
    })
    .from(zakatDistributions)
    .where(eq(zakatDistributions.status, 'approved'))
    .groupBy(zakatDistributions.zakatType);

  const incMap: Record<string, number> = {};
  for (const row of incomeTotals) {
    incMap[row.fundType] = Number(row.total ?? 0);
  }

  const distMap: Record<string, number> = {};
  for (const row of distTotals) {
    distMap[row.zakatType] = Number(row.total ?? 0);
  }

  const cashIncome = incMap['mosque_cash'] ?? 0;
  const cashExpense = Number(expenseTotals[0]?.total ?? 0);
  const cashBalance = openCash + cashIncome - cashExpense;

  const fitrahIncome = incMap['zakat_fitrah'] ?? 0;
  const fitrahDist = distMap['zakat_fitrah'] ?? 0;
  const fitrahBalance = openFitrah + fitrahIncome - fitrahDist;

  const malIncome = incMap['zakat_mal'] ?? 0;
  const malDist = distMap['zakat_mal'] ?? 0;
  const malBalance = openMal + malIncome - malDist;

  const assetTotals = await executor
    .select({
      totalItems: sql<string>`COUNT(*)`,
      totalQuantity: sql<string>`COALESCE(SUM(${mosqueAssets.quantity}), 0)`,
      totalNominalValue: sql<string>`COALESCE(SUM(${mosqueAssets.nominalValue}), 0)`,
    })
    .from(mosqueAssets)
    .where(eq(mosqueAssets.isActive, true));

  return {
    mosqueCash: {
      opening: openCash,
      income: cashIncome,
      expense: cashExpense,
      balance: cashBalance,
    },
    zakatFitrah: {
      opening: openFitrah,
      income: fitrahIncome,
      distributed: fitrahDist,
      balance: fitrahBalance,
    },
    zakatMal: {
      opening: openMal,
      income: malIncome,
      distributed: malDist,
      balance: malBalance,
    },
    totalZakatCollected: fitrahIncome + malIncome,
    totalZakatDistributed: fitrahDist + malDist,
    totalZakatRemaining: fitrahBalance + malBalance,
    mosqueAssets: {
      totalItems: Number(assetTotals[0]?.totalItems ?? 0),
      totalQuantity: Number(assetTotals[0]?.totalQuantity ?? 0),
      totalNominalValue: Number(assetTotals[0]?.totalNominalValue ?? 0),
    },
  };
}
