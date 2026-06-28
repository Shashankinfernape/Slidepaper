import { X } from 'lucide-react';

export default function LegalModal({ type, onClose }) {
  if (!type) return null;

  const getContent = () => {
    switch (type) {
      case 'privacy':
        return {
          title: 'Privacy Policy',
          content: (
            <>
              <p>Last updated: June 28, 2026</p>
              <h3>1. Information We Collect</h3>
              <p>At Slidepapers, accessible from slidepapers.vercel.app, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Slidepapers and how we use it.</p>
              
              <h3>2. Log Files and Analytics</h3>
              <p>Slidepapers follows a standard procedure of using log files and client-side anonymous session caching. The information collected includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and number of views to analyze trends and administer the site.</p>
              
              <h3>3. Google AdSense & Cookies</h3>
              <p>Google is a third-party vendor on our site. It uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to slidepapers.vercel.app and other sites on the internet. Visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy.</p>
              
              <h3>4. Third Party Privacy Policies</h3>
              <p>Slidepapers's Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information.</p>
            </>
          )
        };
      case 'terms':
        return {
          title: 'Terms of Service',
          content: (
            <>
              <p>Last updated: June 28, 2026</p>
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing and using Slidepapers (slidepapers.vercel.app), you accept and agree to be bound by the terms and provision of this agreement.</p>
              
              <h3>2. Intellectual Property & License</h3>
              <p>Unless otherwise stated, all digital wallpaper artwork hosted on Slidepapers is distributed under Creative Commons or explicit creator permissions for personal desktop wallpaper display purposes.</p>
              
              <h3>3. Prohibited Conduct</h3>
              <p>You agree not to use the automated downloader or API services to scrape, mirror, or systematically harvest wallpaper packages for commercial redistribution without creator authorization.</p>
            </>
          )
        };
      case 'dmca':
        return {
          title: 'DMCA & Copyright Policy',
          content: (
            <>
              <h3>Copyright Infringement Notification</h3>
              <p>Slidepapers respects the intellectual property rights of creators and artists. If you believe that your work has been copied in a way that constitutes copyright infringement, please contact our DMCA Agent with the following information:</p>
              <ul>
                <li>A description of the copyrighted work that you claim has been infringed.</li>
                <li>The specific URL or bundle link where the material is located.</li>
                <li>Your contact information including email address and physical address.</li>
              </ul>
              <p>Takedown notices should be emailed to: <strong>support@slidepapers.vercel.app</strong></p>
            </>
          )
        };
      case 'about':
        return {
          title: 'About Slidepapers',
          content: (
            <>
              <h3>The Desktop Wallpaper Continuity Hub</h3>
              <p>Slidepapers is a curated platform engineered for digital artists and desktop enthusiasts. We specialize in high-resolution multi-monitor sequences, panoramic ultrawide wallpapers, and custom aspect ratio cropping tools built for modern workspace setups.</p>
              <p>Our mission is to empower digital creators to showcase multi-screen artwork sequences while providing users with instantaneous, lossless wallpaper customization tools.</p>
            </>
          )
        };
      case 'contact':
        return {
          title: 'Contact Us',
          content: (
            <>
              <h3>Get in Touch</h3>
              <p>Have questions, feedback, or creator partnership inquiries? Reach out to our team:</p>
              <p><strong>Email:</strong> support@slidepapers.vercel.app</p>
              <p><strong>Creator Portal:</strong> Authenticate via Google to access the Admin Dashboard and submit wallpaper bundles directly.</p>
            </>
          )
        };
      default:
        return { title: '', content: null };
    }
  };

  const { title, content } = getContent();

  return (
    <div className="bundle-auth-popup-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="bundle-auth-popup" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '650px', width: '90%', maxHeight: '85vh', overflowY: 'auto', textAlign: 'left', padding: '2rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{title}</h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="legal-modal-body" style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {content}
        </div>
      </div>
    </div>
  );
}
