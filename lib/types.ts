export interface Phone {
  id: number;
  name_model: string;
  imei: string;
  buy_price: number;
  buy_date: string;
  status: "unsold" | "sold";
  created_at: string;
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
  deal_date: string; // buy date
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
