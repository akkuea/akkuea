import HeaderLanding from '@/components/landing/HeaderLanding';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <HeaderLanding />
      <main className="pt-20">{children}</main>
    </section>
  );
}
