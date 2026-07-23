import React from 'react';
import AdminDashboard from './AdminDashboard';

export default function CreatorDashboard({ onBack, logout }) {
  return <AdminDashboard onBack={onBack} logout={logout} isCreatorMode={true} />;
}
