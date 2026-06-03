import React, { ReactNode } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  className?: string;
}

export default function MetricCard({
  id,
  title,
  value,
  icon,
  description,
  className = '',
}: MetricCardProps) {
  let numericValue = 0;
  let prefix = '';
  let suffix = '';
  let isTime = false;
  let isNumeric = false;

  if (typeof value === 'number') {
    numericValue = value;
    isNumeric = true;
  } else if (typeof value === 'string') {
    const cleanVal = value.trim();
    if (cleanVal.endsWith('%')) {
      const parsed = parseInt(cleanVal.slice(0, -1), 10);
      if (!isNaN(parsed)) {
        numericValue = parsed;
        suffix = '%';
        isNumeric = true;
      }
    } else if (cleanVal.includes(':')) {
      const parts = cleanVal.split(':').map(Number);
      if (parts.every(p => !isNaN(p))) {
        isTime = true;
        if (parts.length === 2) {
          numericValue = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          numericValue = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        isNumeric = true;
      }
    } else {
      const parsed = parseFloat(cleanVal);
      if (!isNaN(parsed)) {
        numericValue = Math.round(parsed);
        isNumeric = true;
      }
    }
  }

  const animatedValue = useAnimatedNumber(numericValue, 300);

  const renderValue = () => {
    if (!isNumeric) {
      return value;
    }
    if (isTime) {
      const h = Math.floor(animatedValue / 3600);
      const m = Math.floor((animatedValue % 3600) / 60);
      const s = animatedValue % 60;
      if (h > 0) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${prefix}${animatedValue}${suffix}`;
  };

  return (
    <Card id={id} className={`glass-panel p-4 flex flex-col gap-2 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between p-0">
        <span className="font-display text-[9px] font-bold tracking-wider text-text-secondary uppercase">
          {title}
        </span>
        <div className="text-text-muted">
          {icon}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col gap-1">
        <span className="font-mono text-2xl font-black text-text-primary tracking-tight">
          {renderValue()}
        </span>
        {description && (
          <span className="text-[9px] text-text-muted font-mono leading-none">
            {description}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

