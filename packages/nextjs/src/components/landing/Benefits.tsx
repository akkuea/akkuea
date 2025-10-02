import Image from 'next/image';
import Link from "next/link";

const Benefits = () => {
  const benefits = [
    {
      index: '1',
      title: 'Fair Rewards',
      description:
        'Educators and contributors earn transparent rewards through Stellar blockchain.',
    },
    {
      index: '2',
      title: 'Verified Knowledge',
      description: 'Content is community-validated, ensuring accuracy and trust.',
    },
    {
      index: '3',
      title: 'AI-Powered Discovery',
      description: 'Smart recommendations help learners find exactly what they need.',
    },
    {
      index: '4',
      title: 'Global & Open Access',
      description: 'Breaking barriers to provide knowledge for everyone, everywhere.',
    },
  ];
  return (
    <div className="py-20 px-6 md:px-16 lg:px-32">
      <div className="flex flex-col-reverse md:flex-row gap-12 items-center justify-center">
        {/* Image section */}
        <div className="flex-shrink-0">
          <Image
            src="/benefits.png"
            alt="img"
            width={472}
            height={410}
            className="w-full max-w-sm md:max-w-md"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 384px, 448px"
          />
        </div>

        {/* Text section */}
        <div className="flex flex-col gap-8 w-full max-w-lg">
          <div className="flex flex-col gap-3">
            <h1 className="font-bold text-2xl md:text-4xl text-black dark:text-foreground">
              The Benefits of <span className="text-[#5EEAD4] dark:text-primary">Akkuea</span>
            </h1>
            <p className="text-[#737373] dark:text-muted text-sm md:text-base">
              Akkuea empowers learners and educators with a decentralized, transparent, and
              collaborative platform built on Stellar.
            </p>
          </div>

          {/* Benefits list */}
          <div className="flex flex-col gap-4">
            {benefits.map((item) => (
              <div key={item.index} className="flex gap-3 items-start">
                <div className="bg-[#5EEAD4] dark:bg-primary rounded-full px-3 py-[5.45px] flex items-center justify-center text-[14px] text-white dark:text-primary-foreground font-semibold">
                  {item.index}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[#0A0A0A] dark:text-foreground text-lg font-semibold">
                    {item.title}
                  </div>
                  <div className="text-[#737373] dark:text-muted text-sm">{item.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 items-center">
            <Link href="/home">
              <button className="rounded-[10px] py-2.5 px-6 bg-[#5EEAD4] dark:bg-primary text-white dark:text-primary-foreground text-sm font-medium hover:bg-[#4DD4C1] dark:hover:bg-primary/90 transition-colors">
                Get Started
              </button>
            </Link>

            <button className="rounded-[10px] py-2.5 px-6 text-[#5EEAD4] dark:text-primary border-[1px] border-[#5EEAD4] dark:border-primary bg-white dark:bg-background text-sm font-medium hover:bg-[#F0FDFA] dark:hover:bg-primary/10 transition-colors">
              Read More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Benefits;
