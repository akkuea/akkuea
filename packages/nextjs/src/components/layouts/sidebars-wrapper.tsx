'use client';

import dynamic from 'next/dynamic';

const LeftSidebar = dynamic(() => import('@/components/learning-hub/left-sidebar'), {
    ssr: false,
});
const RightSidebar = dynamic(() => import('@/components/learning-hub/right-sidebar'), {
    ssr: false,
});

export function SidebarsWrapper() {
    return (
        <>
            <LeftSidebar />
            <RightSidebar />
        </>
    );
}
