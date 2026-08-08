"use client";

import React from "react";
import { Printer, X } from "lucide-react";

interface ThermalInvoiceProps {
  order: {
    orderNumber: string;
    customerName: string;
    createdAt: string | Date;
    table?: { number: number };
    items: { name: string; quantity: number; price: number }[];
  };
  invoiceNumber: string;
  billingDetails: {
    subtotal: number;
    discountAmount: number;
    gstAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    serviceCharge: number;
    roundOff: number;
    finalAmount: number;
  };
  settings: {
    name: string;
    address: string;
    phone: string;
    currency: string;
  };
  cashierName?: string;
  paymentMethod?: string;
  paperWidth?: "58mm" | "80mm";
  isKitchenCopy?: boolean;
  onClose?: () => void;
}

export default function ThermalInvoice({
  order,
  invoiceNumber,
  billingDetails,
  settings,
  cashierName = "POS Terminal",
  paymentMethod = "UPI",
  paperWidth = "80mm",
  isKitchenCopy = false,
  onClose
}: ThermalInvoiceProps) {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#140b0c] p-6 rounded-xl border border-[#251416] w-full max-w-md flex flex-col gap-4 shadow-modal">
      {/* Visual Controls Toolbar */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416] print:hidden">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Receipt Preview ({paperWidth})
        </span>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-[#201011] border border-[#2d191b] rounded text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PRINT CONTAINER WITH POS ROLL CSS OVERLAYS */}
      <div
        className="bg-white text-black p-4 font-mono text-xs mx-auto shadow-md select-none rounded border border-zinc-200 print:border-0 print:shadow-none"
        style={{
          width: paperWidth === "58mm" ? "219px" : "302px",
          lineHeight: "1.3"
        }}
      >
        {/* Receipt Header */}
        <div className="text-center pb-3 border-b border-dashed border-zinc-400">
          <h2 className="text-sm font-bold tracking-tight uppercase">
            {settings.name}
          </h2>
          <p className="text-[10px] text-zinc-650 mt-0.5 whitespace-pre-line">
            {settings.address}
          </p>
          <p className="text-[10px] text-zinc-650">Ph: {settings.phone}</p>
          
          <h3 className="text-xs font-bold uppercase tracking-wider mt-3 border border-zinc-500 py-0.5 px-2 inline-block">
            {isKitchenCopy ? "KITCHEN DUPLICATE" : "TAX INVOICE"}
          </h3>
        </div>

        {/* Invoice Metadata */}
        <div className="py-3 border-b border-dashed border-zinc-400 text-[10px] flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span>INV NO:</span>
            <span className="font-bold">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>TICKET:</span>
            <span>#{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>DATE:</span>
            <span>
              {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>TABLE:</span>
            <span className="font-bold">TABLE {order.table?.number || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span>CASHIER:</span>
            <span>{cashierName}</span>
          </div>
          {order.customerName && (
            <div className="flex justify-between">
              <span>CUSTOMER:</span>
              <span className="truncate max-w-[120px]">{order.customerName}</span>
            </div>
          )}
        </div>

        {/* Items Grid */}
        <div className="py-3 border-b border-dashed border-zinc-400">
          <div className="flex justify-between text-[10px] font-bold text-zinc-650 mb-1 border-b border-zinc-200 pb-1">
            <span className="w-1/2">ITEM NAME</span>
            <span className="w-1/6 text-center">QTY</span>
            <span className="w-1/3 text-right">AMOUNT</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="w-1/2 break-words leading-tight">{item.name}</span>
                <span className="w-1/6 text-center">{item.quantity}</span>
                <span className="w-1/3 text-right font-bold">
                  ₹{(item.price * item.quantity).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Calculations summary */}
        {!isKitchenCopy && (
          <div className="py-3 border-b border-dashed border-zinc-400 flex flex-col gap-1 text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{billingDetails.subtotal.toFixed(2)}</span>
            </div>
            
            {billingDetails.discountAmount > 0 && (
              <div className="flex justify-between">
                <span>Discounts:</span>
                <span>-₹{billingDetails.discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>CGST (2.5%):</span>
              <span>₹{billingDetails.cgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>SGST (2.5%):</span>
              <span>₹{billingDetails.sgstAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Service Charge (5%):</span>
              <span>₹{billingDetails.serviceCharge.toFixed(2)}</span>
            </div>

            {billingDetails.roundOff !== 0 && (
              <div className="flex justify-between">
                <span>Round Off:</span>
                <span>{billingDetails.roundOff > 0 ? "+" : ""}₹{billingDetails.roundOff.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs font-bold border-t border-zinc-300 pt-1.5 mt-0.5">
              <span>NET BILL TOTAL:</span>
              <span>₹{billingDetails.finalAmount.toFixed(0)}.00</span>
            </div>
          </div>
        )}

        {/* Footer instructions */}
        {!isKitchenCopy && (
          <div className="text-center pt-4 flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-zinc-650 uppercase font-bold tracking-wider">
              Paid via {paymentMethod.replace(/_/g, ' ')}
            </span>
            <div className="w-20 h-20 border border-zinc-250 p-1 bg-white flex items-center justify-center">
              {/* Mock QR for scanning payment details */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=Paid%20Invoice%20${invoiceNumber}`}
                alt="QR Code verification"
                className="w-full h-full"
              />
            </div>
            <p className="text-[9px] text-zinc-550 font-bold uppercase mt-2">
              Thank You! Visit Us Again.
            </p>
          </div>
        )}
      </div>

      {/* CSS stylesheet injected for media print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Target printable block only */
          div[style*="lineHeight: 1.3"] {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
            border: 0;
          }
          div[style*="lineHeight: 1.3"] * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
