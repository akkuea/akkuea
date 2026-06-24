import dynamic from "next/dynamic";

const ViewerSkeleton = () => (
  <div className="aspect-video w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
);

export const PropertyViewer3DDynamic = dynamic(
  () =>
    import("./PropertyViewer3D").then((mod) => ({
      default: mod.PropertyViewer3D,
    })),
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);
