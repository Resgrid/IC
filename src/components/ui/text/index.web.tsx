import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';

import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    testID?: string;
  };

const Text = React.forwardRef<React.ElementRef<'span'>, ITextProps>(
  ({ className, isTruncated, bold, underline, strikeThrough, size = 'md', sub, italic, highlight, numberOfLines, ellipsizeMode: _ellipsizeMode, testID, style, ...props }: { className?: string } & ITextProps, ref) => {
    const lineClampStyle: React.CSSProperties | undefined = numberOfLines
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: numberOfLines,
          overflow: 'hidden',
        }
      : undefined;

    return (
      <span
        className={textStyle({
          isTruncated,
          bold,
          underline,
          strikeThrough,
          size,
          sub,
          italic,
          highlight,
          class: className,
        })}
        data-testid={testID}
        {...props}
        style={lineClampStyle ? { ...lineClampStyle, ...style } : style}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
