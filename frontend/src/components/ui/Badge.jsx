import React from 'react';

/**
 * Reusable badge component for government / intelligence dashboard status items
 * Styled strictly with Cream #E7DDCA and Dark Brown #44312A palette
 */
export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) {
  const variantStyles = {
    default: 'bg-[#E7DDCA] text-[#44312A] border-[#D8CBB6]',
    primary: 'bg-[#44312A] text-white border-[#44312A] shadow-xs',
    success: 'bg-[#F4EFE6] text-[#44312A] border-[#D8CBB6]',
    warning: 'bg-[#504F47] text-white border-[#504F47]',
    danger: 'bg-[#44312A] text-white border-[#44312A] font-bold',
    info: 'bg-[#FAF7F2] text-[#504F47] border-[#D8CBB6]',
    outline: 'bg-transparent text-[#44312A] border-[#D8CBB6]',
    live: 'bg-[#44312A] text-white border-[#44312A] shadow-xs',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 tracking-wider font-semibold uppercase',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  const dotColors = {
    default: 'bg-[#44312A]',
    primary: 'bg-[#E7DDCA]',
    success: 'bg-[#44312A]',
    warning: 'bg-[#E7DDCA]',
    danger: 'bg-white',
    info: 'bg-[#504F47]',
    live: 'bg-[#E7DDCA] animate-pulse',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColors[variant] || 'bg-current'}`}
        />
      )}
      {children}
    </span>
  );
}
