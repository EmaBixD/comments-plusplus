// FIXME: Questo è un commento reale
const isReady = false;

// TODO: Sistemare la logica del componente
function checkNote(note) {
  // Falsi positivi da ignorare:
  if (!note.text) setTimeout(() => textarea.focus(), 50);
  
  const info = { expired: true };
  const badge = document.createElement('span');
  badge.className = 'note-expiry-badge' + (info?.expired ? ' expired' : '');
  
  const el = document.createElement('div');
  el.className = 'note';
  if (!note) return;
  
  // NOTE: Anche questo è un commento valido [HIGH]
  return el;
}

/* HACK: Multi riga o blocco
   Dovrebbe vederlo
*/
