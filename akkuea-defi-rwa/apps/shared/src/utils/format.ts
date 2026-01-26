export const formatCurrency = (
  value: number,
  locale: string = "en-US",
  currency: string = "USD"
): string => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
};

export const formatPercent = (
  value: number,
  decimals: number = 2,
  locale: string = "en-US"
): string => {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatDate = (
  date: Date | string | number,
  locale: string = "en-US",
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string => {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
};

export const formatRelativeTime = (
  date: Date | string | number,
  locale: string = "en-US"
): string => {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((d.getTime() - now.getTime()) / 1000);

  const formatters: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const { unit, seconds } of formatters) {
    if (Math.abs(diffInSeconds) >= seconds || unit === "second") {
      const value = Math.round(diffInSeconds / seconds);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, "second");
};

export const abbreviateNumber = (
  value: number,
  decimals: number = 1,
  locale: string = "en-US"
): string => {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
};
