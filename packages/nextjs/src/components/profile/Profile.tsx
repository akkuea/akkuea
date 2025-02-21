import React from 'react';
import { Edit, MapPin, Link as LinkIcon, Calendar } from 'lucide-react';

const ProfilePage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-24">
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col md:flex-row items-start gap-6">
       
        <div className="w-full md:w-auto flex flex-col items-center md:items-start">
         
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full ring-4 ring-white bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-lg">
            <svg
              className="w-16 h-16 md:w-20 md:h-20 text-gray-400 transition-transform hover:scale-110 duration-300"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
  
         
          <div className="flex gap-2 mt-4">
            <span className="px-4 py-1.5 bg-teal-50 text-teal-600 rounded-full text-sm font-medium hover:bg-teal-100 transition-colors duration-200">
              Student
            </span>
            <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors duration-200">
              Designer
            </span>
          </div>
        </div>
  
        <div className="flex-1 pt-2 w-full">
         
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 hover:text-teal-600 transition-colors duration-200">
                Jefferson Calderon
              </h1>
              <div className="text-gray-500 font-medium">@xJeffx23</div>
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all duration-200 hover:shadow-sm flex items-center gap-2 text-gray-700">
              <Edit size={16} />
              Edit Profile
            </button>
          </div>
  
         
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1">
              <MapPin size={16} className="text-gray-400" />
              <span>San Francisco, CA</span>
            </div>
            <div className="flex items-center gap-1">
              <LinkIcon size={16} className="text-gray-400" />
              <a href="#" className="text-teal-600 hover:underline">
                portfolio.design
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} className="text-gray-400" />
              <span>Joined September 2023</span>
            </div>
          </div>
  
          
          <div className="flex flex-row gap-8 mb-6">
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900">15</span>
              <span className="text-gray-600 text-sm">posts</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900">1,234</span>
              <span className="text-gray-600 text-sm">followers</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl text-gray-900">567</span>
              <span className="text-gray-600 text-sm">following</span>
            </div>
          </div>
  
          
          <p className="text-gray-700 leading-relaxed">
            I'm a crack designer, I like software engineering and also mixing as a DJ. Passionate
            about creating beautiful and functional digital experiences.
          </p>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ProfilePage;
