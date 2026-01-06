import React from 'react';

// Mock next/link
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NextLink = ({ href, children, ...props }: any) => {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

export default NextLink;
