import React from 'react';

const EMOJI_LIST = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '😇',
  '🤔', '😏', '😬', '😱', '😢', '😭', '😤', '🤯', '🥳', '🤗',
  '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🙏', '❤️',
  '🔥', '⭐', '💯', '✅', '❌', '⚡', '🎉', '🎊', '📌', '📎',
  '📁', '📄', '✏️', '📝', '💡', '🔔', '🏫', '📚', '🎓', '👨‍🏫',
  '👩‍🏫', '👨‍🎓', '👩‍🎓', '🧑‍💼', '👨‍💼', '👩‍💼', '🤷', '💬', '👀', '🙂',
];

export function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border p-3 w-[280px]" data-testid="emoji-picker" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJI_LIST.map(e => (
          <button key={e} onClick={() => onSelect(e)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded text-base transition-transform hover:scale-125">{e}</button>
        ))}
      </div>
    </div>
  );
}
