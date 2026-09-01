export interface Phone {
  id: number;
  name_model: string;
  imei: string;
  buy_price: number;
  buy_date: string;
  status: "unsold" | "sold";
  created_at: string;
  // Optional — populated when the phone was added via the Buy tab
  ram_rom?: string | null;
  battery_health?: string | null;
  bought_from?: string | null;
  phone_number?: string | null;
  nid?: string | null;
}

export interface Sale {
  id: number;
  phone_id: number;
  selling_price: number;
  selling_date: string;
  profit: number;
  is_due: number;
  customer_name: string | null;
  customer_phone: string | null;
  due_amount: number;
  paid_amount: number;
  created_at: string;
  // joined
  name_model?: string;
  imei?: string;
  buy_price?: number;
}

export interface DuePayment {
  id: number;
  sale_id: number;
  amount: number;
  paid_date: string;
  note: string | null;
}

export interface OutsideDeal {
  id: number;
  // Outside Sell is now a standalone 3-field profit log (Model, IMEI,
  // Profit) — most other columns are legacy from the old staged-Buy flow
  // and stay optional/unused for new rows.
  name: string;
  model: string | null;
  imei: string | null;
  ram_rom: string | null;
  bought_from: string | null;
  buy_price: number;
  nid: string | null;
  phone_number: string | null;
  status: "unsold" | "sold";
  sell_price: number | null;
  profit: number;
  customer_name: string | null;
  customer_phone: string | null;
  deal_date: string; // legacy buy date
  sell_date: string | null;
  created_at: string;
}

export interface DashboardSummary {
  total_cash: number;
  today_sale: number;
  total_buy: number;
  stock_count: number;
  profit_till_now: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  designation: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  category_id: number;
  amount: number;
  expense_date: string;
  note: string | null;
  created_at: string;
  category_name?: string;
}

export interface Gadget {
  id: number;
  buy_name: string;
  buy_price: number;
  quantity: number; // total units originally bought — never edited afterwards
  created_at: string;
  // joined — how many of those units have been sold so far, and the
  // resulting revenue/profit from just those sold units
  sold_count?: number;
  total_sell?: number;
  total_profit?: number;
}

export interface GadgetSale {
  id: number;
  gadget_id: number;
  sell_price: number;
  profit: number;
  sold_at: string;
}

export interface Loan {
  id: number;
  direction: "taken" | "given";
  person_name: string;
  amount: number;
  paid_amount: number;
  loan_date: string;
  status: "pending" | "settled";
  settled_date: string | null;
  created_at: string;
}

export interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number;
  paid_date: string;
  note: string | null;
}

export interface NetProfitSummary {
  from: string;
  to: string;
  stock_profit: number;
  outside_profit: number;
  total_expense: number;
  total_due_outstanding: number;
  net_profit: number;
  stock_sales_count: number;
  outside_deals_count: number;
}
