import RightSidebar from '@/components/discovery/right-sidebar';
import LearningHubSidebar from '@/components/learning-hub/learning-hub-sidebar';
import Navbar from '@/components/navbar/navbar';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Navbar />
      <div className="grid grid-cols-[320px_1fr_256px] min-h-screen bg-background text-foreground">
        <LearningHubSidebar />
        <main className="flex justify-center mt-14 px-4 py-8 pl-[4em]">
          <div className="w-full max-w-5xl">{children}</div>
        </main>
        <RightSidebar />
      </div>
    </SidebarProvider>
  );
}
