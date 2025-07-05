import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ActionButtons = ({ onCancel, isSubmitting = false }: ActionButtonsProps) => {
  return (
    <div className="flex justify-end space-x-2">
      <Button type="button" variant="outline" onClick={onCancel} className="text-gray-600">
        Cancel
      </Button>
      <Button
        type="submit"
        className="bg-[#7BDFD1] hover:bg-[#6BCFC1] text-white font-medium px-6 py-2 rounded-md"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};
