import React from 'react';
import { CartItem } from '../types';

interface ReceiptPrintProps {
  orderId: string;
  cart: CartItem[];
  paymentMethod: string;
  receivedAmount: number;
  changeDue: number;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
  };
  dateTimeString: string;
  cardRefNo?: string;
}

export default function ReceiptPrint({
  orderId,
  cart,
  paymentMethod,
  receivedAmount,
  changeDue,
  totals,
  dateTimeString,
  cardRefNo,
}: ReceiptPrintProps) {
  return (
    <div 
      id="printable-receipt" 
      className="p-6 font-mono text-xs leading-relaxed text-stone-900 bg-white border border-stone-200 shadow-lg rounded-2xl max-w-[80mm] mx-auto print:border-none print:shadow-none print:rounded-none"
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Brand Icon Header Stamp */}
      <header className="text-center mb-4 flex flex-col items-center">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-black text-white text-base flex items-center justify-center shadow-md tracking-wider mb-2 print:border print:border-indigo-600">
          DN
        </div>
        <h2 className="m-0 text-md font-extrabold uppercase tracking-wider text-stone-900 leading-tight">
          DAILYNEST POS
        </h2>
        <p className="text-[9px] text-blue-600 font-bold m-0 uppercase tracking-widest mt-0.5">
          HIGH SPEED CHECKOUT SYSTEM
        </p>
        <p className="text-[9px] text-stone-500 m-0 font-medium">
          Aalbot Retail Partners Inc.
        </p>
        <p className="text-[8px] text-stone-400 m-0">
          Trivandrum City Circle, India
        </p>
      </header>

      {/* Dotted Divider */}
      <div className="border-t border-dashed border-stone-300 my-3"></div>

      {/* Metadata Panel */}
      <div className="space-y-1 text-[9px] text-stone-600">
        <div className="flex justify-between">
          <span className="font-semibold text-stone-500">INVOICE NO:</span>
          <span className="font-bold text-stone-900">{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-stone-500">DATE & TIME:</span>
          <span className="text-stone-800">{dateTimeString}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-stone-500">PAY METHOD:</span>
          <span className="font-bold text-stone-900 uppercase tracking-wider">{paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-stone-500">TERMINAL ID:</span>
          <span className="text-stone-850">TERM-03D (ONLINE)</span>
        </div>
      </div>

      <div className="border-t border-dashed border-stone-300 my-3"></div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1.8fr_0.6fr_1fr] font-black text-[9px] text-stone-900 uppercase pb-1 border-b border-dotted border-stone-200 tracking-wide">
        <span>Item Description</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Total</span>
      </div>

      {/* Cart Items list */}
      <div className="space-y-2 py-2">
        {cart.map((item, idx) => (
          <div key={`${item.id}_${item.vId || 'default'}_${idx}`} className="grid grid-cols-[1.8fr_0.6fr_1fr] text-[10px] text-stone-800 leading-snug">
            <div className="flex flex-col min-w-0 pr-1">
              <span className="truncate font-semibold text-stone-900">{item.name}</span>
              {item.variantName && (
                <span className="text-[8px] text-blue-600 font-bold tracking-wide uppercase mt-0.5">
                  [{item.variantName}]
                </span>
              )}
            </div>
            <span className="text-stone-500 text-center font-medium">{item.qty}</span>
            <span className="text-right font-bold text-stone-900">₹{(item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-stone-300 my-3"></div>

      {/* Totals Summary */}
      <div className="space-y-1 text-[10px] text-stone-700">
        <div className="flex justify-between">
          <span>GROSS SUBTOTAL:</span>
          <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-rose-600 font-bold">
            <span>SAVINGS DISCOUNT:</span>
            <span>-₹{totals.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>TAX / CGST (INCL):</span>
          <span className="font-medium text-stone-600">₹{totals.tax.toFixed(2)}</span>
        </div>
        
        {/* Grand Total - Beautiful colored container */}
        <div className="flex justify-between font-black text-xs text-blue-900 bg-blue-50/70 border border-blue-105 py-2 px-2.5 rounded-lg mt-3 print:bg-stone-55 print:border-stone-200">
          <span>NET TOTAL DUE:</span>
          <span>₹{totals.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-stone-300 my-3"></div>

      {/* Payment details with gorgeous color blocks */}
      <div className="space-y-1 text-[10px]">
        {paymentMethod.toLowerCase() === 'cash' ? (
          <div className="p-2.5 bg-green-50/60 border border-green-100 rounded-lg text-[9px] space-y-1 print:bg-stone-50 print:border-stone-200">
            <div className="flex justify-between text-green-800">
              <span className="font-semibold">CASH TENDERED:</span>
              <span className="font-bold">₹{receivedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-green-100/70 pt-1 mt-1 text-green-905">
              <span>CHANGE DUE:</span>
              <span className="text-xs font-black">₹{changeDue.toFixed(2)}</span>
            </div>
          </div>
        ) : paymentMethod.toLowerCase() === 'card' ? (
          <div className="p-2.5 bg-indigo-50/75 border border-indigo-100 rounded-lg text-[9px] text-indigo-800 font-bold tracking-wide space-y-1 print:bg-stone-50 print:border-stone-200">
            <div className="flex justify-between">
              <span className="font-semibold text-indigo-700">METHOD:</span>
              <span className="font-bold text-indigo-900">CARD Settle</span>
            </div>
            {cardRefNo && (
              <div className="flex justify-between border-t border-indigo-100/70 pt-1 mt-1 font-mono">
                <span className="font-semibold text-indigo-700">REF NO:</span>
                <span className="text-indigo-950 font-black">{cardRefNo}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-50/75 border border-emerald-100 rounded-lg text-[9px] text-center text-emerald-800 font-bold tracking-wide flex items-center justify-center gap-1.5 print:bg-stone-50 print:border-stone-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>UPI TRANSACTION SECURED & VERIFIED</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-stone-300 my-3"></div>

      {/* Dynamic barcode representation */}
      <div className="my-4 flex flex-col items-center">
        <div 
          className="h-9 w-full flex select-none"
          style={{
            background: 'repeating-linear-gradient(90deg, #1c1917 0px, #1c1917 1.5px, #ffffff 1.5px, #ffffff 4px, #1c1917 4px, #1c1917 5px, #ffffff 5px, #ffffff 7.5px)'
          }}
        />
        <span className="text-[7.5px] font-bold text-stone-400 tracking-widest mt-1.5">*{orderId}*</span>
      </div>

      {/* Footer message */}
      <footer className="text-center text-[8.5px] text-stone-500 mt-4 space-y-1 leading-normal">
        <div className="font-extrabold text-[9.5px] text-indigo-900 uppercase tracking-widest">
          THANK YOU FOR YOUR PATRONAGE!
        </div>
        <div>Please save or bookmark your mobile receipt.</div>
        <div className="text-[7.5px] text-stone-400 font-mono tracking-wider flex items-center justify-center gap-1.5 pt-1">
          <span>POS v4.89</span> • <span className="font-bold">{dateTimeString}</span>
        </div>
      </footer>
    </div>
  );
}

