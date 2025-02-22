import { useState } from "react";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange }) => {
  const [charCount, setCharCount] = useState(value.length);
  const maxChars = 280;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= maxChars) {
      setCharCount(newText.length);
      onChange(newText);
    }
  };

  return (
    <div className="mb-2">
      <textarea
        className="w-full border rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="What's on your mind?"
        value={value}
        onChange={handleChange}
        rows={3}
      />
      <div className="text-right text-sm text-gray-500">{charCount}/{maxChars}</div>
    </div>
  );
};

export default TextInput;
