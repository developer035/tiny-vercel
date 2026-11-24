import React from 'react';
import Ansi from 'ansi-to-react';

export default function AnsiText({ text }) {
  if (typeof text !== 'string') {
    return <span>{JSON.stringify(text)}</span>;
  }

  return (
    <span className="break-all whitespace-pre-wrap">
      <Ansi useClasses={false}>{text}</Ansi>
    </span>
  );
}
