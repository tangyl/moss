import { Text } from 'ink';
import Markdown from '@inkkit/ink-markdown';
import React from 'react';

export const StreamingMarkdown = ({iter}: {iter: AsyncIterable<string>}) => {

  const [ content, setContent ] = React.useState('');

  React.useEffect(() => {

    let canceled = false;

    (async () => {
      for await (const chunk of iter) {
        if (canceled) break;
        setContent(prev => prev + chunk);
      }
    })();

    return () => {
      canceled = true;
    };

  }, [iter]);

  return (
    <Text>
      <Markdown>{content}</Markdown>
    </Text>
  );
};

