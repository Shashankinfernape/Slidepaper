import React, { useState } from 'react';
import { X, Sparkles, ShieldCheck, Key, Lock, ArrowRight } from 'lucide-react';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  API_URL.startsWith('http://') &&
  !API_URL.includes('localhost') &&
  !API_URL.includes('127.0.0.1')
) {
  API_URL = API_URL.replace('http://', 'https://');
}

export default function CuratorApplicationModal({ isOpen, onClose, user, onActivated }) {
  const [loading, setLoading] = useState(false);
  const [unlockingState, setUnlockingState] = useState(false); // Candlelight unlock animation sequence

  if (!isOpen) return null;

  const handleUnlockCurator = async () => {
    setLoading(true);
    setUnlockingState(true);

    try {
      const res = await fetch(`${API_URL}/api/curator/activate-instant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user?.uid })
      });

      const data = await res.json();
      
      // Allow the candlelight unlock animation to play dramatically for 1.8 seconds
      setTimeout(() => {
        setLoading(false);
        if (data.success && onActivated) {
          onActivated(data.user);
        }
      }, 1800);
    } catch (err) {
      console.error('Error activating curator access:', err);
      setLoading(false);
      setUnlockingState(false);
    }
  };

  return (
    <>
      {/* Candlelight Dimming Vignette Backdrop — Dims the entire screen with a warm radial candlelight glow */}
      <div 
        className="candlelight-vignette-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'radial-gradient(ellipse at 85% 5%, rgba(234, 179, 8, 0.14) 0%, rgba(5, 5, 5, 0.92) 65%, rgba(0, 0, 0, 0.97) 100%)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'candleFadeIn 0.3s ease-out'
        }}
      >
        {unlockingState ? (
          /* Candlelight Unlock Animation Card */
          <div 
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2.5rem 2rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              boxShadow: '0 0 50px rgba(234, 179, 8, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              animation: 'unlockPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <div 
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'rgba(234, 179, 8, 0.15)',
                border: '2px solid var(--color-google-yellow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-google-yellow)',
                boxShadow: '0 0 25px rgba(234, 179, 8, 0.4)',
                animation: 'keyGlowPulse 1.2s infinite ease-in-out'
              }}
            >
              <Key size={34} />
            </div>

            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Unlocking Creator Studio...
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-google-yellow)', fontWeight: 600 }}>
              Granting Creator Privileges & Unlocking Menu...
            </p>
          </div>
        ) : (
          /* Curator Unlock Request Card */
          <div 
            className="curator-app-modal"
            style={{
              width: 'min(100%, 28rem)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '2rem 1.75rem',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              animation: 'modalPop 0.25s ease-out'
            }}
          >
            <button 
              className="close-btn" 
              onClick={onClose}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.35rem' }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div 
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--color-google-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto'
                }}
              >
                <Lock size={26} />
              </div>
              <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Unlock Creator Studio
              </h2>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Publish wallpaper drops, access your Creator Studio analytics, and build your subscriber audience.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: 'var(--color-google-yellow)' }} />
                <span>Publish unlimited high-res wallpaper collections</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: 'var(--color-google-yellow)' }} />
                <span>Full Creator Dashboard parity with Admin Studio</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={14} style={{ color: 'var(--color-google-yellow)' }} />
                <span>Track views, downloads, and subscriber growth</span>
              </div>
            </div>

            <button 
              onClick={handleUnlockCurator}
              disabled={loading}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                fontSize: '0.9rem',
                fontWeight: 750,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <span>Unlock Creator Access Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
