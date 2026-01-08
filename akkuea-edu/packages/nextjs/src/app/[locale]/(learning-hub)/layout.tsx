import RightSidebar from '@/components/discovery/right-sidebar';
import LearningHubSidebar from '@/components/learning-hub/learning-hub-sidebar';
import Navbar from '@/components/navbar/navbar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true} className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex flex-1 bg-background text-foreground relative">
        <LearningHubSidebar />
        <main className="flex-1 mt-14 px-4 py-8 overflow-x-hidden md:mr-0">
          <div className="w-full max-w-5xl mx-auto">{children}</div>
        </main>
        <RightSidebar />
      </div>
    </SidebarProvider>
  );
}
