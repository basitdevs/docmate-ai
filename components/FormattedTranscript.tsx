"use client";

import React from 'react';

interface FormattedTranscriptProps {
  transcript: string;
}

const FormattedTranscript: React.FC<FormattedTranscriptProps> = ({ transcript }) => {
  // If the transcript is empty or just whitespace, show the placeholder.
  if (!transcript || transcript.trim() === "") {
    return <p className='text-slate-400 italic'>Medical conversation transcript will appear here...</p>;
  }

  // This regular expression splits the text by the "**Speaker X:**" pattern,
  // but it keeps the delimiter (the speaker label) in the resulting array.
  const parts = transcript.split(/(\*\*Speaker \d+:\*\*)/g);

  return (
    <div className="text-sm font-mono text-slate-200 leading-relaxed">
      {parts.map((part, index) => {
        // Check if the part is a speaker label
        if (part.match(/\*\*Speaker \d+:\*\*/g)) {
          return (
            <p key={index} className="mt-4 first:mt-0">
              {/* Remove the asterisks and make the label bold and a different color */}
              <strong className="text-blue-300 font-semibold">
                {part.replace(/\*\*/g, '')}
              </strong>
            </p>
          );
        }
        // This is the spoken text that follows the label
        return (
          <span key={index} className="pl-2">
            {part.trim()}
          </span>
        );
      })}
    </div>
  );
};

export default FormattedTranscript;