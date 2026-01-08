'use client';

import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { cn } from '@/lib/utils';
import { MenubarProps } from './types';
import { menubarStyles } from './utils';

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  MenubarProps
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn(menubarStyles.root, className)}
    {...props}
  />
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

export default Menubar;
