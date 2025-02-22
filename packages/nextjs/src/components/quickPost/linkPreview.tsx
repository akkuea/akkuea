import { useEffect, useState } from 'react';

interface LinkPreviewProps {
  url: string;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [metadata, setMetadata] = useState<{
    title: string;
    description: string;
    image: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`/api/fetchMetadata?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch metadata');

        const data = await response.json();
        setMetadata(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) return <div className="text-sm text-gray-500">Loading preview...</div>;
  if (error) return <div className="text-red-500 text-sm">⚠️ Unable to load link preview</div>;

  return metadata ? (
    <div className="border rounded-lg p-2 mt-2 flex gap-2 items-center">
      {metadata.image && (
        <img src={metadata.image} alt="Preview" className="w-16 h-16 object-cover rounded-md" />
      )}
      <div>
        <p className="font-semibold text-sm">{metadata.title}</p>
        <p className="text-xs text-gray-500">{metadata.description}</p>
      </div>
    </div>
  ) : null;
};

export default LinkPreview;
