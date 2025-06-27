import type React from 'react';

const AkkueaLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
      width="150"
      height="32"
      viewBox="0 0 150 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="0"
        y="24"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fill="#2A9D8F"
        fontWeight="bold"
      >
        akkuea
      </text>
    </svg>
  );
};

export default AkkueaLogo; 