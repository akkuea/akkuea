'use client';

import { MessageCircle, Github } from 'lucide-react';
import TwitterIcon from '../ui/twitter-icon';
import ReactTooltip from 'react-tooltip';

export default function CommunitySection() {
  const communityLinks = [
    {
      id: 'telegram',
      title: 'Join our Telegram',
      description: 'Connect with the community and get real-time updates',
      icon: <MessageCircle className="w-8 h-8 text-primary" />,
      link: 'https://t.me/Akkuea',
    },
    {
      id: 'twitter',
      title: 'Follow us on X',
      description: 'Stay updated with our latest news and announcements',
      icon: <TwitterIcon className="w-8 h-8 text-primary" />,
      link: 'https://x.com/Akkuea_Official',
    },
    {
      id: 'github',
      title: 'Explore our GitHub',
      description: 'Contribute to our open source development',
      icon: <Github className="w-8 h-8 text-primary" />,
      link: 'https://github.com/akkuea/akkuea',
    },
  ];

  return (
    <section className="py-16 px-4 bg-[#F5F7F8]">
      <div className="max-w-6xl mx-auto text-center">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Join the <span className="text-primary">Akkuea</span> Community
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Akkuea is more than a platform — {"it's"} a movement. Connect with us, share ideas, and
            help us shape the future of decentralized education.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {communityLinks.map((platform) => (
            <a
              key={platform.id}
              href={platform.link}
              target="_blank"
              rel="noopener noreferrer"
              data-tip={platform.title} // <-- Tooltip v4
              className="bg-white rounded-2xl py-12 px-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 group"
            >
              <div className="flex justify-center mb-6">
                <div className="p-3 bg-[#F0FDFA] rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                  {platform.icon}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-gray-900">{platform.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{platform.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
      <ReactTooltip place="bottom" effect="solid" /> {/* <-- Tooltip v4 */}
    </section>
  );
}
