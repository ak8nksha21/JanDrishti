import React from 'react';

/**
 * Surface card container with crisp white background, restrained warm brown border, and subtle shadow
 */
export default function Card({
  children,
  className = '',
  hover = false,
  glow = false,
  ...props
}) {
  return (
    <div
      className={`rounded-2xl border border-[#D8CBB6] bg-white shadow-xs transition-all duration-200 ${
        hover ? 'hover:border-[#44312A] hover:shadow-md' : ''
      } ${
        glow ? 'border-[#504F47] shadow-sm shadow-[#44312A]/10' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`p-5 pb-3 border-b border-[#D8CBB6] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`text-sm font-bold tracking-wide text-[#44312A] uppercase ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-[#504F47] mt-1 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`p-4 pt-3 border-t border-[#D8CBB6] bg-[#FAF7F2] rounded-b-2xl ${className}`} {...props}>
      {children}
    </div>
  );
}
