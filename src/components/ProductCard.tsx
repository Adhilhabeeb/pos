import React from 'react';
import { Product } from '../types';
import { PlusCircle } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product, event: React.MouseEvent<HTMLElement>) => void;
  isThemeLight?: boolean;
}

export default function ProductCard({ product, onSelect, isThemeLight }: ProductCardProps) {
  const defaultEmoji = "📦";

  return (
    <article
      id={`product-card-${product.id}`}
      onClick={(e) => onSelect(product, e)}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border p-1.5 sm:p-2.5 shadow-2xs transition-[transform,box-shadow] duration-150 active:scale-97 select-none cursor-pointer ${
        isThemeLight 
          ? 'border-stone-200 bg-white hover:border-blue-500 hover:shadow-xs' 
          : 'border-slate-800 bg-slate-900/30 hover:border-blue-500/50 hover:bg-slate-900/40'
      }`}
    >
      {/* Subtle background color overlay */}
      <div className="absolute inset-0 bg-blue-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none" />

      {/* Image / Fallback Container - super-dense design */}
      <div className={`relative mb-1 flex items-center justify-center rounded bg-stone-50/70 border-stone-100 dark:bg-slate-950/40 dark:border-slate-850/50 aspect-square max-h-[60px] xs:max-h-[75px] sm:max-h-[90px] w-full overflow-hidden border transition-colors mx-auto`}>
        {product.pic ? (
          <img
            src={product.pic}
            alt={product.name}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-120"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center text-xl group-hover:scale-105 transition-transform duration-120">
            {defaultEmoji}
          </div>
        )}

        {/* Floating Category Tag - compact */}
        <span className={`absolute top-0.5 left-0.5 rounded px-1 py-0.2 text-[7px] font-extrabold uppercase tracking-wider border ${
          isThemeLight 
            ? 'bg-stone-50 text-stone-500 border-stone-150' 
            : 'bg-slate-950 text-slate-500 border-slate-800'
        }`}>
          {product.cat}
        </span>

        {/* Variants count pill overlay - compact */}
        {product.variants && product.variants.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-blue-600 px-1 py-0.2 text-[7px] font-black uppercase tracking-wide text-white shadow-2xs">
            {product.variants.length} SKU
          </span>
        )}
      </div>

      {/* Info Block - unified height to align components perfectly & densely */}
      <div className="flex flex-col flex-1 min-w-0">
        <h4 className={`font-sans text-[10px] sm:text-xs font-semibold leading-tight tracking-tight line-clamp-1 sm:line-clamp-2 min-h-[14px] sm:min-h-[28px] uppercase transition-colors ${
          isThemeLight ? 'text-stone-900 group-hover:text-blue-600' : 'text-slate-100 group-hover:text-blue-400'
        }`}>
          {product.name}
        </h4>
        
        {product.details ? (
          <p className={`mt-0.5 text-[8.5px] truncate leading-none ${
            isThemeLight ? 'text-stone-400' : 'text-slate-500'
          }`}>
            {product.details}
          </p>
        ) : (
          <div className="h-[10px]"></div>
        )}
      </div>

      {/* Pricing / CTA row - compact and fully integrated */}
      <div className={`mt-1 flex items-center justify-between pt-1.5 border-t ${
        isThemeLight ? 'border-stone-100' : 'border-slate-850/50'
      }`}>
        <div className="flex flex-col min-w-0">
          <span className={`font-mono text-xs font-extrabold tracking-tight shrink-0 ${
            isThemeLight ? 'text-green-600' : 'text-green-400'
          }`}>
            ₹{product.price.toFixed(2)}
          </span>
          {product.mrp > product.price ? (
            <span className={`font-mono text-[8px] line-through truncate leading-none ${
              isThemeLight ? 'text-stone-400' : 'text-slate-600'
            }`}>
              ₹{product.mrp.toFixed(2)}
            </span>
          ) : (
            <span className="text-[8px] text-transparent select-none leading-none">m</span>
          )}
        </div>

        {/* Visual Cue - Styled div to prevent nested button click swallowing */}
        <div
          className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded transition-all duration-120 ${
            isThemeLight 
              ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' 
              : 'bg-blue-500/15 text-blue-400 group-hover:bg-blue-500 group-hover:text-white'
          }`}
        >
          <PlusCircle className="h-3.5 w-3.5 stroke-[2.5]" />
        </div>
      </div>
    </article>
  );
}
