import RightSidebar from '@/components/discovery/right-sidebar';
import LearningHubSidebar from '@/components/learning-hub/learning-hub-sidebar';
import Navbar from '@/components/navbar/navbar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Navbar />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr_256px] justify-center w-full min-h-screen bg-background text-foreground">
        <LearningHubSidebar />
        <main className="flex justify-center mt-14 px-2 sm:px-4 py-4 sm:py-8">
          <div className="w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">{children}</div>
        </main>
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>
    </SidebarProvider>
  );
}

