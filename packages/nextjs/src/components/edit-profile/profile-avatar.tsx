import { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import ReactTooltip from 'react-tooltip';

export const ProfileAvatar = () => {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder-user.jpg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center space-x-4">
      <Avatar className="w-24 h-24">
        <AvatarImage src={imageUrl} alt="Profile picture" />
        <AvatarFallback className="bg-muted">
          <User className="w-12 h-12" />
        </AvatarFallback>
      </Avatar>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={handleButtonClick}
        data-tip="Change your profile picture"
      >
        Change Profile Picture
      </Button>
      <ReactTooltip place="bottom" effect="solid" />
    </div>
  );
};
