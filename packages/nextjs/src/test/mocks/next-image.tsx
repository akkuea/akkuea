import React from 'react';

// Mock next/image
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NextImage = ({ src, alt, ...props }: any) => {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} {...props} />;
};

export default NextImage;
