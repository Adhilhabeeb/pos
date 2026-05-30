export interface Variant {
  vId: string;
  price: number;
  mrp: number;
  stockQty: number;
  unitValue: string;
  unit: string;
  tax: number;
}

export interface Product {
  id: string;
  name: string;
  cat: string;
  categoryCode: string;
  price: number;
  mrp: number;
  pic: string;
  details: string;
  variants: Variant[];
}

export interface CartItem {
  id: string;
  vId: string;
  name: string;
  price: number;
  mrp: number;
  unit: string;
  unitValue: string;
  tax: number;
  qty: number;
  variantName?: string;
}

export interface HeldOrder {
  id: string;
  time: string;
  items: CartItem[];
  total: number;
}

export interface Category {
  code: string;
  name: string;
}
