/**
 * Точная десятичная арифметика на целых числах.
 *
 * В отчёте сравниваются и суммируются площади и объёмы. Обычные числа с
 * плавающей точкой дают 0.1 + 0.2 = 0.30000000000000004, и проверка «сумма
 * подчинённых строк не больше родительской» начинает врать на границе.
 * Поэтому значения хранятся как целое + степень десяти.
 */
export interface Decimal {
  scale: number;
  units: bigint;
}

const DECIMAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

export const isDecimal = (text: string): boolean => DECIMAL_RE.test(text.trim());

export const parseDecimal = (text: string): Decimal | undefined => {
  const raw = text.trim();
  if (!isDecimal(raw)) return undefined;
  const negative = raw.startsWith('-');
  const body = raw.replace(/^[+-]/, '');
  const [whole, fraction = ''] = body.split('.');
  const units = BigInt((whole || '0') + fraction);
  return { scale: fraction.length, units: negative ? -units : units };
};

const align = (a: Decimal, b: Decimal): [bigint, bigint] => {
  const scale = Math.max(a.scale, b.scale);
  const pow = (d: Decimal): bigint => d.units * 10n ** BigInt(scale - d.scale);
  return [pow(a), pow(b)];
};

export const addDecimal = (a: Decimal, b: Decimal): Decimal => {
  const [x, y] = align(a, b);
  return { scale: Math.max(a.scale, b.scale), units: x + y };
};

export const compareDecimal = (a: Decimal, b: Decimal): number => {
  const [x, y] = align(a, b);
  return x === y ? 0 : x < y ? -1 : 1;
};

export const formatDecimal = (d: Decimal): string => {
  const negative = d.units < 0n;
  const digits = (negative ? -d.units : d.units).toString().padStart(d.scale + 1, '0');
  const whole = digits.slice(0, digits.length - d.scale) || '0';
  const fraction = d.scale > 0 ? '.' + digits.slice(digits.length - d.scale) : '';
  return (negative ? '-' : '') + whole + fraction;
};

export const ZERO: Decimal = { scale: 0, units: 0n };
