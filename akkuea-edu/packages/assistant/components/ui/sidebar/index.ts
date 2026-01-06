// Provider and hooks
export { SidebarProvider } from './SidebarProvider';
export { useSidebar, useSidebarState } from './hooks';

// Main sidebar components
export { default as Sidebar } from './Sidebar';
export { default as SidebarTrigger } from './SidebarTrigger';
export { default as SidebarRail } from './SidebarRail';
export { default as SidebarInset } from './SidebarInset';
export { default as SidebarInput } from './SidebarInput';
export { default as SidebarHeader } from './SidebarHeader';
export { default as SidebarFooter } from './SidebarFooter';
export { default as SidebarSeparator } from './SidebarSeparator';
export { default as SidebarContent } from './SidebarContent';

// Sidebar Group components
export * from './SidebarGroup';

// Sidebar Menu components
export * from './SidebarMenu';

// Types exports
export type { SidebarProps } from './Sidebar';
export type { SidebarMenuButtonProps } from './SidebarMenu/SidebarMenuButton';

// Constants and utilities
export { SIDEBAR_COOKIE_NAME, SIDEBAR_COOKIE_MAX_AGE } from './hooks/useSidebarState';
export { sidebarMenuButtonVariants } from './SidebarMenu/SidebarMenuButton';