import type { Gender } from '@/types/game';

export const AVATARS = {
  male: [
    { key: 'male-1', emoji: '👨', label: 'Hombre 1' },
    { key: 'male-2', emoji: '👨‍🦱', label: 'Hombre 2' },
    { key: 'male-3', emoji: '👨‍🦳', label: 'Hombre 3' },
    { key: 'male-4', emoji: '🧔', label: 'Hombre 4' },
    { key: 'male-5', emoji: '👴', label: 'Hombre 5' },
  ],
  female: [
    { key: 'female-1', emoji: '👩', label: 'Mujer 1' },
    { key: 'female-2', emoji: '👩‍🦱', label: 'Mujer 2' },
    { key: 'female-3', emoji: '👩‍🦳', label: 'Mujer 3' },
    { key: 'female-4', emoji: '👧', label: 'Mujer 4' },
    { key: 'female-5', emoji: '👵', label: 'Mujer 5' },
  ],
  other: [
    { key: 'other-1', emoji: '🧑', label: 'Persona 1' },
    { key: 'other-2', emoji: '🧑‍🦱', label: 'Persona 2' },
    { key: 'other-3', emoji: '🧑‍🦳', label: 'Persona 3' },
    { key: 'other-4', emoji: '🧓', label: 'Persona 4' },
    { key: 'other-5', emoji: '👤', label: 'Persona 5' },
  ],
} as const;

export function getDefaultAvatar(gender: Gender): string {
  const avatars = AVATARS[gender];
  return avatars[Math.floor(Math.random() * avatars.length)].key;
}

export function getAvatarEmoji(key?: string): string {
  if (!key) return '👤';
  
  for (const genderAvatars of Object.values(AVATARS)) {
    const found = genderAvatars.find(a => a.key === key);
    if (found) return found.emoji;
  }
  
  return '👤';
}

export function getAvatarsByGender(gender: Gender) {
  return AVATARS[gender];
}
