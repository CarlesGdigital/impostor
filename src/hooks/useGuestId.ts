import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const GUEST_ID_KEY = 'topo_guest_id';

export function useGuestId() {
  const [guestId, setGuestId] = useState<string>('');

  useEffect(() => {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    setGuestId(id);
  }, []);

  return guestId;
}
