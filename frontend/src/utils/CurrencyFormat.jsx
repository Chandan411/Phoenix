import React from 'react';

export default function CurrencyFormat({
  value,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  symbol = '₹',
  className = ''
}) {
  if (value === undefined || value === null || isNaN(Number(value))) return '--';
  const formatted = Number(value).toLocaleString('en-IN', {
    style: 'decimal',
    minimumFractionDigits,
    maximumFractionDigits,
  });
  return <span className={className}>{symbol}{formatted}</span>;
}