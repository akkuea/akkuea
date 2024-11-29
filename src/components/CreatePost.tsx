import { useState, useRef } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CreatePostProps {
  onPost: (content: string, image?: File) => void;
}

export default function CreatePost({ onPost }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onPost(content, selectedImage || undefined);
      setContent('');
      setImagePreview(null);
      setSelectedImage(null);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-4">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-light dark:focus:ring-primary-dark min-h-[100px]"
        />
        
        {imagePreview && (
          <div className="relative mt-3">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-60 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-1 bg-gray-900/50 rounded-full hover:bg-gray-900/70"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark"
          >
            <PhotoIcon className="w-6 h-6 mr-2" />
            Add Photo
          </button>
          
          <button
            type="submit"
            disabled={!content.trim()}
            className="px-4 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-full hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post
          </button>
        </div>
      </form>
    </div>
  );
}