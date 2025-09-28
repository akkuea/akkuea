interface PopularTopicsProps {
  topics: string[];
}

const PopularTopics = ({ topics }: PopularTopicsProps) => {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">Popular Topics</h2>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <button
            key={topic}
            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-sm transition-colors duration-300"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PopularTopics;
