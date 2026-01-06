'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MenubarShortcutProps } from './types';
import { menubarStyles } from './utils';

const MenubarShortcut = ({
  className,
  ...props
}: MenubarShortcutProps) => {
  return (
    <span
      className={cn(menubarStyles.shortcut, className)}
      {...props}
    />
  );
};
MenubarShortcut.displayname = 'MenubarShortcut';

export default MenubarShortcut;
