import HeaderLanding from '@/components/landing/HeaderLanding';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <HeaderLanding />
      <main className="pt-20 bg-[#f5f7f8] dark:bg-background text-black dark:text-foreground">
        {children}
      </main>
    </section>
  );
}
