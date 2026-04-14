import React from 'react';

// TODO: Aggiungere prop types
export function Notifier({ note }) {
  const isTodo = true; // Falso positivo nome variabile

  // FIXME: Questo dovrebbe essere un hook
  return (
    <div className="note">
      {/* NOTE: Inline jsx comment */}
      {/* HACK: Multi riga o commento 
          dentro la vista */}
      <span>
       Il testo "todo" qui non fa niente. 
      </span>
      <p>{!note ? 'Nessuna nota' : note.text}</p>
    </div>
  );
}