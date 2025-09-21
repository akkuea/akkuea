'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ChangeEvent } from 'react';

export default function LanguageSwitcher() {
  const router = useRouter();
  const locale = useLocale();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value;
    router.replace(`/${newLocale}`);
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="bg-transparent text-white"
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}