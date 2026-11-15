'use client';

// src/components/ContactForm.tsx
// Interactive listener & creator contact intake form with instant validation.

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { STATION_CONTACTS, validateContactFormPayload } from '@/lib/contact/contact-info';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'general',
    subject: '',
    message: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateContactFormPayload(formData);
    if (!validation.valid) {
      setErrorMessage(validation.errors[0] || 'Invalid input');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch message');
      }

      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        department: 'general',
        subject: '',
        message: '',
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error sending message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Message Dispatched Successfully</h3>
        <p className="text-zinc-300 text-sm max-w-md mx-auto">
          Thank you for contacting PromptFM. Your inquiry has been routed to the appropriate station department.
          We typically respond within 24 to 48 business hours.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="px-5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 text-left">
          <label htmlFor="contact-name" className="block text-xs font-semibold text-zinc-300">
            Full Name or Artist Handle <span className="text-emerald-400">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Alex Vance"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label htmlFor="contact-email" className="block text-xs font-semibold text-zinc-300">
            Email Address <span className="text-emerald-400">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="e.g. alex@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <div className="space-y-1.5 text-left">
        <label htmlFor="contact-dept" className="block text-xs font-semibold text-zinc-300">
          Inquiry Department <span className="text-emerald-400">*</span>
        </label>
        <select
          id="contact-dept"
          value={formData.department}
          onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          {STATION_CONTACTS.map((dept) => (
            <option key={dept.key} value={dept.key}>
              {dept.name} ({dept.email})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 text-left">
        <label htmlFor="contact-subject" className="block text-xs font-semibold text-zinc-300">
          Subject <span className="text-emerald-400">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          required
          value={formData.subject}
          onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="Brief summary of your question or report"
          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      <div className="space-y-1.5 text-left">
        <label htmlFor="contact-message" className="block text-xs font-semibold text-zinc-300">
          Message <span className="text-emerald-400">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          placeholder="Provide clear details regarding your inquiry, technical issue, or copyright question..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
      </div>

      <div className="pt-2 text-left">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transmitting...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
