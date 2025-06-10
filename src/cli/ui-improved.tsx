import { Text, Box } from 'ink';
import Markdown from '@inkkit/ink-markdown';
import React from 'react';

export const StreamingMarkdown = ({iter}: {iter: AsyncIterable<string>}) => {
  const [ content, setContent ] = React.useState('');
  const [ isComplete, setIsComplete ] = React.useState(false);

  React.useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        for await (const chunk of iter) {
          if (canceled) break;
          setContent(prev => prev + chunk);
        }
        setIsComplete(true);
      } catch (error) {
        console.error('Streaming error:', error);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [iter]);

  return (
    <Box flexDirection="column" height="80%" overflow="hidden">
      <Box flexGrow={1} flexShrink={1} overflow="hidden">
        <Markdown>{content}</Markdown>
      </Box>
      {!isComplete && (
        <Box marginTop={1}>
          <Text color="gray">正在生成中...</Text>
        </Box>
      )}
    </Box>
  );
};

// 另一种方案：使用固定高度的滚动容器
export const ScrollableStreamingMarkdown = ({iter}: {iter: AsyncIterable<string>}) => {
  const [ content, setContent ] = React.useState('');
  const [ lines, setLines ] = React.useState<string[]>([]);
  const maxLines = process.stdout.rows ? Math.floor(process.stdout.rows * 0.8) : 20;

  React.useEffect(() => {
    let canceled = false;

    (async () => {
      for await (const chunk of iter) {
        if (canceled) break;
        setContent(prev => {
          const newContent = prev + chunk;
          // 将内容分割成行
          const contentLines = newContent.split('\n');
          
          // 如果行数超过最大限制，只保留最后的行
          if (contentLines.length > maxLines) {
            const visibleLines = contentLines.slice(-maxLines);
            setLines(visibleLines);
            return visibleLines.join('\n');
          } else {
            setLines(contentLines);
            return newContent;
          }
        });
      }
    })();

    return () => {
      canceled = true;
    };
  }, [iter, maxLines]);

  return (
    <Box flexDirection="column" height={maxLines}>
      <Markdown>{content}</Markdown>
    </Box>
  );
};