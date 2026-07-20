const fs = require('fs');
let content = fs.readFileSync('c:/Users/user/Desktop/El projecto/Slidepapers/frontend/src/components/AdminDashboard.jsx', 'utf8');

content = content.replace(/alert\('Profile updated successfully!'\);/g, "showToast('Profile updated successfully!', 'success');");
content = content.replace(/alert\('Failed to update profile.'\);/g, "showToast('Failed to update profile.', 'error');");
content = content.replace(/alert\('Error updating profile settings.'\);/g, "showToast('Error updating profile settings.', 'error');");
content = content.replace(/alert\(`"\$\{bundleName\}" pinned as the Home Page Hero successfully!`\);/g, "showToast(`\"${bundleName}\" pinned as the Home Page Hero successfully!`, 'success');");
content = content.replace(/alert\(`Setting hero failed: \$\{err\.message\}`\);/g, "showToast(`Setting hero failed: ${err.message}`, 'error');");
content = content.replace(/alert\('Zip Cache rebuilt successfully!'\);/g, "showToast('Zip Cache rebuilt successfully!', 'success');");
content = content.replace(/alert\('Please upload or keep at least one image.'\);/g, "showToast('Please upload or keep at least one image.', 'error');");
content = content.replace(/alert\(`Publishing failed: \$\{msg\}`\);/g, "showToast(`Publishing failed: ${msg}`, 'error');");

fs.writeFileSync('c:/Users/user/Desktop/El projecto/Slidepapers/frontend/src/components/AdminDashboard.jsx', content);
console.log('Replaced all alerts');
