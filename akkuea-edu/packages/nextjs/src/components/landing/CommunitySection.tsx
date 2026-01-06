/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { MessageCircle, Github } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function CommunitySection() {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedItems, setAnimatedItems] = useState(new Set());
  const sectionRef = useRef(null);

  const communityLinks = [
    {
      id: 'telegram',
      title: 'Join our Telegram',
      description: 'Connect with the community and get real-time updates',
      icon: <MessageCircle className="w-8 h-8 text-primary" />,
      link: 'https://t.me/Akkuea',
      delay: 0,
    },
    {
      id: 'twitter',
      title: 'Follow us on X',
      description: 'Stay updated with our latest news and announcements',
      icon: <TwitterIcon className="w-8 h-8 text-primary" />,
      link: 'https://x.com/Akkuea_Official',
      delay: 200,
    },
    {
      id: 'github',
      title: 'Explore our GitHub',
      description: 'Contribute to our open source development',
      icon: <Github className="w-8 h-8 text-primary" />,
      link: 'https://github.com/akkuea/akkuea',
      delay: 400,
    },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          communityLinks.forEach((link, index) => {
            setTimeout(() => {
              setAnimatedItems((prev) => new Set([...prev, link.id]));
            }, link.delay + 600);
          });
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 px-4 bg-[#F5F7F8] overflow-hidden dark:bg-background"
    >
      <div className="max-w-6xl mx-auto text-center">
        <div
          className={`mb-12 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 dark:text-foreground">
            Join the{' '}
            <span
              className={`text-primary inline-block transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              Akkuea
            </span>{' '}
            Community
          </h2>
          <p
            className={`text-gray-600 text-lg max-w-2xl dark:text-muted mx-auto leading-relaxed transition-all duration-800 delay-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            Akkuea is more than a platform — {"it's"} a movement. Connect with us, share ideas, and
            help us shape the future of decentralized education.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {communityLinks.map((platform, index) => (
            <a
              key={platform.id}
              href={platform.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                bg-white rounded-2xl py-12 px-2 cursor-pointer group
                transition-all duration-700 ease-out dark:bg-card
                hover:shadow-2xl hover:scale-105 hover:-translate-y-2
                ${
                  animatedItems.has(platform.id)
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-12 scale-95'
                }
              `}
              style={{
                transitionDelay: animatedItems.has(platform.id) ? '0ms' : `${platform.delay}ms`,
              }}
            >
              <div className="flex justify-center mb-6">
                <div
                  className={`
                  p-3 bg-[#F0FDFA] rounded-full shadow-sm 
                  transition-all duration-500 ease-out
                  group-hover:shadow-xl group-hover:bg-primary/5 
                  group-hover:scale-110 group-hover:rotate-6
                  ${animatedItems.has(platform.id) ? 'animate-bounce-subtle' : ''}
                `}
                >
                  <div className="transition-transform duration-300 group-hover:scale-110">
                    {platform.icon}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3
                  className={`
                  text-xl font-semibold text-gray-900 
                  transition-all duration-500 delay-100
                  group-hover:text-primary group-hover:scale-105
                  dark:text-foreground
                  ${
                    animatedItems.has(platform.id)
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4'
                  }
                `}
                >
                  {platform.title}
                </h3>
                <p
                  className={`
                  text-gray-600 text-sm leading-relaxed
                  transition-all duration-500 delay-200
                  group-hover:text-gray-700
                  dark:group-hover:text-muted
                  dark:text-muted
                  ${
                    animatedItems.has(platform.id)
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4'
                  }
                `}
                >
                  {platform.description}
                </p>
              </div>

              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 rounded-2xl transition-all duration-500 group-hover:from-primary/5 group-hover:to-transparent opacity-0 group-hover:opacity-100" />

              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
            </a>
          ))}
        </div>
        <div className="absolute -top-10 -left-10 w-20 h-20 bg-primary/5 rounded-full animate-float-slow hidden lg:block" />
        <div className="absolute -bottom-10 -right-10 w-16 h-16 bg-primary/5 rounded-full animate-float-slow-reverse hidden lg:block" />
      </div>

      <style jsx>{`
        @keyframes bounce-subtle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes float-slow {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(5deg);
          }
        }

        @keyframes float-slow-reverse {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(10px) rotate(-5deg);
          }
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite;
        }

        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }

        .animate-float-slow-reverse {
          animation: float-slow-reverse 8s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
