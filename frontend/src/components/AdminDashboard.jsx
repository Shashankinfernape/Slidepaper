import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Folder, HardDrive, Shield, LogOut, ArrowLeft, RefreshCw, 
  CheckCircle2, AlertCircle, FileText, Upload, Plus, Trash2, IndianRupee, HelpCircle, DollarSign, Check, User, X, Users, Clock, MessageSquare, Eye,
  Sparkles, Send, ExternalLink, ShieldAlert, Search
} from 'lucide-react';
import confetti from 'canvas-confetti';
import DraggableGrid from './common/DraggableGrid';
import { useAuth } from '../context/AuthContext';
import MonetizationDashboard from './MonetizationDashboard';
import TransferHUD from './TransferHUD';
import BundleDetailPage from './BundleDetailPage';

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Automatically upgrade HTTP to HTTPS in production to avoid mixed content block on mobile
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:' &&
  API_URL.startsWith('http://') &&
  !API_URL.includes('localhost') &&
  !API_URL.includes('127.0.0.1')
) {
  API_URL = API_URL.replace('http://', 'https://');
}

const AVATAR_FALLBACK_URL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
const AVATAR_CROP_SIZE = 320;

export const getProxiedImageUrl = (url) => {
  if (!url) return '';

  // Force high-resolution for Google profile images
  if (url.includes('googleusercontent.com') && url.includes('=s')) {
    url = url.replace(/=s\d+-c/, '=s800-c');
  }

  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.includes('drive.google.com')) {
    const match = url.match(/[?&]id=([^&]+)/);
    if (match) {
      return `${API_URL}/api/proxy-image?id=${match[1]}`;
    }
  }
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url.replace('http://localhost:5001', API_URL);
};

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCropMetrics(image, zoom) {
  const coverScale = Math.max(
    AVATAR_CROP_SIZE / image.width,
    AVATAR_CROP_SIZE / image.height
  );
  const scale = coverScale * zoom;

  return {
    scale,
    maxOffsetX: Math.max(0, (image.width * scale - AVATAR_CROP_SIZE) / 2),
    maxOffsetY: Math.max(0, (image.height * scale - AVATAR_CROP_SIZE) / 2),
  };
}

function clampCropOffset(offset, image, zoom) {
  if (!image) return offset;

  const { maxOffsetX, maxOffsetY } = getCropMetrics(image, zoom);

  return {
    x: clampValue(offset.x, -maxOffsetX, maxOffsetX),
    y: clampValue(offset.y, -maxOffsetY, maxOffsetY),
  };
}

function drawAvatarCrop(canvas, image, zoom, offset) {
  if (!canvas || !image) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const { scale } = getCropMetrics(image, zoom);
  context.clearRect(0, 0, AVATAR_CROP_SIZE, AVATAR_CROP_SIZE);
  context.fillStyle = '#050505';
  context.fillRect(0, 0, AVATAR_CROP_SIZE, AVATAR_CROP_SIZE);

  context.save();
  context.beginPath();
  context.arc(
    AVATAR_CROP_SIZE / 2,
    AVATAR_CROP_SIZE / 2,
    AVATAR_CROP_SIZE / 2,
    0,
    Math.PI * 2
  );
  context.clip();
  context.translate(
    AVATAR_CROP_SIZE / 2 + offset.x,
    AVATAR_CROP_SIZE / 2 + offset.y
  );
  context.scale(scale, scale);
  context.drawImage(image, -image.width / 2, -image.height / 2);
  context.restore();
}

function MediaPreviewItem({ item, index, removeFile, isDragged }) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    if (item.type === 'new') {
      const url = URL.createObjectURL(item.data);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [item]);

  const imgSrc = item.type === 'existing' ? (item.data.previewUrl || item.data.url) : objectUrl;
  if (!imgSrc) return null;

  return (
    <div 
      style={{ 
        position: 'relative', 
        aspectRatio: '16/10', 
        borderRadius: '6px', 
        overflow: 'hidden', 
        border: isDragged ? '2px solid var(--color-google-blue)' : '1px solid var(--border-color)',
        boxShadow: isDragged ? '0 8px 16px rgba(0,0,0,0.2)' : 'none',
        opacity: isDragged ? 0.9 : 1
      }}
    >
      <img src={imgSrc} alt={item.data.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <button 
        type="button" 
        onClick={(e) => { e.stopPropagation(); removeFile(index); }} 
        style={{ position: 'absolute', top: '4px', right: '4px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Trash2 size={12} />
      </button>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.65rem', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.data.name} {item.type === 'existing' && '(Existing)'}
      </div>
    </div>
  );
}

function CustomDropdown({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (selectedOption && selectedOption.value !== value) {
      onChange(selectedOption.value);
    }
  }, [selectedOption, value, onChange]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        className="admin-modal-input" 
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--bg-primary)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px', zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {options.map((opt) => (
            <div 
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`custom-dropdown-option ${opt.value === value ? 'selected' : ''}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ onBack, logout, isCreatorMode = false }) {
  const { user, userProfile, updateUserProfileState } = useAuth();
  
  // Toast Notification State
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getInitialTab = () => {
    const path = window.location.pathname.toLowerCase();
    const prefix = isCreatorMode ? '/curator/' : '/admin/';
    if (path.startsWith(prefix)) {
      const tab = path.split(prefix)[1].split('/')[0];
      const validTabs = isCreatorMode
        ? ['overview', 'bundles', 'upload', 'profile', 'subscribers']
        : ['overview', 'drive', 'bundles', 'reviews', 'upload', 'monetize', 'profile', 'subscribers', 'creators'];
      if (validTabs.includes(tab)) return tab;
    }
    return isCreatorMode ? 'profile' : 'overview';
  };
  const [activeTab, setActiveTabState] = useState(getInitialTab);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    const prefix = isCreatorMode ? '/curator' : '/admin';
    window.history.pushState(null, '', `${prefix}/${tab}`);
  };

  useEffect(() => {
    const handlePopState = () => setActiveTabState(getInitialTab());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bundles, setBundles] = useState([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [bundleFilter, setBundleFilter] = useState(() => isCreatorMode ? 'mine' : 'all');
  const [driveStatus, setDriveStatus] = useState(null);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [rebuildingCache, setRebuildingCache] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [animatingDeleteId, setAnimatingDeleteId] = useState(null);
  const [subscribersList, setSubscribersList] = useState([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [viewingSubscriberImage, setViewingSubscriberImage] = useState(null);

  // Pending Drops Review States
  const [pendingDrops, setPendingDrops] = useState([]);
  const [loadingPendingDrops, setLoadingPendingDrops] = useState(false);
  const [reviewingDrop, setReviewingDrop] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Creators Management States
  const [creatorsList, setCreatorsList] = useState([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [messagingCreator, setMessagingCreator] = useState(null);
  const [messageTitleInput, setMessageTitleInput] = useState('');
  const [messageBodyInput, setMessageBodyInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [deleteConfirmCreator, setDeleteConfirmCreator] = useState(null);
  const [deleteCreatorBundlesOption, setDeleteCreatorBundlesOption] = useState(false);
  const [isDeletingCreator, setIsDeletingCreator] = useState(false);

  const fetchCreators = async () => {
    setLoadingCreators(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/creators`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCreatorsList(data.creators || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin creators list:', err);
    } finally {
      setLoadingCreators(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'creators') {
      fetchCreators();
    }
  }, [activeTab]);

  const handleSendMessageToCreator = async () => {
    if (!messagingCreator || !messageBodyInput.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/creators/${messagingCreator.uid}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: messageTitleInput || 'Message from Slidepapers Admin',
          message: messageBodyInput
        })
      });
      if (res.ok) {
        showToast(`Message sent to ${messagingCreator.displayName || 'Creator'}!`, 'success');
        setMessagingCreator(null);
        setMessageTitleInput('');
        setMessageBodyInput('');
      } else {
        showToast('Failed to send message', 'error');
      }
    } catch (err) {
      showToast('Error sending message', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteCreator = async () => {
    if (!deleteConfirmCreator?.uid) return;
    setIsDeletingCreator(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/creators/${deleteConfirmCreator.uid}?deleteBundles=${deleteCreatorBundlesOption}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Creator access revoked / deleted', 'success');
        setCreatorsList(prev => prev.filter(c => c.uid !== deleteConfirmCreator.uid));
        if (selectedCreator?.uid === deleteConfirmCreator.uid) setSelectedCreator(null);
        setDeleteConfirmCreator(null);
      } else {
        showToast('Failed to delete creator', 'error');
      }
    } catch (err) {
      showToast('Error deleting creator', 'error');
    } finally {
      setIsDeletingCreator(false);
    }
  };

  const fetchPendingDrops = async () => {
    setLoadingPendingDrops(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/pending-drops`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setPendingDrops(data.bundles || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending drops:', err);
    } finally {
      setLoadingPendingDrops(false);
    }
  };

  const handleReviewAction = async (bundleId, action) => {
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/review-drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId,
          action,
          adminNote: adminNoteInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(action === 'approve' ? 'Drop Approved & Published!' : 'Drop Rejected with feedback note.');
        setPendingDrops(prev => prev.filter(b => b.id !== bundleId));
        setReviewingDrop(null);
        setAdminNoteInput('');
        fetchBundles();
      } else {
        showToast('Review action failed.', 'error');
      }
    } catch (err) {
      showToast('Error completing review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Form states for uploading new bundle
  const [bundleName, setBundleName] = useState('');
  const [bundleDescription, setBundleDescription] = useState('');
  const [bundleOrientation, setBundleOrientation] = useState('landscape');
  const [bundleType, setBundleType] = useState('');
  const [bundleTags, setBundleTags] = useState('');
  const [bundleIncludes, setBundleIncludes] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadHud, setShowUploadHud] = useState(false);
  const [uploadMetrics, setUploadMetrics] = useState({
    progress: 0,
    speedMbps: 0,
    transferredMB: 0,
    totalMB: 0,
    etaSeconds: 0,
    stage: ''
  });
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [bundleRatio, setBundleRatio] = useState('16:9');
  const [customRatioW, setCustomRatioW] = useState('16');
  const [customRatioH, setCustomRatioH] = useState('9');

  // Edit Bundle states
  const [editingBundleId, setEditingBundleId] = useState(null);

  // Form states for profile editing
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedPhotoURL, setEditedPhotoURL] = useState('');
  const [editedAbout, setEditedAbout] = useState('');
  const [editedYoutube, setEditedYoutube] = useState('');
  const [editedInstagram, setEditedInstagram] = useState('');
  const [editedTwitter, setEditedTwitter] = useState('');

  const [editedAccent, setEditedAccent] = useState('midnight');
  const [editedBannerURL, setEditedBannerURL] = useState('');

  // WhatsApp-style Cropper states
  const canvasRef = useRef(null);
  const cropperRef = useRef(null);
  const cropImageRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotate, setCropRotate] = useState(0);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);
  const touchState = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setEditedDisplayName(userProfile.displayName || '');
      setEditedPhotoURL(userProfile.photoURL || '');
      setEditedAbout(userProfile.about || '');
      setEditedYoutube(userProfile.youtubeUrl || '');
      setEditedInstagram(userProfile.instagramUrl || '');
      setEditedTwitter(userProfile.twitterUrl || '');
      setEditedAccent(userProfile.accentGradient || 'midnight');
      setEditedBannerURL(userProfile.bannerURL || '');
    } else if (user) {
      setEditedDisplayName(user.displayName || '');
      setEditedPhotoURL(user.photoURL || '');
    }
  }, [userProfile, user]);

  const resetCropEditor = () => {
    dragState.current = null;
    cropImageRef.current = null;
    setCropZoom(1);
    setCropRotate(0);
    setCropOffset({ x: 0, y: 0 });
  };

  const closeCropper = () => {
    resetCropEditor();
    setImageSrc(null);
  };

  const setCropZoomValue = (value) => {
    const nextZoom = clampValue(value, 1, 4);
    const currentImage = cropImageRef.current;
    setCropZoom(nextZoom);
    setCropOffset((prev) => clampCropOffset(prev, currentImage, nextZoom));
  };

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      resetCropEditor();
      setImageSrc(event.target?.result || null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }

    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_URL}/api/users/upload-avatar`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.photoURL) {
          setEditedBannerURL(data.photoURL);
        }
      }
    } catch (err) {
      console.error('Error uploading channel banner:', err);
    } finally {
      setUploadingBanner(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!imageSrc) return undefined;

    const image = new Image();
    image.onload = () => {
      cropImageRef.current = image;
      drawAvatarCrop(canvasRef.current, image, 1, { x: 0, y: 0 });
    };
    image.src = imageSrc;

    return () => {
      cropImageRef.current = null;
    };
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = cropImageRef.current;
    if (!canvas || !image || !imageSrc) return;

    const clampedOffset = clampCropOffset(cropOffset, image, cropZoom);
    if (
      clampedOffset.x !== cropOffset.x ||
      clampedOffset.y !== cropOffset.y
    ) {
      setCropOffset(clampedOffset);
      return;
    }

    drawAvatarCrop(canvas, image, cropZoom, clampedOffset);
  }, [imageSrc, cropOffset, cropZoom]);

  useEffect(() => {
    if (!imageSrc) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeCropper();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [imageSrc]);

  const onCropMouseDown = (e) => {
    e.preventDefault();
    if (e.touches && e.touches.length > 1) return;
    const point = e.touches ? e.touches[0] : e;
    dragState.current = {
      startX: point.clientX,
      startY: point.clientY,
      startOX: cropOffset.x,
      startOY: cropOffset.y,
    };
  };

  const onCropTouchStart = (e) => {
    if (e.touches.length === 1) {
      onCropMouseDown(e);
    } else if (e.touches.length === 2) {
      dragState.current = null;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchState.current = { startDist: dist, startZoom: cropZoom };
    }
  };

  const onCropMouseMove = (e) => {
    if (e.touches && e.touches.length === 2 && touchState.current) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchState.current.startDist;
      setCropZoomValue(touchState.current.startZoom * factor);
      return;
    }

    if (!dragState.current) return;
    if (e.cancelable) {
      e.preventDefault();
    }

    const point = e.touches ? e.touches[0] : e;
    const nextOffset = {
      x: dragState.current.startOX + (point.clientX - dragState.current.startX),
      y: dragState.current.startOY + (point.clientY - dragState.current.startY),
    };

    setCropOffset(clampCropOffset(nextOffset, cropImageRef.current, cropZoom));
  };

  const onCropMouseUp = (e) => {
    if (e && e.touches && e.touches.length > 0) return;
    dragState.current = null;
    touchState.current = null;
  };

  useEffect(() => {
    window.addEventListener('mousemove', onCropMouseMove);
    window.addEventListener('mouseup', onCropMouseUp);
    window.addEventListener('touchmove', onCropMouseMove, { passive: false });
    window.addEventListener('touchend', onCropMouseUp);
    window.addEventListener('touchcancel', onCropMouseUp);

    return () => {
      window.removeEventListener('mousemove', onCropMouseMove);
      window.removeEventListener('mouseup', onCropMouseUp);
      window.removeEventListener('touchmove', onCropMouseMove);
      window.removeEventListener('touchend', onCropMouseUp);
      window.removeEventListener('touchcancel', onCropMouseUp);
    };
  }, [cropZoom]);

  const onCropWheel = (e) => {
    e.preventDefault();
    setCropZoomValue(cropZoom - e.deltaY * 0.0015);
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setEditedPhotoURL(dataUrl);
    closeCropper();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.png');
      try {
        const res = await fetch(`${API_URL}/api/users/upload-avatar`, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setEditedPhotoURL(data.photoURL);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingAvatar(false);
      }
    }, 'image/png');
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/users/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          displayName: editedDisplayName,
          photoURL: editedPhotoURL,
          about: editedAbout,
          youtubeUrl: editedYoutube,
          instagramUrl: editedInstagram,
          twitterUrl: editedTwitter,
          accentGradient: editedAccent,
          bannerURL: editedBannerURL
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          updateUserProfileState(data.user);
          showToast('Profile updated successfully!', 'success');
        } else {
          showToast('Failed to update profile.', 'error');
        }
      } else {
        showToast('Failed to update profile.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating profile settings.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    setBundleRatio(bundleOrientation === 'landscape' ? '16:9' : '9:16');
  }, [bundleOrientation]);

  useEffect(() => {
    const preventDrag = (e) => e.preventDefault();
    window.addEventListener('dragover', preventDrag);
    window.addEventListener('drop', preventDrag);
    return () => {
      window.removeEventListener('dragover', preventDrag);
      window.removeEventListener('drop', preventDrag);
    };
  }, []);

  // Fetch bundles list from backend database
  const fetchBundles = async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch(`${API_URL}/api/bundles`);
      if (res.ok) {
        const data = await res.json();
        setBundles(data);
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    } finally {
      setLoadingBundles(false);
    }
  };

  // Fetch Drive Status from Express backend
  const checkDriveStatus = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetch(`${API_URL}/api/drive-status`);
      const data = await res.json();
      setDriveStatus(data);
    } catch (error) {
      console.error('Error fetching drive status:', error);
      setDriveStatus({ authenticated: false, error: `Cannot connect to backend server. Make sure it is running at ${API_URL}.` });
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    fetchBundles();
    checkDriveStatus();
    fetchPendingDrops();
  }, []);

  // Fetch subscribers when tab is active
  useEffect(() => {
    if (activeTab === 'subscribers' && userProfile?.uid) {
      setLoadingSubscribers(true);
      fetch(`${API_URL}/api/authors/${userProfile.uid}/subscribers-list`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.subscribers) {
            setSubscribersList(data.subscribers);
          }
          setLoadingSubscribers(false);
        })
        .catch(err => {
          console.error('Failed to fetch subscribers:', err);
          setLoadingSubscribers(false);
        });
    }
  }, [activeTab, userProfile?.uid]);

  // Compute aggregate stats (scoped to logged-in creator if in creator mode)
  const myUploadedBundles = React.useMemo(() => {
    if (!bundles || !bundles.length) return [];
    if (!user) return [];
    return bundles.filter(b => 
      (b.author?.uid && user.uid && String(b.author.uid) === String(user.uid)) ||
      (b.author?.email && user.email && String(b.author.email).toLowerCase() === String(user.email).toLowerCase()) ||
      (b.authorId && user.uid && String(b.authorId) === String(user.uid))
    );
  }, [bundles, user]);

  const targetBundles = isCreatorMode ? myUploadedBundles : bundles;

  const stats = {
    bundlesCount: targetBundles.length,
    totalViews: targetBundles.reduce((acc, b) => acc + (b.stats?.views || 0), 0),
    totalLikes: targetBundles.reduce((acc, b) => acc + (b.stats?.likes || 0), 0),
    totalDownloads: targetBundles.reduce((acc, b) => acc + (b.stats?.downloads || 0), 0),
  };

  // Drag and Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const sortFilesByName = (filesArray) => {
    return [...filesArray].sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    if (files.length > 0) {
      const newItems = sortFilesByName(files).map(f => ({ id: Math.random().toString(36), type: 'new', data: f }));
      setMediaItems(prev => [...prev, ...newItems]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(file => 
      file.type.startsWith('image/')
    );
    if (files.length > 0) {
      const newItems = sortFilesByName(files).map(f => ({ id: Math.random().toString(36), type: 'new', data: f }));
      setMediaItems(prev => [...prev, ...newItems]);
    }
  };

  const removeMediaItem = (indexToRemove) => {
    setMediaItems(prev => prev.filter((_, i) => i !== indexToRemove));
  };


  const handleSetHeroBundle = async (bundleId, bundleName) => {
    try {
      const response = await fetch(`${API_URL}/api/set-hero-bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bundleId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update hero bundle.');
      }

      showToast(`"${bundleName}" pinned as the Home Page Hero successfully!`, 'success');
      // Update local bundles state to reflect the change
      setBundles(prev => prev.map(b => ({
        ...b,
        isHero: b.id === bundleId
      })));
    } catch (err) {
      console.error('Error setting hero bundle:', err);
      showToast(`Setting hero failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteBundle = async (bundleId, bundleName) => {
    try {
      setAnimatingDeleteId(bundleId);
      
      // Wait for the animation to play before removing from DOM
      await new Promise(resolve => setTimeout(resolve, 500));

      // Optimistic UI update: immediately remove from list so others refill
      const originalBundles = [...bundles];
      setBundles(bundles.filter(b => b.id !== bundleId));

      const res = await fetch(`${API_URL}/api/bundles/${bundleId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        setBundles(originalBundles); // revert if failed
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete bundle.');
      }
      showToast(`Bundle "${bundleName}" deleted successfully!`, 'success');
    } catch (err) {
      console.error('Delete bundle error:', err);
      setAnimatingDeleteId(null);
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleRebuildCache = () => {
    setRebuildingCache(true);
    setTimeout(() => {
      setRebuildingCache(false);
      showToast('Zip Cache rebuilt successfully!', 'success');
    }, 1500);
  };

  // Upload form submission
  const handleSubmitBundle = async (e) => {
    e.preventDefault();
    const submitter = e.nativeEvent?.submitter;
    const rect = submitter ? submitter.getBoundingClientRect() : null;
    const existingImages = mediaItems.filter(m => m.type === 'existing').map(m => m.data);
    const newImages = mediaItems.filter(m => m.type === 'new').map(m => m.data);

    if (existingImages.length === 0 && newImages.length === 0) {
      showToast('Please upload or keep at least one image.', 'error');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('name', bundleName);
    formData.append('description', bundleDescription);
    formData.append('orientation', bundleOrientation);
    const finalRatio = bundleRatio === 'custom' ? `${customRatioW}:${customRatioH}` : bundleRatio;
    formData.append('ratio', finalRatio);
    formData.append('type', bundleType || (bundleOrientation === 'landscape' ? 'Landscape Wallpaper Pack' : 'Vertical Mobile Pack'));
    formData.append('tags', bundleTags);
    formData.append('includes', bundleIncludes);
    
    if (editingBundleId) {
      formData.append('existingImages', JSON.stringify(existingImages));
      const finalImageOrder = mediaItems.map(m => ({ type: m.type, url: m.type === 'existing' ? m.data.url : null }));
      formData.append('finalImageOrder', JSON.stringify(finalImageOrder));
    }

    newImages.forEach((file) => {
      formData.append('images', file);
    });

    if (user) {
      formData.append('authorId', user.uid);
      formData.append('authorName', userProfile?.displayName || user.displayName || user.email);
      if (userProfile?.photoURL || user.photoURL) {
        formData.append('authorAvatar', userProfile?.photoURL || user.photoURL);
      }
      if (user.email) {
        formData.append('authorEmail', user.email);
      }
    }

    setShowUploadHud(true);
    setUploadMetrics({
      progress: 5,
      speedMbps: 0,
      transferredMB: 0,
      totalMB: 0,
      etaSeconds: 0,
      stage: 'Preparing image payload & metadata...'
    });

    try {
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      const xhr = new XMLHttpRequest();
      if (editingBundleId) {
        xhr.open('PUT', `${API_URL}/api/bundles/${editingBundleId}`, true);
      } else {
        xhr.open('POST', `${API_URL}/api/bundles/upload`, true);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable || e.total > 0) {
          const totalBytes = e.total;
          const loadedBytes = e.loaded;
          const pct = Math.min(99, Math.max(5, (loadedBytes / totalBytes) * 100));

          const currentTime = Date.now();
          const timeDelta = (currentTime - lastTime) / 1000;

          if (timeDelta >= 0.15) {
            const bytesDelta = loadedBytes - lastLoaded;
            const speedBps = bytesDelta / timeDelta;
            const speedMbps = (speedBps * 8) / (1024 * 1024);
            const remainingBytes = Math.max(0, totalBytes - loadedBytes);
            const eta = speedBps > 0 ? (remainingBytes / speedBps) : 0;

            setUploadMetrics({
              progress: pct,
              speedMbps: Math.max(0.2, speedMbps),
              transferredMB: loadedBytes / (1024 * 1024),
              totalMB: totalBytes / (1024 * 1024),
              etaSeconds: Math.max(0, eta),
              stage: 'Uploading images to cloud storage...'
            });

            lastLoaded = loadedBytes;
            lastTime = currentTime;
          }
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadMetrics(prev => ({
              ...prev,
              progress: 100,
              stage: 'Upload complete! Processing database...'
            }));
            setTimeout(() => {
              setShowUploadHud(false);
              resolve();
            }, 1500);
          } else {
            let errorMessage = 'Failed to publish wallpaper bundle.';
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.error || errorMessage;
              if (errorData.details) {
                errorMessage += ` (${errorData.details})`;
              }
            } catch (_) {}
            setShowUploadHud(false);
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => {
          setShowUploadHud(false);
          reject(new Error('Network error during bundle upload.'));
        };

        xhr.send(formData);
      });

      if (rect) {
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { x, y },
          startVelocity: 35,
          colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b']
        });
      } else {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
      
      // Reset form
      setEditingBundleId(null);
      setBundleName('');
      setBundleDescription('');
      setBundleOrientation('landscape');
      setBundleRatio('16:9');
      setBundleType('');
      setBundleTags('');
      setBundleIncludes('');
      setMediaItems([]);

      // Navigate to My Uploads
      setActiveTab('bundles');
      setBundleFilter('mine');
      
      // Refresh bundles list
      fetchBundles();
      setActiveTab('bundles');
    } catch (error) {
      console.error('Upload failed:', error);
      let msg = error.message;
      if (msg.includes('Failed to fetch')) {
        msg = 'Failed to connect to the backend server. Please make sure your backend server is running (npm start in the backend directory).';
      }
      showToast(`Publishing failed: ${msg}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Toast Notification Element */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20, 20, 20, 0.95)',
          color: '#fff',
          padding: '12px 24px', 
          borderRadius: '8px', 
          zIndex: 9999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', 
          animation: 'toast-pop-fade 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500,
          fontSize: '0.85rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={16} color="#ef4444" /> : <CheckCircle2 size={16} color="#10b981" />}
          {toast.message}
        </div>
      )}

      {/* Sidebar backdrop overlay (all screen sizes) */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="admin-sidebar-backdrop"
        />
      )}

      <div className="admin-dashboard-container" style={{
        display: 'flex',
        minHeight: '85vh',
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        marginTop: '1rem',
        position: 'relative'
      }}>
        {/* Sidebar navigation — right-side overlay */}
        <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          {/* Close button inside sidebar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="admin-sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} style={{ color: 'var(--color-google-yellow)', flexShrink: 0 }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px', margin: 0, whiteSpace: 'nowrap' }}>Studio</h2>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', lineHeight: 1 }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, width: '100%' }}>
            <button
              onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            >
              <BarChart2 size={16} style={{ flexShrink: 0 }} />
              <span>Overview</span>
            </button>

            {!isCreatorMode && (
              <button
                onClick={() => { setActiveTab('drive'); setIsSidebarOpen(false); }}
                className={`admin-nav-item ${activeTab === 'drive' ? 'active' : ''}`}
              >
                <Folder size={16} style={{ flexShrink: 0 }} />
                <span>Google Drive</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab('bundles'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'bundles' ? 'active' : ''}`}
            >
              <HardDrive size={16} style={{ flexShrink: 0 }} />
              <span>Bundles Manager</span>
            </button>

            {!isCreatorMode && (
              <button
                onClick={() => { setActiveTab('reviews'); setIsSidebarOpen(false); fetchPendingDrops(); }}
                className={`admin-nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} style={{ flexShrink: 0 }} />
                  <span>Pending Drops</span>
                </div>
                {pendingDrops.length > 0 && (
                  <span style={{ background: 'var(--color-google-yellow)', color: '#000000', borderRadius: '9999px', padding: '0.1rem 0.55rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    {pendingDrops.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => { 
                setActiveTab('upload'); 
                setIsSidebarOpen(false); 
                setEditingBundleId(null);
                setBundleName('');
                setBundleDescription('');
                setBundleOrientation('landscape');
                setBundleRatio('16:9');
                setBundleType('');
                setBundleTags('');
                setBundleIncludes('');
                setMediaItems([]);
              }}
              className={`admin-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            >
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span>Create Bundle</span>
            </button>

            {!isCreatorMode && (
              <button
                onClick={() => { setActiveTab('monetize'); setIsSidebarOpen(false); }}
                className={`admin-nav-item ${activeTab === 'monetize' ? 'active' : ''}`}
              >
                <DollarSign size={16} style={{ flexShrink: 0 }} />
                <span>Monetization</span>
              </button>
            )}

            <button
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            >
              <User size={16} style={{ flexShrink: 0 }} />
              <span>Profile Settings</span>
            </button>
            <button
              onClick={() => { setActiveTab('subscribers'); setIsSidebarOpen(false); }}
              className={`admin-nav-item ${activeTab === 'subscribers' ? 'active' : ''}`}
            >
              <Users size={16} style={{ flexShrink: 0 }} />
              <span>Subscribers</span>
            </button>
            {!isCreatorMode && (
              <button
                onClick={() => { setActiveTab('creators'); setIsSidebarOpen(false); setSelectedCreator(null); }}
                className={`admin-nav-item ${activeTab === 'creators' ? 'active' : ''}`}
              >
                <Sparkles size={16} style={{ flexShrink: 0 }} />
                <span>Creators</span>
              </button>
            )}
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            <button onClick={onBack} className="admin-nav-item" style={{ border: '1px solid var(--border-color)' }}>
              <ArrowLeft size={16} style={{ flexShrink: 0 }} />
              <span>Back to Site</span>
            </button>
            <button onClick={logout} className="admin-nav-item logout" style={{ color: '#ef4444' }}>
              <LogOut size={16} style={{ flexShrink: 0 }} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

      {/* Main dashboard content */}
      <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              {activeTab === 'overview' && 'Command Center'}
              {activeTab === 'drive' && 'Google Drive Integration'}
              {activeTab === 'bundles' && 'Bundles Manager'}
              {activeTab === 'upload' && (editingBundleId ? 'Edit Wallpaper Bundle' : 'Publish New Bundle')}
              {activeTab === 'monetize' && 'Partner Earnings Studio'}
              {activeTab === 'profile' && 'Creator Profile Settings'}
              {activeTab === 'subscribers' && 'Subscriber List'}
              {activeTab === 'creators' && (selectedCreator ? `Creator Profile: ${selectedCreator.displayName}` : 'Creator Network')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
              {activeTab === 'overview' && 'System diagnostics, wallpaper caching and API metrics'}
              {activeTab === 'drive' && 'Linked OAuth 2.0 folders and file logs'}
              {activeTab === 'bundles' && 'List, edit, and delete active wallpaper sets'}
              {activeTab === 'upload' && 'Upload high-resolution images dynamically to your Google Drive'}
              {activeTab === 'monetize' && 'YouTube Studio-style revenue sharing, ad metrics, and CPM'}
              {activeTab === 'profile' && 'Customize display name, channel about details, brand accents and socials'}
              {activeTab === 'subscribers' && 'View your channel subscribers and community members'}
              {activeTab === 'creators' && (selectedCreator ? 'View creator drops, analytics, and manage channel' : 'Manage registered creators, message authors, or remove accounts')}
            </p>
          </div>

          {/* Right-side: status pills + hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className="admin-status-pill green" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="status-dot"></span> Auth
            </span>
            <span className={`admin-status-pill ${driveStatus?.authenticated ? 'green' : 'yellow'}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="status-dot"></span> Drive
            </span>
            {/* Hamburger — always visible, right side */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="admin-hamburger"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Stats Grid */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="stat-label">Wallpaper Bundles</span>
                <span className="stat-value">{stats.bundlesCount}</span>
                <span className="stat-sub">{isCreatorMode ? 'Your published drops' : 'Active in feed'}</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Views</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalViews)}</span>
                <span className="stat-sub">{isCreatorMode ? 'Across your drops' : 'Across all bundles'}</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Downloads</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalDownloads)}</span>
                <span className="stat-sub">{isCreatorMode ? 'Your pack downloads' : 'ZIP files processed'}</span>
              </div>
              <div className="admin-stat-card">
                <span className="stat-label">Total Likes</span>
                <span className="stat-value">{new Intl.NumberFormat().format(stats.totalLikes)}</span>
                <span className="stat-sub">{isCreatorMode ? 'Your drop upvotes' : 'Public upvotes'}</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 600 }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {isCreatorMode ? (
                  <>
                    <button 
                      onClick={() => setActiveTab('upload')} 
                      className="admin-btn primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={15} />
                      <span>+ Create Wallpaper Bundle</span>
                    </button>
                    <button 
                      onClick={() => { setActiveTab('bundles'); setBundleFilter('mine'); }} 
                      className="admin-btn secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <HardDrive size={15} />
                      <span>View My Uploads</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleRebuildCache} 
                      disabled={rebuildingCache}
                      className="admin-btn primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={15} className={rebuildingCache ? 'spin' : ''} />
                      <span>{rebuildingCache ? 'Rebuilding...' : 'Rebuild Zip Cache'}</span>
                    </button>
                    <button onClick={checkDriveStatus} className="admin-btn secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={15} />
                      <span>Refresh System Diagnostics</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-card" style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Google Drive Status</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Connection parameters of the authenticated OAuth 2.0 client</p>
                </div>
                <button 
                  onClick={checkDriveStatus} 
                  disabled={loadingDrive}
                  className="admin-btn secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem' }}
                >
                  <RefreshCw size={14} className={loadingDrive ? 'spin' : ''} />
                  <span>Check Status</span>
                </button>
              </div>

              {driveStatus ? (
                driveStatus.authenticated ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4caf50', background: 'rgba(76, 175, 80, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                      <CheckCircle2 size={18} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Successfully connected to Google Drive API using personal credentials.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Folder Name</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>{driveStatus.folderName}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folder Owner</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'block', marginTop: '0.25rem' }}>{driveStatus.owner}</span>
                      </div>
                      {driveStatus.quota && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Google Drive Account Quota</span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 600, display: 'block', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                            {(Number(driveStatus.quota.usage || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB used of {(Number(driveStatus.quota.limit || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB Total
                          </span>
                        </div>
                      )}
                      <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Folder Resource Link</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <code style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', wordBreak: 'break-all', flex: 1 }}>
                            {driveStatus.folderId}
                          </code>
                          <a
                            href={`https://drive.google.com/drive/folders/${driveStatus.folderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-btn primary"
                            style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                          >
                            Open Folder in Google Drive Web ↗
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Per-Creator Storage Usage Breakdown */}
                    {driveStatus.creatorStorage && driveStatus.creatorStorage.length > 0 && (
                      <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600 }}>Storage Usage by Creator / Admin</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {driveStatus.creatorStorage.map((creator, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                              <div>
                                <span style={{ fontWeight: 600, display: 'block' }}>{creator.name}</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{creator.email} • {creator.bundlesCount} Packs</span>
                              </div>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {(creator.totalBytes / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600 }}>Recent Uploaded Files inside Folder ({driveStatus.files.length})</h4>
                      {driveStatus.files.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {driveStatus.files.map((file) => (
                            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontWeight: 500 }}>{file.name}</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
                                <span>{(Number(file.size) / (1024 * 1024)).toFixed(2)} MB</span>
                                <span>{new Date(file.createdTime).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, fontStyle: 'italic' }}>No files found in folder yet. Crop a wallpaper on the site to trigger your first upload!</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffb300', background: 'rgba(255, 179, 0, 0.08)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                        {driveStatus.error || 'Google Drive client not authenticated.'}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                      The backend requires authorization with your Google Drive. Click below to start the single-click OAuth flow:
                    </p>
                    
                    <a 
                      href={`${API_URL}/api/auth`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="admin-btn primary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: '6px' }}
                    >
                      Authenticate Google Drive
                    </a>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div className="download-spinner-tiny" style={{ width: '20px', height: '20px' }}></div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bundles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{isCreatorMode ? 'My Wallpaper Drops' : 'Manage Wallpapers'}</h3>
              {!isCreatorMode && (
                <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => setBundleFilter('all')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: bundleFilter === 'all' ? 'var(--bg-primary)' : 'transparent',
                      color: bundleFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    All Creators ({bundles.length})
                  </button>
                  <button
                    onClick={() => setBundleFilter('mine')}
                    style={{
                      padding: '0.35rem 0.8rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: bundleFilter === 'mine' ? 'var(--bg-primary)' : 'transparent',
                      color: bundleFilter === 'mine' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    My Uploads ({myUploadedBundles.length})
                  </button>
                </div>
              )}
            </div>

            {loadingBundles ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="download-spinner-tiny" style={{ width: '20px', height: '20px' }}></div>
              </div>
            ) : (
              (isCreatorMode || bundleFilter === 'mine' 
                ? myUploadedBundles
                : bundles
              )
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
              .map((bundle) => {
                const coverIdx = bundle.coverIndex || 0;
                const wallpapersList = bundle.wallpapers || bundle.images || [];
                const coverObj = wallpapersList[coverIdx] || wallpapersList[0];
                const previewSrc = bundle.coverUrl || 
                                   (coverObj ? (coverObj.previewUrl || coverObj.url || (typeof coverObj === 'string' ? coverObj : '')) : '') ||
                                   bundle.previewUrl || 
                                   bundle.url || 
                                   'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300';
                const totalWallpapers = wallpapersList.length;

                return (
                <div 
                  key={bundle.id}  
                  className={`admin-card admin-bundle-row ${animatingDeleteId === bundle.id ? 'animating-delete' : ''}`} 
                  onClick={() => {
                    setEditingBundleId(bundle.id);
                    setBundleName(bundle.name || '');
                    setBundleDescription(bundle.description || '');
                    setBundleOrientation(bundle.orientation || 'landscape');
                    setBundleType(bundle.type || '');
                    setBundleTags((bundle.tags || []).join(', '));
                    setBundleIncludes((bundle.includes || []).join(', '));
                    setBundleRatio(bundle.ratio || (bundle.orientation === 'landscape' ? '16:9' : '9:16'));
                    setMediaItems(wallpapersList.map(img => ({ type: 'existing', data: img, id: img.url || img.previewUrl || img })));
                    setActiveTab('upload');
                  }}
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    background: 'var(--bg-primary)', 
                    borderRadius: '14px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img 
                      src={previewSrc} 
                      alt={bundle.name} 
                      style={{ 
                        width: bundle.orientation === 'portrait' ? '70px' : '150px', 
                        height: bundle.orientation === 'portrait' ? '95px' : '85px', 
                        objectFit: 'cover', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onError={(e) => { 
                        e.target.src = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300'; 
                      }}
                    />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bundle.name}</h4>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', display: 'block', marginTop: '0.35rem' }}>
                        {bundle.orientation === 'portrait' ? 'Mobile' : 'Landscape'} Wallpaper Pack • <strong style={{ color: 'var(--text-primary)' }}>{totalWallpapers} Wallpapers</strong> • Creator: <strong style={{ color: 'var(--text-primary)' }}>{bundle.author?.name || 'Unknown'}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', fontSize: '0.92rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem' }}>Views</span>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '2px', display: 'block', color: 'var(--text-primary)' }}>{bundle.stats?.views || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem' }}>Downloads</span>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '2px', display: 'block', color: 'var(--text-primary)' }}>{bundle.stats?.downloads || 0}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.85rem' }}>Likes</span>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '2px', display: 'block', color: 'var(--text-primary)' }}>{bundle.stats?.likes || 0}</span>
                      </div>
                    </div>

                    {bundle.isHero ? (
                      <span style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: 'rgba(66, 133, 244, 0.1)',
                        color: 'var(--color-google-blue)',
                        border: '1px solid rgba(66, 133, 244, 0.25)',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Check size={16} /> Pinned Hero
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetHeroBundle(bundle.id, bundle.name); }}
                        className="admin-btn secondary"
                        style={{
                          padding: '8px 14px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          transition: 'all 0.2s ease',
                          fontSize: '0.85rem'
                        }}
                      >
                        Pin as Hero
                      </button>
                    )}

                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (confirmDeleteId === bundle.id) {
                          handleDeleteBundle(bundle.id, bundle.name);
                        } else {
                          setConfirmDeleteId(bundle.id);
                          setTimeout(() => setConfirmDeleteId(null), 3000);
                        }
                      }}
                      className="admin-btn secondary"
                      style={{ 
                        padding: '8px 14px', 
                        color: confirmDeleteId === bundle.id ? '#fff' : '#ff4444', 
                        border: confirmDeleteId === bundle.id ? '1px solid #ef4444' : '1px solid rgba(255, 68, 68, 0.2)',
                        background: confirmDeleteId === bundle.id ? '#ef4444' : 'rgba(255, 68, 68, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                        fontSize: '0.85rem'
                      }}
                      onMouseEnter={(e) => { 
                        if (confirmDeleteId !== bundle.id) e.currentTarget.style.background = 'rgba(255, 68, 68, 0.12)'; 
                      }}
                      onMouseLeave={(e) => { 
                        if (confirmDeleteId !== bundle.id) e.currentTarget.style.background = 'rgba(255, 68, 68, 0.05)'; 
                      }}
                    >
                      {confirmDeleteId === bundle.id ? (
                        <>
                          <Check size={14} />
                          Confirm
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="admin-card" style={{ padding: '2rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <form onSubmit={handleSubmitBundle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Bundle Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Neon Horizon" 
                    value={bundleName} 
                    onChange={(e) => setBundleName(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Orientation *</label>
                  <CustomDropdown 
                    value={bundleOrientation} 
                    onChange={setBundleOrientation} 
                    options={[
                      { value: 'landscape', label: 'Landscape (Desktop & Wide Screen Ratio only)' },
                      { value: 'portrait', label: 'Portrait (Mobile Locked Ratio only)' }
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Native Ratio *</label>
                  {bundleRatio === 'custom' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="text" 
                        value={customRatioW} 
                        onChange={(e) => setCustomRatioW(e.target.value.replace(/[^0-9.]/g, ''))} 
                        className="admin-modal-input" 
                        style={{ width: '80px', textAlign: 'center' }} 
                        placeholder="16"
                      />
                      <span style={{ fontWeight: 'bold' }}>:</span>
                      <input 
                        type="text" 
                        value={customRatioH} 
                        onChange={(e) => setCustomRatioH(e.target.value.replace(/[^0-9.]/g, ''))} 
                        className="admin-modal-input" 
                        style={{ width: '80px', textAlign: 'center' }} 
                        placeholder="9"
                      />
                      <button 
                        type="button"
                        onClick={() => setBundleRatio(bundleOrientation === 'landscape' ? '16:9' : '9:16')}
                        style={{ 
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.5rem',
                          cursor: 'pointer',
                          marginLeft: '2px',
                          transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.15)'}
                        title="Reset to default ratio"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <CustomDropdown 
                      value={bundleRatio} 
                      onChange={setBundleRatio} 
                      options={bundleOrientation === 'landscape' ? [
                        { value: '16:9', label: '16:9 (Standard Desktop)' },
                        { value: '21:9', label: '21:9 (Ultrawide)' },
                        { value: '32:9', label: '32:9 (Super Ultrawide)' },
                        { value: '16:10', label: '16:10 (MacBook/Display)' },
                        { value: '48:9', label: '48:9 (Triple Monitor Spread)' },
                        { value: 'original', label: 'Original (Uncropped)' },
                        { value: 'custom', label: 'Custom Ratio' }
                      ] : [
                        { value: '9:16', label: '9:16 (Standard Mobile)' },
                        { value: '9:19.5', label: '9:19.5 (Tall Mobile e.g. iPhone)' },
                        { value: 'original', label: 'Original (Uncropped)' },
                        { value: 'custom', label: 'Custom Ratio' }
                      ]}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Description</label>
                <textarea 
                  rows="3" 
                  placeholder="Tell users what this wallpaper sequence is about..." 
                  value={bundleDescription} 
                  onChange={(e) => setBundleDescription(e.target.value)} 
                  className="admin-modal-input" 
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Nature, Abstract, Minimalist" 
                    value={bundleTags} 
                    onChange={(e) => setBundleTags(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Design Details (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ultra high definition mapping, Sync sequence" 
                    value={bundleIncludes} 
                    onChange={(e) => setBundleIncludes(e.target.value)} 
                    className="admin-modal-input" 
                  />
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Upload Wallpaper Images *</label>
                <div 
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    border: isDragging ? '2px dashed var(--color-google-blue)' : '2px dashed var(--border-color)',
                    borderRadius: '10px',
                    padding: '2.5rem',
                    textAlign: 'center',
                    background: isDragging ? 'rgba(66, 133, 244, 0.04)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                    transform: isDragging ? 'scale(1.01)' : 'none'
                  }}
                  className="admin-dropzone"
                >
                  <Upload size={32} style={{ color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                  <div style={{ pointerEvents: 'none' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-google-blue)' }}>Click to upload</span> or drag and drop images
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', pointerEvents: 'none' }}>Supported formats: PNG, JPG, JPEG</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    multiple 
                    accept="image/*" 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }} 
                  />
                </div>
              </div>

              {mediaItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Wallpapers in Bundle ({mediaItems.length})</span>
                  <DraggableGrid
                    items={mediaItems}
                    onChange={(newItems) => setMediaItems(newItems)}
                    keyExtractor={(item) => item.id}
                    renderItem={(item, index, isDragging) => (
                      <MediaPreviewItem 
                        item={item} 
                        index={index} 
                        removeFile={removeMediaItem} 
                        isDragged={isDragging}
                      />
                    )}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                {editingBundleId && (
                  <button 
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setActiveTab('bundles');
                      setEditingBundleId(null);
                      setMediaItems([]);
                    }}
                    className="admin-btn secondary"
                    style={{ flex: 1, padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.92rem' }}
                  >
                    Discard
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={uploading || mediaItems.length === 0}
                  className="admin-btn primary"
                  style={{ flex: 2, padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.92rem' }}
                >
                  {uploading ? (
                    <>
                      <div className="download-spinner-tiny" style={{ borderTopColor: '#000', width: '14px', height: '14px' }}></div>
                      <span>{editingBundleId ? 'Applying changes...' : 'Uploading files to Google Drive & Publishing...'}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{editingBundleId ? 'Apply Changes' : 'Publish Wallpaper Bundle'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'monetize' && (
          <MonetizationDashboard isInline={false} />
        )}

        {activeTab === 'profile' && (
          <div className="admin-profile-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center', maxWidth: '750px', margin: '0 auto', width: '100%', padding: '2rem', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }} className="admin-card profile-layout-grid admin-profile-layout">
              
              {/* Form Column */}
              <form onSubmit={handleSubmitProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }} className="admin-profile-form">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  style={{ display: 'none' }}
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }} className="admin-profile-avatar-stack">
                  <button
                    type="button"
                    onClick={openAvatarPicker}
                    className="whatsapp-avatar-container admin-profile-avatar-button"
                  >
                    <img
                      src={getProxiedImageUrl(editedPhotoURL) || AVATAR_FALLBACK_URL}
                      alt="Avatar"
                      className="admin-profile-avatar-image"
                      onError={(e) => { e.target.src = AVATAR_FALLBACK_URL; }}
                    />
                    <div className="whatsapp-avatar-overlay admin-profile-avatar-overlay">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Change photo</span>
                    </div>
                  </button>
                  <div className="admin-profile-avatar-copy">
                    <strong>Profile photo</strong>
                    <span>Crop it like WhatsApp and make sure it still sits right on both laptop and phone widths.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Display Name / Channel Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google Design Lab"
                    value={editedDisplayName}
                    onChange={(e) => setEditedDisplayName(e.target.value)}
                    className="admin-modal-input"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Channel Bio / About</label>
                  <textarea
                    rows="4"
                    placeholder="Describe your design workflow, device specialties or wallpaper style..."
                    value={editedAbout}
                    onChange={(e) => setEditedAbout(e.target.value)}
                    className="admin-modal-input"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="admin-profile-social-grid">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>YouTube Link</label>
                    <input
                      type="text"
                      placeholder="https://youtube.com/@channel"
                      value={editedYoutube}
                      onChange={(e) => setEditedYoutube(e.target.value)}
                      className="admin-modal-input"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Instagram Link</label>
                    <input
                      type="text"
                      placeholder="https://instagram.com/username"
                      value={editedInstagram}
                      onChange={(e) => setEditedInstagram(e.target.value)}
                      className="admin-modal-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Twitter / X Link</label>
                  <input
                    type="text"
                    placeholder="https://x.com/username"
                    value={editedTwitter}
                    onChange={(e) => setEditedTwitter(e.target.value)}
                    className="admin-modal-input"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Channel Banner Background Image (Horizontal)</label>
                  
                  <div 
                    onClick={() => bannerInputRef.current?.click()}
                    style={{
                      width: '100%',
                      height: '110px',
                      borderRadius: '12px',
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px dashed var(--border-color)',
                      background: editedBannerURL ? `url(${getProxiedImageUrl(editedBannerURL)}) center/cover no-repeat` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      transition: 'all 0.2s'
                    }}
                    title="Click to upload horizontal background image"
                  >
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      color: '#ffffff',
                      backdropFilter: 'blur(2px)',
                      transition: 'all 0.2s'
                    }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {uploadingBanner ? 'Uploading Banner...' : (editedBannerURL ? 'Change Horizontal Banner' : 'Upload Horizontal Banner')}
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Or paste image URL (https://...)"
                    value={editedBannerURL}
                    onChange={(e) => setEditedBannerURL(e.target.value)}
                    className="admin-modal-input"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile || uploadingAvatar || uploadingBanner}
                  className="admin-btn primary"
                  style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.92rem', marginTop: '1rem' }}
                >
                  {uploadingAvatar ? 'Uploading photo...' : savingProfile ? 'Saving Changes...' : 'Save Profile Settings'}
                </button>
              </form>

              {/* Media & Preview Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }} className="admin-profile-preview-column">

                {/* WhatsApp-style full screen cropper modal without sliders */}
                {imageSrc && (
                  <div className="cropper-container">
                    <div className="whatsapp-cropper-header">
                      <h3>Move and scale</h3>
                      <p>Drag to position • Scroll or pinch to zoom</p>
                    </div>

                    <div
                      ref={cropperRef}
                      className="cropper-canvas-wrapper"
                      onMouseDown={onCropMouseDown}
                      onTouchStart={onCropTouchStart}
                      onWheel={onCropWheel}
                    >
                      <canvas ref={canvasRef} width={AVATAR_CROP_SIZE} height={AVATAR_CROP_SIZE} />
                    </div>

                    <div className="whatsapp-cropper-actions">
                      <button
                        type="button"
                        onClick={closeCropper}
                        className="whatsapp-crop-btn cancel"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={applyCrop}
                        className="whatsapp-crop-btn done"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Card Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Live Creator Card Preview</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: 'calc(96% - 12px)', margin: '0 auto', position: 'relative' }}>
                    <div style={{
                      width: '100%',
                      height: '140px',
                      borderRadius: '12px',
                      background: editedBannerURL ? `url(${getProxiedImageUrl(editedBannerURL)}) center/cover no-repeat` : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                    }}>
                      {!editedBannerURL && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'radial-gradient(circle at 75% 30%, rgba(59, 130, 246, 0.2), transparent 65%)',
                          pointerEvents: 'none'
                        }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', padding: '0 0.5rem', marginTop: '-40px', flexWrap: 'wrap' }} className="channel-header-block">
                      <div style={{
                        position: 'relative',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '3px solid var(--bg-primary)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        background: 'var(--bg-secondary)',
                        flexShrink: 0
                      }}>
                        <img
                          src={getProxiedImageUrl(editedPhotoURL) || AVATAR_FALLBACK_URL}
                          alt="Avatar Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.src = AVATAR_FALLBACK_URL; }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, minWidth: '260px', marginTop: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>{editedDisplayName || 'Creator Name'}</h1>
                          <span className="verified-badge-circle" title="Verified Creator" style={{ width: '16px', height: '16px', background: '#3b82f6', color: '#fff', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" style={{ width: '10px', height: '10px' }}>
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                            </svg>
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{editedDisplayName ? editedDisplayName.toLowerCase().replace(/\s+/g, '') : 'creator'}</span>
                          <span>•</span>
                          <span>{userProfile?.subscribers || 0} subscribers</span>
                          <span>•</span>
                          <span>{bundles.filter(b => (user?.uid && b.author?.uid === user.uid) || (user?.email && b.author?.email === user.email)).length} wallpapers</span>
                          <span>•</span>
                          <span>{userProfile?.joined ? `Joined ${new Date(userProfile.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : 'Joined today'}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '2.5rem' }}>
                        <button style={{ 
                          background: 'transparent', 
                          color: 'var(--text-primary)', 
                          border: '1px solid var(--border-color)', 
                          padding: '0.7rem 1.5rem', 
                          borderRadius: '999px', 
                          fontSize: '0.95rem', 
                          fontWeight: 600, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px' 
                        }}>
                          <Check size={18} />
                          Subscribed
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {activeTab === 'subscribers' && (
          <div className="admin-profile-layout">
            <div className="admin-card">
              <h2 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} className="text-blue-500" /> Subscribers ({subscribersList.length})
              </h2>
              {loadingSubscribers ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading subscribers...</div>
              ) : subscribersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <Users size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                  <p>You don't have any subscribers yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {subscribersList.map(sub => (
                    <div key={sub.uid} style={{
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
                      background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)'
                    }}>
                      <img 
                        src={getProxiedImageUrl(sub.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>'} 
                        alt={sub.displayName}
                        onClick={() => setViewingSubscriberImage(getProxiedImageUrl(sub.photoURL) || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23888888"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>')}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', transition: 'transform 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.displayName || 'Subscriber'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Creators Management View */}
        {activeTab === 'creators' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selectedCreator ? (
              /* Creator Detail View (Profile & Bundles) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <button
                  onClick={() => setSelectedCreator(null)}
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <ArrowLeft size={16} /> Back to Creators List
                </button>

                {/* Creator Header Profile Card */}
                <div className="admin-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '280px' }}>
                    <img
                      src={getProxiedImageUrl(selectedCreator.photoURL) || AVATAR_FALLBACK_URL}
                      alt={selectedCreator.displayName}
                      style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-google-yellow)' }}
                      onError={(e) => { e.currentTarget.src = AVATAR_FALLBACK_URL; }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{selectedCreator.displayName}</h2>
                        <span className="admin-status-pill green" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>Curator</span>
                      </div>
                      <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        @{selectedCreator.handle || 'creator'} • {selectedCreator.email}
                      </p>
                      {selectedCreator.bio && (
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                          "{selectedCreator.bio}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Creator Stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: '10px', minWidth: '90px' }}>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-google-yellow)' }}>{selectedCreator.stats?.totalDrops || selectedCreator.bundles?.length || 0}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Drops</p>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: '10px', minWidth: '90px' }}>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-google-blue)' }}>{selectedCreator.stats?.totalViews || 0}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Views</p>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: '10px', minWidth: '90px' }}>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{selectedCreator.stats?.subscribers || 0}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Subscribers</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setMessagingCreator(selectedCreator)}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <MessageSquare size={16} /> Message
                    </button>
                    <button
                      onClick={() => setDeleteConfirmCreator(selectedCreator)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Trash2 size={16} /> Delete / Revoke
                    </button>
                  </div>
                </div>

                {/* Creator's Bundles / Wallpaper Drops Grid */}
                <div className="admin-card">
                  <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <Folder size={18} className="text-yellow-500" /> Uploaded Wallpaper Drops ({selectedCreator.bundles?.length || 0})
                  </h3>

                  {(!selectedCreator.bundles || selectedCreator.bundles.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      <Folder size={40} style={{ opacity: 0.3, margin: '0 auto 0.75rem auto' }} />
                      <p>This creator has not published any wallpaper drops yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                      {selectedCreator.bundles.map(b => (
                        <div key={b.id} style={{
                          background: 'var(--bg-secondary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)',
                          display: 'flex', flexDirection: 'column'
                        }}>
                          <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                            <img
                              src={getProxiedImageUrl(b.images?.[b.coverIndex || 0]?.previewUrl || b.images?.[0]?.url || b.coverUrl)}
                              alt={b.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', backdropFilter: 'blur(4px)' }}>
                              {b.images?.length || 0} wallpapers
                            </span>
                          </div>
                          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, justifyContent: 'space-between' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{b.name}</h4>
                              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {b.description}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <span>👁️ {b.stats?.views || 0} views</span>
                              <span>⬇️ {b.stats?.downloads || 0} downloads</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Creators List View (First Page) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Search & Header Bar */}
                <div className="admin-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Sparkles size={22} style={{ color: 'var(--color-google-yellow)' }} />
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Registered Creators ({creatorsList.length})</h2>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage authors, inspect profiles, send messages, or revoke permissions</p>
                    </div>
                  </div>

                  <div style={{ position: 'relative', minWidth: '240px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      placeholder="Search creators by name, handle or email..."
                      value={creatorSearchQuery}
                      onChange={(e) => setCreatorSearchQuery(e.target.value)}
                      style={{
                        width: '100%', padding: '0.45rem 0.85rem 0.45rem 2.2rem',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                {loadingCreators ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>Loading creator network...</div>
                ) : creatorsList.length === 0 ? (
                  <div className="admin-card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <Sparkles size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                    <h3>No Active Creators Found</h3>
                    <p style={{ fontSize: '0.88rem' }}>When users unlock Creator Status by clicking +Drop, they will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {creatorsList
                      .filter(c => 
                        !creatorSearchQuery || 
                        c.displayName?.toLowerCase().includes(creatorSearchQuery.toLowerCase()) || 
                        c.email?.toLowerCase().includes(creatorSearchQuery.toLowerCase()) ||
                        c.handle?.toLowerCase().includes(creatorSearchQuery.toLowerCase())
                      )
                      .map(creator => (
                        <div key={creator.uid} style={{
                          background: 'var(--bg-primary)', borderRadius: '14px', border: '1px solid var(--border-color)',
                          padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.1)', transition: 'transform 0.2s, border-color 0.2s'
                        }}>
                          {/* Creator Card Top Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <img
                              src={getProxiedImageUrl(creator.photoURL) || AVATAR_FALLBACK_URL}
                              alt={creator.displayName}
                              onClick={() => setSelectedCreator(creator)}
                              style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid var(--border-color)' }}
                              onError={(e) => { e.currentTarget.src = AVATAR_FALLBACK_URL; }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4
                                onClick={() => setSelectedCreator(creator)}
                                style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              >
                                {creator.displayName}
                              </h4>
                              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                @{creator.handle || 'creator'} • {creator.email}
                              </p>
                            </div>
                          </div>

                          {/* Creator Stats Row */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.6rem', borderRadius: '10px', textAlign: 'center' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-google-yellow)' }}>{creator.stats?.totalDrops || 0}</p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Drops</p>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-google-blue)' }}>{creator.stats?.totalViews || 0}</p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Views</p>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{creator.stats?.subscribers || 0}</p>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Subs</p>
                            </div>
                          </div>

                          {/* Creator Action Buttons */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                            <button
                              onClick={() => setSelectedCreator(creator)}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                                padding: '0.5rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              <Eye size={14} /> Profile & Drops
                            </button>
                            <button
                              onClick={() => setMessagingCreator(creator)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                                padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                color: 'var(--color-google-blue)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                              }}
                              title="Message Creator"
                            >
                              <MessageSquare size={14} /> Message
                            </button>
                            <button
                              onClick={() => setDeleteConfirmCreator(creator)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                              }}
                              title="Delete Creator"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin Message Modal */}
        {messagingCreator && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }} onClick={() => setMessagingCreator(null)}>
            <div style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px',
              display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={18} style={{ color: 'var(--color-google-blue)' }} /> Message {messagingCreator.displayName}
                </h3>
                <button onClick={() => setMessagingCreator(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Subject / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Creator Update / Account Feedback"
                    value={messageTitleInput}
                    onChange={(e) => setMessageTitleInput(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem 0.85rem', background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Message Body *</label>
                  <textarea
                    rows={4}
                    placeholder="Write a direct message or notification to this creator..."
                    value={messageBodyInput}
                    onChange={(e) => setMessageBodyInput(e.target.value)}
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button onClick={() => setMessagingCreator(null)} className="btn-secondary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSendMessageToCreator}
                  disabled={isSendingMessage || !messageBodyInput.trim()}
                  style={{
                    padding: '0.5rem 1.2rem', borderRadius: '8px', background: 'var(--color-google-blue)',
                    color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    opacity: (!messageBodyInput.trim() || isSendingMessage) ? 0.6 : 1
                  }}
                >
                  <Send size={15} /> {isSendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Creator Confirmation Modal */}
        {deleteConfirmCreator && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem'
          }} onClick={() => setDeleteConfirmCreator(null)}>
            <div style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              borderRadius: '20px', padding: '1.75rem', width: '100%', maxWidth: '460px',
              display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '46px', height: '46px', borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Trash2 size={22} style={{ color: '#ef4444' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Delete Creator Account</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {deleteConfirmCreator.displayName}{deleteConfirmCreator.email ? ` • ${deleteConfirmCreator.email}` : ''}
                  </p>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                  This will permanently delete this creator record and all their published wallpaper drops from the MongoDB database.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  When this user logs in again, they will return as a standard user until they click <strong style={{ color: 'var(--text-primary)' }}>+ Drop</strong> to re-register.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setDeleteConfirmCreator(null)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCreator}
                  disabled={isDeletingCreator}
                  style={{
                    padding: '0.6rem 1.35rem', borderRadius: '10px', background: '#ef4444',
                    color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem',
                    opacity: isDeletingCreator ? 0.6 : 1, boxShadow: '0 4px 16px rgba(239,68,68,0.35)'
                  }}
                >
                  <Trash2 size={16} /> {isDeletingCreator ? 'Deleting Database Entry...' : 'Delete Creator'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer HUD Floating Indicator */}
        {showUploadHud && (
          <TransferHUD
            type="upload"
            title="Publishing Wallpaper Pack"
            fileName={`${bundleName} (${mediaItems.length} files)`}
            progress={uploadMetrics.progress}
            speedMbps={uploadMetrics.speedMbps}
            transferredMB={uploadMetrics.transferredMB}
            totalMB={uploadMetrics.totalMB}
            etaSeconds={uploadMetrics.etaSeconds}
            stage={uploadMetrics.stage}
            onClose={() => setShowUploadHud(false)}
          />
        )}

        {/* Subscriber Profile Picture Viewer Modal */}
        {viewingSubscriberImage && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(5px)'
            }}
            onClick={() => setViewingSubscriberImage(null)}
          >
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setViewingSubscriberImage(null)}
                style={{
                  position: 'absolute', top: '-40px', right: '-10px',
                  background: 'none', border: 'none', color: 'white', cursor: 'pointer',
                  padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={28} />
              </button>
              <img 
                src={viewingSubscriberImage} 
                alt="Enlarged profile" 
                style={{
                  width: '320px', height: '320px',
                  borderRadius: '50%', objectFit: 'cover',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  border: '4px solid var(--border-color)'
                }} 
              />
            </div>
          </div>
        )}
        {activeTab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Pending Drop Requests ({pendingDrops.length})</h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Review wallpaper quality, aspect ratios, and send feedback notes to creators.</p>
              </div>
              <button className="admin-btn secondary" onClick={fetchPendingDrops}>
                <RefreshCw size={14} className={loadingPendingDrops ? 'spin-icon' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPendingDrops ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                <RefreshCw className="spin-icon" size={24} style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.85rem' }}>Fetching pending drops...</p>
              </div>
            ) : pendingDrops.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={36} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.05rem' }}>No Pending Drops!</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>All submitted wallpaper collections have been reviewed.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {pendingDrops.map((drop) => {
                  const coverImg = drop.images && drop.images[drop.coverIndex || 0] ? (drop.images[drop.coverIndex || 0].previewUrl || drop.images[drop.coverIndex || 0].url) : '';
                  return (
                    <div 
                      key={drop.id}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                    >
                      <div style={{ position: 'relative', height: '160px', background: '#000000', cursor: 'pointer' }} onClick={() => setReviewingDrop(drop)}>
                        {coverImg ? (
                          <img src={coverImg} alt={drop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Cover</div>
                        )}
                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.75)', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.72rem', color: '#ffffff', fontWeight: 600 }}>
                          {drop.type || 'Desktop'}
                        </div>
                      </div>

                      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>{drop.name}</h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <User size={13} />
                          <span>By {drop.author?.name || 'Creator'} ({drop.author?.email || 'N/A'})</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {drop.images?.length || 0} Wallpapers • {new Date(drop.createdAt || Date.now()).toLocaleDateString()}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="admin-btn primary" 
                            onClick={() => setReviewingDrop(drop)}
                            style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', fontWeight: 700, justifyContent: 'center', background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                          >
                            Inspect & Review Drop
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Middle Bundle Review Modal with exact BundleDetailPage Layout & Admin Feedback Controls */}
        {reviewingDrop && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ width: 'min(100%, 58rem)', maxHeight: '92vh', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
              {/* Modal Header */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Clock size={18} style={{ color: 'var(--color-google-yellow)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Reviewing Drop: {reviewingDrop.name}
                  </h3>
                </div>
                <button onClick={() => setReviewingDrop(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.35rem' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Middle Preview View (Embedded BundleDetailPage) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <BundleDetailPage
                  bundle={reviewingDrop}
                  onBack={() => setReviewingDrop(null)}
                  onOpenBundle={() => {}}
                  onOpenChannel={() => {}}
                  user={user}
                  bundles={[reviewingDrop]}
                />
              </div>

              {/* Admin Decision & Messaging Panel */}
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MessageSquare size={14} />
                    <span>Admin Feedback Message to Creator (Optional):</span>
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Type message to creator (e.g. 'Approved! Great collection' or 'Rejected: Image resolution is too low')..."
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleReviewAction(reviewingDrop.id, 'reject')}
                    disabled={submittingReview}
                    style={{ padding: '0.55rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    ❌ Reject Drop
                  </button>
                  <button
                    onClick={() => handleReviewAction(reviewingDrop.id, 'approve')}
                    disabled={submittingReview}
                    style={{ padding: '0.55rem 1.5rem', borderRadius: '10px', border: 'none', background: '#10b981', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                  >
                    ✅ Approve & Publish
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
