// Tab/Comanda types
export interface Tab {
  id: string;
  establishment_id: string;
  client_id: string | null;
  appointment_id: string | null;
  professional_id: string | null;
  client_name: string;
  status: 'open' | 'closed' | 'cancelled';
  subtotal: number;
  discount_amount: number | null;
  discount_type: string | null;
  total: number;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  created_by: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TabItem {
  id: string;
  tab_id: string;
  product_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_type: 'product' | 'service' | 'custom';
  added_by: string | null;
  created_at: string;
}

export interface TabPayment {
  id: string;
  tab_id: string;
  payment_method_id: string | null;
  payment_method_name: string;
  amount: number;
  installments: number;
  has_interest: boolean;
  interest_amount: number;
  notes: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  establishment_id: string;
  name: string;
  type: 'pix' | 'debit_card' | 'credit_card' | 'cash' | 'other';
  allows_installments: boolean;
  max_installments: number;
  has_interest: boolean;
  interest_rate: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  unit: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TabWithDetails extends Tab {
  items?: TabItem[];
  payments?: TabPayment[];
  professionals?: { name: string } | null;
  clients?: { name: string; phone: string } | null;
}
