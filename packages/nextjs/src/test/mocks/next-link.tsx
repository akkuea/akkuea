import React from 'react';

// Mock next/link
const NextLink = ({ href, children, ...props }: any) => {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

export default NextLink;
