'use client';

import * as React from 'react';
import { ChartContextProps } from './types';

export const ChartContext = React.createContext<ChartContextProps | null>(null);
