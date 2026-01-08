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
    <select value={locale} onChange={handleChange} className="bg-transparent text-foreground">
      <option value="en" className="text-black dark:text-white bg-white dark:bg-black">
        English
      </option>
      <option value="es" className="text-black dark:text-white bg-white dark:bg-black">
        Español
      </option>
    </select>
  );
}
