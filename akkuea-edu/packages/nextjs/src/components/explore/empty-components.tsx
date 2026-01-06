import { Search } from 'lucide-react';

const EmptyState = () => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-muted/20 rounded-full mx-auto mb-4 flex items-center justify-center">
        <Search className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
      <p className="text-muted">Try adjusting your search or browse popular topics instead.</p>
    </div>
  );
};

export default EmptyState;
