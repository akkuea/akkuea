'use client';

import { useState } from 'react';
import TextInput from '@/components/quickPost/textInput';
import LinkPreview from '@/components/quickPost/linkPreview';
import PostButton from '@/components/quickPost/postButton';
import { Card } from '@/components/ui/card';

const QuickPost = () => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);

  const handleTextChange = (value: string) => {
    setText(value);
    detectLink(value);
  };

  const detectLink = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const foundLinks = text.match(urlRegex);
    setLink(foundLinks ? foundLinks[0] : null);
  };

  const handleImageUpload = (files: File[]) => {
    const imageUrls = files.map((file) => URL.createObjectURL(file));
    setImages(imageUrls);
  };

  const handlePost = () => {
    console.log('Posting:', { text, images, link });
  };

  return (
    <div className="max-w-4xl w-full mx-auto px-8">
      <Card className="p-8 mb-6 dark:bg-black dark:border-gray-800 w-full shadow-lg rounded-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePost();
          }}
          className="space-y-4"
        >
          <TextInput value={text} onChange={handleTextChange} />
          {link && <LinkPreview url={link} />}

          {images.length > 0 && (
            <div className="flex gap-2 mt-2">
              {images.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`preview-${index}`}
                  className="w-24 h-24 object-cover rounded-md"
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <PostButton
              onClick={handlePost}
              disabled={!text.trim() && images.length === 0}
              onUpload={handleImageUpload}
            />
          </div>
        </form>
      </Card>
    </div>
  );
};

export default QuickPost;
