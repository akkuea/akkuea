import Image from 'next/image';

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
          />
        </div>

        {/* Text section */}
        <div className="flex flex-col gap-8 w-full max-w-lg">
          <div className="flex flex-col gap-3">
            <h1 className="font-bold text-2xl md:text-4xl">
              The Benefits of <span className="text-[#5EEAD4]">Akkuea</span>
            </h1>
            <p className="text-[#737373] text-sm md:text-base">
              Akkuea empowers learners and educators with a decentralized, transparent, and
              collaborative platform built on Stellar.
            </p>
          </div>

          {/* Benefits list */}
          <div className="flex flex-col gap-4">
            {benefits.map((item) => (
              <div key={item.index} className="flex gap-3 items-start">
                <div className="bg-[#5EEAD4] rounded-full px-3 py-[5.45px] flex items-center justify-center text-[14px] text-white font-semibold">
                  {item.index}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[#0A0A0A] text-lg font-semibold">{item.title}</div>
                  <div className="text-[#737373] text-sm">{item.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 items-center">
            <button className="rounded-[10px] py-2.5 px-6 bg-[#5EEAD4] text-white text-sm font-medium">
              Get Started
            </button>
            <button className="rounded-[10px] py-2.5 px-6 text-[#5EEAD4] border-[1px] border-[#5EEAD4] bg-white text-sm font-medium">
              Read More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Benefits;
