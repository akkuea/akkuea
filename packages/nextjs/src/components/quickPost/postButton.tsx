import { Paperclip } from "lucide-react";

interface PostButtonProps {
  onClick: () => void;
  disabled?: boolean;
  onUpload: (files: File[]) => void;
}

const PostButton: React.FC<PostButtonProps> = ({ onClick, disabled, onUpload }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    onUpload(files);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`bg-[#59C9D0] text-white px-4 py-2 rounded-md font-medium ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[#45AAB1]"
        }`}
      >
        Post
      </button>
      <label className="cursor-pointer text-gray-500 hover:text-gray-700">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange} 
        />
        <Paperclip className="w-5 h-5" />
      </label>
    </div>
  );
};

export default PostButton;
