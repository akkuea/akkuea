'use client';

import * as React from 'react';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { cn } from '@/lib/utils';
import { MenubarItemProps } from './types';
import { menubarStyles } from './utils';

const MenubarItem = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Item>,
  MenubarItemProps
>(({ className, inset, ...props }, ref) => (
  <MenubarPrimitive.Item
    ref={ref}
    className={cn(menubarStyles.item, inset && 'pl-8', className)}
    {...props}
  />
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

export default MenubarItem;
