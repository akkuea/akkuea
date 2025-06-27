import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ProfileFormProps {
  name: string;
  username: string;
  bio: string;
  onNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onBioChange: (value: string) => void;
}

export const ProfileForm = ({
  name,
  username,
  bio,
  onNameChange,
  onUsernameChange,
  onBioChange,
}: ProfileFormProps) => {
  return (
    <>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <Input
          id="username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
          Bio
        </label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          className="mt-1"
          rows={4}
        />
      </div>
    </>
  );
}; 