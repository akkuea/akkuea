import { useState } from 'react';
import TextInput from '@/components/ui/quickPost/textInput';
import LinkPreview from '@/components/ui/quickPost/linkPreview';
import PostButton from '@/components/ui/quickPost/postButton';

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
    <div className="border border-gray-300 p-4 rounded-lg shadow-sm bg-white w-full max-w-xl">
      <TextInput value={text} onChange={handleTextChange} />
      {link && <LinkPreview url={link} />}

      {images.length > 0 && (
        <div className="flex gap-2 mt-2">
          {images.map((src, index) => (
            <img
              key={index}
              src={src}
              alt={`preview-${index}`}
              className="w-16 h-16 object-cover rounded-md"
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <PostButton
          onClick={handlePost}
          disabled={!text.trim() && images.length === 0}
          onUpload={handleImageUpload}
        />
      </div>
    </div>
  );
};

export default QuickPost;
