// src/lib/contact/contact-info.ts
// Centralized contact directory and payload validation for PromptFM publisher inquiries.

export interface StationContactDepartment {
  key: 'general' | 'support' | 'submissions' | 'legal' | 'advertising';
  name: string;
  email: string;
  description: string;
  sla: string;
}

export const STATION_CONTACTS: StationContactDepartment[] = [
  {
    key: 'general',
    name: 'General & Listener Relations',
    email: 'contact@promptfm.live',
    description: 'General feedback, station feedback, radio ideas, and press inquiries.',
    sla: 'Within 24 to 48 business hours',
  },
  {
    key: 'support',
    name: 'Technical Support & Stream Health',
    email: 'support@promptfm.live',
    description: 'Audio buffering issues, player bugs, web accessibility reports, or bot failures.',
    sla: 'Within 12 to 24 hours',
  },
  {
    key: 'submissions',
    name: 'Music Submissions & Editorial Curation',
    email: 'submissions@promptfm.live',
    description: 'Artist profiles, R2 audio upload assistance, catalog corrections, and curation guidelines.',
    sla: 'Within 2 business days',
  },
  {
    key: 'legal',
    name: 'DMCA & Statutory Copyright Office',
    email: 'dmca@promptfm.live',
    description: '17 U.S.C. § 512 statutory takedown notices, rights holder inquiries, and licensing verifications.',
    sla: 'Expedited review within 24 hours',
  },
  {
    key: 'advertising',
    name: 'Sponsorships & Google AdSense Operations',
    email: 'advertising@promptfm.live',
    description: 'Ad placement inquiries, sponsored artist drops, and publisher compliance notices.',
    sla: 'Within 48 hours',
  },
];

export interface ContactFormPayload {
  name: string;
  email: string;
  department: string;
  subject: string;
  message: string;
}

export interface ContactValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactFormPayload(payload: ContactFormPayload): ContactValidationResult {
  const errors: string[] = [];

  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    errors.push('Full name or creator handle is required.');
  } else if (payload.name.trim().length > 100) {
    errors.push('Name must be 100 characters or fewer.');
  }

  if (!payload.email || typeof payload.email !== 'string' || !EMAIL_REGEX.test(payload.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!payload.subject || typeof payload.subject !== 'string' || payload.subject.trim().length < 3) {
    errors.push('Subject must be at least 3 characters long.');
  } else if (payload.subject.trim().length > 150) {
    errors.push('Subject must be 150 characters or fewer.');
  }

  if (!payload.message || typeof payload.message !== 'string' || payload.message.trim().length < 10) {
    errors.push('Message body must be at least 10 characters long.');
  } else if (payload.message.trim().length > 5000) {
    errors.push('Message body must be 5000 characters or fewer.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
